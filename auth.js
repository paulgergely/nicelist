import { supabase } from './config.js'
import { showLoading, hideLoading, showError } from './ui-helpers.js'
import { loadTasks, navigateToTasks, updateProfilePhotos } from './script.js'

// DOM Elements
const authContainer = document.getElementById('authContainer')
const appContainer = document.getElementById('appContainer')
const loginForm = document.getElementById('loginForm')
const signupForm = document.getElementById('signupForm')
const showSignupLink = document.getElementById('showSignup')
const showLoginLink = document.getElementById('showLogin')

// Form switching
showSignupLink?.addEventListener('click', (e) => {
    e.preventDefault()
    loginForm.classList.add('hidden')
    signupForm.classList.remove('hidden')
})

showLoginLink?.addEventListener('click', (e) => {
    e.preventDefault()
    signupForm.classList.add('hidden')
    loginForm.classList.remove('hidden')
})

// Move DOM initialization here
function initializeAuthenticatedUI() {
    const userMenuButton = document.getElementById('userMenuButton');
    const userMenu = document.getElementById('userMenu');
    const accountLink = document.getElementById('accountLink');
    const logoutLink = document.getElementById('logoutLink');
    const accountPage = document.getElementById('accountPage');
    const tasksLink = document.getElementById('tasksLink');
    const backToTasksLink = document.getElementById('backToTasksLink');
    
    // Ensure menu starts hidden
    if (userMenu) {
        userMenu.classList.add('hidden');
    }
    
    if (userMenuButton && userMenu) {
        // Toggle menu with immediate effect
        userMenuButton.onclick = (e) => {
            e.stopPropagation(); // Prevent document click from immediately closing it
            userMenu.classList.toggle('hidden');
        };
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!userMenuButton.contains(e.target) && !userMenu.contains(e.target)) {
                userMenu.classList.add('hidden');
            }
        });
    }
    
    // Navigation handlers
    if (tasksLink) {
        tasksLink.onclick = (e) => {
            e.preventDefault();
            navigateToTasks();
        };
    }
    
    if (backToTasksLink) {
        backToTasksLink.onclick = (e) => {
            e.preventDefault();
            navigateToTasks();
        };
    }
    
    // Account link handler
    if (accountLink) {
        accountLink.onclick = async (e) => {
            e.preventDefault();
            if (userMenu) userMenu.classList.add('hidden');
            
            // Hide other views
            document.getElementById('mainView')?.classList.add('hidden');
            document.getElementById('taskView')?.classList.add('hidden');
            accountPage?.classList.remove('hidden');
            
            // Update account page with current user data
            const { data: { user }, error } = await supabase.auth.getUser();
            if (!error && user) {
                updateProfilePhotos(user.email);
            }
        };
    }
    
    // Logout handler
    if (logoutLink) {
        logoutLink.onclick = (e) => {
            e.preventDefault();
            if (userMenu) userMenu.classList.add('hidden');
            logout();
        };
    }
}

// Login handler
const loginButton = document.getElementById('loginButton');
if (loginButton) {
    loginButton.onclick = async () => {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        if (!email || !password) {
            showError('Please enter both email and password');
            return;
        }
        
        try {
            showLoading();
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) throw error;
            
            // Hide auth container and show app
            authContainer.classList.add('hidden');
            appContainer.classList.remove('hidden');
            
            // Initialize authenticated UI
            initializeAuthenticatedUI();
            
            // Update user display
            await updateUserDisplay();
            
            // Initialize app
            await loadTasks();
            
        } catch (error) {
            console.error('Login error:', error);
            showError(error.message);
        } finally {
            hideLoading();
        }
    };
}

// Signup handler
const signupButton = document.getElementById('signupButton');
if (signupButton) {
    signupButton.onclick = async () => {
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        
        if (!email || !password) {
            showError('Please enter both email and password');
            return;
        }
        
        if (password.length < 6) {
            showError('Password must be at least 6 characters');
            return;
        }
        
        try {
            showLoading();
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: window.location.origin
                }
            });
            
            if (error) throw error;
            
            showError('Please check your email for confirmation link');
            
            // Switch back to login form
            signupForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
            
        } catch (error) {
            console.error('Signup error:', error);
            showError(error.message);
        } finally {
            hideLoading();
        }
    };
}

// Check for existing session on page load
window.addEventListener('load', async () => {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        
        if (session) {
            // Show app
            authContainer.classList.add('hidden');
            appContainer.classList.remove('hidden');
            
            // Initialize authenticated UI
            initializeAuthenticatedUI();
            
            // Update user display
            await updateUserDisplay();
            
            await loadTasks();
        } else {
            // No session, show login
            authContainer.classList.remove('hidden');
            appContainer.classList.add('hidden');
        }
    } catch (error) {
        console.error('Session check error:', error);
        authContainer.classList.remove('hidden');
        appContainer.classList.add('hidden');
    }
});

// User display update
async function updateUserDisplay() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!error && user) {
        const userEmail = user.email;
        document.getElementById('userEmail').textContent = userEmail;
        updateProfilePhotos(userEmail);
    }
}

// Logout handler
export async function logout() {
    try {
        showLoading()
        const { error } = await supabase.auth.signOut()
        if (error) throw error
        
        // Clear task cache if it exists
        if (typeof taskCache !== 'undefined') {
            taskCache.clear()
        }
        
        // Return to login screen
        authContainer.classList.remove('hidden')
        appContainer.classList.add('hidden')
        
        // Clear any stored session data
        localStorage.removeItem('supabase.auth.token')
        
    } catch (error) {
        console.error('Logout error:', error)
        showError('Error logging out: ' + error.message)
    } finally {
        hideLoading()
    }
} 