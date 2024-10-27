class StoryApp {
    constructor() {
        this.messageInput = document.getElementById('message-input');
        this.sendButton = document.getElementById('send-button');
        this.chatMessages = document.getElementById('chat-messages');
        this.keywords = document.getElementById('keywords');
        this.selectedKeywords = new Set();
        this.currentImage = document.getElementById('current-image');
        this.darkModeToggle = document.getElementById('dark-mode-toggle');
        this.clearHistoryBtn = document.getElementById('clear-history');
        
        this.setupEventListeners();
        this.commandHistory = [];
        this.historyIndex = -1;
        this.chatHistory = this.loadChatHistory();
        this.isProcessing = false;
        this.imageGenTimer = null;
        this.lastImageGeneration = Date.now();
        
        // Image generation settings
        this.imageSettings = {
            enabled: true,
            mode: 'after_chat',
            interval_seconds: 30
        };
        
        this.setupImageControls();
    }

    setupEventListeners() {
        this.sendButton.addEventListener('click', () => {
            if (this.isMessageValid()) {
                this.sendMessage();
            }
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
        const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        this.darkModeToggle.checked = savedTheme === 'dark';
        this.setTheme(savedTheme);
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }

    toggleDarkMode() {
        this.setTheme(this.darkModeToggle.checked ? 'dark' : 'light');
    }

    loadChatHistory() {
        console.log('Loading chat history from localStorage');
        const saved = localStorage.getItem('chatHistory');
        let history = [];
        
        try {
            history = saved ? JSON.parse(saved) : [];
            console.log('Loaded chat history:', history);
            
            // Restore chat messages and images from history
            history.forEach(item => {
                if (!item || !item.id) return; // Skip invalid items
                
                if (item.type === 'image') {
                    // Restore image
                    this.updateImage(item.url, item.prompt);
                    return;
                }
                
                // Restore message
                const messageDiv = document.createElement('div');
                messageDiv.className = 'message';
                messageDiv.dataset.id = item.id;
                
                const controls = document.createElement('div');
                controls.className = 'edit-controls';
                controls.innerHTML = `
                    <button onclick="app.editMessage('${item.id}')">Edit</button>
                    <button onclick="app.deleteMessage('${item.id}')">Delete</button>
                `;
                
                if (item.thoughts) {
                    const thoughts = document.createElement('thinking');
                    thoughts.className = 'thoughts';
                    thoughts.textContent = item.thoughts;
                    messageDiv.appendChild(thoughts);
                }
                
                if (Array.isArray(item.dialog)) {
                    item.dialog.forEach(entry => {
                        if (!entry || !entry.speaker) return; // Skip invalid dialog entries
                        const text = document.createElement('p');
                        text.className = `dialog ${entry.speaker.toLowerCase()}`;
                        text.textContent = `${entry.speaker}: ${entry.text}`;
                        messageDiv.appendChild(text);
                    });
                }
                
                this.chatMessages.appendChild(messageDiv);
                messageDiv.appendChild(controls);
            });
        } catch (error) {
            console.error('Failed to load chat history:', error);
            history = [];
        }
        
        return history;
    }

    saveChatHistory() {
        try {
            console.log('Saving chat history...');
            // Filter out invalid messages before saving
            const validHistory = this.chatHistory.filter(msg => 
                msg && msg.id && 
                (msg.thoughts || (Array.isArray(msg.dialog) && msg.dialog.length > 0))
            );
            console.log('Filtered valid history:', validHistory);
            localStorage.setItem('chatHistory', JSON.stringify(validHistory));
            console.log('Chat history saved successfully');
        } catch (error) {
            console.error('Failed to save chat history:', error);
        }
    }

    clearHistory() {
        if (confirm('Are you sure you want to clear the chat history?')) {
            this.chatHistory = [];
            this.saveChatHistory();
            this.chatMessages.innerHTML = '';
        }
    }

    setupImageControls() {
        const enabledToggle = document.getElementById('image-gen-enabled');
        const modeSelect = document.getElementById('image-gen-mode');
        const intervalSetting = document.getElementById('interval-setting');
        const intervalInput = document.getElementById('interval-seconds');

        enabledToggle.checked = this.imageSettings.enabled;
        modeSelect.value = this.imageSettings.mode;
        intervalInput.value = this.imageSettings.interval_seconds;

        enabledToggle.addEventListener('change', (e) => {
            this.imageSettings.enabled = e.target.checked;
            if (this.imageSettings.enabled && this.imageSettings.mode === 'periodic') {
                this.startImageGeneration();
            } else {
                this.stopImageGeneration();
            }
        });

        modeSelect.addEventListener('change', (e) => {
            this.imageSettings.mode = e.target.value;
            intervalSetting.style.display = e.target.value === 'periodic' ? 'flex' : 'none';
            
            this.stopImageGeneration();
            if (this.imageSettings.enabled && e.target.value === 'periodic') {
                this.startImageGeneration();
            }
        });

        intervalInput.addEventListener('change', (e) => {
            this.imageSettings.interval_seconds = Math.max(5, parseInt(e.target.value) || 30);
            if (this.imageSettings.enabled && this.imageSettings.mode === 'periodic') {
                this.startImageGeneration();
            }
        });

        // Initialize interval setting visibility
        intervalSetting.style.display = this.imageSettings.mode === 'periodic' ? 'flex' : 'none';
    }

    startImageGeneration() {
        this.stopImageGeneration();
        if (this.imageSettings.mode === 'periodic') {
            this.imageGenTimer = setInterval(() => {
                this.generateImage();
            }, this.imageSettings.interval_seconds * 1000);
        }
    }

    stopImageGeneration() {
        if (this.imageGenTimer) {
            clearInterval(this.imageGenTimer);
            this.imageGenTimer = null;
        }
    }

    async generateImage() {
        if (!this.imageSettings.enabled || Date.now() - this.lastImageGeneration < 5000) {
            return;
        }

        try {
            const response = await fetch('/api/image/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: "Generate based on current context" })
            });

            if (!response.ok) {
                throw new Error('Failed to generate image');
            }

            const data = await response.json();
            if (data.image_url) {
                this.updateImage(data.image_url);
                this.lastImageGeneration = Date.now();
            }
        } catch (error) {
            console.error('Failed to generate image:', error);
        }
    }

    handleInputKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (this.isMessageValid()) {
                this.sendMessage();
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
        if (direction === 'up' && this.historyIndex < this.commandHistory.length - 1) {
            this.historyIndex++;
        } else if (direction === 'down' && this.historyIndex > -1) {
            this.historyIndex--;
        }

        if (this.historyIndex >= 0) {
            this.messageInput.value = this.commandHistory[this.historyIndex];
        } else {
            this.messageInput.value = '';
        }
    }

    setLoadingState(loading) {
        this.isProcessing = loading;
        this.sendButton.disabled = loading;
        this.messageInput.disabled = loading;
        this.sendButton.innerHTML = loading ? '<span class="loading">Processing...</span>' : 'Send';
        
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

    async sendMessage() {
        const message = this.messageInput.value.trim();
        const hasKeywords = this.selectedKeywords.size > 0;
        
        if (!message || this.isProcessing) return;

        this.commandHistory.unshift(message);
        this.historyIndex = -1;
        
        // Clear keywords after getting their values
        const selectedKeywordsArray = Array.from(this.selectedKeywords);
        this.selectedKeywords.clear();
        this.keywords.innerHTML = ''; // Clear keyword display
        
        const messageObj = {
            content: message,
            timestamp: Date.now(),
            id: Date.now().toString()
        };
        this.chatHistory.push(messageObj);

        let prefix = '';
        if (message.startsWith('@')) prefix = 'character';
        else if (message.startsWith('>')) prefix = 'narrator';
        else if (message.startsWith('/')) prefix = 'system';
        else if (message.startsWith('*')) prefix = 'thought';

        try {
            this.setLoadingState(true);
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    prefix: prefix,
                    history: this.chatHistory,
                    selected_keywords: Array.from(this.selectedKeywords)
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.messageInput.value = '';
            
            if (data.error) {
                this.appendErrorMessage(data.error);
                return;
            }

            const { llm_response } = data;
            
            // Update chat messages
            if (llm_response) {
                this.appendMessage(llm_response);
                // Update keywords
                if (llm_response.keywords) {
                    this.updateKeywords(llm_response.keywords);
                }
                
                // Generate image after chat if enabled
                if (this.imageSettings.enabled && this.imageSettings.mode === 'after_chat') {
                    await this.generateImage();
                }
            }

        } catch (error) {
            console.error('Failed to send message:', error);
            this.appendErrorMessage('Failed to send message. Please try again.');
        } finally {
            this.setLoadingState(false);
        }
    }

    appendErrorMessage(error) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'message error-message';
        errorDiv.textContent = `Error: ${error}`;
        this.chatMessages.appendChild(errorDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    appendMessage(response) {
        const messageDiv = document.createElement('div');
        const messageType = this.getMessageType(response);
        messageDiv.className = `message ${messageType}-message card`;
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
        
        // Create message object for history
        const messageObj = {
            id: messageDiv.dataset.id,
            thoughts: response.thoughts || '',
            dialog: response.dialog || [],
            keywords: response.keywords || [],
            timestamp: Date.now()
        };
        console.log('Created message object:', messageObj);
        
        // Add to chat history
        this.chatHistory.push(messageObj);
        
        if (response.thoughts) {
            const thoughts = document.createElement('thinking');
            thoughts.className = 'thoughts';
            thoughts.textContent = response.thoughts;
            contentDiv.appendChild(thoughts);
        }
        
        response.dialog.forEach(entry => {
            const text = document.createElement('p');
            text.className = `dialog ${entry.speaker.toLowerCase()}`;
            text.textContent = `${entry.speaker}: ${entry.text}`;
            contentDiv.appendChild(text);
        });
        
        messageDiv.appendChild(controls);
        messageDiv.appendChild(contentDiv);
        this.chatMessages.appendChild(messageDiv);
        
        // Ensure smooth scroll to bottom
        requestAnimationFrame(() => {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        });
        this.saveChatHistory();
    }

    updateKeywords(keywords) {
        console.log('Updating keywords display:', keywords);
        this.keywords.innerHTML = '';
        keywords.forEach(keyword => {
            console.log('Creating keyword element:', keyword);
            const span = document.createElement('span');
            span.className = 'keyword';
            span.dataset.category = keyword.category;
            span.textContent = keyword.text;
            span.style.opacity = keyword.weight;
            span.addEventListener('click', (event) => this.handleKeywordClick(keyword, event));
            this.keywords.appendChild(span);
        });
    }

    updateImage(imageUrl, prompt = '') {
        const imageContainer = document.getElementById('images-container');
        const imageWrapper = document.createElement('div');
        imageWrapper.className = 'card bg-base-300 shadow-lg';
        
        // Scroll container to bottom before adding new image
        const shouldScroll = imageContainer.scrollHeight - imageContainer.scrollTop === imageContainer.clientHeight;
        
        const imageBody = document.createElement('div');
        imageBody.className = 'card-body p-4';
        
        const image = document.createElement('img');
        image.src = imageUrl;
        image.className = 'w-full h-auto rounded-lg';
        
        imageBody.appendChild(image);
        imageWrapper.appendChild(imageBody);
        imageContainer.insertBefore(imageWrapper, imageContainer.firstChild);
        
        // Scroll to bottom if we were at bottom before
        if (shouldScroll) {
            imageContainer.scrollTop = imageContainer.scrollHeight;
        }

        // Add image to chat history
        const imageData = {
            type: 'image',
            url: imageUrl,
            prompt: prompt,
            timestamp: Date.now(),
            id: Date.now().toString()
        };
        this.chatHistory.push(imageData);
        this.saveChatHistory();
    }

    handleKeywordClick(keyword, event) {
        console.log('Keyword clicked:', keyword);
        const keywordElement = event.target;
        const isSelected = this.selectedKeywords.has(keyword.text);
        
        if (isSelected) {
            console.log('Deselecting keyword:', keyword.text);
            this.selectedKeywords.delete(keyword.text);
            keywordElement.classList.remove('selected');
        } else {
            console.log('Selecting keyword:', keyword.text);
            this.selectedKeywords.add(keyword.text);
            keywordElement.classList.add('selected');
        }
        
        // Update send button state after keyword selection changes
        this.updateSendButtonState();
    }


    editMessage(messageId) {
        const messageDiv = this.chatMessages.querySelector(`[data-id="${messageId}"]`);
        if (!messageDiv) return;

        const currentContent = messageDiv.querySelector('.dialog').textContent;
        messageDiv.classList.add('editing');
        
        const editInput = document.createElement('textarea');
        editInput.className = 'edit-input';
        editInput.value = currentContent;
        
        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save';
        saveButton.onclick = () => this.saveEdit(messageId, editInput.value);
        
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.onclick = () => this.cancelEdit(messageId);
        
        const editControls = document.createElement('div');
        editControls.className = 'edit-controls';
        editControls.appendChild(saveButton);
        editControls.appendChild(cancelButton);
        
        messageDiv.appendChild(editInput);
        messageDiv.appendChild(editControls);
    }

    saveEdit(messageId, newContent) {
        const messageDiv = this.chatMessages.querySelector(`[data-id="${messageId}"]`);
        if (!messageDiv) return;

        const messageIndex = this.chatHistory.findIndex(m => m.id === messageId);
        if (messageIndex !== -1) {
            this.chatHistory[messageIndex].content = newContent;
            this.saveChatHistory();
        }

        messageDiv.querySelector('.dialog').textContent = newContent;
        this.cancelEdit(messageId);
    }

    cancelEdit(messageId) {
        const messageDiv = this.chatMessages.querySelector(`[data-id="${messageId}"]`);
        if (!messageDiv) return;

        messageDiv.classList.remove('editing');
        const editInput = messageDiv.querySelector('.edit-input');
        const editControls = messageDiv.querySelector('.edit-controls');
        if (editInput) editInput.remove();
        if (editControls) editControls.remove();
    }

    deleteMessage(messageId) {
        if (!confirm('Are you sure you want to delete this message?')) return;

        const messageDiv = this.chatMessages.querySelector(`[data-id="${messageId}"]`);
        if (!messageDiv) return;

        this.chatHistory = this.chatHistory.filter(m => m.id !== messageId);
        this.saveChatHistory();
        messageDiv.remove();
    }

    getMessageType(response) {
        if (!response.dialog || response.dialog.length === 0) return 'system';
        const firstDialog = response.dialog[0];
        
        switch(firstDialog.speaker.toLowerCase()) {
            case 'narrator': return 'narrator';
            case 'system': return 'system';
            case 'thought': return 'thought';
            default: return 'character';
        }
    }

    isMessageValid() {
        const message = this.messageInput.value.trim();
        const hasKeywords = this.selectedKeywords.size > 0;
        return message || hasKeywords;
    }

    updateSendButtonState() {
        this.sendButton.disabled = !this.isMessageValid() || this.isProcessing;
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    window.app = new StoryApp();
});
