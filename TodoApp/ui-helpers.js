// Add a delay threshold for showing loading state
let loadingTimeout;

// Loading state management
export function showLoading() {
    // Clear any existing timeout
    if (loadingTimeout) clearTimeout(loadingTimeout);
    
    // Only show loading if operation takes longer than 300ms
    loadingTimeout = setTimeout(() => {
        document.getElementById('loadingOverlay').classList.remove('hidden');
    }, 300);
}

export function hideLoading() {
    // Clear the timeout to prevent showing loading state
    if (loadingTimeout) clearTimeout(loadingTimeout);
    clearTimeout(loadingTimeout);
    document.getElementById('loadingOverlay').classList.add('hidden');
}

// Error handling
export function showError(message) {
    const errorToast = document.getElementById('errorToast');
    document.getElementById('errorMessage').textContent = message;
    errorToast.classList.remove('hidden');
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        hideError();
    }, 5000);
}

export function hideError() {
    document.getElementById('errorToast').classList.add('hidden');
}

// Async wrapper for error handling
export function withErrorHandling(fn) {
    return async (...args) => {
        try {
            showLoading();
            await fn(...args);
        } catch (error) {
            console.error(error);
            showError(error.message || 'An error occurred');
        } finally {
            hideLoading();
        }
    };
} 