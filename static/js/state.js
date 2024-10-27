// Create store before Alpine loads
window.alpineStore = {
  chatHistory: [],
  imageHistory: [], 
  keywords: [],
  selectedKeywords: [],
  commandHistory: [],
  historyIndex: -1,
  isProcessing: false,
  lastImageGeneration: 0,
  currentlyEditingMessageIndex: null,
  selectedAuthor: '',
  currentInput: '',
  theme: localStorage.getItem('theme') || 'dark',
  imageSettings: {
    enabled: true,
    mode: 'after_chat',
    interval_seconds: 30
  },

  init() {
    this.loadFromStorage();
    this.applyTheme(this.theme);
  },

  loadFromStorage() {
    try {
      const savedState = localStorage.getItem('appState');
      if (savedState) {
        const parsed = JSON.parse(savedState);
        Object.assign(this, parsed);
      }
    } catch (error) {
      console.error('Failed to load state:', error);
    }
  },

  saveState() {
    try {
      localStorage.setItem('appState', JSON.stringify({
        chatHistory: this.chatHistory,
        imageHistory: this.imageHistory,
        keywords: this.keywords,
        selectedKeywords: this.selectedKeywords,
        commandHistory: this.commandHistory,
        imageSettings: this.imageSettings,
        selectedAuthor: this.selectedAuthor,
        theme: this.theme
      }));
    } catch (error) {
      console.error('Failed to save state:', error);
    }
  },

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
  },

  applyTheme(theme) {
    this.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    this.saveState();
  }
};

// Initialize Alpine store when Alpine loads
document.addEventListener('alpine:init', () => {
  Alpine.store('app', window.alpineStore);
});
