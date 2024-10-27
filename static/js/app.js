import { sendMessage, generateImage } from './api.js';

// Export API functions for use in Alpine components
window.sendMessage = sendMessage;
window.generateImage = generateImage;

// Ensure Alpine is loaded
document.addEventListener('alpine:init', () => {
  console.log('Alpine initialized');
});
