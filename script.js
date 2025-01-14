import { supabase } from './config.js'
import { showLoading, hideLoading, showError } from './ui-helpers.js'

// Variables
let taskCache = new Map();
let lastFetchTime = 0;
let currentUserEmail = '';
const CACHE_DURATION = 5000; // 5 seconds cache
let currentTaskId = null;
let taskPath = [];
let saveTimeout;

// Error handling wrapper
function withErrorHandling(fn) {
    return async (...args) => {
        try {
            showLoading();
            await fn(...args);
        } catch (error) {
            console.error('Operation error:', error);
            showError(error.message);
        } finally {
            hideLoading();
        }
    };
}

// Task loading
export async function loadTasks() {
    try {
        const now = Date.now();
        if (taskCache.size > 0 && (now - lastFetchTime) < CACHE_DURATION) {
            renderTasksFromCache();
            return;
        }

        const { data: tasks, error } = await supabase
            .from('tasks')
            .select('*')
            .order('position');
            
        if (error) throw error;

        taskCache.clear();
        tasks.forEach(task => taskCache.set(task.id, task));
        lastFetchTime = now;

        renderTasksFromCache();
    } catch (error) {
        showError(error.message);
    }
}

// Navigation
export function navigateToTasks() {
    // Hide all other views
    document.getElementById('accountPage')?.classList.add('hidden');
    document.getElementById('taskView')?.classList.add('hidden');
    
    // Show main view
    document.getElementById('mainView')?.classList.remove('hidden');
    
    // Reset task view state if needed
    currentTaskId = null;
    taskPath = [];
    
    // Refresh tasks
    loadTasks();
}

// Profile photo update
export function updateProfilePhotos(email) {
    const initial = email.charAt(0).toUpperCase();
    
    // Update header profile photo
    const headerPhoto = document.getElementById('headerProfilePhoto');
    if (headerPhoto) headerPhoto.textContent = initial;
    
    // Update account page profile photo
    const profilePhoto = document.getElementById('profilePhoto');
    if (profilePhoto) profilePhoto.textContent = initial;
    
    // Update account page email
    const accountEmail = document.getElementById('accountEmail');
    if (accountEmail) accountEmail.textContent = email;
}

// Add this function after loadTasks
function renderTasksFromCache() {
    const taskList = document.getElementById('taskList');
    if (!taskList) return;
    
    taskList.innerHTML = '';
    const tasksByParent = getTasksByParentFromCache();
    
    // Render only root level tasks (those without parent)
    const rootTasks = tasksByParent.get('root') || [];
    rootTasks.sort((a, b) => (a.position || 0) - (b.position || 0));
    
    rootTasks.forEach(task => {
        const taskElement = createTaskElement(task, 0);
        taskList.appendChild(taskElement);
        renderChildTasks(task.id, taskElement.querySelector('ul'), 1, tasksByParent);
    });
}

// Helper function to create task elements
function createTaskElement(task, depth) {
    const li = document.createElement('li');
    li.dataset.id = task.id;
    li.className = 'task-item group';
    
    const div = document.createElement('div');
    div.className = `flex items-center space-x-2 p-2 ${depth > 0 ? 'ml-6' : ''}`;
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.completed;
    checkbox.className = 'form-checkbox h-4 w-4 text-blue-600';
    checkbox.onclick = () => toggleTask(task.id);
    
    const span = document.createElement('span');
    span.textContent = task.text;
    span.className = task.completed ? 'line-through text-gray-500 flex-grow' : 'cursor-pointer hover:text-gray-600 flex-grow';
    span.onclick = () => openTaskView(task);
    
    const deleteButton = document.createElement('button');
    deleteButton.className = 'hidden group-hover:block text-gray-400 hover:text-red-600';
    deleteButton.innerHTML = `
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
    `;
    deleteButton.onclick = () => deleteTask(task.id);
    
    div.appendChild(checkbox);
    div.appendChild(span);
    div.appendChild(deleteButton);
    
    li.appendChild(div);
    
    // Add container for nested tasks
    const ul = document.createElement('ul');
    ul.className = 'nested-tasks pl-0';
    li.appendChild(ul);
    
    return li;
}

