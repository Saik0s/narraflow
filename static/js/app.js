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
    audioCache: new Map(),
    audioPlayers: new Map(), // Track audio elements and their states
    commandHistory: [],
    historyIndex: -1,
    isProcessing: false,
    lastImageGeneration: 0,
    showConfigModal: false,
    config: {
      storytellerPrompt: localStorage.getItem('storytellerPrompt') || '',
      imagePrompt: localStorage.getItem('imagePrompt') || '',
      comfyWorkflow: localStorage.getItem('comfyWorkflow') || '{\n  \n}',
      positivePromptPlaceholder: localStorage.getItem('positivePromptPlaceholder') || '{positive_prompt}',
      negativePromptPlaceholder: localStorage.getItem('negativePromptPlaceholder') || '{negative_prompt}',
      savedConfigs: JSON.parse(localStorage.getItem('savedConfigs')) || [],
      selectedConfigIndex: -1
    },
    currentlyEditingMessageIndex: null,
    editingContent: '',

    startEditing(index) {
      this.currentlyEditingMessageIndex = index;
      this.editingContent = this.chatHistory[index].content;
      // Focus the textarea after it's rendered
      this.$nextTick(() => {
        const textarea = document.querySelector('.chat [data-id="' + index + '"] textarea');
        if (textarea) {
          textarea.focus();
        }
      });
    },

    saveEdit() {
      if (this.currentlyEditingMessageIndex === null) return;

      // Trim the content and check if it's not empty
      const trimmedContent = this.editingContent.trim();
      if (!trimmedContent) {
        this.cancelEdit();
        return;
      }

      // Update the message
      this.chatHistory[this.currentlyEditingMessageIndex].content = trimmedContent;

      // Reset editing state
      this.currentlyEditingMessageIndex = null;
      this.editingContent = '';

      // Save to storage
      this.saveState();
    },

    cancelEdit() {
      this.currentlyEditingMessageIndex = null;
      this.editingContent = '';
    },
    selectedAuthor: 'narrator',
    currentInput: '',
    imageSettings: {
      enabled: true,
      mode: 'after_chat',
      interval_seconds: 10
    },
    selectedImage: null,

    imageGenerationMode: localStorage.getItem('imageGenerationMode') || 'regular',

    init() {
      this.loadFromStorage();
      window.editor.setValue(this.config.comfyWorkflow);
      this.applyTheme(this.theme);
      this.setupAuthorSelector();
      this.renderKeywords();

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

    deleteMessage(index) {
      this.chatHistory.splice(index, 1);
      this.saveState();
    },

    deleteImage(index) {
      this.imageHistory.splice(index, 1);
      this.saveState();
      // Dispatch custom event when images are updated
      window.dispatchEvent(new CustomEvent('images-changed'));
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

    toggleImageMode(mode) {
      this.imageGenerationMode = mode;
      localStorage.setItem('imageGenerationMode', mode);
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
        this.config.comfyWorkflow = localStorage.getItem('comfyWorkflow') || '';
        this.config.positivePromptPlaceholder = localStorage.getItem('positivePromptPlaceholder') || '';
        this.config.negativePromptPlaceholder = localStorage.getItem('negativePromptPlaceholder') || '';
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

    openImageModal(image) {
      this.selectedImage = image;
      document.body.style.overflow = 'hidden';
    },

    closeImageModal() {
      this.selectedImage = null;
      document.body.style.overflow = 'auto';
    },

    saveConfig() {
      this.config.comfyWorkflow = window.editor.getValue();
      localStorage.setItem('storytellerPrompt', this.config.storytellerPrompt);
      localStorage.setItem('imagePrompt', this.config.imagePrompt);
      localStorage.setItem('comfyWorkflow', this.config.comfyWorkflow);
      localStorage.setItem('positivePromptPlaceholder', this.config.positivePromptPlaceholder);
      localStorage.setItem('negativePromptPlaceholder', this.config.negativePromptPlaceholder);
      this.closeConfig();
    },

    addNewConfig() {
      this.config.comfyWorkflow = window.editor.getValue();
      const nextConfigNum = this.config.savedConfigs.length + 1;
      const newConfig = {
        id: nextConfigNum,
        name: `Configuration ${nextConfigNum}`,
        storytellerPrompt: this.config.storytellerPrompt,
        imagePrompt: this.config.imagePrompt,
        comfyWorkflow: this.config.comfyWorkflow,
        positivePromptPlaceholder: this.config.positivePromptPlaceholder,
        negativePromptPlaceholder: this.config.negativePromptPlaceholder
      };

      this.config.savedConfigs.push(newConfig);
      localStorage.setItem('savedConfigs', JSON.stringify(this.config.savedConfigs));
      this.config.selectedConfigIndex = this.config.savedConfigs.length - 1;
    },

    loadConfig() {
      if (this.config.selectedConfigIndex >= 0) {
        const selectedConfig = this.config.savedConfigs[this.config.selectedConfigIndex];
        if (selectedConfig) {
          this.config.storytellerPrompt = selectedConfig.storytellerPrompt;
          this.config.imagePrompt = selectedConfig.imagePrompt;
          this.config.positivePromptPlaceholder = selectedConfig.positivePromptPlaceholder;
          this.config.negativePromptPlaceholder = selectedConfig.negativePromptPlaceholder;

          try {
            const parsed = JSON.parse(selectedConfig.comfyWorkflow);
            this.config.comfyWorkflow = JSON.stringify(parsed, null, 2);
            window.editor.setValue(this.config.comfyWorkflow);
          } catch (e) {
            this.showError('Invalid JSON');
            window.editor.setValue("{}");
          }
        }
      }
    },

    formatWorkflow() {
      this.config.comfyWorkflow = window.editor.getValue();
      try {
        const parsed = JSON.parse(this.config.comfyWorkflow);
        this.config.comfyWorkflow = JSON.stringify(parsed, null, 2);
        window.editor.setValue(this.config.comfyWorkflow);
      } catch (e) {
        this.showError('Invalid JSON');
      }
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
          this.scrollChatToBottom();
        }
      } catch (error) {
        console.error('Failed to send message:', error);
        this.showError('Failed to send message');
      } finally {
        this.isProcessing = false;
      }
    },

    scrollChatToBottom() {
      const container = document.getElementById('chat-messages');
      if (container) {
        container.scrollTop = container.scrollHeight;
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
        const response = await generateImage(this.chatHistory, this.imageHistory);
        if (response?.urls && response.urls.length > 0) {
          // Store each image URL along with its prompt
          response.urls.forEach(url => {
            this.imageHistory.push({
              url: url,
              prompt: response.prompt,
              timestamp: Date.now()
            });
          });
          this.lastImageGeneration = Date.now();
          this.saveState();
          // Dispatch custom event when images are updated
          window.dispatchEvent(new CustomEvent('images-changed'));
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

    showSuccess(message) {
      const notification = document.createElement('div');
      notification.className = 'toast toast-top toast-end';
      notification.innerHTML = `
        <div class="alert alert-success">
          <span>${message}</span>
        </div>
      `;
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 3000);
    },

    exportConfig() {
      const config = {
        storytellerPrompt: this.config.storytellerPrompt,
        imagePrompt: this.config.imagePrompt,
        comfyWorkflow: this.config.comfyWorkflow,
        positivePromptPlaceholder: this.config.positivePromptPlaceholder,
        negativePromptPlaceholder: this.config.negativePromptPlaceholder,
        savedConfigs: this.config.savedConfigs
      };
      
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'story-config.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },

    async importConfig() {
      try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          
          const text = await file.text();
          const config = JSON.parse(text);
          
          // Validate config structure
          const requiredFields = ['storytellerPrompt', 'imagePrompt', 'comfyWorkflow', 
                                'positivePromptPlaceholder', 'negativePromptPlaceholder'];
          
          const missingFields = requiredFields.filter(field => !(field in config));
          if (missingFields.length > 0) {
            throw new Error(`Invalid config file. Missing fields: ${missingFields.join(', ')}`);
          }
          
          // Update config
          this.config.storytellerPrompt = config.storytellerPrompt;
          this.config.imagePrompt = config.imagePrompt;
          this.config.comfyWorkflow = config.comfyWorkflow;
          this.config.positivePromptPlaceholder = config.positivePromptPlaceholder;
          this.config.negativePromptPlaceholder = config.negativePromptPlaceholder;
          
          // Update saved configs if present
          if (config.savedConfigs) {
            this.config.savedConfigs = config.savedConfigs;
          }
          
          // Update Monaco editor
          window.editor.setValue(this.config.comfyWorkflow);
          
          // Show success message
          this.showSuccess('Configuration imported successfully');
        };
        
        input.click();
      } catch (error) {
        console.error('Failed to import config:', error);
        this.showError(`Failed to import config: ${error.message}`);
      }
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

    async playMessageAudio(text) {
      try {
        // Stop any currently playing audio for this message
        if (this.audioPlayers.has(text)) {
          const existingPlayer = this.audioPlayers.get(text);
          existingPlayer.audio.pause();
          existingPlayer.audio.currentTime = 0;
          this.audioPlayers.delete(text);
          return;
        }

        // Check if already loading
        if (this.audioCache.get(text) === 'loading') {
          return;
        }

        // Check cache first
        let audioUrl;
        if (this.audioCache.has(text)) {
          const cachedUrl = this.audioCache.get(text);
          if (cachedUrl !== 'loading') {
            audioUrl = cachedUrl;
          }
        }

        if (!audioUrl) {
          // Set loading state
          this.audioCache.set(text, 'loading');

          // Generate new audio
          const response = await fetch('/api/audio/generate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text })
          });

          if (!response.ok) {
            throw new Error('Failed to generate audio');
          }

          const data = await response.json();
          audioUrl = data.url;

          // Cache the URL
          this.audioCache.set(text, audioUrl);
        }

        // Create and play the audio
        const audio = new Audio(audioUrl);

        // Create player state object with reactive properties
        const playerState = {
          audio,
          duration: 0,
          currentTime: 0,
          isPlaying: true
        };

        // Set up audio event listeners
        audio.addEventListener('loadedmetadata', () => {
          // Use Alpine's reactivity system to update the state
          this.$nextTick(() => {
            playerState.duration = audio.duration;
          });
        });

        audio.addEventListener('timeupdate', () => {
          // Use Alpine's reactivity system to update the state
          this.$nextTick(() => {
            playerState.currentTime = audio.currentTime;
          });
        });

        audio.addEventListener('ended', () => {
          this.$nextTick(() => {
            playerState.isPlaying = false;
            this.audioPlayers.delete(text);
          });
        });

        audio.addEventListener('pause', () => {
          this.$nextTick(() => {
            playerState.isPlaying = false;
          });
        });

        audio.addEventListener('play', () => {
          this.$nextTick(() => {
            playerState.isPlaying = true;
          });
        });

        // Store the player state
        this.audioPlayers.set(text, playerState);

        // Play the audio
        await audio.play();

      } catch (error) {
        console.error('Error playing audio:', error);
        this.showError('Failed to play audio');
        // Clear loading state on error
        this.audioCache.delete(text);
        this.audioPlayers.delete(text);
      }
    },

    formatTime(seconds) {
      if (!seconds || isNaN(seconds)) return '0:00';
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    pauseAudio(text) {
      const player = this.audioPlayers.get(text);
      if (player) {
        player.audio.pause();
        player.isPlaying = false;
      }
    },

    resumeAudio(text) {
      const player = this.audioPlayers.get(text);
      if (player) {
        player.audio.play();
        player.isPlaying = true;
      }
    },

    seekAudio(text, event) {
      const player = this.audioPlayers.get(text);
      if (player) {
        const rect = event.target.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const percentage = x / rect.width;
        player.audio.currentTime = player.audio.duration * percentage;
      }
    },
  });

  // Add this to your Alpine.init listener, after the app store definition
  Alpine.data('imageCarousel', () => ({
    initLazyLoad() {
      // Initial setup if needed
    },

    loadImage(imgElement, imageUrl) {
      // Create a new image object to preload
      const img = new Image();

      img.onload = () => {
        // Once loaded, update the src and fade in
        imgElement.src = imageUrl;
        imgElement.classList.add('opacity-100');
      };

      // Start loading the image
      img.src = imageUrl;
    }
  }));

});
