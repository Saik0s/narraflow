from pydantic import BaseModel, Field
from typing import List, Literal, Optional


class LLMKeyword(BaseModel):
    category: Literal["event", "atmosphere", "entity", "theme", "style", "meta"] = (
        Field(
            description="Category of potential future story elements. 'event' for significant occurrences or plot points, "
            "'atmosphere' for mood, tone, or setting shifts, 'entity' for characters, objects, or concepts that could become important, "
            "'theme' for underlying ideas or motifs to explore, 'style' for narrative techniques or genre shifts, "
            "'meta' for story structure, pacing, or fourth-wall-breaking elements."
        )
    )
    text: str = Field(
        description="A creative story element for the potential future. Should be unexpected "
        "yet fitting, offering original, WOW, and surprising directions for the narrative. 5 words max."
    )


class LLMMessage(BaseModel):
    author: str = Field(
        description="Any character name (e.g. 'Alice', 'Bob') for character dialogue, or can be 'thoughts' for meta-commentary and chain of thought, "
        "or 'narrator' for story narration without any quotes, or 'system' for llm errors and important messages."
    )
    content: str = Field(
        description="The actual message text content. For thoughts, this is a raw chain of thought that led to particular story development."
        "For the super rare system messages this is llm specific report about problems"
        "For other types, this is the spoken dialogue or narration"
    )


class LLMResponse(BaseModel):
    messages: List[LLMMessage] = Field(
        description="A non empty list of new messages that continue the story. Each message represents a distinct narrative element, such as character dialogue, narration, or internal thoughts, advancing the plot or developing characters."
    )
    keywords: List[LLMKeyword] = Field(
        default=[],
        description="A diverse list of things that did not happen yet, but can possibly happen in the nearest future. Should provide a variety of very different, unique and surprising ideas for story development.",
    )


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
    imageHistory: List[dict] = Field(default_factory=list)
    systemPrompt: Optional[str] = Field(default="")

    class Config:
        from_attributes = True


class ComfyWorkflowRequest(BaseModel):
    workflow: dict = Field(..., description="ComfyUI workflow configuration")
    history: List[Message]
    imageHistory: List[dict] = Field(default_factory=list)
    systemPrompt: Optional[str] = Field(default="")
    positivePromptPlaceholder: Optional[str] = Field(
        default="String to replace with positive prompt in the workflow"
    )
    negativePromptPlaceholder: Optional[str] = Field(
        default="String to replace with negative prompt in the workflow"
    )

    class Config:
        from_attributes = True


class ImageResponse(BaseModel):
    urls: list[str] = Field(description="List of generated image URLs")
    prompt: str = Field(description="The prompt used to generate the images")


class AudioGenerationRequest(BaseModel):
    text: str


class AudioResponse(BaseModel):
    url: str
