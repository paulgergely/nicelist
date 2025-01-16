import { supabase } from './config.js';
import { initializeAuth } from './auth.js';
import { loadTasks } from './tasks.js';
import { initializeUI } from './ui.js';
import { showError } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        initializeAuth();
        initializeUI();
        
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
            await loadTasks();
        }
    } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to initialize application');
    }
}); 