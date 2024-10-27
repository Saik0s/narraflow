from pydantic import BaseModel
from typing import List, Optional, Literal

class DialogEntry(BaseModel):
    speaker: str
    text: str

class Keyword(BaseModel):
    category: Literal["action", "emotion", "object", "plot"]
    text: str
    weight: float

class LLMResponse(BaseModel):
    thoughts: str
    dialog: List[DialogEntry]
    keywords: List[Keyword]

class ChatMessage(BaseModel):
    message: str
    prefix: str
    history: List[dict] = []  # List of previous messages
    message_id: Optional[str] = None  # For editing/deleting specific messages

class ImagePrompt(BaseModel):
    prompt: str

class ImageResponse(BaseModel):
    image_url: str

class ImageReaction(BaseModel):
    image_id: str
    reaction: Literal["like", "dislike", "style"]

class ImageGenSettings(BaseModel):
    enabled: bool
    mode: Literal["after_chat", "periodic", "manual"]
    interval_seconds: Optional[int] = None
