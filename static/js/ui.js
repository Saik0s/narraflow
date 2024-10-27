import { appState } from './state.js';
import { sendMessage, generateImage } from './api.js';

export class UI {
  constructor() {
    this.elements = null;
  }

  init() {
    this.elements = this.initializeElements();

    // Set initial input value from state
    if (this.elements.messageInput) {
      this.elements.messageInput.value = appState.currentInput || '';
    }

    this.setupEventListeners();
    this.setupImageControls();
    this.setupAuthorSelector();
    this.renderMessages();
    this.renderKeywords();
    this.renderImages();
    this.updateSendButtonState();
  }

  initializeElements() {
    return {
      messageInput: document.getElementById('message-input'),
      sendButton: document.getElementById('send-button'),
      chatMessages: document.getElementById('chat-messages'),
      keywords: document.getElementById('keywords'),
      imageContainer: document.getElementById('images-container'),
      darkModeToggle: document.querySelector('.theme-controller'),
      clearHistoryBtn: document.getElementById('clear-history'),
      form: document.getElementById('chat-form'),
      authorSelector: document.getElementById('author-selector'),
      // Add image control elements
      imageGenEnabled: document.getElementById('image-gen-enabled'),
      imageGenMode: document.getElementById('image-gen-mode'),
      intervalInput: document.getElementById('interval-input'),
      intervalSetting: document.getElementById('interval-setting')
    };
  }

  setupEventListeners() {
    // Prevent form submission and handle button click
    this.elements.form.addEventListener('submit', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    this.elements.sendButton.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await this.handleSendMessage();
    });

