export class AppState {
    constructor() {
        this.chatHistory = [];
        this.selectedKeywords = new Set();
        this.commandHistory = [];
        this.historyIndex = -1;
        this.isProcessing = false;
        this.lastImageGeneration = 0;
        this.imageSettings = {
            enabled: true,
            mode: 'after_chat',
            interval_seconds: 30
        };
        this.theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    loadState() {
        try {
            const saved = localStorage.getItem('appState');
            if (saved) {
                const state = JSON.parse(saved);
                this.setState(state);
            }
        } catch (error) {
            console.error('Failed to load state:', error);
        }
    }

    setState(newState) {
        if (!newState) return;

        this.chatHistory = newState.chatHistory || [];
        this.selectedKeywords = new Set(newState.selectedKeywords || []);
        this.commandHistory = newState.commandHistory || [];
        this.imageSettings = newState.imageSettings || this.imageSettings;
        this.lastImageGeneration = newState.lastImageGeneration || 0;
        this.theme = newState.theme || this.theme;

        this.saveState();
    }

    getState() {
        return {
            chatHistory: this.chatHistory,
            selectedKeywords: Array.from(this.selectedKeywords),
            commandHistory: this.commandHistory,
            imageSettings: this.imageSettings,
            lastImageGeneration: this.lastImageGeneration,
            theme: this.theme
        };
    }

    saveState() {
        try {
            localStorage.setItem('appState', JSON.stringify(this.getState()));
        } catch (error) {
            console.error('Failed to save state:', error);
        }
    }

    clearState() {
        this.chatHistory = [];
        this.selectedKeywords.clear();
        this.commandHistory = [];
        this.imageSettings = {
            enabled: true,
            mode: 'after_chat',
            interval_seconds: 30
        };
        this.lastImageGeneration = 0;
        localStorage.removeItem('appState');
    }

    addMessage(message) {
        if (!message?.id) return;

        this.chatHistory = [
            ...this.chatHistory.filter(msg => msg.id !== message.id),
            message
        ];
        this.saveState();
    }

    updateMessage(id, content) {
        const message = this.chatHistory.find(msg => msg.id === id);
        if (message?.messages?.[0]) {
            message.messages[0].content = content;
            this.saveState();
        }
    }

    deleteMessage(id) {
        const initialLength = this.chatHistory.length;
        this.chatHistory = this.chatHistory.filter(msg => msg.id !== id);
        if (this.chatHistory.length !== initialLength) {
            this.saveState();
        }
    }

    setTheme(theme) {
        this.theme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        document.body.setAttribute('data-theme', theme);
        this.saveState();
    }
}

// Create and export a single instance
export const appState = new AppState();
