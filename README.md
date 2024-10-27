# NarraFlow

A web application that enables interactive storytelling with real-time AI-generated illustrations, featuring a chat interface and dynamic keyword suggestions.

## Core Features
- Chat-based story interaction
- Real-time AI image generation
- Dynamic keyword suggestions
- Multiple interaction modes (character, narrator, system)

## Technical Stack

- HTML5, CSS3, JavaScript (vanilla)
- FastAPI
- Python 3.11+

## External Services
- LLM API (generic interface)
- Image Generation API (generic interface)

## Functional Requirements

### Message Input System
- Smart prefix commands:
  - `@character_name` - Character dialogue
  - `>` - Narrator text
  - `/` - System commands
  - `*` - Character thoughts
- Auto-completion for character names
- Command history (up/down arrows)

### LLM Integration
- Input: Current chat history + user message
- Output: JSON response containing:
```json
{
    "thoughts": "string",
    "dialog": [{
        "speaker": "string",
        "text": "string"
    }],
    "keywords": [
        {
            "category": "action|emotion|object|plot",
            "text": "string",
            "weight": float
        }
    ]
}

### Image Generation Loop
- Triggers: New chat messages
- Process:
  1. Generate prompt from recent messages
  2. Send to image API
  3. Display result
  4. Repeat
- Image reaction system:
  - 👍 More like this
  - 👎 Less like this
  - 🎨 Change style

### Keyword System
- Categories:
  - Actions (red)
  - Emotions (blue)
  - Objects/Environment (green)
  - Plot twists (purple)
- Multiple selection allowed
- Preview effect on hover
- Auto-updates with each LLM response

## API Endpoints

### FastAPI Routes
```python
POST /api/chat
- Input: {"message": str, "prefix": str}
- Output: LLM response JSON

POST /api/image
- Input: {"prompt": str}
- Output: {"image_url": str}
```

## Data Flow

### Message Flow
1. User inputs message
2. Frontend adds prefix if needed
3. Backend sends to LLM
4. Response parsed and displayed
5. Keywords updated
6. Image generation triggered

### Image Generation Flow
1. Monitor chat updates
2. Generate prompt
3. Request image
4. Display in chat
5. Collect feedback
6. Adjust future prompts

## MVP Limitations

### Scope Restrictions
- No user accounts
- Client side persistance
- No branching storylines
- No custom API configurations via UI
- Single active story at a time

### Technical Limitations
- Basic error handling
- No message editing
- No image history
- No custom styling options
- No voice input
- No gesture controls

## Future Considerations

### Planned Extensions
- Voice input with prefix recognition
- Gesture shortcuts
- Character emotion indicators
- Story branching
- Context management
- User accounts
- Story templates

## Development Priorities

### Phase 1
1. Basic chat interface
2. Prefix command system
3. LLM integration
4. Keyword display

### Phase 2
1. Image generation integration
2. Mobile layout
3. Keyword categories

### Phase 3
1. Image reactions
2. Command auto-complete
3. Preview effects
4. UI polish
