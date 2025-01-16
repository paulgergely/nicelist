export function showError(message) {
    const errorElement = document.getElementById('errorMessage');
    if (!errorElement) return;
    
    errorElement.textContent = message;
    errorElement.classList.remove('hidden');
    setTimeout(() => {
        errorElement.classList.add('hidden');
    }, 3000);
} 