from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException, Request
from fastapi.templating import Jinja2Templates
from app.logging_config import get_logger, setup_logging
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from app.models import (
    ComfyWorkflowRequest,
    ImageResponse,
    LLMMessage,
    NewChatMessage,
    ImageGenerationRequest,
)
from app.llm import process_chat
from app.image_gen import generate_image, generate_image_comfy, generate_prompt
from app.logging_config import setup_logging
import json
from app.models import AudioGenerationRequest, AudioResponse
from app.audio_gen import generate_audio
from fastapi.middleware.cors import CORSMiddleware


logger = get_logger("main")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

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
        logger.info(f"Received chat request")

        response = await process_chat(chat_message)

        logger.info(f"Generated response")

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


@app.post("/api/image/generate", response_model=ImageResponse)
async def generate_image_endpoint(imageGen: ImageGenerationRequest):
    try:
        logger.info(f"Received image generation request")
        prompt = await generate_prompt(imageGen)
        urls = await generate_image(prompt)
        logger.info(f"Generated image response")
        return ImageResponse(urls=urls, prompt=prompt.positive)
    except Exception as e:
        logger.error(f"Error generating image: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/image/comfyui", response_model=ImageResponse)
async def generate_image_endpoint(comfyGen: ComfyWorkflowRequest):
    try:
        logger.info(f"Received image generation request")
        prompt = await generate_prompt(ImageGenerationRequest(**comfyGen.model_dump()))
        workflow_json = json.dumps(comfyGen.workflow)
        workflow_json = workflow_json.replace(
            comfyGen.positivePromptPlaceholder, json.dumps(prompt.positive)[1:-1]
        )
        workflow_json = workflow_json.replace(
            comfyGen.negativePromptPlaceholder, json.dumps(prompt.negative)[1:-1]
        )
        urls = await generate_image_comfy(workflow_json)
        logger.info(f"Generated image response: {urls}")
        return ImageResponse(urls=urls, prompt=prompt.positive)
    except Exception as e:
        logger.error(f"Error generating image: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/audio/generate", response_model=AudioResponse)
async def generate_audio_endpoint(request: AudioGenerationRequest):
    return await generate_audio(request.text)


if __name__ == "__main__":
    import nest_asyncio
    from pyngrok import ngrok
    import uvicorn

    ngrok_tunnel = ngrok.connect(8000)
    print("Public URL:", ngrok_tunnel.public_url)
    nest_asyncio.apply()
    uvicorn.run(app, host="0.0.0.0", port=8000)
