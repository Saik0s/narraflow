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
        
        // Initialize state from storage
        this.loadFromStorage();
        
        // Set up theme listener
        this.setupThemeListener();
    }

    setupThemeListener() {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            this.setTheme(e.matches ? 'dark' : 'light');
        });
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

    setState(newState) {
        if (!newState) return;
        
        this.chatHistory = newState.chatHistory || [];
        this.selectedKeywords = new Set(newState.selectedKeywords || []);
        this.commandHistory = newState.commandHistory || [];
        this.imageSettings = newState.imageSettings || this.imageSettings;
        this.lastImageGeneration = newState.lastImageGeneration || 0;
        this.theme = newState.theme || this.theme;
        
        this.saveToStorage();
    }

    loadFromStorage() {
        try {
            const saved = localStorage.getItem('appState');
            if (saved) {
                this.setState(JSON.parse(saved));
            }
        } catch (error) {
            console.error('Failed to load state:', error);
        }
    }

    saveToStorage() {
        try {
            localStorage.setItem('appState', JSON.stringify(this.getState()));
        } catch (error) {
            console.error('Failed to save state:', error);
        }
    }

    clearState() {
        this.setState({
            chatHistory: [],
            selectedKeywords: [],
            commandHistory: [],
            imageSettings: {
                enabled: true,
                mode: 'after_chat',
                interval_seconds: 30
            },
            lastImageGeneration: 0
        });
        localStorage.removeItem('appState');
    }

    // Message management
    addMessage(message) {
        if (!message?.id) return;
        
        this.chatHistory = [
            ...this.chatHistory.filter(msg => msg.id !== message.id),
            message
        ];
        this.saveToStorage();
    }

    updateMessage(id, content) {
        const message = this.chatHistory.find(msg => msg.id === id);
        if (message?.messages?.[0]) {
            message.messages[0].content = content;
            this.saveToStorage();
        }
    }

    deleteMessage(id) {
        const initialLength = this.chatHistory.length;
        this.chatHistory = this.chatHistory.filter(msg => msg.id !== id);
        if (this.chatHistory.length !== initialLength) {
            this.saveToStorage();
        }
    }

    // Keyword management
    toggleKeyword(keyword) {
        if (!keyword) return;
        
        if (this.selectedKeywords.has(keyword)) {
            this.selectedKeywords.delete(keyword);
        } else {
            this.selectedKeywords.add(keyword);
        }
        this.saveToStorage();
    }

    // Settings management
    updateImageSettings(settings) {
        if (!settings) return;
        
        this.imageSettings = {
            ...this.imageSettings,
            ...settings,
            interval_seconds: settings.interval_seconds 
                ? Math.max(5, parseInt(settings.interval_seconds))
                : this.imageSettings.interval_seconds
        };
        this.saveToStorage();
    }

    setTheme(theme) {
        this.theme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        this.saveToStorage();
    }
}

export const appState = new AppState();
