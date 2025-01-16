import { supabase } from './config.js';
import { showError } from './utils.js';
import { 
    taskCache, 
    currentTaskId, 
    taskPath, 
    createTask, 
    deleteTask, 
    toggleTask, 
    getTaskPathFromCache, 
    getTasksByParentFromCache,
    setCurrentTaskId,
    setTaskPath,
    loadTasks
} from './tasks.js';

document.addEventListener('keydown', (e) => {
    // Check for Cmd+Backspace (Mac) or Ctrl+Backspace (Windows)
    if ((e.metaKey || e.ctrlKey) && e.key === 'Backspace') {
        e.preventDefault(); // Prevent browser back
        
        // Only handle if we're in a task view
        if (currentTaskId) {
            const taskPath = getTaskPathFromCache(currentTaskId);
            
            // If we have a path and it's longer than 1 (not at root)
            if (taskPath.length > 1) {
                // Go to parent task
                const parentTaskId = taskPath[taskPath.length - 2];
                const parentTask = taskCache.get(parentTaskId);
                if (parentTask) {
                    openTaskView(parentTask);
                }
            } else {
                // If at first level, go to root
                navigateToRoot();
            }
        }
    }
});

function initializeUI() {
    initializeTaskInput();
    initializeUserMenu();
    initializeAccountView();
    updateUserDisplay();
}

function initializeTaskInput() {
    // Remove old event listeners by cloning the elements
    const mainInput = document.getElementById('mainTaskInput');
    const subtaskInput = document.getElementById('subtaskInput');
    
    if (mainInput) {
        const newMainInput = mainInput.cloneNode(true);
        mainInput.parentNode.replaceChild(newMainInput, mainInput);
        
        newMainInput.addEventListener('keyup', async (e) => {
            if (e.key === 'Enter') {
                const text = newMainInput.value.trim();
                if (!text) return;
                
                try {
                    await createTask(text);
                    newMainInput.value = '';
                } catch (error) {
                    showError(error.message);
                }
            }
        });
    }

    if (subtaskInput) {
        const newSubtaskInput = subtaskInput.cloneNode(true);
        subtaskInput.parentNode.replaceChild(newSubtaskInput, subtaskInput);
        
        newSubtaskInput.addEventListener('keyup', async (e) => {
            if (e.key === 'Enter') {
                const text = newSubtaskInput.value.trim();
                if (!text) return;
                
                try {
                    await createTask(text, currentTaskId);
                    newSubtaskInput.value = '';
                } catch (error) {
                    showError(error.message);
                }
            }
        });
    }
}

function initializeUserMenu() {
    const userMenuButton = document.getElementById('userMenuButton');
    const userMenu = document.getElementById('userMenu');
    const accountLink = document.getElementById('accountLink');
    const logoutLink = document.getElementById('logoutLink');
    
    if (userMenuButton) {
        userMenuButton.onclick = () => {
            userMenu.classList.toggle('hidden');
        };
    }
    
    if (accountLink) {
        accountLink.onclick = (e) => {
            e.preventDefault();
            document.getElementById('mainView')?.classList.add('hidden');
            document.getElementById('taskView')?.classList.add('hidden');
            document.getElementById('accountView')?.classList.remove('hidden');
            userMenu.classList.add('hidden');
        };
    }
    
    if (logoutLink) {
        logoutLink.onclick = async (e) => {
            e.preventDefault();
            const { error } = await supabase.auth.signOut();
            if (error) showError(error.message);
        };
    }
}

