import { sendMessage, generateImage } from './api.js';

// Export API functions for use in Alpine components
window.sendMessage = sendMessage;
window.generateImage = generateImage;

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
    },

    async handleSendMessage() {
      const content = this.currentInput.trim();
      const author = this.selectedAuthor;

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

          this.currentInput = '';
          this.updateSendButtonState();

          if (this.imageSettings.enabled &&
            this.imageSettings.mode === 'after_chat') {
            await this.handleImageGeneration();
          }
        }
      } catch (error) {
        console.error('Failed to send message:', error);
        this.showError('Failed to send message');
      } finally {
        this.isProcessing = false;
      }
    },

    async handleImageGeneration() {
      if (!this.imageSettings.enabled ||
        Date.now() - this.lastImageGeneration < 5000) {
        return;
      }

      try {
        const response = await generateImage(this.chatHistory);
        if (response?.image_url) {
          this.imageHistory.push(response.image_url);
          this.lastImageGeneration = Date.now();
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
          return 'bg-base/5 text-base-content/50';
        default:
          const hash = author.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
          const hue = hash % 360;
          return `bg-[hsl(${hue},10%,20%)] text-[hsl(${hue},60%,80%)]`;
      }
    },

    renderKeywords() {
      const container = document.getElementById('keywords');
      if (!container) return;

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

    toggleKeyword(keyword) {
      const index = this.selectedKeywords.indexOf(keyword);
      if (index === -1) {
        this.selectedKeywords.push(keyword);
      } else {
        this.selectedKeywords.splice(index, 1);
      }
      this.saveState();
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
    }
  });
});
