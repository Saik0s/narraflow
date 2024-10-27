
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
