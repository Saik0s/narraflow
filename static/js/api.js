import { appState } from './state.js';
import { ui } from './app.js';

export async function sendMessage(message, author, state) {
    if (!message) return;

    try {
        console.log('Making API request:', { message, author, state }); // Debug log
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message,
                author: author || "",
                state: state || {}
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText);
        }

        return await response.json();
    } catch (error) {
        console.error('API error:', error);
        throw error;
    }
}

export async function generateImage(state) {
    if (!appState.imageSettings.enabled ||
        Date.now() - appState.lastImageGeneration < 5000) {
        console.log('Skipping image generation - too soon or disabled');
        return;
    }

    try {
        console.log('Requesting image generation');
        const response = await fetch('/api/image/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: "Generate based on current context",
                state: state
            })
        });

        if (!response.ok) {
            throw new Error('Failed to generate image');
        }

        const data = await response.json();
        console.log('Received image response:', data);

        if (data.image_url) {
            ui.updateImage(data.image_url);
            appState.lastImageGeneration = Date.now();
            appState.saveState();
        }
    } catch (error) {
        console.error('Failed to generate image:', error);
    }
}
