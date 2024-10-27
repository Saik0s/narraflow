class WebSocketClient {
    constructor() {
        this.connect();
        this.messageHandlers = new Set();
    }

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        this.ws = new WebSocket(`${protocol}//${window.location.host}/api/ws`);
        
        this.ws.onopen = () => console.log('WebSocket Connected');
        this.ws.onclose = () => setTimeout(() => this.connect(), 1000);
        this.ws.onmessage = (event) => this.handleMessage(event);
    }

    addMessageHandler(handler) {
        this.messageHandlers.add(handler);
    }

    removeMessageHandler(handler) {
        this.messageHandlers.delete(handler);
    }

    handleMessage(event) {
        const data = JSON.parse(event.data);
        this.messageHandlers.forEach(handler => handler(data));
    }

    send(message) {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }
}

const wsClient = new WebSocketClient();
