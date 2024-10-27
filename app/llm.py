from anthropic import AsyncAnthropic
from app.logging_config import setup_logging
import instructor
from app.models import LLMResponse, LLMKeyword, LLMMessage, NewChatMessage
from app.utils import history_to_messages

logger = setup_logging()

anthropic_client = AsyncAnthropic()
client = instructor.from_anthropic(anthropic_client)


async def process_chat(chat_data: NewChatMessage) -> LLMResponse:
    """
    Process a chat message and generate a response
    """
    messages = history_to_messages(chat_data.history)

    # Add current message
    current_content = chat_data.content
    if chat_data.author:
        current_content = f"{chat_data.author}: {current_content}"
    messages.append(
        {
            "role": "user",
            "content": f"{current_content}\n\n* selected keywords: {', '.join(chat_data.selectedKeywords)} *",
        }
    )

    system_prompt = (
        chat_data.systemPrompt
        or "You are an interactive storytelling assistant. Continue the story. Keep responses engaging and story-driven."
    )

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
        raise e
