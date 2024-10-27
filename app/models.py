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

class ImageData(BaseModel):
    url: str
    timestamp: int
    prompt: str

class ChatMessage(BaseModel):
    message: str
    prefix: str
    history: List[dict] = []  # List of previous messages and images
    selected_keywords: List[str] = []

class ImagePrompt(BaseModel):
    prompt: str

class ImageResponse(BaseModel):
    image_url: str

class ImageGenSettings(BaseModel):
    enabled: bool
    mode: Literal["after_chat", "periodic", "manual"]
    interval_seconds: Optional[int] = None
