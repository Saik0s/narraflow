import logging
from openai import AsyncOpenAI
import instructor
from app.models import LLMResponse, Keyword, Message, ChatMessage

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

openai_client = AsyncOpenAI()
client = instructor.from_openai(openai_client)


async def process_chat(chat_data: ChatMessage) -> LLMResponse:
    """
    Process a chat message and generate a response

    Args:
        chat_data: ChatMessage object containing message, author, history, and selected keywords

    Returns:
        LLMResponse object containing messages and keywords
    """
    # Format history for better context
    formatted_history = []
    if chat_data.history:
        for msg in chat_data.history[-10:]:  # Keep last 10 messages for context
            if isinstance(msg, dict) and "messages" in msg:
                for submsg in msg["messages"]:
                    formatted_history.append(
                        f"{submsg.get('author', 'User')}: {submsg.get('content', '')}"
                    )

    # Add current message
    current_msg = (
        f"{chat_data.author + ': ' if chat_data.author else ''}{chat_data.message}"
    )
    formatted_history.append(current_msg)

    # Add selected keywords if any
    if chat_data.selected_keywords:
        formatted_history.append(
            f"Selected keywords: {', '.join(chat_data.selected_keywords)}"
        )

    context = "\n".join(formatted_history)

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
            keywords=[Keyword(category="plot", text="story-interrupted")],
        )
