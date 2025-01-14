import { supabase } from './config.js';
import { showError } from './utils.js';
import { initializeUI } from './ui.js';
import { loadTasks } from './tasks.js';

export function initializeAuth() {
    // Form switching
    document.getElementById('showSignup')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('loginForm')?.classList.add('hidden');
        document.getElementById('signupForm')?.classList.remove('hidden');
    });

    document.getElementById('showLogin')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('signupForm')?.classList.add('hidden');
        document.getElementById('loginForm')?.classList.remove('hidden');
    });

    // Forgot password
    document.getElementById('forgotPasswordLink')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('loginForm')?.classList.add('hidden');
        document.getElementById('forgotPasswordForm')?.classList.remove('hidden');
    });

    document.getElementById('backToLoginLink')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('forgotPasswordForm')?.classList.add('hidden');
        document.getElementById('loginForm')?.classList.remove('hidden');
    });

    // Auth handlers
    document.getElementById('loginButton')?.addEventListener('click', handleLogin);
    document.getElementById('signupButton')?.addEventListener('click', handleSignup);
    document.getElementById('sendResetLink')?.addEventListener('click', handlePasswordReset);

    // Check session
    checkSession();
}

async function handleLogin() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        showError('Please enter both email and password');
        return;
    }

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        document.getElementById('authContainer').classList.add('hidden');
        document.getElementById('appContainer').classList.remove('hidden');
        
        await initializeUI();
        await loadTasks();

    } catch (error) {
        console.error('Login error:', error);
        showError(error.message);
    }
}

async function handleSignup() {
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
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: window.location.origin
            }
        });

        if (error) throw error;

        showError('Please check your email for confirmation link');
        document.getElementById('signupForm').classList.add('hidden');
        document.getElementById('loginForm').classList.remove('hidden');

    } catch (error) {
        console.error('Signup error:', error);
        showError(error.message);
    }
}

async function handlePasswordReset() {
    const email = document.getElementById('resetEmail').value;

    if (!email) {
        showError('Please enter your email address');
        return;
    }

    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
        });

        if (error) throw error;

        showError('Password reset link sent! Please check your email.');
        document.getElementById('forgotPasswordForm').classList.add('hidden');
        document.getElementById('loginForm').classList.remove('hidden');

    } catch (error) {
        console.error('Reset password error:', error);
        showError(error.message);
    }
}

async function checkSession() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;

        if (session) {
            document.getElementById('authContainer').classList.add('hidden');
            document.getElementById('appContainer').classList.remove('hidden');
            
            await initializeUI();
            await loadTasks();
        } else {
            document.getElementById('authContainer').classList.remove('hidden');
            document.getElementById('appContainer').classList.add('hidden');
        }
    } catch (error) {
        console.error('Session check error:', error);
        document.getElementById('authContainer').classList.remove('hidden');
        document.getElementById('appContainer').classList.add('hidden');
    }
} 