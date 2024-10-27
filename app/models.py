from pydantic import BaseModel, Field
from typing import List, Optional, Literal


class Keyword(BaseModel):
    category: Literal["action", "emotion", "object", "plot"] = Field(
        description="The category of the suggested story element: "
        "'action' for potential events or character actions (e.g. 'flee', 'discover'), "
        "'emotion' for suggested emotional tones or character feelings (e.g. 'fear', 'joy'), "
        "'object' for key items or settings that could be introduced (e.g. 'ancient map', 'castle'), "
        "'plot' for possible story directions or themes (e.g. 'betrayal', 'redemption')"
    )
    text: str = Field(
        description="The suggested story element or plot development. Should be a concise, "
        "evocative word or phrase that players can use to influence the story's direction. "
        "These serve as creative prompts for the next story beat"
    )


class Message(BaseModel):
    author: str = Field(
        description="The author of the message. Can be 'thoughts' for meta-commentary, "
        "'narrator' for story narration, 'system' for game mechanics/instructions, "
        "or any character name (e.g. 'Alice', 'Bob') for character dialogue"
    )
    content: str = Field(
        description="The actual message text content. For thoughts, this is the raw thought. "
        "For other types, this is the spoken dialogue or narration"
    )


class LLMResponse(BaseModel):
    messages: List[Message] = Field(
        description="List of messages in chronological order. Each message has an author "
        "and content. The first message often sets the tone/context for the response",
        min_items=1,
    )
    keywords: List[Keyword] = Field(
        description="List of story-relevant keywords extracted from or related to the messages. "
        "Used for story continuity and theme tracking",
        default_factory=list,
    )


class ImageData(BaseModel):
    url: str
    timestamp: int
    prompt: str


class ChatMessage(BaseModel):
    message: str
    author: Optional[str] = None  # Replace prefix with optional author
    history: List[dict] = []
    selected_keywords: List[str] = []


class ImagePrompt(BaseModel):
    prompt: str


class ImageResponse(BaseModel):
    image_url: str


class ImageGenSettings(BaseModel):
    enabled: bool
    mode: Literal["after_chat", "periodic", "manual"]
    interval_seconds: Optional[int] = None
