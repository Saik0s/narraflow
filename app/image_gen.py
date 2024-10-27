import fal_client
from app.logging_config import get_logger, setup_logging
import instructor
from anthropic import AsyncAnthropic
from typing import List
import json
import subprocess
import uuid
from pathlib import Path
import os
from minio import Minio
from minio.error import S3Error
from datetime import timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
import aiohttp
import asyncio
from pydantic import BaseModel, Field
from app.models import ComfyWorkflowRequest, ImageResponse, ImageGenerationRequest
from app.utils import history_to_messages

logger = get_logger("image_gen")

# Add MinIO client initialization at module level
minio_client = Minio(
    os.getenv("MINIO_ENDPOINT", "minio:9000"),
    access_key=os.getenv("MINIO_ACCESS_KEY"),
    secret_key=os.getenv("MINIO_SECRET_KEY"),
    secure=True,
)
bucket_name = os.getenv("MINIO_BUCKET_NAME", "image-files")

class ImagePrompt(BaseModel):
    """Structure for generating image prompts"""

    positive: str = Field(..., description="Positive prompt")
    negative: str = Field(..., description="Negative prompt")


class ImagePromptDetails(BaseModel):
    """Structure for generating detailed image prompts"""

    style: str = Field(
        ...,
        description="Overall image style, genre, or artistic technique (e.g. photorealistic, oil painting, digital art, anime, film noir)",
    )
    characters: str = Field(
        ...,
        description="Comprehensive description of main characters, including age, gender, ethnicity, body type, height, weight, hair color and style, eye color, skin tone, facial features, and any distinguishing marks or characteristics",
    )
    clothing_and_accessories: str = Field(
        ...,
        description="Detailed description of characters' attire, including fabric types, colors, patterns, fit, and style. Include all accessories such as jewelry, hats, glasses, or props",
    )
    expressions_and_poses: str = Field(
        ...,
        description="Vivid description of characters' facial expressions, body language, gestures, and specific poses or actions. Include emotional states and interactions between characters if applicable",
    )
    scene: str = Field(
        ...,
        description="Thorough depiction of the setting, including time of day, season, weather, architectural details, natural elements, and any significant objects or props in the environment",
    )
    lighting: str = Field(
        ...,
        description="Precise description of lighting conditions, including source (natural or artificial), intensity, color temperature, shadows, highlights, and any special lighting effects",
    )
    camera: str = Field(
        ...,
        description="Specific camera details including angle (e.g. low angle, bird's eye view), shot type (e.g. close-up, wide shot), lens used (e.g. wide-angle, telephoto), depth of field, and any camera movements",
    )
    additional_details: str = Field(
        ...,
        description="Any extra visual elements, textures, colors, or specific details to enhance the image. Include atmosphere, mood, or thematic elements",
    )
    negative_prompt: str = Field(
        ...,
        description="List of elements to avoid including in the image, such as specific objects, styles, or characteristics",
    )

    def to_prompt(self) -> ImagePrompt:
        """Convert the structured prompt to a detailed, cohesive string"""
        positive_prompt = (
            f"{self.style} featuring {self.characters}. "
            f"{self.clothing_and_accessories}. "
            f"{self.expressions_and_poses}. "
            f"{self.scene}. "
            f"{self.lighting}. "
            f"{self.camera}. "
            f"{self.additional_details}."
        )
        return ImagePrompt(positive=positive_prompt, negative=self.negative_prompt)


# Initialize Anthropic client with instructor
client = instructor.from_anthropic(AsyncAnthropic())


async def generate_prompt(imageGen: ImageGenerationRequest) -> ImagePrompt:
    """Generate an image prompt from chat history and image history"""
    try:
        # Format messages for Claude
        messages = history_to_messages(imageGen.history)

        # Add context about previous images if available
        image_context = ""
        if imageGen.imageHistory:
            recent_images = imageGen.imageHistory[-3:]  # Get last 3 images
            image_context = "\nRecent image prompts:\n" + "\n".join(
                f"- {img['prompt']}" for img in recent_images
            )

        system_prompt = (
            imageGen.systemPrompt
            or "You are an expert at creating vivid image generation prompts. "
            "Analyze the conversation and create a prompt that captures the latest "
            "significant story development. Focus on visual elements and maintain "
            "a consistent style with previous images if available."
        )

        # Add image context to system prompt if available
        if image_context:
            system_prompt += image_context

        prompt = await client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=1024,
            system=system_prompt,
            messages=messages,
            response_model=ImagePromptDetails,
        )

        logger.info(
            f"Generated structured prompt: {prompt.to_prompt().model_dump_json(include=2)}"
        )
        return prompt.to_prompt()

    except Exception as e:
        logger.error(f"Error generating prompt: {e}")
        return "Placeholder image"


