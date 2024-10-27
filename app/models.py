from pydantic import BaseModel, Field
from typing import List, Literal, Optional


class LLMKeyword(BaseModel):
    category: Literal["action", "emotion", "object", "plot"] = Field(
        description="The category of the keyword. Must be one of 'action', 'emotion', 'object', or 'plot'."
    )
    text: str = Field(description="The actual keyword text.")


class LLMMessage(BaseModel):
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
    messages: List[LLMMessage] = Field(
        description="A list of message objects representing the conversation or narrative."
    )
    keywords: List[LLMKeyword] = Field(
        default=[],
        description="A list of story-relevant keywords extracted from the conversation.",
    )


class ImageData(BaseModel):
    url: str
    timestamp: int
    prompt: str


class Message(BaseModel):
    author: str
    content: str
    # Add any other fields your Message model needs
    class Config:
        from_attributes = True


class NewChatMessage(BaseModel):
    content: str
    author: str
    history: List[Message] = Field(default_factory=list)  # Updated field definition
    selectedKeywords: List[str] = Field(default_factory=list)
    systemPrompt: Optional[str] = Field(default="")

    class Config:
        from_attributes = True


class ImageGenerationRequest(BaseModel):
    history: List[Message]
    systemPrompt: Optional[str] = Field(default="")

    class Config:
        from_attributes = True


class ImageResponse(BaseModel):
    image_url: str
