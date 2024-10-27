import { appState } from './state.js';
import { sendMessage, generateImage } from './api.js';

export class UI {
    constructor() {
        // Initialize DOM elements
        this.messageInput = document.getElementById('message-input');
        this.sendButton = document.getElementById('send-button');
        this.chatMessages = document.getElementById('chat-messages');
        this.keywords = document.getElementById('keywords');
        this.currentImage = document.getElementById('current-image');
        this.darkModeToggle = document.getElementById('dark-mode-toggle');
        this.clearHistoryBtn = document.getElementById('clear-history');

        this.setupEventListeners();
        this.setupImageControls();
        this.setupAuthorSelector();
        this.imageGenTimer = null;
    }

    setupEventListeners() {
        // Add form submit handler
        document.getElementById('chat-form').addEventListener('submit', (e) => {
            e.preventDefault(); // Prevent form submission
            this.handleSendMessage();
        });
        
        this.messageInput.addEventListener('keydown', (e) => this.handleInputKeydown(e));
        this.messageInput.addEventListener('input', () => this.updateSendButtonState());
        this.clearHistoryBtn.addEventListener('click', () => this.clearHistory());
        this.darkModeToggle.addEventListener('change', () => this.toggleDarkMode());

        // Listen for system dark mode changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            this.darkModeToggle.checked = e.matches;
            this.setTheme(e.matches ? 'dark' : 'light');
        });

        // Initial dark mode check
        const savedTheme = localStorage.getItem('theme') ||
            (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        this.darkModeToggle.checked = savedTheme === 'dark';
        this.setTheme(savedTheme);
    }

    async handleSendMessage() {
        if (!this.isMessageValid() || appState.isProcessing) return;

        const message = this.messageInput.value.trim();
        const author = document.querySelector('input[name="author"]:checked')?.value || '';
        
        try {
            this.setLoadingState(true);
            console.log('Preparing to send message with complete state');

            // Prepare complete state object
            const completeState = {
                message,
                author,
                state: {
                    chatHistory: appState.chatHistory,
                    selectedKeywords: Array.from(appState.selectedKeywords),
                    commandHistory: appState.commandHistory,
                    imageSettings: appState.imageSettings,
                    lastImageGeneration: appState.lastImageGeneration
                }
            };

            console.log('Sending complete state:', completeState);

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(completeState)
            });

            if (!response.ok) {
                throw new Error(await response.text());
            }

            const data = await response.json();
            console.log('Received response:', data);

            if (data.llm_response) {
                // Handle multiple messages if present
                this.appendMessage(data.llm_response);
                
                // Update keywords if present
                if (data.llm_response.keywords) {
                    this.updateKeywords(data.llm_response.keywords);
                }

                // Clear input and update UI state
                this.messageInput.value = '';
                this.updateSendButtonState();

                // Handle image generation if enabled
                if (appState.imageSettings.enabled && 
                    appState.imageSettings.mode === 'after_chat') {
                    await this.handleImageGeneration(completeState.state);
                }
            }

        } catch (error) {
            console.error('Failed to send message:', error);
            this.appendErrorMessage(error.message || 'Failed to send message');
        } finally {
            this.setLoadingState(false);
        }
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
        const enabledToggle = document.getElementById('image-gen-enabled');
        const modeSelect = document.getElementById('image-gen-mode');
        const intervalSetting = document.getElementById('interval-setting');
        const intervalInput = document.getElementById('interval-seconds');

        enabledToggle.checked = appState.imageSettings.enabled;
        modeSelect.value = appState.imageSettings.mode;
        intervalInput.value = appState.imageSettings.interval_seconds;

        enabledToggle.addEventListener('change', (e) => {
            appState.updateImageSettings({ enabled: e.target.checked });
            if (appState.imageSettings.enabled && appState.imageSettings.mode === 'periodic') {
                this.startImageGeneration();
            } else {
                this.stopImageGeneration();
            }
        });

        modeSelect.addEventListener('change', (e) => {
            appState.updateImageSettings({ mode: e.target.value });
            intervalSetting.style.display = e.target.value === 'periodic' ? 'flex' : 'none';

            this.stopImageGeneration();
            if (appState.imageSettings.enabled && e.target.value === 'periodic') {
                this.startImageGeneration();
            }
        });

        intervalInput.addEventListener('change', (e) => {
            appState.updateImageSettings({
                interval_seconds: Math.max(5, parseInt(e.target.value) || 30)
            });
            if (appState.imageSettings.enabled && appState.imageSettings.mode === 'periodic') {
                this.startImageGeneration();
            }
        });

        intervalSetting.style.display = appState.imageSettings.mode === 'periodic' ? 'flex' : 'none';
    }

    startImageGeneration() {
        this.stopImageGeneration();
        if (appState.imageSettings.mode === 'periodic') {
            this.imageGenTimer = setInterval(() => {
                generateImage();
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
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        messageDiv.dataset.id = Date.now().toString();

        const controls = document.createElement('div');
        controls.className = 'edit-controls';
        controls.innerHTML = `
            <button onclick="app.editMessage('${messageDiv.dataset.id}')">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button onclick="app.deleteMessage('${messageDiv.dataset.id}')">
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

        messageDiv.appendChild(controls);
        messageDiv.appendChild(contentDiv);
        this.chatMessages.appendChild(messageDiv);

        requestAnimationFrame(() => {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        });

        this.updateAuthorSelector();

        // Add to state
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
        appState.isProcessing = loading;
        this.sendButton.disabled = loading;
        this.messageInput.disabled = loading;
        this.sendButton.innerHTML = loading ?
            '<span class="loading">Processing...</span>' :
            'Send';

        if (loading) {
            const loadingMessage = document.createElement('div');
            loadingMessage.className = 'message loading-message';
            loadingMessage.innerHTML = '<div class="loading-spinner"></div> Processing your message...';
            this.chatMessages.appendChild(loadingMessage);
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        } else {
            const loadingMessage = this.chatMessages.querySelector('.loading-message');
            if (loadingMessage) {
                loadingMessage.remove();
            }
        }
    }

    isMessageValid() {
        const message = this.messageInput.value.trim();
        return message || appState.selectedKeywords.size > 0;
    }

    updateSendButtonState() {
        this.sendButton.disabled = !this.isMessageValid() || appState.isProcessing;
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
}
