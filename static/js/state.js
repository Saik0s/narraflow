export class AppState {
  constructor() {
    this.chatHistory = [];
    this.imageHistory = [];
    this.keywords = [];
    this.selectedKeywords = [];
    this.commandHistory = [];
    this.historyIndex = -1;
    this.isProcessing = false;
    this.lastImageGeneration = 0;
    this.currentlyEditingMessageIndex = null;

    // Add image settings with defaults
    this.imageSettings = {
      enabled: true,
      mode: 'after_chat', // 'after_chat', 'periodic'
      interval_seconds: 30
    };
  }

  // Add updateImageSettings method
  updateImageSettings(settings) {
    this.imageSettings = {
      ...this.imageSettings,
      ...settings
    };
    this.saveState();
  }

  loadFromStorage() {
    try {
      const savedState = localStorage.getItem('appState');
      if (savedState) {
        const parsed = JSON.parse(savedState);
        this.setState(parsed);
      }

      console.log('Loaded state:', this);
    } catch (error) {
      console.error('Failed to load state from storage:', error);
    }
  }

  setState(newState) {
    if (!newState) return;
    Object.assign(this, newState);
    this.saveState();
  }

  saveState() {
    console.log('Saving state:', this);
    try {
      localStorage.setItem('appState', JSON.stringify(this));
    } catch (error) {
      console.error('Failed to save state:', error);
    }
  }

  clearState() {
    this.chatHistory = [];
    this.selectedKeywords = [];
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

