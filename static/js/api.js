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
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                author: author,
                history: appState.chatHistory,
                selected_keywords: selectedKeywordsArray
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            ui.appendErrorMessage(data.error);
            return;
        }

        const { llm_response } = data;

        if (llm_response) {
            ui.appendMessage(llm_response);
            if (llm_response.keywords) {
                ui.updateKeywords(llm_response.keywords);
            }

            if (appState.imageSettings.enabled && appState.imageSettings.mode === 'after_chat') {
                await generateImage();
            }
        }

    } catch (error) {
        console.error('Failed to send message:', error);
        ui.appendErrorMessage('Failed to send message. Please try again.');
    } finally {
        ui.setLoadingState(false);
    }
}

export async function generateImage() {
    if (!appState.imageSettings.enabled || Date.now() - appState.lastImageGeneration < 5000) {
        return;
    }

    try {
        const response = await fetch('/api/image/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: "Generate based on current context" })
        });

        if (!response.ok) {
            throw new Error('Failed to generate image');
        }

        const data = await response.json();
        if (data.image_url) {
            ui.updateImage(data.image_url);
            appState.lastImageGeneration = Date.now();
        }
    } catch (error) {
        console.error('Failed to generate image:', error);
    }
}
