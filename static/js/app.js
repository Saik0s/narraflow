import { sendMessage, generateImage } from './api.js';

// Export API functions for use in Alpine components
window.sendMessage = sendMessage;
window.generateImage = generateImage;

document.addEventListener('alpine:init', () => {
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
    showConfigModal: false,
    config: {
      storytellerPrompt: localStorage.getItem('storytellerPrompt') || '',
      imagePrompt: localStorage.getItem('imagePrompt') || ''
    },
    currentlyEditingMessageIndex: null,
    selectedAuthor: 'narrator',
    currentInput: '',
    imageSettings: {
      enabled: true,
      mode: 'after_chat',
      interval_seconds: 10
    },
    imageObserver: null,

    init() {
      this.loadFromStorage();
      this.applyTheme(this.theme);
      this.setupAuthorSelector();
      this.renderKeywords();
      this.initImageObserver();

      // Start periodic generation if enabled
      if (this.imageSettings.enabled && this.imageSettings.mode === 'periodic') {
        this.startPeriodicImageGeneration();
      }
    },

    clearState() {
      this.chatHistory = [];
      this.imageHistory = [];
      this.keywords = [];
      this.selectedKeywords = [];
      this.currentInput = '';
      this.selectedAuthor = 'narrator';
      this.saveState();
    },

    setupAuthorSelector() {
      const authorSelector = document.getElementById('author-selector');
      if (!authorSelector) return;

      const defaultAuthors = ['narrator', 'system', '']; // '' represents 'Direct'
      defaultAuthors.forEach(author => {
        const label = document.createElement('label');
        label.className = `join-item btn btn-sm flex-1 ${author === this.selectedAuthor ? 'btn-active' : ''}`;

        const btn = document.createElement('input');
        btn.type = 'radio';
        btn.name = 'author';
        btn.value = author;
        btn.id = `author-${author || 'direct'}`;
        btn.className = 'hidden';
        btn.checked = author === this.selectedAuthor;

        label.htmlFor = btn.id;
        label.textContent = author || 'Direct';

        btn.addEventListener('change', () => {
          this.selectedAuthor = author;
          this.saveState();
          this.updateAuthorSelectorVisuals();
        });

        label.appendChild(btn);
        authorSelector.appendChild(label);
      });
    },

    updateAuthorSelector() {
      const authorSelector = document.getElementById('author-selector');

      const characters = new Set();
      this.chatHistory.forEach(msg => {
        if (msg.author && !['system', 'narrator', 'thoughts'].includes(msg.author)) {
          characters.add(msg.author);
        }
      });

      characters.forEach(character => {
        if (!authorSelector.querySelector(`input[value="${character}"]`)) {
          const label = document.createElement('label');
          label.className = `join-item btn btn-sm flex-1 ${character === this.selectedAuthor ? 'btn-active' : ''}`;

          const btn = document.createElement('input');
          btn.type = 'radio';
          btn.name = 'author';
          btn.value = character;
          btn.id = `author-${character}`;
          btn.className = 'hidden';
          btn.checked = character === this.selectedAuthor;

          label.htmlFor = btn.id;
          label.textContent = character;

          btn.addEventListener('change', () => {
            this.selectedAuthor = character;
            this.saveState();
            this.updateAuthorSelectorVisuals();
          });

          label.appendChild(btn);
          authorSelector.appendChild(label);
        }
      });
    },

    updateAuthorSelectorVisuals() {
      const authorSelector = document.getElementById('author-selector');
      if (!authorSelector) return;

      authorSelector.querySelectorAll('label').forEach(label => {
        const input = label.querySelector('input');
        if (input) {
          label.classList.toggle('btn-active', input.value === this.selectedAuthor);
        }
      });
    },


    toggleImageGeneration() {
      this.saveState();

      // Start periodic generation if enabled
      if (this.imageSettings.enabled && this.imageSettings.mode === 'periodic') {
        this.startPeriodicImageGeneration();
      }
    },

    loadFromStorage() {
      try {
        const savedState = localStorage.getItem('appState');
        if (savedState) {
          const parsed = JSON.parse(savedState);
          Object.assign(this, parsed);
          console.log('Loaded state:', parsed);
        }
        // Load config separately
        this.config.storytellerPrompt = localStorage.getItem('storytellerPrompt') || '';
        this.config.imagePrompt = localStorage.getItem('imagePrompt') || '';
      } catch (error) {
        console.error('Failed to load state:', error);
      }
    },

    openConfig() {
      this.showConfigModal = true;
    },

    closeConfig() {
      this.showConfigModal = false;
    },

    saveConfig() {
      localStorage.setItem('storytellerPrompt', this.config.storytellerPrompt);
      localStorage.setItem('imagePrompt', this.config.imagePrompt);
      this.closeConfig();
    },

    saveState() {
      try {
        console.log('Saving state:', this);
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
    },

    async handleSendMessage() {
      const author = this.selectedAuthor || 'narrator';

      if (!this.isMessageValid() || this.isProcessing) return;

      try {
        this.isProcessing = true;

        const response = await sendMessage(
          this.currentInput,
          author,
          this.chatHistory,
          this.selectedKeywords
        );

        if (response?.llm_response) {
          response.llm_response.messages.forEach(message => {
            this.chatHistory.push(message);
          });
          this.keywords = response.llm_response.keywords;
          this.selectedKeywords = [];
          this.saveState();
          this.renderKeywords();

          this.currentInput = '';
          this.updateSendButtonState();

          if (this.imageSettings.enabled &&
            this.imageSettings.mode === 'after_chat') {
            await this.handleImageGeneration();
          }

          this.updateAuthorSelector();
        }
      } catch (error) {
        console.error('Failed to send message:', error);
        this.showError('Failed to send message');
      } finally {
        this.isProcessing = false;
      }
    },

    periodicImageGenerationInterval: null,

    startPeriodicImageGeneration() {
      if (this.periodicImageGenerationInterval) return;
      this.periodicImageGenerationInterval = setInterval(() => {
        if (this.imageSettings.mode === 'after_chat') {
          this.stopPeriodicImageGeneration();
          return;
        }
        this.handleImageGeneration();
      }, this.imageSettings.interval_seconds * 1000);
    },

    stopPeriodicImageGeneration() {
      if (this.periodicImageGenerationInterval) {
        clearInterval(this.periodicImageGenerationInterval);
        this.periodicImageGenerationInterval = null;
      }
    },

    async handleImageGeneration() {
      if (!this.imageSettings.enabled) return;

      const now = Date.now();
      if (this.imageSettings.mode === 'periodic') {
        // For periodic mode, no additional checks needed
      } else if (this.imageSettings.mode === 'after_chat') {
        if (now - this.lastImageGeneration < 5000) {
          // Prevent spamming in 'after_chat' mode
          return;
        }
      }

      try {
        const response = await generateImage(this.chatHistory);
        if (response?.image_url) {
          this.imageHistory.push(response.image_url);
          this.lastImageGeneration = Date.now();;
          this.saveState();
        }
      } catch (error) {
        this.showError('Failed to generate image');
      }
    },

    renderMessages() {
      const container = document.getElementById('chat-messages');
      if (!container) return;

      container.innerHTML = '';
      this.chatHistory.forEach((message, index) => {
        const messageEl = this.createMessageElement(message, index);
        container.appendChild(messageEl);
      });

      container.scrollTop = container.scrollHeight;
    },

    createMessageElement(message, index) {
      const wrapper = document.createElement('div');
      wrapper.className = message.author.toLowerCase() === 'user' ? 'chat chat-end' : 'chat chat-start';
      wrapper.dataset.id = index;

      const header = document.createElement('div');
      header.className = 'chat-header text-xs text-base-content/40';
      header.textContent = message.author;

      const bubble = document.createElement('div');
      bubble.className = `chat-bubble ${this.getAuthorColorClass(message.author)}`;
      bubble.textContent = message.content;

      wrapper.appendChild(header);
      wrapper.appendChild(bubble);
      return wrapper;
    },

    getAuthorColorClass(author) {
      switch (author.toLowerCase()) {
        case 'thoughts':
        case 'system':
        case 'narrator':
          return 'bg-base-content/5 text-base-content/50';
        default:
          const hash = author.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
          const hue = hash % 360;
          return `bg-[hsl(${hue},10%,20%)] text-[hsl(${hue},60%,80%)]`;
      }
    },

    renderKeywords() {
      const container = document.getElementById('keywords');

      container.innerHTML = '';
      this.keywords.forEach(keyword => {
        const keywordEl = this.createKeywordElement(keyword);
        container.appendChild(keywordEl);
      });
    },

    createKeywordElement(keyword) {
      const wrapper = document.createElement('div');
      wrapper.className = 'form-control';

      const label = document.createElement('label');
      label.className = 'label cursor-pointer gap-2 bg-base-200 rounded-full px-4 py-2 hover:bg-base-300 transition-colors';

      const span = document.createElement('span');
      span.className = `label-text text-${keyword.category}`;
      span.textContent = keyword.text;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'checkbox checkbox-sm checkbox-primary';
      checkbox.checked = this.selectedKeywords.includes(keyword.text);
      checkbox.addEventListener('change', () => this.toggleKeyword(keyword.text));

      label.appendChild(span);
      label.appendChild(checkbox);
      wrapper.appendChild(label);
      return wrapper;
    },

    toggleKeyword(keywordText) {
      const index = this.selectedKeywords.indexOf(keywordText);
      if (index === -1) {
        this.selectedKeywords.push(keywordText);
      } else {
        this.selectedKeywords.splice(index, 1);
      }
      this.saveState();
      this.updateSendButtonState();
    },

    showError(message) {
      const notification = document.createElement('div');
      notification.className = 'toast toast-top toast-end';
      notification.innerHTML = `
        <div class="alert alert-error">
          <span>${message}</span>
        </div>
      `;
      document.body.appendChild(notification);
      const timeoutId = setTimeout(() => {
        if (document.body.contains(notification)) {
          notification.remove();
        }
      }, 3000);
      notification.addEventListener('click', () => {
        clearTimeout(timeoutId);
        notification.remove();
      });
    },

    isMessageValid() {
      return this.currentInput || this.selectedKeywords.length > 0;
    },

    updateSendButtonState() {
      const sendButton = document.getElementById('send-button');
      if (sendButton) {
        sendButton.disabled = !this.isMessageValid() || this.isProcessing;
      }
    },

    initImageObserver() {
      this.imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.classList.remove('lazy');
              this.imageObserver.unobserve(img);
            }
          }
        });
      }, {
        root: document.getElementById('images-container'),
        rootMargin: '50px',
        threshold: 0.1
      });
    },

    lazyLoadImages() {
      if (!this.imageObserver) {
        this.initImageObserver();
      }

      const lazyImages = document.querySelectorAll('img.lazy');
      lazyImages.forEach(img => {
        this.imageObserver.observe(img);
      });
    },
  });
});