// Helper function to render child tasks
function renderChildTasks(parentId, container, depth, tasksByParent) {
    if (!container || !parentId) return;
    
    const children = tasksByParent.get(parentId) || [];
    children.sort((a, b) => (a.position || 0) - (b.position || 0));
    
    children.forEach(task => {
        const taskElement = createTaskElement(task, depth);
        container.appendChild(taskElement);
        // Recursively render children
        renderChildTasks(task.id, taskElement.querySelector('ul'), depth + 1, tasksByParent);
    });
}

// Task view handling
async function openTaskView(task) {
    try {
        currentTaskId = task.id;
        taskPath = getTaskPathFromCache(task.id);
        
        document.getElementById('mainView')?.classList.add('hidden');
        document.getElementById('taskView')?.classList.remove('hidden');
        
        createBreadcrumbs();
        
        const currentTask = taskCache.get(task.id);
        if (!currentTask) throw new Error('Task not found');

        const titleElement = document.getElementById('taskViewTitle');
        if (titleElement) {
            titleElement.textContent = currentTask.text;
            titleElement.className = 'text-xl font-semibold ' + 
                (currentTask.completed ? 'line-through text-gray-500' : '');
        }
        
        const currentTaskCheckbox = document.getElementById('currentTaskCheckbox');
        if (currentTaskCheckbox) {
            currentTaskCheckbox.checked = currentTask.completed;
            currentTaskCheckbox.onclick = () => toggleTask(currentTask.id);
        }
        
        const detailsTextarea = document.getElementById('taskDetails');
        if (detailsTextarea) {
            detailsTextarea.value = currentTask.details || '';
            autoResizeTextarea(detailsTextarea);
            
            detailsTextarea.oninput = () => {
                autoResizeTextarea(detailsTextarea);
                if (saveTimeout) clearTimeout(saveTimeout);
                saveTimeout = setTimeout(() => {
                    saveTaskDetails(currentTask.id, detailsTextarea.value);
                }, 500);
            };
        }
        
        const nestedList = document.getElementById('nestedTaskList');
        if (nestedList) {
            nestedList.innerHTML = '';
            renderChildTasks(task.id, nestedList, 0, getTasksByParentFromCache());
        }
        
    } catch (error) {
        showError(error.message);
    }
}

// Helper functions for task view
function getTaskPathFromCache(id) {
    const path = [];
    let currentId = id;
    
    while (currentId) {
        const task = taskCache.get(currentId);
        if (task) {
            path.unshift(task.id);
            currentId = task.parent_id;
        } else {
            currentId = null;
        }
    }
    
    return path;
}

function getTasksByParentFromCache() {
    const tasksByParent = new Map();
    
    // Initialize root tasks array
    tasksByParent.set('root', []);
    
    // Group tasks by their parent_id
    taskCache.forEach(task => {
        const parentId = task.parent_id || 'root';
        if (!tasksByParent.has(parentId)) {
            tasksByParent.set(parentId, []);
        }
        tasksByParent.get(parentId).push(task);
    });
    
    return tasksByParent;
}

function createBreadcrumbs() {
    const container = document.getElementById('breadcrumbs');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Add "home" link for root
    const homeLink = document.createElement('a');
    homeLink.href = '#';
    homeLink.textContent = 'home';
    homeLink.className = 'text-gray-500 hover:text-gray-700';
    homeLink.onclick = (e) => {
        e.preventDefault();
        navigateToRoot();
    };
    container.appendChild(homeLink);
    
    // Add task path
    if (taskPath && taskPath.length > 0) {
        taskPath.forEach((taskId, index) => {
            const task = taskCache.get(taskId);
            if (!task) return;
            
            const separator = document.createElement('span');
            separator.textContent = ' / ';
            separator.className = 'text-gray-400 mx-2';
            container.appendChild(separator);
            
            const link = document.createElement('a');
            link.href = '#';
            link.textContent = task.text;
            
            if (index < taskPath.length - 1) {
                link.className = 'text-gray-500 hover:text-gray-700';
                link.onclick = (e) => {
                    e.preventDefault();
                    openTaskView(task);
                };
            } else {
                link.className = 'text-gray-900';
            }
            
            container.appendChild(link);
        });
    }
}

