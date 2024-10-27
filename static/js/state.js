class AppState {
    constructor() {
        this.initializeState();
    }

    initializeState() {
        // Initialize with default values
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
    }

    loadState() {
        try {
            const savedState = localStorage.getItem('appState');
            if (!savedState) return;

            const parsedState = JSON.parse(savedState);

            // Clear current state before loading
            this.initializeState();

            // Validate and load chat history
            if (Array.isArray(parsedState.chatHistory)) {
                this.chatHistory = parsedState.chatHistory.filter(msg =>
                    msg && (msg.type === 'image' || (msg.messages && Array.isArray(msg.messages)))
                );
            }

            // Load selected keywords
            if (Array.isArray(parsedState.selectedKeywords)) {
                this.selectedKeywords = new Set(parsedState.selectedKeywords);
            }

            // Load command history
            if (Array.isArray(parsedState.commandHistory)) {
                this.commandHistory = parsedState.commandHistory;
            }

            // Load image settings
            if (parsedState.imageSettings) {
                this.imageSettings = {
                    enabled: Boolean(parsedState.imageSettings.enabled),
                    mode: ['after_chat', 'periodic', 'manual'].includes(parsedState.imageSettings.mode)
                        ? parsedState.imageSettings.mode
                        : 'after_chat',
                    interval_seconds: Math.max(5, parseInt(parsedState.imageSettings.interval_seconds) || 30)
                };
            }

            // Load other primitive values
            this.historyIndex = parseInt(parsedState.historyIndex) || -1;
            this.lastImageGeneration = parseInt(parsedState.lastImageGeneration) || Date.now();

            console.log('State loaded successfully');
        } catch (error) {
            console.error('Error loading state:', error);
            this.initializeState();
        }
    }

    saveState() {
        try {
            const stateToSave = {
                chatHistory: this.chatHistory,
                selectedKeywords: Array.from(this.selectedKeywords),
                commandHistory: this.commandHistory,
                historyIndex: this.historyIndex,
                lastImageGeneration: this.lastImageGeneration,
                imageSettings: this.imageSettings
            };
            localStorage.setItem('appState', JSON.stringify(stateToSave));
            console.log('State saved successfully');
        } catch (error) {
            console.error('Error saving state:', error);
        }
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
