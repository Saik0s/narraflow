import { appState } from './state.js';
import { UI } from './ui.js';

// Create UI instance
export const ui = new UI();

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    appState.loadState();
    ui.init();
});
