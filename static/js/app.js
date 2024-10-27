import { appState } from './state.js';
import { UI } from './ui.js';

class App {
    constructor() {
        this.state = appState;
        this.ui = new UI();
        this.init();
    }

    init() {
        this.state.loadState();
        this.ui.updateKeywords(this.state.chatHistory.flatMap(msg => msg.keywords || []));
        this.state.chatHistory.forEach(msg => {
            if (msg.type === 'image') {
                this.ui.updateImage(msg.url, msg.prompt);
            } else {
                this.ui.appendMessage(msg);
            }
        });
    }
}

export const app = new App();
export const ui = app.ui;
