import logging
from anthropic import AsyncAnthropic
import instructor
from app.models import LLMResponse, LLMKeyword, LLMMessage, NewChatMessage

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

anthropic_client = AsyncAnthropic()
client = instructor.from_anthropic(anthropic_client)


async def process_chat(chat_data: NewChatMessage) -> LLMResponse:
    """
    Process a chat message and generate a response
    """
    messages = []
    if chat_data.history:
        starting_role = "assistant" if len(chat_data.history) % 2 == 0 else "user"
        for i, msg in enumerate(chat_data.history):
            # Ensure we're working with Message objects
            if isinstance(msg, dict):
                msg = Message(**msg)
            role = "user" if (i % 2 == 0) == (starting_role == "user") else "assistant"
            messages.append({"role": role, "content": f"{msg.author}: {msg.content}"})

    # Add current message
    messages.append(
        {
            "role": "user",
            "content": f"{chat_data.author}: {chat_data.content}\n\n* selected keywords: {', '.join(chat_data.selectedKeywords)} *",
        }
    )

    system_prompt = """You are an interactive storytelling assistant. Your response must follow this exact structure:
    - messages: An array of message objects where each has:
        - author: String (can be "thoughts", "narrator", "system", or a character name)
        - content: The actual message text
    - keywords: An array of story-relevant keywords where each entry has:
        - category: One of ["action", "emotion", "object", "plot"]
        - text: The keyword text

    For messages, use:
    - "thoughts" for meta-commentary about the story
    - "narrator" for story narration
    - "system" for game mechanics or instructions
    - character names (e.g. "Alice", "Bob") for character dialogue

    Keep responses engaging and story-driven, ensuring all responses match the required structure exactly."""

    try:
        logger.info(f"Processing chat message with {len(messages)} messages")

        response = await client.messages.create(
            model="claude-3-5-sonnet-20241022",
            response_model=LLMResponse,
            system=system_prompt,
            messages=messages,
            max_tokens=4096,
        )

        logger.info("Successfully generated response structure")
        return response

    except Exception as e:
        error_msg = f"Error in process_chat: {str(e)}"
        logger.error(error_msg)
        # Return a graceful fallback response that matches the model structure
        return LLMResponse(
            messages=[
                LLMMessage(
                    author="system",
                    content="There was an error generating the story response. Please try again.",
                )
            ],
            keywords=[LLMKeyword(category="plot", text="story-interrupted")],
        )