function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    const newHeight = Math.max(72, textarea.scrollHeight);
    textarea.style.height = newHeight + 'px';
}

async function saveTaskDetails(taskId, details) {
    try {
        const { error } = await supabase
            .from('tasks')
            .update({ details })
            .eq('id', taskId);
            
        if (error) throw error;
        
        // Update cache
        const task = taskCache.get(taskId);
        if (task) {
            task.details = details;
            taskCache.set(taskId, task);
        }
        
        showSaveIndicator();
    } catch (error) {
        showError('Error saving details: ' + error.message);
    }
}

function showSaveIndicator() {
    let indicator = document.querySelector('.save-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'save-indicator';
        indicator.textContent = 'Changes saved';
        document.getElementById('taskDetails')?.parentElement.appendChild(indicator);
    }
    
    requestAnimationFrame(() => {
        indicator.classList.add('show');
        setTimeout(() => {
            indicator.classList.remove('show');
        }, 2000);
    });
}

// Make sure navigateToRoot is defined
function navigateToRoot() {
    currentTaskId = null;
    taskPath = [];
    
    document.getElementById('taskView')?.classList.add('hidden');
    document.getElementById('mainView')?.classList.remove('hidden');
    
    loadTasks();
}

// Add task functionality
async function addTask(text, parentId = null) {
    try {
        showLoading();
        const position = getNextPosition(parentId);
        
        const { data: task, error } = await supabase
            .from('tasks')
            .insert([
                { 
                    text,
                    parent_id: parentId,
                    position,
                    completed: false
                }
            ])
            .select()
            .single();
            
        if (error) throw error;
        
        // Add to cache
        taskCache.set(task.id, task);
        
        // Refresh view
        if (currentTaskId) {
            // In task view
            const nestedList = document.getElementById('nestedTaskList');
            if (nestedList) {
                const taskElement = createTaskElement(task, 0);
                nestedList.appendChild(taskElement);
            }
        } else {
            // In main view
            await loadTasks();
        }
        
    } catch (error) {
        showError(error.message);
    } finally {
        hideLoading();
    }
}

// Add task button handler
document.addEventListener('DOMContentLoaded', () => {
    const addTaskButton = document.getElementById('addTaskButton');
    const newTaskInput = document.getElementById('newTaskInput');
    
    if (addTaskButton && newTaskInput) {
        // Add button click handler
        addTaskButton.onclick = async () => {
            const text = newTaskInput.value.trim();
            if (!text) return;
            
            try {
                showLoading();
                
                // Get current user
                const { data: { user }, error: userError } = await supabase.auth.getUser();
                if (userError) throw userError;
                
                const { data: task, error } = await supabase
                    .from('tasks')
                    .insert([{ 
                        text,
                        completed: false,
                        position: getNextPosition(null),
                        user_id: user.id  // Add user_id to the task
                    }])
                    .select()
                    .single();
                    
                if (error) throw error;
                
                // Add to cache and refresh
                taskCache.set(task.id, task);
                newTaskInput.value = '';
                await loadTasks();
                
            } catch (error) {
                showError(error.message);
            } finally {
                hideLoading();
            }
        };
        
        // Enter key handler
        newTaskInput.onkeypress = async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addTaskButton.click();
            }
        };
    }
});

// Helper function for task positioning
function getNextPosition(parentId) {
    const siblings = Array.from(taskCache.values())
        .filter(t => t.parent_id === parentId);
    return siblings.length > 0 
        ? Math.max(...siblings.map(t => t.position || 0)) + 1 
        : 0;
}

// Rest of your existing functions without any exports...