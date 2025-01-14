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

function initializeUI() {
    console.log('Initializing UI');
    initializeTaskInput();
    initializeUserMenu();
    initializeAccountView();
    updateUserDisplay();
}

function initializeTaskInput() {
    console.log('Initializing task inputs');
    
    const mainInput = document.getElementById('mainTaskInput');
    const subtaskInput = document.getElementById('subtaskInput');
    
    if (mainInput) {
        mainInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                const text = mainInput.value.trim();
                if (!text) return;
                
                try {
                    await createTask(text, currentTaskId);
                    mainInput.value = '';
                    await loadTasks();
                } catch (error) {
                    console.error('Error creating task:', error);
                    showError(error.message);
                }
            }
        });
    }

    if (subtaskInput) {
        subtaskInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                const text = subtaskInput.value.trim();
                if (!text) return;
                
                try {
                    await createTask(text, currentTaskId);
                    subtaskInput.value = '';
                    await loadTasks();
                } catch (error) {
                    console.error('Error creating task:', error);
                    showError(error.message);
                }
            }
        });
    }
}

function initializeUserMenu() {
    const userMenuButton = document.getElementById('userMenuButton');
    const userMenu = document.getElementById('userMenu');
    const logoutLink = document.getElementById('logoutLink');
    
    if (userMenuButton && userMenu) {
        userMenuButton.onclick = (e) => {
            e.stopPropagation();
            userMenu.classList.toggle('hidden');
        };
        
        document.addEventListener('click', (e) => {
            if (!userMenuButton.contains(e.target) && !userMenu.contains(e.target)) {
                userMenu.classList.add('hidden');
            }
        });
    }
    
    logoutLink?.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            window.location.reload();
        } catch (error) {
            showError('Error signing out');
        }
    });
}

function initializeAccountView() {
    const accountLink = document.getElementById('accountLink');
    accountLink?.addEventListener('click', (e) => {
        e.preventDefault();
        showAccountView();
    });
    
    initializeProfileSettings();
    initializePreferences();
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
    console.log('Rendering tasks:', taskCache);
    
    // Get the appropriate task list based on current view
    const taskList = currentTaskId 
        ? document.getElementById('subtaskList')
        : document.getElementById('mainTaskList');
    
    if (!taskList) {
        console.error('Task list element not found');
        return;
    }
    
    taskList.innerHTML = '';
    const tasksByParent = getTasksByParentFromCache();
    
    // Show nested tasks in both main view and task detail view
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
    div.className = 'flex items-center space-x-2 py-2 px-3 rounded-lg hover:bg-gray-50';
    
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
    });
    
    div.addEventListener('mouseleave', () => {
        deleteBtn.classList.add('hidden');
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

export {
    initializeUI,
    renderTasks,
    navigateToRoot
}; 