    // Input handling
    this.elements.messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        if (this.isMessageValid()) {
          this.handleSendMessage();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.navigateHistory('up');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.navigateHistory('down');
      }
    });

    this.elements.messageInput.addEventListener('input', (e) => {
      appState.currentInput = e.target.value.trim();
      appState.saveState();
      this.updateSendButtonState();
    });

    // Theme handling
    this.elements.darkModeToggle?.addEventListener('change', (e) => {
      const theme = e.target.checked ? 'dark' : 'light';
      this.setTheme(theme);
    });

    // Clear history
    this.elements.clearHistoryBtn.addEventListener('click', () => this.handleClearHistory());
  }

  async handleSendMessage() {
    const messageInput = this.elements.messageInput;
    const content = messageInput?.value.trim();
    const author = appState.selectedAuthor;

    if (!this.isMessageValid() || appState.isProcessing) return;

    try {
      this.setLoadingState(true);

      const response = await sendMessage(
        appState.currentInput,
        author,
        appState.chatHistory,
        appState.selectedKeywords
      );

      if (response?.llm_response) {
        // Update state
        response.llm_response.messages.forEach(message => {
          appState.chatHistory.push(message);
        });
        appState.keywords = response.llm_response.keywords;
        appState.selectedKeywords = [];
        appState.saveState();

        // Update UI
        this.renderMessages();
        this.renderKeywords();
        appState.currentInput = '';
        messageInput.value = '';
        appState.saveState();
        this.updateSendButtonState();

        if (appState.imageSettings.enabled &&
          appState.imageSettings.mode === 'after_chat') {
          await this.handleImageGeneration();
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      this.showError('Failed to send message');
    } finally {
      this.setLoadingState(false);
    }
  }

  // New method to render all messages
  renderMessages() {
    if (!this.elements.chatMessages) return;

    this.elements.chatMessages.innerHTML = '';

    appState.chatHistory.forEach((message, index) => {
      const messageWrapper = document.createElement('div');
      messageWrapper.className = message.author.toLowerCase() === 'user' ? 'chat chat-end' : 'chat chat-start';
      messageWrapper.dataset.id = index.toString();

      const chatHeader = document.createElement('div');
      chatHeader.className = 'chat-header text-xs text-base-content/40';
      chatHeader.textContent = message.author;

      const messageBubble = document.createElement('div');
      const getAuthorColorClass = (author) => {
        switch (author.toLowerCase()) {
          case 'thoughts':
            return 'bg-base/5 text-base-content/50';
          case 'system':
            return 'bg-base/5 text-base-content/50';
          case 'narrator':
            return 'bg-base/5 text-base-content/50';
          default:
            // Generate a unique color based on the author's name
            const hash = author.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
            const hue = hash % 360;
            return `bg-[hsl(${hue},10%,20%)] text-[hsl(${hue},60%,80%)]`;
        }
      };

      messageBubble.className = `chat-bubble ${getAuthorColorClass(message.author)}`;

      messageBubble.textContent = message.content;
      const controls = this.createMessageControls(index);
      controls.className += ' opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute -top-7 right-0 mb-2 mr-2';

      messageWrapper.classList.add('group', 'relative');
      messageBubble.appendChild(controls);

      messageWrapper.appendChild(chatHeader);
      messageWrapper.appendChild(messageBubble);
      this.elements.chatMessages.appendChild(messageWrapper);
    });

    // Scroll to bottom
    requestAnimationFrame(() => {
      this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
    });
  }

  // Helper to create message controls
  createMessageControls(index) {
    const controls = document.createElement('div');
    controls.className = 'edit-controls';
    controls.innerHTML = `
      <button class="btn btn-ghost btn-sm edit-button p-2">
        <i class="fas fa-edit"></i>
      </button>
      <button class="btn btn-ghost btn-sm delete-button p-2">
        <i class="fas fa-trash"></i>
      </button>
    `;

    controls.querySelector('.edit-button').addEventListener('click',
      () => this.editMessage(index));
    controls.querySelector('.delete-button').addEventListener('click',
      () => this.deleteMessage(index));

    return controls;
  }

  // Update image rendering
  renderImages() {
    if (!this.elements.imageContainer) return;

    this.elements.imageContainer.innerHTML = '';

    appState.imageHistory.forEach(imageUrl => {
      const imageWrapper = document.createElement('div');
      imageWrapper.className = 'card bg-base-200 shadow-xl';

      const imageBody = document.createElement('div');
      imageBody.className = 'card-body p-4';

      const image = document.createElement('img');
      image.src = imageUrl;
      image.className = 'w-full h-auto rounded-lg';

      imageBody.appendChild(image);
      imageWrapper.appendChild(imageBody);
      this.elements.imageContainer.appendChild(imageWrapper);
    });
  }

  // Update keywords rendering
  renderKeywords() {
    if (!this.elements.keywords) return;

    this.elements.keywords.innerHTML = '';

    appState.keywords.forEach(keyword => {
        // Create wrapper div for the form control
        const wrapper = document.createElement('div');
        wrapper.className = 'form-control';

        // Create label container
        const label = document.createElement('label');
        label.className = 'label cursor-pointer gap-2 bg-base-200 rounded-full px-4 py-2 hover:bg-base-300 transition-colors';

        // Create keyword text span
        const span = document.createElement('span');
        span.className = `label-text text-${keyword.category}`;
        span.textContent = keyword.text;

        // Create checkbox input
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'checkbox checkbox-sm checkbox-primary';
        checkbox.checked = appState.selectedKeywords.includes(keyword.text);

        // Add event listener to checkbox
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation(); // Prevent label click from triggering twice
            this.handleKeywordClick(keyword);
        });

        // Assemble the elements
        label.appendChild(span);
        label.appendChild(checkbox);
        wrapper.appendChild(label);
        this.elements.keywords.appendChild(wrapper);
    });
  }

  // Update state and UI after image generation
  async handleImageGeneration() {
    if (!appState.imageSettings.enabled ||
      Date.now() - appState.lastImageGeneration < 5000) {
      return;
    }

    try {
      const response = await generateImage(appState.chatHistory);
      if (response?.image_url) {
        appState.imageHistory.push(response.image_url);
        appState.lastImageGeneration = Date.now();
        appState.saveState();
        this.renderImages();
      }
    } catch (error) {
      this.showError('Failed to generate image');
    }
  }

  editMessage(index) {
    const message = appState.chatHistory[index];
    if (!message) return;

    const messageDiv = document.querySelector(`[data-id="${index}"]`);
    if (!messageDiv) return;

    const contentDiv = messageDiv.querySelector('.chat-bubble');
    const currentText = message.content;

    // Create edit input
    const editInput = document.createElement('textarea');
    editInput.className = 'edit-input input input-bordered w-full';
    editInput.value = currentText;

    // Create save button
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary btn-sm mt-2';
    saveBtn.textContent = 'Save';

    // Create cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-ghost btn-sm mt-2 ml-2';
    cancelBtn.textContent = 'Cancel';

    // Save original content
    const originalContent = contentDiv.innerHTML;

    // Replace content with edit interface
    contentDiv.innerHTML = '';
    contentDiv.appendChild(editInput);
    contentDiv.appendChild(saveBtn);
    contentDiv.appendChild(cancelBtn);

    // Handle save
    saveBtn.addEventListener('click', () => {
      const newText = editInput.value.trim();
      if (newText) {
        appState.chatHistory[index].content = newText;
        appState.saveState();
        this.renderMessages();
      }
    });

    // Handle cancel
    cancelBtn.addEventListener('click', () => {
      contentDiv.innerHTML = originalContent;
    });
  }

  deleteMessage(index) {
    if (confirm('Are you sure you want to delete this message?')) {
      const messageDiv = document.querySelector(`[data-id="${index}"]`);
      if (messageDiv) {
        messageDiv.remove();
        appState.chatHistory = appState.chatHistory.filter((_, index) => index !== index);
        appState.saveState();
      }
    }
  }

  navigateHistory(direction) {
    if (direction === 'up' && appState.historyIndex < appState.commandHistory.length - 1) {
      appState.historyIndex++;
    } else if (direction === 'down' && appState.historyIndex > -1) {
      appState.historyIndex--;
    }

    if (appState.historyIndex >= 0) {
      this.messageInput.value = appState.commandHistory[appState.historyIndex];
    } else {
      this.messageInput.value = '';
    }
  }

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    appState.setTheme(theme);
  }

  toggleDarkMode() {
    this.setTheme(this.darkModeToggle.checked ? 'dark' : 'light');
  }

  setupImageControls() {
    if (!this.elements.imageGenEnabled || !this.elements.imageGenMode || !this.elements.intervalInput) {
      console.warn('Image control elements not found');
      return;
    }

    // Set initial values from state
    this.elements.imageGenEnabled.checked = appState.imageSettings.enabled;
    this.elements.imageGenMode.value = appState.imageSettings.mode;
    this.elements.intervalInput.value = appState.imageSettings.interval_seconds;

    // Update interval setting visibility based on initial mode
    this.elements.intervalSetting.style.display =
      appState.imageSettings.mode === 'periodic' ? 'block' : 'none';

    // Enable/Disable image generation
    this.elements.imageGenEnabled.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      appState.updateImageSettings({ enabled });

      if (enabled && appState.imageSettings.mode === 'periodic') {
        this.startImageGeneration();
      } else {
        this.stopImageGeneration();
      }
    });

    // Handle mode changes
    this.elements.imageGenMode.addEventListener('change', (e) => {
      const mode = e.target.value;
      appState.updateImageSettings({ mode });

      // Show/hide interval setting
      this.elements.intervalSetting.style.display =
        mode === 'periodic' ? 'block' : 'none';

      // Restart image generation if needed
      this.stopImageGeneration();
      if (appState.imageSettings.enabled && mode === 'periodic') {
        this.startImageGeneration();
      }
    });

    // Handle interval changes
    this.elements.intervalInput.addEventListener('change', (e) => {
      const interval = Math.max(5, parseInt(e.target.value) || 30);
      appState.updateImageSettings({ interval_seconds: interval });

      // Restart periodic generation if active
      if (appState.imageSettings.enabled && appState.imageSettings.mode === 'periodic') {
        this.startImageGeneration();
      }
    });

    // Start periodic generation if enabled initially
    if (appState.imageSettings.enabled && appState.imageSettings.mode === 'periodic') {
      this.startImageGeneration();
    }
  }

  startImageGeneration() {
    this.stopImageGeneration();
    if (appState.imageSettings.mode === 'periodic') {
      this.imageGenTimer = setInterval(() => {
        this.handleImageGeneration();
      }, appState.imageSettings.interval_seconds * 1000);
    }
  }

  stopImageGeneration() {
    if (this.imageGenTimer) {
      clearInterval(this.imageGenTimer);
      this.imageGenTimer = null;
    }
  }

  setupAuthorSelector() {
    if (!this.elements.authorSelector) return;

    const defaultAuthors = ['', 'system', 'narrator'];
    defaultAuthors.forEach(author => {
      const label = document.createElement('label');
      label.className = `join-item btn btn-sm flex-1 ${author === appState.selectedAuthor ? 'btn-active' : ''}`;

      const btn = document.createElement('input');
      btn.type = 'radio';
      btn.name = 'author';
      btn.value = author;
      btn.id = `author-${author || 'direct'}`;
      btn.className = 'hidden';
      btn.checked = author === appState.selectedAuthor;

      label.htmlFor = btn.id;
      label.textContent = author || 'Direct';

      btn.addEventListener('change', () => {
        appState.selectedAuthor = author;
        appState.saveState();
        this.updateAuthorSelectorVisuals();
      });

      label.appendChild(btn);
      this.elements.authorSelector.appendChild(label);
    });
  }

  updateAuthorSelectorVisuals() {
    const authorSelector = this.elements.authorSelector;
    if (!authorSelector) return;

    // Update all labels
    authorSelector.querySelectorAll('label').forEach(label => {
      const input = label.querySelector('input');
      if (input) {
        label.classList.toggle('btn-active', input.value === appState.selectedAuthor);
      }
    });
  }

  updateAuthorSelector() {
    const authorSelector = document.getElementById('author-selector');
    if (!authorSelector) return;

    const characters = new Set();
    appState.chatHistory.forEach(msg => {
      if (msg.messages) {
        msg.messages.forEach(m => {
          if (m.author && !['system', 'narrator', 'thoughts'].includes(m.author)) {
            characters.add(m.author);
          }
        });
      }
    });

    const existingAuthors = new Set(
      Array.from(authorSelector.querySelectorAll('input')).map(i => i.value)
    );

    characters.forEach(character => {
      if (!existingAuthors.has(character)) {
        const label = document.createElement('label');
        label.className = `join-item btn btn-sm flex-1 ${character === appState.selectedAuthor ? 'btn-active' : ''}`;

        const btn = document.createElement('input');
        btn.type = 'radio';
        btn.name = 'author';
        btn.value = character;
        btn.id = `author-${character}`;
        btn.className = 'hidden';
        btn.checked = character === appState.selectedAuthor;

        label.htmlFor = btn.id;
        label.textContent = character;

        btn.addEventListener('change', () => {
          appState.selectedAuthor = character;
          appState.saveState();
          this.updateAuthorSelectorVisuals();
        });

        label.appendChild(btn);
        authorSelector.appendChild(label);
      }
    });
  }

  handleKeywordClick(keyword) {
    const isSelected = appState.selectedKeywords.includes(keyword.text);

    if (isSelected) {
      appState.selectedKeywords = appState.selectedKeywords.filter(k => k !== keyword.text);
    } else {
      appState.selectedKeywords.push(keyword.text);
    }

    appState.saveState();
    this.renderKeywords();
    this.updateSendButtonState();
  }

  setLoadingState(loading) {
    if (!this.elements) return;

    appState.isProcessing = loading;

    if (this.elements.sendButton) {
      this.elements.sendButton.disabled = loading;
      this.elements.sendButton.innerHTML = loading ?
        '<span class="loading">Processing...</span>' :
        'Send';
    }

    if (this.elements.messageInput) {
      this.elements.messageInput.disabled = loading;
    }

    if (this.elements.chatMessages) {
      if (loading) {
        const loadingMessage = document.createElement('div');
        loadingMessage.className = 'message loading-message';
        loadingMessage.innerHTML = '<div class="loading-spinner"></div> Processing your message...';
        this.elements.chatMessages.appendChild(loadingMessage);
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
      } else {
        const loadingMessage = this.elements.chatMessages.querySelector('.loading-message');
        if (loadingMessage) {
          loadingMessage.remove();
        }
      }
    }
  }

  isMessageValid() {
    return appState.currentInput || appState.selectedKeywords.length > 0;
  }

  updateSendButtonState() {
    this.elements.sendButton.disabled = !this.isMessageValid() || appState.isProcessing;
  }

  handleClearHistory() {
    if (confirm('Are you sure you want to clear the chat history?')) {
      appState.clearState();
      if (this.elements.chatMessages) {
        this.elements.chatMessages.innerHTML = '';
      }
      if (this.elements.keywords) {
        this.elements.keywords.innerHTML = '';
      }
      if (this.elements.imageContainer) {
        this.elements.imageContainer.innerHTML = `
                    <p class="text-base-content/70">Visual interpretations of the story will appear here as you chat...</p>
                `;
      }
      this.updateSendButtonState();
    }
  }

  showError(message) {
    console.error(message);
    this.showNotification('error', message);
  }

  showNotification(type, message) {
    const notification = document.createElement('div');
    notification.innerHTML = `
      <div class="toast toast-top toast-end">
          <div class="alert alert-${type}">
              <span>${message}</span>
          </div>
      </div>
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  }
}
