document.body.addEventListener('htmx:afterRequest', function(evt) {
    // Add null check for evt.detail
    if (evt.detail && evt.detail.path && evt.detail.path.startsWith('/api/')) {
        const response = evt.detail.xhr.response;
        try {
            const data = JSON.parse(response);
            if (data.status === 'success') {
                showNotification('success', 'Operation completed successfully');
            } else if (data.error) {
                showNotification('error', data.error);
            }
        } catch (e) {
            // Response might not be JSON
            console.log('Non-JSON response received');
        }
    }
});

function showNotification(type, message) {
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