async function initializeAccountView() {
    const changeEmailButton = document.getElementById('changeEmailButton');
    const emailChangeModal = document.getElementById('emailChangeModal');
    const cancelEmailChange = document.getElementById('cancelEmailChange');
    const confirmEmailChange = document.getElementById('confirmEmailChange');
    const newEmailInput = document.getElementById('newEmailInput');
    const accountEmail = document.getElementById('accountEmail');
    const deleteAccountButton = document.getElementById('deleteAccountButton');
    const deleteAccountModal = document.getElementById('deleteAccountModal');
    const cancelDeleteAccount = document.getElementById('cancelDeleteAccount');
    const confirmDeleteAccount = document.getElementById('confirmDeleteAccount');
    const backToTasks = document.getElementById('backToTasks');
    
    // Display current email
    const { data: { user } } = await supabase.auth.getUser();
    if (user && accountEmail) {
        accountEmail.textContent = user.email;
    }
    
    // Load task metrics
    const { data: tasks, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id);
        
    if (!error && tasks) {
        const openTasks = tasks.filter(t => !t.completed).length;
        const completedTasks = tasks.filter(t => t.completed).length;
        const totalTasks = tasks.length;
        
        document.getElementById('openTasksCount').textContent = openTasks;
        document.getElementById('completedTasksCount').textContent = completedTasks;
        document.getElementById('totalTasksCount').textContent = totalTasks;
    }
    
    // Back to tasks link
    if (backToTasks) {
        backToTasks.onclick = (e) => {
            e.preventDefault();
            document.getElementById('accountView').classList.add('hidden');
            document.getElementById('mainView').classList.remove('hidden');
        };
    }
    
    // Email change handlers
    if (changeEmailButton) {
        changeEmailButton.onclick = () => {
            emailChangeModal.classList.remove('hidden');
            newEmailInput.value = '';
            newEmailInput.focus();
        };
    }
    
    if (cancelEmailChange) {
        cancelEmailChange.onclick = () => {
            emailChangeModal.classList.add('hidden');
        };
    }
    
    if (confirmEmailChange) {
        confirmEmailChange.onclick = async () => {
            const newEmail = newEmailInput.value.trim();
            if (!newEmail) return;
            
            try {
                const { error } = await supabase.auth.updateUser({ email: newEmail });
                if (error) throw error;
                
                emailChangeModal.classList.add('hidden');
                showMessage('Check your email to confirm the change');
            } catch (error) {
                showError(error.message);
            }
        };
    }
    
    // Delete account handlers
    if (deleteAccountButton) {
        deleteAccountButton.onclick = () => {
            deleteAccountModal.classList.remove('hidden');
        };
    }
    
    if (cancelDeleteAccount) {
        cancelDeleteAccount.onclick = () => {
            deleteAccountModal.classList.add('hidden');
        };
    }
    
    if (confirmDeleteAccount) {
        confirmDeleteAccount.onclick = async () => {
            try {
                // Delete all user's tasks
                const { error: tasksError } = await supabase
                    .from('tasks')
                    .delete()
                    .eq('user_id', user.id);
                if (tasksError) throw tasksError;
                
                // Delete user account
                const { error: userError } = await supabase.auth.admin.deleteUser(user.id);
                if (userError) throw userError;
                
                // Sign out
                await supabase.auth.signOut();
            } catch (error) {
                showError(error.message);
            }
        };
    }
    
    // Close modals if clicking outside
    emailChangeModal?.addEventListener('click', (e) => {
        if (e.target === emailChangeModal) {
            emailChangeModal.classList.add('hidden');
        }
    });
    
    deleteAccountModal?.addEventListener('click', (e) => {
        if (e.target === deleteAccountModal) {
            deleteAccountModal.classList.add('hidden');
        }
    });
}

async function updateUserDisplay() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const userEmail = user.email;
            document.getElementById('userEmail').textContent = userEmail;
            
            const initial = userEmail.charAt(0).toUpperCase();
            const profilePhoto = document.getElementById('profilePhoto');
            if (profilePhoto) {
                profilePhoto.textContent = initial;
            }
        }
    } catch (error) {
        console.error('Error updating user display:', error);
    }
}

