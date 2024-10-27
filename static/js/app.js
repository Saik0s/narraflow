import { sendMessage, generateImage } from './api.js';

// Export API functions for use in Alpine components
window.sendMessage = sendMessage;
window.generateImage = generateImage;

// Initialize store before Alpine loads
if (!window.alpineStore) {
  console.error('Alpine store not initialized!');
}

// Ensure Alpine is loaded
document.addEventListener('alpine:init', () => {
  console.log('Alpine initialized');
  if (window.alpineStore) {
    Alpine.store('app', window.alpineStore);
  }
});
