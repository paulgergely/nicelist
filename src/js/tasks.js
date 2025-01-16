import { supabase } from './config.js';
import { showError } from './utils.js';
import { renderTasks } from './ui.js';

// State
export let taskCache = new Map();
export let currentTaskId = null;
export let taskPath = [];

export function setCurrentTaskId(id) {
    currentTaskId = id;
}

export function setTaskPath(path) {
    taskPath = path;
}

export async function loadTasks() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { data: tasks, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', user.id)
            .order('position');
            
        if (error) throw error;

        taskCache.clear();
        tasks.forEach(task => taskCache.set(task.id, task));
        renderTasks(taskCache);
    } catch (error) {
        showError(error.message);
    }
}

export async function createTask(text, parentId = null) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const tasksByParent = getTasksByParentFromCache();
        const siblings = tasksByParent.get(parentId || 'root') || [];
        const maxPosition = siblings.reduce((max, task) => Math.max(max, task.position || 0), 0);
        
        const { data: task, error } = await supabase
            .from('tasks')
            .insert([{ 
                text,
                parent_id: parentId,
                position: maxPosition + 1,
                completed: false,
                user_id: user.id
            }])
            .select()
            .single();
            
        if (error) throw error;
        
        taskCache.set(task.id, task);
        await loadTasks();
    } catch (error) {
        showError(error.message);
    }
}

export async function deleteTask(taskId) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // Get all descendant task IDs (children, grandchildren, etc.)
        const descendantIds = getDescendantTaskIds(taskId);
        
        // Delete descendants first (from bottom up to avoid FK constraints)
        if (descendantIds.length > 0) {
            const { error: childError } = await supabase
                .from('tasks')
                .delete()
                .in('id', descendantIds)
                .eq('user_id', user.id);
                
            if (childError) throw childError;
        }
        
        // Delete the task itself
        const { error } = await supabase
            .from('tasks')
            .delete()
            .eq('id', taskId)
            .eq('user_id', user.id);
            
        if (error) throw error;

        // If we deleted the current task, navigate to root
        if (taskId === currentTaskId) {
            navigateToRoot();
        } else {
            // Otherwise just reload tasks
            await loadTasks();
        }
    } catch (error) {
        console.error('Error deleting task:', error);
        showError(error.message);
    }
}

function getDescendantTaskIds(taskId) {
    const descendants = [];
    const tasksByParent = getTasksByParentFromCache();
    
    function addChildren(parentId) {
        const children = tasksByParent.get(parentId) || [];
        children.forEach(child => {
            descendants.push(child.id);
            addChildren(child.id);
        });
    }
    
    addChildren(taskId);
    return descendants;
}

export async function toggleTask(taskId) {
    try {
        const task = taskCache.get(taskId);
        if (!task) return;
        
        const { error } = await supabase
            .from('tasks')
            .update({ completed: !task.completed })
            .eq('id', taskId);
            
        if (error) throw error;
        
        task.completed = !task.completed;
        taskCache.set(taskId, task);
        await loadTasks();
    } catch (error) {
        showError(error.message);
    }
}

function getNextPosition(parentId) {
    const siblings = Array.from(taskCache.values())
        .filter(t => t.parent_id === parentId);
    return siblings.length > 0 
        ? Math.max(...siblings.map(t => t.position || 0)) + 1 
        : 0;
}

export function getTaskPathFromCache(id) {
    const path = [];
    let currentId = id;
    
    while (currentId) {
        const task = taskCache.get(currentId);
        if (!task) break;
        path.unshift(task.id);
        currentId = task.parent_id;
    }
    
    return path;
}

export function getTasksByParentFromCache() {
    const tasksByParent = new Map();
    taskCache.forEach(task => {
        const parentId = task.parent_id || 'root';
        if (!tasksByParent.has(parentId)) {
            tasksByParent.set(parentId, []);
        }
        tasksByParent.get(parentId).push(task);
    });
    return tasksByParent;
} 