function renderTasks(taskCache) {
    const taskList = currentTaskId 
        ? document.getElementById('subtaskList')
        : document.getElementById('mainTaskList');
    
    if (!taskList) return;
    
    taskList.innerHTML = '';
    const tasksByParent = getTasksByParentFromCache();
    
    const rootTasks = tasksByParent.get(currentTaskId || 'root') || [];
    rootTasks.sort((a, b) => (a.position || 0) - (b.position || 0));
    
    rootTasks.forEach(task => {
        const taskElement = createTaskElement(task, 0);
        taskList.appendChild(taskElement);
        renderChildTasks(task.id, taskElement, 1, tasksByParent);
    });
}

function renderChildTasks(parentId, parentElement, depth, tasksByParent) {
    const children = tasksByParent.get(parentId) || [];
    if (children.length === 0) return;
    
    const childList = document.createElement('ul');
    childList.className = 'ml-6 mt-1 space-y-1';
    
    // Sort children by position in ascending order
    children.sort((a, b) => (a.position || 0) - (b.position || 0));
    
    children.forEach(task => {
        const taskElement = createTaskElement(task, depth);
        childList.appendChild(taskElement);
        renderChildTasks(task.id, taskElement, depth + 1, tasksByParent);
    });
    
    parentElement.appendChild(childList);
}

function createTaskElement(task, depth) {
    const li = document.createElement('li');
    li.className = 'relative';
    
    const div = document.createElement('div');
    div.className = 'flex items-center space-x-2 py-2 px-3 rounded-lg transition-colors duration-75';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500';
    checkbox.checked = task.completed;
    checkbox.onclick = () => toggleTask(task.id);
    
    const span = document.createElement('span');
    span.textContent = task.text;
    span.className = task.completed 
        ? 'flex-grow text-gray-500 line-through' 
        : 'flex-grow cursor-pointer hover:text-gray-600';
    span.onclick = () => openTaskView(task);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'hidden p-1 rounded-md hover:bg-gray-200';
    deleteBtn.innerHTML = `
        <svg class="w-4 h-4 text-gray-400 hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
    `;
    deleteBtn.onclick = () => deleteTask(task.id);
    
    div.addEventListener('mouseenter', () => {
        deleteBtn.classList.remove('hidden');
        div.classList.add('bg-gray-50');
    });
    
    div.addEventListener('mouseleave', () => {
        deleteBtn.classList.add('hidden');
        div.classList.remove('bg-gray-50');
    });
    
    div.appendChild(checkbox);
    div.appendChild(span);
    div.appendChild(deleteBtn);
    li.appendChild(div);
    
    return li;
}

function openTaskView(task) {
    setCurrentTaskId(task.id);
    
    const taskPath = getTaskPathFromCache(task.id);
    setTaskPath(taskPath);
    
    // Update task title and checkbox
    const taskViewTitle = document.getElementById('taskViewTitle');
    const taskViewCheckbox = document.getElementById('taskViewCheckbox');
    
    if (taskViewTitle) taskViewTitle.textContent = task.text;
    if (taskViewCheckbox) {
        taskViewCheckbox.checked = task.completed;
        taskViewCheckbox.onclick = () => toggleTask(task.id);
    }
    
    // Restore breadcrumbs
    updateBreadcrumbs(taskPath);
    
    // Update view visibility
    document.getElementById('mainView')?.classList.add('hidden');
    document.getElementById('taskView')?.classList.remove('hidden');
    
    loadTasks();
}

function updateBreadcrumbs(taskPath) {
    const breadcrumbs = document.getElementById('breadcrumbs');
    if (!breadcrumbs) return;
    
    breadcrumbs.innerHTML = '';
    
    // Add Home link
    const homeLink = document.createElement('a');
    homeLink.href = '#';
    homeLink.className = 'text-gray-500 hover:text-gray-700';
    homeLink.textContent = 'Home';
    homeLink.onclick = (e) => {
        e.preventDefault();
        navigateToRoot();
    };
    breadcrumbs.appendChild(homeLink);
    
    // Add path items
    taskPath.forEach((taskId, index) => {
        // Add separator
        const separator = document.createElement('span');
        separator.className = 'mx-2 text-gray-400';
        separator.textContent = '/';
        breadcrumbs.appendChild(separator);
        
        const task = taskCache.get(taskId);
        if (!task) return;
        
        const link = document.createElement('a');
        link.href = '#';
        
        if (index === taskPath.length - 1) {
            link.className = 'text-gray-900';
            link.onclick = (e) => e.preventDefault();
        } else {
            link.className = 'text-gray-500 hover:text-gray-700';
            link.onclick = (e) => {
                e.preventDefault();
                openTaskView(task);
            };
        }
        
        link.textContent = task.text;
        breadcrumbs.appendChild(link);
    });
}

