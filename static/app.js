class StoryApp {
    constructor() {
        this.messageInput = document.getElementById('message-input');
        this.sendButton = document.getElementById('send-button');
        this.chatMessages = document.getElementById('chat-messages');
        this.keywords = document.getElementById('keywords');
        this.currentImage = document.getElementById('current-image');
        
        this.setupEventListeners();
        this.commandHistory = [];
        this.historyIndex = -1;
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
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keydown', (e) => this.handleInputKeydown(e));
        
        document.querySelectorAll('.reaction').forEach(button => {
            button.addEventListener('click', () => this.handleReaction(button.dataset.reaction));
        });
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
            this.sendMessage();
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
        if (!message || this.isProcessing) return;

        this.commandHistory.unshift(message);
        this.historyIndex = -1;

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
                    prefix: prefix
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

            const { llm_response, image } = data;
            
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
            
            // Update image if provided directly
            if (image && image.image_url) {
                this.updateImage(image.image_url);
                this.lastImageGeneration = Date.now();
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
        messageDiv.className = 'message';
        
        if (response.thoughts) {
            const thoughts = document.createElement('p');
            thoughts.className = 'thoughts';
            thoughts.textContent = response.thoughts;
            messageDiv.appendChild(thoughts);
        }
        
        response.dialog.forEach(entry => {
            const text = document.createElement('p');
            text.className = `dialog ${entry.speaker.toLowerCase()}`;
            text.textContent = `${entry.speaker}: ${entry.text}`;
            messageDiv.appendChild(text);
        });
        
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    updateKeywords(keywords) {
        this.keywords.innerHTML = '';
        keywords.forEach(keyword => {
            const span = document.createElement('span');
            span.className = 'keyword';
            span.dataset.category = keyword.category;
            span.textContent = keyword.text;
            span.style.opacity = keyword.weight;
            span.addEventListener('click', () => this.handleKeywordClick(keyword));
            this.keywords.appendChild(span);
        });
    }

    updateImage(imageUrl) {
        this.currentImage.src = imageUrl;
    }

    handleKeywordClick(keyword) {
        this.messageInput.value += ` ${keyword.text}`;
        this.messageInput.focus();
    }

    async handleReaction(reaction) {
        try {
            const response = await fetch('/api/image/reaction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image_id: this.currentImage.src,
                    reaction: reaction
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to send reaction');
            }
        } catch (error) {
            console.error('Failed to send reaction:', error);
            this.appendErrorMessage('Failed to send image reaction');
        }
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    window.app = new StoryApp();
});
