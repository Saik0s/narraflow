import logging
from openai import AsyncOpenAI
import instructor
from app.models import LLMResponse, Keyword, Message

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

openai_client = AsyncOpenAI()
client = instructor.from_openai(openai_client)


async def process_chat(message: str, history: list[str]) -> LLMResponse:
    # Format history for better context
    formatted_history = []
    for msg in history[-10:]:  # Keep last 10 messages for context
        formatted_history.append(f"User: {msg}")
    formatted_history.append(f"User: {message}")

    context = "\n".join(formatted_history)

    system_prompt = """You are an interactive storytelling assistant. Your response must follow this exact structure:
    - messages: An array of message objects where each has:
        - author: String (can be "thoughts", "narrator", "system", or a character name)
        - content: The actual message text
    - keywords: An array of story-relevant keywords where each entry has:
        - category: One of ["action", "emotion", "object", "plot"]
        - text: The keyword text
        - weight: A float between 0 and 1 indicating importance

    For messages, use:
    - "thoughts" for meta-commentary about the story
    - "narrator" for story narration
    - "system" for game mechanics or instructions
    - character names (e.g. "Alice", "Bob") for character dialogue

    Keep responses engaging and story-driven, ensuring all responses match the required structure exactly."""

    try:
        logger.info(f"Processing chat message with context length: {len(context)}")

        response = await client.chat.completions.create(
            model="gpt-4",
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
            messages=[
                Message(
                    author="system",
                    content="There was an error generating the story response. Please try again.",
                )
            ],
            keywords=[Keyword(category="plot", text="story-interrupted", weight=1.0)],
        )