function navigateToRoot() {
    setCurrentTaskId(null);
    setTaskPath([]);
    
    document.getElementById('taskView')?.classList.add('hidden');
    document.getElementById('mainView')?.classList.remove('hidden');
    
    loadTasks();
}

async function initializeProfileSettings() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const profileEmail = document.getElementById('profileEmail');
    if (profileEmail) {
        profileEmail.value = user.email;
    }
    
    const changeEmailBtn = document.getElementById('changeEmailBtn');
    changeEmailBtn?.addEventListener('click', async () => {
        const newEmail = prompt('Enter new email:');
        if (!newEmail) return;
        
        try {
            const { error } = await supabase.auth.updateUser({ email: newEmail });
            if (error) throw error;
            showError('Verification email sent. Please check your email.');
        } catch (error) {
            showError(error.message);
        }
    });
    
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    changePasswordBtn?.addEventListener('click', async () => {
        const newPassword = prompt('Enter new password:');
        if (!newPassword) return;
        
        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
            showError('Password updated successfully');
        } catch (error) {
            showError(error.message);
        }
    });
}

function initializePreferences() {
    const themeSelect = document.getElementById('themeSelect');
    const defaultViewSelect = document.getElementById('defaultViewSelect');
    
    const preferences = loadPreferences();
    if (themeSelect) themeSelect.value = preferences.theme;
    if (defaultViewSelect) defaultViewSelect.value = preferences.defaultView;
    
    applyTheme(preferences.theme);
    
    themeSelect?.addEventListener('change', (e) => {
        const theme = e.target.value;
        savePreferences({ ...preferences, theme });
        applyTheme(theme);
    });
    
    defaultViewSelect?.addEventListener('change', (e) => {
        const defaultView = e.target.value;
        savePreferences({ ...preferences, defaultView });
    });
}

function loadPreferences() {
    const defaultPreferences = {
        theme: 'light',
        defaultView: 'list'
    };
    
    const saved = localStorage.getItem('preferences');
    return saved ? { ...defaultPreferences, ...JSON.parse(saved) } : defaultPreferences;
}

function savePreferences(preferences) {
    localStorage.setItem('preferences', JSON.stringify(preferences));
}

function applyTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else if (theme === 'light') {
        document.documentElement.classList.remove('dark');
    } else if (theme === 'system') {
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }
}

function showAccountView() {
    document.getElementById('mainView')?.classList.add('hidden');
    document.getElementById('taskView')?.classList.add('hidden');
    document.getElementById('accountView')?.classList.remove('hidden');
    document.getElementById('userMenu')?.classList.add('hidden');
}

function navigateBack() {
    if (!currentTaskId) return;
    
    const taskPath = getTaskPathFromCache(currentTaskId);
    
    // Get the parent task ID (one level up)
    const parentTaskId = taskCache.get(currentTaskId)?.parent_id;
    
    if (parentTaskId) {
        // If there's a parent, navigate to it
        const parentTask = taskCache.get(parentTaskId);
        if (parentTask) {
            openTaskView(parentTask);
        }
    } else {
        // If no parent (at root level), go to main view
        navigateToRoot();
    }
}

// Update the event listener to use the helper
document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Backspace') {
        e.preventDefault();
        navigateBack();
    }
});

export {
    initializeUI,
    renderTasks,
    navigateToRoot
}; 