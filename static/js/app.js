import { sendMessage, generateImage } from './api.js';

// Export API functions for use in Alpine components
window.sendMessage = sendMessage;
window.generateImage = generateImage;

// Wait for Alpine to be ready
document.addEventListener('alpine:init', () => {
  console.log('Alpine initialized');
  
  // Initialize Alpine store
  Alpine.store('app', {
    ...window.alpineStore,
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

    applyTheme(newTheme) {
      this.theme = newTheme;
      document.documentElement.setAttribute('data-theme', newTheme);
      document.body.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      this.saveState();
    }
  });
});
