from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.models import ChatMessage, ImagePrompt, ImageReaction
from app.llm import process_chat
from app.image_gen import generate_image, process_reaction
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Serve static files
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
async def root():
    return FileResponse("static/index.html")


@app.post("/api/chat")
async def chat_endpoint(message: ChatMessage):
    try:
        logger.info("Processing chat message")
        # Extract history messages
        history = [msg.get('content', '') for msg in message.history]
        
        # Process chat message with full history
        llm_response = await process_chat(message.message, history)
        return {"llm_response": llm_response.dict()}

    except Exception as e:
        logger.error(f"Error processing message: {str(e)}")
        return {"error": f"Error processing message: {str(e)}"}, 500


@app.post("/api/image/generate")
async def generate_image_endpoint(prompt: ImagePrompt):
    try:
        logger.info("Processing image generation request")
        image_response = await generate_image(prompt)
        return image_response
    except Exception as e:
        logger.error(f"Error generating image: {str(e)}")
        return {"error": f"Error generating image: {str(e)}"}, 500

@app.post("/api/image/reaction")
async def image_reaction(reaction: ImageReaction):
    try:
        logger.info(f"Processing image reaction: {reaction.reaction}")
        await process_reaction(reaction.image_id, reaction.reaction)
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error processing image reaction: {str(e)}")
        return {"status": "error", "message": str(e)}



if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
