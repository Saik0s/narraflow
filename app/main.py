from fastapi import Cookie, FastAPI, HTTPException, Request, Response, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from app.models import ChatMessage, ImagePrompt
from app.llm import process_chat
from app.image_gen import generate_image
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

# Serve static files
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


# Add this class after the imports
class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        try:
            response = await call_next(request)
            return response
        except Exception as e:
            logger.error(f"Error processing request: {str(e)}")
            return JSONResponse(
                status_code=500, content={"error": "An internal server error occurred"}
            )


# Add this line after creating the FastAPI app
app.add_middleware(ErrorHandlingMiddleware)


# State management (replace with database in production)
class AppState:
    def __init__(self):
        self.chat_history = []
        self.image_settings = {
            "enabled": True,
            "mode": "after_chat",
            "interval_seconds": 30,
        }
        self.theme = "light"

    def to_dict(self):
        """Convert state to dictionary for JSON serialization."""
        return {
            "chat_history": self.chat_history,
            "image_settings": self.image_settings,
            "theme": self.theme,
        }

    def from_dict(self, data: dict):
        """Load state from dictionary."""
        self.chat_history = data.get("chat_history", [])
        self.image_settings = data.get(
            "image_settings",
            {
                "enabled": True,
                "mode": "after_chat",
                "interval_seconds": 30,
            },
        )
        self.theme = data.get("theme", "light")


# Create states directory if it doesn't exist
STATES_DIR = Path("states")
STATES_DIR.mkdir(exist_ok=True)


class StateManager:
    def __init__(self):
        self.states: Dict[str, AppState] = {}
        self.current_sessions: Dict[str, str] = {}  # cookie -> password_hash

    def get_state_path(self, password: str) -> Path:
        """Get the path to the state file for a given password."""
        password_hash = hashlib.sha256(password.encode()).hexdigest()
        return STATES_DIR / f"{password_hash}.json"

    def load_state(self, password: str) -> AppState:
        """Load state from file or create new if doesn't exist."""
        state_path = self.get_state_path(password)
        if state_path.exists():
            with open(state_path, "r") as f:
                data = json.load(f)
                state = AppState()
                state.from_dict(data)
                return state
        return AppState()

    def save_state(self, password: str, state: AppState):
        """Save state to file."""
        state_path = self.get_state_path(password)
        with open(state_path, "w") as f:
            json.dump(state.to_dict(), f)

    def get_state(self, session_id: Optional[str] = None) -> AppState:
        """Get state for current session or create new."""
        if session_id and session_id in self.current_sessions:
            password_hash = self.current_sessions[session_id]
            return self.states.get(password_hash, AppState())
        return AppState()


state_manager = StateManager()


# Models
class Message(BaseModel):
    content: str
    author: Optional[str] = ""


class ImageSettings(BaseModel):
    enabled: bool
    mode: str
    interval_seconds: int


