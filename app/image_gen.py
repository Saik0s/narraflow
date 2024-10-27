import logging
import fal_client
import instructor
from anthropic import AsyncAnthropic
from typing import List
from pydantic import BaseModel, Field
from app.models import ImageResponse, ImageGenerationRequest
from app.utils import history_to_messages

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ImagePrompt(BaseModel):
    """Structure for generating image prompts"""

    main_scene: str = Field(..., description="The main scene or action to be depicted")
    style: str = Field(..., description="The artistic style and mood of the image")
    details: str = Field(..., description="Additional visual details and elements")

    def to_prompt(self) -> str:
        """Convert the structured prompt to a string"""
        return f"{self.main_scene}. {self.style}. {self.details}"


# Initialize Anthropic client with instructor
client = instructor.from_anthropic(AsyncAnthropic())


async def generate_prompt(imageGen: ImageGenerationRequest) -> str:
    """Generate an image prompt from chat history"""
    try:
        # Format messages for Claude
        messages = history_to_messages(imageGen.history)

        system_prompt = (
            imageGen.systemPrompt
            or "You are an expert at creating vivid image generation prompts. Analyze the conversation and create a prompt that captures the latest significant story development. Focus on visual elements and maintain a consistent style."
        )

        prompt = await client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=1024,
            system=system_prompt,
            messages=messages,
            response_model=ImagePrompt,
        )

        logger.info(f"Generated structured prompt: {prompt}")
        return prompt.to_prompt()

    except Exception as e:
        logger.error(f"Error generating prompt: {e}")
        return "Placeholder image"


async def generate_image(prompt: str) -> ImageResponse:
    """Generate an image using Fal.ai FLUX API with progress tracking"""
    try:
        logger.info(f"Generating image with prompt: {prompt}")

        # Subscribe to real-time updates with new model
        result = await fal_client.subscribe_async(
            "fal-ai/flux/schnell",
            arguments={
                "prompt": prompt,
            },
        )

        if not result or "images" not in result:
            raise ValueError("Invalid response from Fal.ai API")

        # Extract all image URLs from the result
        image_urls = [img["url"] for img in result["images"]]
        logger.info(f"Successfully generated {len(image_urls)} images")

        return ImageResponse(urls=image_urls, prompt=prompt)

    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error generating image: {error_msg}")
        raise e
