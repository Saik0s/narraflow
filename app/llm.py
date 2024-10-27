import os
import logging
from openai import AsyncOpenAI
import instructor
from app.models import LLMResponse, DialogEntry, Keyword
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

openai_client = AsyncOpenAI()
client = instructor.from_openai(openai_client)


async def process_chat(message: str, history: list[str]) -> LLMResponse:
    context = "\n".join(history[-5:] + [message])  # Keep last 5 messages for context

    system_prompt = """You are an interactive storytelling assistant. Your response must follow this exact structure:
    - thoughts: A brief context about the story progression (string)
    - dialog: An array of speaker/text pairs where each entry has:
        - speaker: The name of the character, "narrator", or "system"
        - text: The actual dialogue or narration text
    - keywords: An array of story-relevant keywords where each entry has:
        - category: One of ["action", "emotion", "object", "plot"]
        - text: The keyword text
        - weight: A float between 0 and 1 indicating importance

    Keep responses engaging and story-driven, ensuring all responses match the required structure exactly."""

    try:
        logger.info(f"Processing chat message with context length: {len(context)}")

        response = await client.chat.completions.create(
            model="gpt-4o",
            response_model=LLMResponse,
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": f"Generate a story response for: {context}",
                },
            ],
        )

        # Validate response structure
        try:
            response_dict = response.dict()
            logger.info("Successfully generated and validated response structure")
            return response
        except Exception as e:
            logger.error(f"Response structure validation failed: {str(e)}")
            raise ValueError("Invalid response structure from LLM")

    except Exception as e:
        error_msg = f"Error in process_chat: {str(e)}"
        logger.error(error_msg)
        # Return a graceful fallback response that matches the model structure
        return LLMResponse(
            thoughts="Sorry, I encountered an error processing your request.",
            dialog=[
                DialogEntry(
                    speaker="system",
                    text="There was an error generating the story response. Please try again.",
                )
            ],
            keywords=[Keyword(category="plot", text="story-interrupted", weight=1.0)],
        )