# Add this function before the routes
def extract_keywords_from_history(
    chat_history: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """Extract keywords from chat history."""
    all_keywords = []
    for message in chat_history:
        if isinstance(message, dict) and "keywords" in message:
            all_keywords.extend(message["keywords"])

    # Deduplicate keywords while preserving order
    seen = set()
    unique_keywords = []
    for keyword in all_keywords:
        key = (keyword["text"], keyword["category"])
        if key not in seen:
            seen.add(key)
            unique_keywords.append(keyword)

    return unique_keywords


# Routes
@app.get("/", response_class=HTMLResponse)
async def root(request: Request, session_id: Optional[str] = Cookie(None)):
    state = state_manager.get_state(session_id)
    return templates.TemplateResponse(
        "index.html",
        {"request": request, "initial_state": state.to_dict() if state else None},
    )




@app.post("/api/chat")
async def chat(
    request: Request,
    message: Optional[str] = Form(None),
    author: Optional[str] = Form(None),
    chat_message: Optional[ChatMessage] = None,
):
    """
    Handles chat messages from both HTMX and JSON requests
    """
    try:
        # Determine if this is an HTMX request
        is_htmx = request.headers.get("HX-Request") == "true"

        if is_htmx:
            # Get current state for history
            state = state_manager.get_state()
            # Handle HTMX form submission
            chat_data = ChatMessage(
                message=message or "",
                author=author or "",
                history=state.chat_history,  # Pass the chat history from state
                selected_keywords=[],  # Add empty keywords list for HTMX requests
            )
        else:
            # Handle JSON request
            if not chat_message:
                raise HTTPException(status_code=400, detail="Missing message data")
            chat_data = chat_message

        # Process the chat message
        response = await process_chat(chat_data)

        # Update state with new message
        state = state_manager.get_state()
        if response:
            state.chat_history.append(response)

        if is_htmx:
            # Return HTML partial for HTMX
            return templates.TemplateResponse(
                "partials/message.html", {"request": request, "message": response}
            )
        else:
            # Return JSON response
            return {"llm_response": response}

    except Exception as e:
        logger.error(f"Error processing chat message: {str(e)}")
        if is_htmx:
            return templates.TemplateResponse(
                "partials/error.html", {"request": request, "error": str(e)}
            )
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/history")
async def clear_history(request: Request):
    state = state_manager.get_state()
    state.chat_history = []
    return templates.TemplateResponse(
        "partials/messages.html", {"request": request, "messages": []}
    )






@app.post("/api/settings/image")
async def update_image_settings(settings: ImageSettings):
    state = state_manager.get_state()
    state.image_settings.update(settings.dict())
    return {"success": True}


@app.post("/api/image/generate")
async def generate_image_endpoint(prompt: ImagePrompt):
    try:
        logger.info("Processing image generation request")
        image_response = await generate_image(prompt)
        return image_response
    except Exception as e:
        logger.error(f"Error generating image: {str(e)}")
        return {"error": f"Error generating image: {str(e)}"}, 500


# New routes for state management
@app.post("/api/validate-password")
async def validate_password(
    password: str, response: Response, session_id: Optional[str] = Cookie(None)
):
    if not password:
        raise HTTPException(status_code=400, message="Password is required")

    password_hash = hashlib.sha256(password.encode()).hexdigest()

    # Generate new session ID if needed
    if not session_id:
        session_id = hashlib.sha256(os.urandom(32)).hexdigest()
        response.set_cookie(key="session_id", value=session_id)

    # Associate session with password
    state_manager.current_sessions[session_id] = password_hash

    # Load or create state
    state = state_manager.load_state(password)
    state_manager.states[password_hash] = state

    return {"status": "success"}


@app.post("/api/save-state")
async def save_state(password: str, session_id: Optional[str] = Cookie(None)):
    if not password or not session_id:
        raise HTTPException(status_code=400, message="Password and session required")

    password_hash = hashlib.sha256(password.encode()).hexdigest()
    if session_id not in state_manager.current_sessions:
        raise HTTPException(status_code=401, message="Invalid session")

    state = state_manager.states.get(password_hash)
    if not state:
        raise HTTPException(status_code=404, message="No state found")

    state_manager.save_state(password, state)
    return {"status": "success"}


@app.post("/api/load-state")
async def load_state(
    request: Request,  # Add request parameter
    password: str,
    session_id: Optional[str] = Cookie(None),
):
    if not password:
        raise HTTPException(status_code=400, message="Password is required")

    state = state_manager.load_state(password)

    # Update session
    if session_id:
        password_hash = hashlib.sha256(password.encode()).hexdigest()
        state_manager.current_sessions[session_id] = password_hash
        state_manager.states[password_hash] = state

    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,  # Add request to context
            "initial_state": state.to_dict(),
        },
    )


# Add this new route after your existing routes


@app.get("/api/images")
async def get_images():
    """
    Returns a list of available image paths from the static/images directory
    """
    images_dir = Path("static/images")
    if not images_dir.exists():
        return {"images": []}

    image_files = [
        f"/static/images/{f.name}"
        for f in images_dir.iterdir()
        if f.suffix.lower() in [".jpg", ".jpeg", ".png", ".gif"]
    ]
    return {"images": image_files}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
