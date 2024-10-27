import { appState } from './state.js';
import { ui } from './app.js';

export async function sendMessage(message, author) {
    if (!message || appState.isProcessing) return;

    appState.commandHistory.unshift(message);
    appState.historyIndex = -1;

    const selectedKeywordsArray = Array.from(appState.selectedKeywords);
    appState.selectedKeywords.clear();
    ui.keywords.innerHTML = '';

    try {
        ui.setLoadingState(true);

        // Check if using HTMX
        if (document.querySelector('[hx-post="/api/chat"]')) {
            // Let HTMX handle the request
            return;
        }

        // Handle JSON request
        const requestBody = {
            message: message,
            author: author || "",
            history: appState.chatHistory || [],
            selected_keywords: selectedKeywordsArray || []
        };

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(await response.text());
        }

        const data = await response.json();

        if (data.llm_response) {
            ui.appendMessage(data.llm_response);
            if (data.llm_response.keywords) {
                ui.updateKeywords(data.llm_response.keywords);
            }

            if (appState.imageSettings.enabled && appState.imageSettings.mode === 'after_chat') {
                await generateImage();
            }
        }

    } catch (error) {
        console.error('Failed to send message:', error);
        ui.appendErrorMessage(error.message || 'Failed to send message. Please try again.');
    } finally {
        ui.setLoadingState(false);
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