async def upload_to_minio(file_path: str) -> str:
    """Upload file to MinIO and return presigned URL"""
    try:
        file_extension = os.path.splitext(os.path.basename(file_path))[1]
        unique_file_name = f"{uuid.uuid4()}{file_extension}"

        minio_client.fput_object(bucket_name, unique_file_name, file_path)
        url = minio_client.presigned_get_object(bucket_name, unique_file_name)
        logger.info(f"Successfully uploaded image to MinIO: {unique_file_name}")
        return url
    except S3Error as e:
        logger.error(f"MinIO upload error: {e}")
        raise


async def download_image(url: str, temp_path: str) -> None:
    """Download image from URL to temporary file"""
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            if response.status == 200:
                with open(temp_path, "wb") as f:
                    f.write(await response.read())
            else:
                raise Exception(f"Failed to download image: {response.status}")


async def generate_image(prompt: ImagePrompt) -> List[str]:
    """Generate an image using Fal.ai FLUX API and upload to MinIO"""
    try:
        logger.info(f"Generating image with prompt: {prompt}")

        result = await fal_client.subscribe_async(
            "fal-ai/flux/schnell",
            arguments={
                "prompt": prompt.positive,
            },
        )

        if not result or "images" not in result:
            raise ValueError("Invalid response from Fal.ai API")

        # Download images and upload to MinIO
        minio_urls = []
        for img in result["images"]:
            # Create temporary file
            temp_path = f"/tmp/{uuid.uuid4()}.png"
            try:
                # Download image
                await download_image(img["url"], temp_path)

                # Upload to MinIO
                minio_url = await upload_to_minio(temp_path)
                minio_urls.append(minio_url)
            finally:
                # Cleanup temporary file
                if os.path.exists(temp_path):
                    os.remove(temp_path)

        logger.info(f"Successfully processed {len(minio_urls)} images")
        return minio_urls

    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error generating image: {error_msg}")
        raise e


async def generate_image_comfy(workflow: str) -> ImageResponse:
    """Generate images using ComfyUI workflow and return MinIO URLs"""
    logger.info("Starting ComfyUI workflow image generation")

    def run_workflow(workflow_path: str) -> List[str]:
        logger.info(f"Starting inference with workflow: {workflow_path}")
        cmd = f"comfy run --workflow {workflow_path} --wait --timeout 1200 --port {os.getenv('COMFYUI_PORT', '8188')} --host {os.getenv('COMFYUI_HOST', '0.0.0.0')} --verbose"
        try:
            result = subprocess.run(
                cmd, shell=True, check=True, capture_output=True, text=True
            )
            logger.info("Inference completed successfully")
            logger.info(f"Subprocess stdout:\n{result.stdout}")
        except subprocess.CalledProcessError as e:
            logger.error(f"Inference failed: {e}")
            logger.error(f"Subprocess stderr:\n{e.stderr}")
            raise

        output_dir = "/workspace/ComfyUI/output"
        logger.info(f"Searching for output images in: {output_dir}")

        image_paths = []
        for root, dirs, files in os.walk(output_dir):
            for file in files:
                if file.lower().endswith(".png"):
                    full_path = os.path.join(root, file)
                    image_paths.append(full_path)
                    logger.info(f"Found output image: {full_path}")

        logger.info(f"Total output images found: {len(image_paths)}")
        return image_paths
        pass

    try:
        # Save workflow to temporary file
        workflow_file = f"/tmp/workflow_{uuid.uuid4()}.json"
        with open(workflow_file, "w") as f:
            f.write(workflow)

        # Run workflow and get image paths
        image_paths = run_workflow(workflow_file)

        # Upload images to MinIO in parallel
        urls = []
        for path in image_paths:
            try:
                url = await upload_to_minio(path)
                urls.append(url)
            except Exception as e:
                logger.error(f"Failed to upload image: {e}")

        # Cleanup temporary files
        for path in image_paths:
            try:
                os.remove(path)
            except Exception as e:
                logger.error(f"Failed to delete temporary file {path}: {e}")
        os.remove(workflow_file)

        return urls

    except Exception as e:
        logger.error(f"Error in ComfyUI workflow processing: {e}")
        raise
