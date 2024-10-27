from fastapi import FastAPI, HTTPException, Request
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from app.models import LLMMessage, NewChatMessage, ImageGenerationRequest, Message
from app.llm import process_chat
from app.image_gen import generate_image, generate_prompt
import logging
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json
import os
import hashlib
from pathlib import Path
from starlette.middleware.base import BaseHTTPMiddleware

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Initialize templates
templates = Jinja2Templates(directory="templates")

# Serve static files
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    """Render the main page"""
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
        },
    )


@app.post("/api/chat")
async def chat(chat_message: NewChatMessage):
    try:
        logger.info(f"Received chat request: {chat_message}")

        # Ensure history is properly converted to Message objects
        validated_history = [
            Message(author=msg.author, content=msg.content)
            for msg in chat_message.history
        ]
        chat_message.history = validated_history

        response = await process_chat(chat_message)
        logger.info(f"Generated response: {response}")

        response.messages.insert(
            0,
            LLMMessage(
                author=chat_message.author,
                content=(
                    f"{chat_message.content}"
                    + (
                        f'\n\n* Selected Keywords: {", ".join(chat_message.selectedKeywords)} *'
                        if chat_message.selectedKeywords
                        else ""
                    )
                ).strip(),
            ),
        )

        return {
            "llm_response": {
                "messages": [msg.model_dump() for msg in response.messages],
                "keywords": [kw.model_dump() for kw in response.keywords],
            }
        }
    except Exception as e:
        logger.error(f"Error processing chat: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/image/generate")
async def generate_image_endpoint(imageGen: ImageGenerationRequest):
    try:
        logger.info(f"Received image generation request: {imageGen}")
        prompt = await generate_prompt(imageGen.history)
        image_response = await generate_image(prompt)
        logger.info(f"Generated image response: {image_response}")
        return image_response
    except Exception as e:
        logger.error(f"Error generating image: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/images")
async def get_images():
    """Returns a list of available image paths from the static/images directory"""
    images_dir = Path("static/images")
    if not images_dir.exists():
        return {"images": []}

    image_files = [
        f"/static/images/{f.name}" for f in images_dir.glob("*.{jpg,png,gif}")
    ]
    return {"images": image_files}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
