export class AppState {
    constructor() {
        this.chatHistory = [];
        this.selectedKeywords = new Set();
        this.commandHistory = [];
        this.historyIndex = -1;
        this.isProcessing = false;
        this.lastImageGeneration = Date.now();
        this.imageSettings = {
            enabled: true,
            mode: 'after_chat',
            interval_seconds: 30
        };
        this.loadFromStorage();
    }

    loadFromStorage() {
        try {
            const saved = localStorage.getItem('appState');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.chatHistory = parsed.chatHistory || [];
                this.commandHistory = parsed.commandHistory || [];
                this.imageSettings = parsed.imageSettings || this.imageSettings;
                // Convert stored keywords back to Set
                this.selectedKeywords = new Set(parsed.selectedKeywords || []);
            }
        } catch (error) {
            console.error('Failed to load state:', error);
        }
    }

    saveState() {
        try {
            const state = {
                chatHistory: this.chatHistory,
                commandHistory: this.commandHistory,
                imageSettings: this.imageSettings,
                selectedKeywords: Array.from(this.selectedKeywords)
            };
            localStorage.setItem('appState', JSON.stringify(state));
            console.log('State saved successfully');
        } catch (error) {
            console.error('Failed to save state:', error);
        }
    }

    loadState() {
        try {
            const saved = localStorage.getItem('appState');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.chatHistory = parsed.chatHistory || [];
                this.commandHistory = parsed.commandHistory || [];
                this.imageSettings = parsed.imageSettings || this.imageSettings;
                this.selectedKeywords = new Set(parsed.selectedKeywords || []);
                console.log('State loaded successfully');
            }
        } catch (error) {
            console.error('Failed to load state:', error);
        }
    }

    clearState() {
        this.chatHistory = [];
        this.selectedKeywords.clear();
        this.commandHistory = [];
        this.historyIndex = -1;
        localStorage.removeItem('appState');
        console.log('State cleared successfully');
    }

    addMessage(message) {
        if (!message || !message.id) return;

        // Remove any existing message with the same ID
        this.chatHistory = this.chatHistory.filter(msg => msg.id !== message.id);

        this.chatHistory.push(message);
        this.saveState();
    }

    updateMessage(id, newContent) {
        const index = this.chatHistory.findIndex(msg => msg.id === id);
        if (index !== -1) {
            const message = this.chatHistory[index];
            if (message.messages && message.messages.length > 0) {
                message.messages[0].content = newContent;
                this.saveState();
            }
        }
    }

    deleteMessage(id) {
        const initialLength = this.chatHistory.length;
        this.chatHistory = this.chatHistory.filter(msg => msg.id !== id);
        if (this.chatHistory.length !== initialLength) {
            this.saveState();
        }
    }

    toggleKeyword(keyword) {
        if (!keyword) return;

        if (this.selectedKeywords.has(keyword)) {
            this.selectedKeywords.delete(keyword);
        } else {
            this.selectedKeywords.add(keyword);
        }
        this.saveState();
    }

    updateImageSettings(settings) {
        if (!settings) return;

        this.imageSettings = {
            ...this.imageSettings,
            ...settings,
            interval_seconds: settings.interval_seconds
                ? Math.max(5, parseInt(settings.interval_seconds))
                : this.imageSettings.interval_seconds
        };
        this.saveState();
    }

    clearState() {
        localStorage.removeItem('appState');
        this.initializeState();
    }
}

export const appState = new AppState();
