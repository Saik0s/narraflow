import { appState } from './state.js';
import { sendMessage, generateImage } from './api.js';

export class UI {
    constructor() {
        this.elements = null;
    }

    init() {
        this.elements = this.initializeElements();
        this.setupEventListeners();
        this.setupImageControls();
        this.setupAuthorSelector();
    }

    initializeElements() {
        return {
            messageInput: document.getElementById('message-input'),
            sendButton: document.getElementById('send-button'),
            chatMessages: document.getElementById('chat-messages'),
            keywords: document.getElementById('keywords'),  // Updated from keywords-container
            imageContainer: document.getElementById('images-container'),
            darkModeToggle: document.getElementById('dark-mode-toggle'),
            clearHistoryBtn: document.getElementById('clear-history'),
            form: document.getElementById('chat-form'),
            authorSelector: document.getElementById('author-selector'),
            // Add image control elements
            imageGenEnabled: document.querySelector('input[hx-post="/api/settings/image"]'),
            imageGenMode: document.querySelector('select[hx-post="/api/settings/image-mode"]'),
            intervalInput: document.querySelector('input[hx-post="/api/settings/interval"]'),
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

        this.elements.messageInput.addEventListener('input', () => this.updateSendButtonState());

        // Theme handling
        this.elements.darkModeToggle.addEventListener('change', () => {
            appState.setTheme(this.elements.darkModeToggle.checked ? 'dark' : 'light');
        });

        // Clear history
        this.elements.clearHistoryBtn.addEventListener('click', () => this.handleClearHistory());
    }

    async handleSendMessage() {
        const messageInput = this.elements.messageInput;
        const message = messageInput?.value.trim();
        const authorInput = document.querySelector('input[name="author"]:checked');
        const author = authorInput ? authorInput.value : '';

        if (!message || appState.isProcessing) return;

        try {
            this.setLoadingState(true);
            console.log('Sending message:', { message, author }); // Debug log

            const state = appState.getState(); // Get current state
            const response = await sendMessage(message, author, state);

            console.log('Response received:', response); // Debug log

            if (response?.llm_response) {
                this.appendMessage(response.llm_response);
                messageInput.value = '';
                this.updateSendButtonState();

                if (appState.imageSettings.enabled &&
                    appState.imageSettings.mode === 'after_chat') {
                    await this.handleImageGeneration(state);
                }
            }
        } catch (error) {
            console.error('Failed to send message:', error);
            this.appendErrorMessage(error.message || 'Failed to send message');
        } finally {
            this.setLoadingState(false);
        }
    }

    async handleImageGeneration() {
        try {
            const response = await generateImage();
            if (response?.image_url) {
                this.updateImage(response.image_url);
            }
        } catch (error) {
            this.showError('Failed to generate image');
        }
    }

    appendMessage(response) {
        if (!this.elements.chatMessages) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        messageDiv.dataset.id = Date.now().toString();

        const controls = document.createElement('div');
        controls.className = 'edit-controls';
        controls.innerHTML = `
            <button class="btn btn-ghost btn-sm edit-button">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button class="btn btn-ghost btn-sm delete-button">
                <i class="fas fa-trash"></i> Delete
            </button>
        `;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        response.messages.forEach(msg => {
            const text = document.createElement('p');
            text.className = `message-text ${msg.author.toLowerCase()}`;
            text.textContent = msg.author === 'thoughts' ?
                msg.content :
                `${msg.author}: ${msg.content}`;
            contentDiv.appendChild(text);
        });

        messageDiv.appendChild(contentDiv);
        messageDiv.appendChild(controls);
        this.elements.chatMessages.appendChild(messageDiv);

        // Add event listeners for edit and delete
        const editBtn = messageDiv.querySelector('.edit-button');
        const deleteBtn = messageDiv.querySelector('.delete-button');

        editBtn.addEventListener('click', () => this.editMessage(messageDiv.dataset.id));
        deleteBtn.addEventListener('click', () => this.deleteMessage(messageDiv.dataset.id));

        // Scroll to bottom
        requestAnimationFrame(() => {
            this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
        });

        // Update state
        const messageObj = {
            id: messageDiv.dataset.id,
            messages: response.messages || [],
            keywords: response.keywords || [],
            timestamp: Date.now()
        };
        appState.addMessage(messageObj);
    }

    editMessage(messageId) {
        const messageDiv = document.querySelector(`[data-id="${messageId}"]`);
        if (!messageDiv) return;

        const contentDiv = messageDiv.querySelector('.message-content');
        const currentText = contentDiv.textContent;

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
                appState.updateMessage(messageId, newText);
                this.updateMessageDisplay(messageId, newText);
            }
        });

        // Handle cancel
        cancelBtn.addEventListener('click', () => {
            contentDiv.innerHTML = originalContent;
        });
    }

    deleteMessage(messageId) {
        if (confirm('Are you sure you want to delete this message?')) {
            const messageDiv = document.querySelector(`[data-id="${messageId}"]`);
            if (messageDiv) {
                messageDiv.remove();
                appState.deleteMessage(messageId);
            }
        }
    }

    updateMessageDisplay(messageId, newText) {
        const messageDiv = document.querySelector(`[data-id="${messageId}"]`);
        if (!messageDiv) return;

        const contentDiv = messageDiv.querySelector('.message-content');
        contentDiv.innerHTML = `<p class="message-text">${newText}</p>`;
    }

    handleInputKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
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
    }

    toggleDarkMode() {
        this.setTheme(this.darkModeToggle.checked ? 'dark' : 'light');
    }

    clearHistory() {
        if (confirm('Are you sure you want to clear the chat history?')) {
            appState.clearState();
            this.chatMessages.innerHTML = '';
            this.keywords.innerHTML = '';
            document.getElementById('images-container').innerHTML = `
                <p class="text-base-content/70">Visual interpretations of the story will appear here as you chat...</p>
            `;
            this.updateSendButtonState();
        }
    }

    setupImageControls() {
        if (!this.elements.imageGenEnabled || !this.elements.imageGenMode || !this.elements.intervalInput) {
            console.warn('Image control elements not found');
            return;
        }

        this.elements.imageGenEnabled.checked = appState.imageSettings.enabled;
        this.elements.imageGenMode.value = appState.imageSettings.mode;
        this.elements.intervalInput.value = appState.imageSettings.interval_seconds;

        this.elements.imageGenEnabled.addEventListener('change', (e) => {
            appState.updateImageSettings({ enabled: e.target.checked });
            if (appState.imageSettings.enabled && appState.imageSettings.mode === 'periodic') {
                this.startImageGeneration();
            } else {
                this.stopImageGeneration();
            }
        });

        this.elements.imageGenMode.addEventListener('change', (e) => {
            appState.updateImageSettings({ mode: e.target.value });
            if (this.elements.intervalSetting) {
                this.elements.intervalSetting.style.display =
                    e.target.value === 'periodic' ? 'flex' : 'none';
            }

            this.stopImageGeneration();
            if (appState.imageSettings.enabled && e.target.value === 'periodic') {
                this.startImageGeneration();
            }
        });

        this.elements.intervalInput.addEventListener('change', (e) => {
            appState.updateImageSettings({
                interval_seconds: Math.max(5, parseInt(e.target.value) || 30)
            });
            if (appState.imageSettings.enabled && appState.imageSettings.mode === 'periodic') {
                this.startImageGeneration();
            }
        });

        // Set initial interval setting display
        if (this.elements.intervalSetting) {
            this.elements.intervalSetting.style.display =
                appState.imageSettings.mode === 'periodic' ? 'flex' : 'none';
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
        const authorSelector = document.createElement('div');
        authorSelector.className = 'join w-full mb-2';
        authorSelector.id = 'author-selector';

        const defaultAuthors = ['', 'system', 'narrator'];
        defaultAuthors.forEach(author => {
            const label = document.createElement('label');
            label.className = 'join-item btn btn-sm flex-1';

            const btn = document.createElement('input');
            btn.type = 'radio';
            btn.name = 'author';
            btn.value = author;
            btn.id = `author-${author || 'direct'}`;
            btn.className = 'hidden';

            label.htmlFor = btn.id;
            label.textContent = author || 'Direct';

            label.addEventListener('click', () => {
                btn.checked = true;
            });

            label.appendChild(btn);
            authorSelector.appendChild(label);
        });

        const bottomPanel = document.querySelector('.flex.flex-col.gap-2');
        bottomPanel.insertBefore(authorSelector, bottomPanel.firstChild);

        // Update hidden author input when selection changes
        const authorInputs = authorSelector.querySelectorAll('input[type="radio"]');
        const hiddenAuthorInput = document.getElementById('selected-author');

        authorInputs.forEach(input => {
            input.addEventListener('change', (e) => {
                hiddenAuthorInput.value = e.target.value;
            });
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
                label.className = 'join-item btn btn-sm flex-1';

                const btn = document.createElement('input');
                btn.type = 'radio';
                btn.name = 'author';
                btn.value = character;
                btn.id = `author-${character}`;
                btn.className = 'hidden';

                label.htmlFor = btn.id;
                label.textContent = character;

                label.addEventListener('click', () => {
                    btn.checked = true;
                });

                label.appendChild(btn);
                authorSelector.appendChild(label);
            }
        });
    }

    appendMessage(response) {
        if (!this.elements.chatMessages) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        messageDiv.dataset.id = Date.now().toString();

        const controls = document.createElement('div');
        controls.className = 'edit-controls';
        controls.innerHTML = `
            <button class="btn btn-ghost btn-sm edit-button">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button class="btn btn-ghost btn-sm delete-button">
                <i class="fas fa-trash"></i> Delete
            </button>
        `;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        response.messages.forEach(msg => {
            const text = document.createElement('p');
            text.className = `message-text ${msg.author.toLowerCase()}`;
            text.textContent = msg.author === 'thoughts' ?
                msg.content :
                `${msg.author}: ${msg.content}`;
            contentDiv.appendChild(text);
        });

        messageDiv.appendChild(contentDiv);
        messageDiv.appendChild(controls);
        this.elements.chatMessages.appendChild(messageDiv);

        // Add event listeners for edit and delete
        const editBtn = messageDiv.querySelector('.edit-button');
        const deleteBtn = messageDiv.querySelector('.delete-button');

        editBtn.addEventListener('click', () => this.editMessage(messageDiv.dataset.id));
        deleteBtn.addEventListener('click', () => this.deleteMessage(messageDiv.dataset.id));

        // Scroll to bottom
        requestAnimationFrame(() => {
            this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
        });

        // Update state
        const messageObj = {
            id: messageDiv.dataset.id,
            messages: response.messages || [],
            keywords: response.keywords || [],
            timestamp: Date.now()
        };
        appState.addMessage(messageObj);
    }

    appendErrorMessage(error) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'message error';
        errorDiv.textContent = error;
        this.chatMessages.appendChild(errorDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    updateImage(imageUrl, prompt = '') {
        const imageContainer = document.getElementById('images-container');
        const imageWrapper = document.createElement('div');
        imageWrapper.className = 'card bg-base-200 shadow-xl';

        const shouldScroll = imageContainer.scrollHeight - imageContainer.scrollTop === imageContainer.clientHeight;

        const imageBody = document.createElement('div');
        imageBody.className = 'card-body p-4';

        const image = document.createElement('img');
        image.src = imageUrl;
        image.className = 'w-full h-auto rounded-lg';

        imageBody.appendChild(image);
        imageWrapper.appendChild(imageBody);
        imageContainer.insertBefore(imageWrapper, imageContainer.firstChild);

        if (shouldScroll) {
            imageContainer.scrollTop = imageContainer.scrollHeight;
        }

        const imageData = {
            type: 'image',
            url: imageUrl,
            prompt: prompt,
            timestamp: Date.now(),
            id: Date.now().toString()
        };
        appState.addMessage(imageData);
    }

    updateKeywords(keywords) {
        keywords.forEach(keyword => {
            const span = document.createElement('span');
            span.className = `badge badge-${keyword.category}`;
            span.textContent = keyword.text;
            span.addEventListener('click', (e) => this.handleKeywordClick(keyword, e));
            this.keywords.appendChild(span);
        });
    }

    handleKeywordClick(keyword, event) {
        const keywordElement = event.target;
        const isSelected = appState.selectedKeywords.has(keyword.text);

        if (isSelected) {
            appState.selectedKeywords.delete(keyword.text);
            keywordElement.classList.remove('selected');
        } else {
            appState.selectedKeywords.add(keyword.text);
            keywordElement.classList.add('selected');
        }

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
        const message = this.elements.messageInput?.value.trim();
        return message || appState.selectedKeywords.size > 0;
    }

    updateSendButtonState() {
        if (this.elements.sendButton) {
            this.elements.sendButton.disabled = !this.isMessageValid() || appState.isProcessing;
        }
    }

    async handleImageGeneration(state) {
        if (Date.now() - appState.lastImageGeneration < 5000) {
            console.log('Skipping image generation - too soon');
            return;
        }

        try {
            const response = await fetch('/api/image/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: "Generate based on current context",
                    state: state
                })
            });

            if (!response.ok) {
                throw new Error('Failed to generate image');
            }

            const data = await response.json();
            if (data.image_url) {
                this.updateImage(data.image_url);
                appState.lastImageGeneration = Date.now();
                appState.saveToStorage(); // Save state after updating image timestamp
            }
        } catch (error) {
            console.error('Failed to generate image:', error);
            this.appendErrorMessage('Failed to generate image');
        }
    }

    appendErrorMessage(error) {
        if (!this.elements.chatMessages) return;

        const errorDiv = document.createElement('div');
        errorDiv.className = 'message error';
        errorDiv.textContent = error;
        this.elements.chatMessages.appendChild(errorDiv);
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
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

    updateImage(imageUrl, prompt = '') {
        if (!this.elements.imageContainer) return;

        const imageWrapper = document.createElement('div');
        imageWrapper.className = 'card bg-base-200 shadow-xl';

        const shouldScroll =
            this.elements.imageContainer.scrollHeight - this.elements.imageContainer.scrollTop ===
            this.elements.imageContainer.clientHeight;

        const imageBody = document.createElement('div');
        imageBody.className = 'card-body p-4';

        const image = document.createElement('img');
        image.src = imageUrl;
        image.className = 'w-full h-auto rounded-lg';

        imageBody.appendChild(image);
        imageWrapper.appendChild(imageBody);
        this.elements.imageContainer.insertBefore(imageWrapper, this.elements.imageContainer.firstChild);

        if (shouldScroll) {
            this.elements.imageContainer.scrollTop = this.elements.imageContainer.scrollHeight;
        }

        const imageData = {
            type: 'image',
            url: imageUrl,
            prompt: prompt,
            timestamp: Date.now(),
            id: Date.now().toString()
        };
        appState.addMessage(imageData);
    }

    showError(message) {
        console.error(message);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'alert alert-error';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 3000);
    }
}
