import os
import logging
import asyncio
import fal_client
from app.models import ImagePrompt, ImageResponse

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def generate_image(prompt: ImagePrompt) -> ImageResponse:
    """Generate an image using Fal.ai FLUX API with progress tracking"""
    try:
        logger.info(f"Generating image with prompt: {prompt.prompt}")

        # Subscribe to real-time updates with new model
        result = await fal_client.subscribe_async(
            "fal-ai/flux/schnell",
            arguments={
                "prompt": prompt.prompt,
            },
        )

        if not result or "images" not in result:
            raise ValueError("Invalid response from Fal.ai API")

        image_url = result["images"][0]["url"]
        logger.info("Successfully generated image")

        return ImageResponse(image_url=image_url)

    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error generating image: {error_msg}")
        return ImageResponse(
            image_url="https://via.placeholder.com/512x512.png?text=Error+Generating+Image"
        )
