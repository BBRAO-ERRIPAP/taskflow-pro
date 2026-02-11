// ==========================================
// TASKFLOW PRO - OPTIMIZED JAVASCRIPT
// WITH PARTIAL DOM UPDATES & DRAG-AND-DROP
// ==========================================

'use strict';

// Configuration
const CONFIG = {
    STORAGE_KEY: 'taskflow_tasks',
    VERSION: '1.4.0', // Updated version for optimized rendering
    TOAST_DURATION: 3000,
    UNDO_DURATION: 5000
};

// State Management
class TaskManager {
    constructor() {
        this.tasks = this.loadTasks();
        this.filter = 'all';
        this.sort = 'dateAdded';
        this.searchQuery = '';
        this.deletedTask = null;
        this.undoTimeout = null;
        this.draggedTaskId = null;
        this.dragTargetId = null;
        this.renderCache = new WeakMap(); // Cache for DOM elements
    }
    
    loadTasks() {
        try {
            const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
            const tasks = saved ? JSON.parse(saved) : [];
            
            // Ensure all tasks have order property
            tasks.forEach((task, index) => {
                if (task.order === undefined) {
                    task.order = index;
                }
            });
            
            return tasks;
        } catch (error) {
            console.error('Error loading tasks:', error);
            return [];
        }
    }
    
    saveTasks() {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(this.tasks));
        } catch (error) {
            console.error('Error saving tasks:', error);
        }
    }
    
    addTask(taskData) {
        const task = {
            id: Date.now().toString(),
            text: taskData.text.trim(),
            priority: taskData.priority || 'medium',
            category: taskData.category || '',
            dueDate: taskData.dueDate || null,
            completed: false,
            completedAt: null,
            createdAt: new Date().toISOString(),
            order: this.tasks.length
        };
        
        this.tasks.unshift(task);
        this.saveTasks();
        return task;
    }
    
    updateTask(id, updates) {
        const index = this.tasks.findIndex(task => task.id === id);
        if (index === -1) return false;
        
        this.tasks[index] = { ...this.tasks[index], ...updates };
        this.saveTasks();
        return true;
    }
    
    deleteTask(id) {
        const index = this.tasks.findIndex(task => task.id === id);
        if (index === -1) return null;
        
        this.deletedTask = this.tasks[index];
        this.tasks.splice(index, 1);
        
        // Update order for remaining tasks
        this.tasks.forEach((task, idx) => {
            task.order = idx;
        });
        
        this.saveTasks();
        
        // Clear previous undo timeout
        if (this.undoTimeout) {
            clearTimeout(this.undoTimeout);
        }
        
        // Set new undo timeout
        this.undoTimeout = setTimeout(() => {
            this.deletedTask = null;
        }, CONFIG.UNDO_DURATION);
        
        return this.deletedTask;
    }
    
    undoDelete() {
        if (!this.deletedTask) return false;
        
        this.tasks.unshift(this.deletedTask);
        // Update order for all tasks
        this.tasks.forEach((task, idx) => {
            task.order = idx;
        });
        
        this.saveTasks();
        const task = this.deletedTask;
        this.deletedTask = null;
        
        if (this.undoTimeout) {
            clearTimeout(this.undoTimeout);
            this.undoTimeout = null;
        }
        
        return task;
    }
    
    toggleTaskCompletion(id) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            if (task.completed) {
                task.completedAt = new Date().toISOString();
            } else {
                task.completedAt = null;
            }
            this.saveTasks();
            return task; // Return updated task for partial update
        }
        return null;
    }
    
    reorderTasks(draggedId, targetId) {
        const draggedIndex = this.tasks.findIndex(task => task.id === draggedId);
        const targetIndex = this.tasks.findIndex(task => task.id === targetId);
        
        if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) {
            return false;
        }
        
        // Remove the dragged task
        const [draggedTask] = this.tasks.splice(draggedIndex, 1);
        
        // Insert it at the target position
        this.tasks.splice(targetIndex, 0, draggedTask);
        
        // Update order property for all tasks
        this.tasks.forEach((task, index) => {
            task.order = index;
        });
        
        this.saveTasks();
        return true;
    }
    
    getFilteredTasks() {
        let filtered = [...this.tasks];
        
        // Apply filter
        switch (this.filter) {
            case 'pending':
                filtered = filtered.filter(task => !task.completed);
                break;
            case 'completed':
                filtered = filtered.filter(task => task.completed);
                break;
        }
        
        // Apply search
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            filtered = filtered.filter(task => 
                task.text.toLowerCase().includes(query) ||
                (task.category && task.category.toLowerCase().includes(query))
            );
        }
        
        // Apply sort
        filtered.sort(this.getSortFunction());
        
        return filtered;
    }
    
    getSortFunction() {
        switch (this.sort) {
            case 'dueDate':
                return (a, b) => {
                    if (!a.dueDate && !b.dueDate) return 0;
                    if (!a.dueDate) return 1;
                    if (!b.dueDate) return -1;
                    return new Date(a.dueDate) - new Date(b.dueDate);
                };
            case 'priority':
                const priorityOrder = { high: 0, medium: 1, low: 2 };
                return (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority];
            case 'name':
                return (a, b) => a.text.localeCompare(b.text);
            case 'manual':
                return (a, b) => a.order - b.order;
            default:
                return (a, b) => new Date(b.createdAt) - new Date(a.createdAt);
        }
    }
    
    clearCompleted() {
        const completedCount = this.tasks.filter(t => t.completed).length;
        this.tasks = this.tasks.filter(task => !task.completed);
        
        // Update order for remaining tasks
        this.tasks.forEach((task, idx) => {
            task.order = idx;
        });
        
        this.saveTasks();
        return completedCount;
    }
    
    clearAll() {
        const totalCount = this.tasks.length;
        this.tasks = [];
        this.saveTasks();
        return totalCount;
    }
    
    getStats() {
        const total = this.tasks.length;
        const completed = this.tasks.filter(t => t.completed).length;
        const pending = total - completed;
        const productivity = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        return { total, completed, pending, productivity };
    }
    
    calculateStreak() {
        if (this.tasks.length === 0) return 0;
        
        const uniqueDays = new Set();
        
        this.tasks.forEach(task => {
            if (task.completed && task.completedAt) {
                const date = new Date(task.completedAt);
                const dayKey = Date.UTC(
                    date.getUTCFullYear(),
                    date.getUTCMonth(),
                    date.getUTCDate()
                );
                uniqueDays.add(dayKey);
            }
        });
        
        if (uniqueDays.size === 0) return 0;
        
        const sortedDays = Array.from(uniqueDays).sort((a, b) => b - a);
        const now = new Date();
        const today = Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate()
        );
        
        const yesterday = today - 86400000;
        let streak = 0;
        let expectedDate = today;
        
        if (sortedDays[0] === today) {
            streak = 1;
            expectedDate = yesterday;
        } else if (sortedDays[0] === yesterday) {
            streak = 1;
            expectedDate = yesterday - 86400000;
        } else {
            return 0;
        }
        
        for (let i = 1; i < sortedDays.length; i++) {
            if (sortedDays[i] === expectedDate) {
                streak++;
                expectedDate -= 86400000;
            } else if (sortedDays[i] < expectedDate) {
                break;
            }
        }
        
        return streak;
    }
    
    exportTasks() {
        return JSON.stringify({
            version: CONFIG.VERSION,
            exportedAt: new Date().toISOString(),
            tasks: this.tasks
        }, null, 2);
    }
    
    importTasks(data) {
        try {
            const imported = JSON.parse(data);
            const tasks = imported.tasks || imported;
            
            if (!Array.isArray(tasks)) {
                throw new Error('Invalid data format');
            }
            
            tasks.forEach(task => {
                if (!this.tasks.some(t => t.id === task.id)) {
                    this.tasks.push({
                        id: task.id || Date.now().toString(),
                        text: task.text || '',
                        priority: task.priority || 'medium',
                        category: task.category || '',
                        dueDate: task.dueDate || null,
                        completed: Boolean(task.completed),
                        completedAt: task.completedAt || null,
                        createdAt: task.createdAt || new Date().toISOString(),
                        order: task.order || this.tasks.length
                    });
                }
            });
            
            // Update order for all tasks
            this.tasks.forEach((task, idx) => {
                task.order = idx;
            });
            
            this.saveTasks();
            return { success: true, count: tasks.length };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

// UI Controller with Optimized Partial Updates
class UIController {
    constructor(taskManager) {
        this.taskManager = taskManager;
        this.modals = {
            shortcuts: null,
            export: null
        };
        this.taskElements = new Map(); // Store task element references
        this.init();
    }
    
    init() {
        this.cacheDOM();
        this.initModals();
        this.bindEvents();
        this.initTheme();
        this.initDate();
        this.render();
    }
    
    cacheDOM() {
        // Form elements
        this.taskForm = document.getElementById('taskForm');
        this.taskInput = document.getElementById('taskInput');
        this.prioritySelect = document.getElementById('prioritySelect');
        this.categorySelect = document.getElementById('categorySelect');
        this.dueDate = document.getElementById('dueDate');
        this.addTaskBtn = document.getElementById('addTaskBtn');
        
        // List elements
        this.taskList = document.getElementById('taskList');
        this.errorMessage = document.getElementById('errorMessage');
        
        // Control elements
        this.filterButtons = document.querySelectorAll('.filter-btn');
        this.sortSelect = document.getElementById('sortSelect');
        this.searchInput = document.getElementById('searchInput');
        this.clearSearch = document.getElementById('clearSearch');
        
        // Action buttons
        this.clearCompletedBtn = document.getElementById('clearCompletedBtn');
        this.clearAllBtn = document.getElementById('clearAllBtn');
        this.exportBtn = document.getElementById('exportBtn');
        this.importBtn = document.getElementById('importBtn');
        
        // Theme toggle
        this.themeToggle = document.getElementById('themeToggle');
        
        // Analytics
        this.toggleAnalytics = document.getElementById('toggleAnalytics');
        this.analyticsSection = document.getElementById('analyticsSection');
        
        // Stats display
        this.totalTasks = document.getElementById('totalTasks');
        this.pendingTasks = document.getElementById('pendingTasks');
        this.completedTasks = document.getElementById('completedTasks');
        this.productivityScore = document.getElementById('productivityScore');
        this.productivityRing = document.getElementById('productivityRing');
        this.streakCount = document.getElementById('streakCount');
        
        // Filter counts
        this.filterCounts = {
            all: document.querySelector('[data-count="all"]'),
            pending: document.querySelector('[data-count="pending"]'),
            completed: document.querySelector('[data-count="completed"]')
        };
        
        // Analytics elements
        this.categoryBreakdown = document.getElementById('categoryBreakdown');
        this.insightsContent = document.getElementById('insightsContent');
        
        // Modals
        this.shortcutsModal = document.getElementById('shortcutsModal');
        this.exportModal = document.getElementById('exportModal');
        
        // Year
        this.currentYear = document.getElementById('currentYear');
    }
    
    initModals() {
        this.modals.shortcuts = {
            element: this.shortcutsModal,
            closeBtn: this.shortcutsModal.querySelector('.modal-close'),
            cancelBtn: document.getElementById('closeShortcuts'),
            isInitialized: false
        };
        
        this.modals.export = {
            element: this.exportModal,
            closeBtn: this.exportModal.querySelector('.modal-close'),
            cancelBtn: document.getElementById('cancelExport'),
            exportBtn: document.getElementById('exportJsonBtn'),
            copyBtn: document.getElementById('copyExportBtn'),
            exportData: document.getElementById('exportData'),
            isInitialized: false
        };
        
        this.initModalEventListeners();
    }
    
    initModalEventListeners() {
        if (!this.modals.shortcuts.isInitialized) {
            const closeShortcutsModal = () => this.closeModal('shortcuts');
            
            this.modals.shortcuts.closeBtn.addEventListener('click', closeShortcutsModal);
            this.modals.shortcuts.cancelBtn.addEventListener('click', closeShortcutsModal);
            this.modals.shortcuts.element.addEventListener('click', (e) => {
                if (e.target === this.modals.shortcuts.element) closeShortcutsModal();
            });
            
            this.modals.shortcuts.isInitialized = true;
        }
        
        if (!this.modals.export.isInitialized) {
            const closeExportModal = () => this.closeModal('export');
            
            this.modals.export.closeBtn.addEventListener('click', closeExportModal);
            this.modals.export.cancelBtn.addEventListener('click', closeExportModal);
            this.modals.export.element.addEventListener('click', (e) => {
                if (e.target === this.modals.export.element) closeExportModal();
            });
            
            this.modals.export.exportBtn.addEventListener('click', () => {
                const data = this.taskManager.exportTasks();
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `tasks-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
                
                closeExportModal();
                this.showToast('Tasks exported successfully!', 'success');
            });
            
            this.modals.export.copyBtn.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(this.modals.export.exportData.value);
                    this.showToast('Copied to clipboard!', 'success');
                } catch (err) {
                    this.modals.export.exportData.select();
                    document.execCommand('copy');
                    this.showToast('Copied to clipboard!', 'success');
                }
            });
            
            this.modals.export.isInitialized = true;
        }
    }
    
    bindEvents() {
        // Form submission
        this.taskForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddTask();
        });
        
        // Task input - Enter key to submit
        this.taskInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleAddTask();
            }
        });
        
        // Search
        this.searchInput.addEventListener('input', () => {
            this.taskManager.searchQuery = this.searchInput.value.trim();
            this.renderFullTaskList();
            this.clearSearch.style.display = this.taskManager.searchQuery ? 'block' : 'none';
        });
        
        this.clearSearch.addEventListener('click', () => {
            this.searchInput.value = '';
            this.taskManager.searchQuery = '';
            this.renderFullTaskList();
            this.clearSearch.style.display = 'none';
        });
        
        // Filters
        this.filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.filterButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.taskManager.filter = btn.dataset.filter;
                this.renderFullTaskList();
            });
        });
        
        // Sort - Add manual option
        const manualOption = document.createElement('option');
        manualOption.value = 'manual';
        manualOption.textContent = 'Manual (Drag Order)';
        this.sortSelect.appendChild(manualOption);
        
        this.sortSelect.addEventListener('change', () => {
            this.taskManager.sort = this.sortSelect.value;
            this.renderFullTaskList();
        });
        
        // Clear buttons
        this.clearCompletedBtn.addEventListener('click', () => {
            if (confirm('Clear all completed tasks?')) {
                const count = this.taskManager.clearCompleted();
                if (count > 0) {
                    this.showToast(`Cleared ${count} completed task${count > 1 ? 's' : ''}`, 'success');
                    this.renderFullTaskList();
                    this.updateStats();
                    this.renderAnalytics();
                } else {
                    this.showToast('No completed tasks to clear', 'info');
                }
            }
        });
        
        this.clearAllBtn.addEventListener('click', () => {
            if (confirm('This will delete ALL tasks. This cannot be undone. Continue?')) {
                const count = this.taskManager.clearAll();
                if (count > 0) {
                    this.showToast(`Cleared ${count} task${count > 1 ? 's' : ''}`, 'success');
                    this.renderFullTaskList();
                    this.updateStats();
                    this.renderAnalytics();
                }
            }
        });
        
        // Export/Import
        this.exportBtn.addEventListener('click', () => this.showExportModal());
        this.importBtn.addEventListener('click', () => this.handleImport());
        
        // Theme toggle
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        
        // Analytics toggle
        this.toggleAnalytics.addEventListener('click', () => {
            this.analyticsSection.classList.toggle('collapsed');
            const icon = this.toggleAnalytics.querySelector('i');
            icon.className = this.analyticsSection.classList.contains('collapsed') 
                ? 'fas fa-chevron-down' 
                : 'fas fa-chevron-up';
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                this.searchInput.focus();
            }
            
            if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                this.showShortcutsModal();
            }
            
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
            
            if (e.key === ' ' && !e.ctrlKey && !e.metaKey) {
                const focusedElement = document.activeElement;
                if (!focusedElement.matches('input, textarea, button, select')) {
                    e.preventDefault();
                    const taskItem = focusedElement.closest('.task-item');
                    if (taskItem) {
                        const taskId = taskItem.dataset.id;
                        this.handleToggleCompletion(taskId, taskItem);
                    }
                }
            }
        });
        
        // Show shortcuts button
        document.getElementById('showShortcuts').addEventListener('click', () => {
            this.showShortcutsModal();
        });
    }
    
    // ==========================================
    // OPTIMIZED RENDERING SYSTEM
    // ==========================================
    
    /**
     * Main render method - calls specific update methods
     * Instead of rebuilding everything, it updates only what's needed
     */
    render() {
        this.updateStats();
        this.renderAnalytics();
    }
    
    /**
     * Update only the task that was toggled
     */
    updateTaskElement(taskId, taskData) {
        const taskElement = this.taskElements.get(taskId);
        
        if (!taskElement) {
            // Element not found, fall back to full render
            this.renderFullTaskList();
            return;
        }
        
        // Update completion classes
        if (taskData.completed) {
            taskElement.classList.add('completed');
            taskElement.querySelector('.task-text').classList.add('completed');
        } else {
            taskElement.classList.remove('completed');
            taskElement.querySelector('.task-text').classList.remove('completed');
        }
        
        // Update checkbox
        const checkbox = taskElement.querySelector('.task-checkbox');
        if (checkbox) {
            checkbox.checked = taskData.completed;
        }
        
        // Update stats
        this.updateStats();
    }
    
    /**
     * Update only the task text after editing
     */
    updateTaskText(taskId, newText) {
        const taskElement = this.taskElements.get(taskId);
        
        if (taskElement) {
            const taskText = taskElement.querySelector('.task-text');
            if (taskText) {
                taskText.textContent = newText;
            }
        } else {
            // Fallback
            this.renderFullTaskList();
        }
    }
    
    /**
     * Full task list render (only when necessary)
     */
    renderFullTaskList() {
        const tasks = this.taskManager.getFilteredTasks();
        
        if (tasks.length === 0) {
            this.renderEmptyState();
            this.taskElements.clear();
            return;
        }
        
        // Clear existing task elements map
        this.taskElements.clear();
        
        const fragment = document.createDocumentFragment();
        
        tasks.forEach(task => {
            const taskElement = this.createTaskElement(task);
            fragment.appendChild(taskElement);
            
            // Store reference for partial updates
            this.taskElements.set(task.id, taskElement);
        });
        
        this.taskList.innerHTML = '';
        this.taskList.appendChild(fragment);
    }
    
    /**
     * Create a single task element with optimized event handlers
     */
    createTaskElement(task) {
        const div = document.createElement('div');
        div.className = `task-item priority-${task.priority} ${task.completed ? 'completed' : ''}`;
        div.dataset.id = task.id;
        div.draggable = true;
        div.tabIndex = 0;
        div.setAttribute('aria-label', `Task: ${task.text}. Drag to reorder.`);
        
        // Drag handle
        const dragHandle = document.createElement('div');
        dragHandle.className = 'drag-handle';
        dragHandle.innerHTML = '<i class="fas fa-grip-vertical"></i>';
        dragHandle.title = 'Drag to reorder';
        dragHandle.setAttribute('aria-label', 'Drag handle');
        
        // Checkbox with optimized handler
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'task-checkbox';
        checkbox.checked = task.completed;
        checkbox.addEventListener('change', () => {
            this.handleToggleCompletion(task.id, div);
        });
        
        // Content
        const content = document.createElement('div');
        content.className = 'task-content';
        
        const text = document.createElement('div');
        text.className = `task-text ${task.completed ? 'completed' : ''}`;
        text.textContent = task.text;
        
        const meta = document.createElement('div');
        meta.className = 'task-meta';
        
        // Priority badge
        const priority = document.createElement('span');
        priority.className = `task-priority priority-${task.priority}`;
        priority.textContent = task.priority;
        meta.appendChild(priority);
        
        // Category badge
        if (task.category) {
            const category = document.createElement('span');
            category.className = 'task-category';
            category.textContent = this.getCategoryLabel(task.category);
            meta.appendChild(category);
        }
        
        // Due date
        if (task.dueDate) {
            const due = document.createElement('span');
            const dateInfo = this.formatDueDate(task.dueDate);
            due.className = `task-due ${dateInfo.indicator || ''}`;
            due.innerHTML = `<i class="fas fa-calendar-day"></i> ${dateInfo.text}`;
            meta.appendChild(due);
        }
        
        content.appendChild(text);
        content.appendChild(meta);
        
        // Actions
        const actions = document.createElement('div');
        actions.className = 'task-actions-cell';
        
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.innerHTML = '<i class="fas fa-edit"></i>';
        editBtn.title = 'Edit task';
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleEditTask(task, text, div);
        });
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.title = 'Delete task';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleDeleteTask(task.id, div);
        });
        
        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);
        
        div.appendChild(dragHandle);
        div.appendChild(checkbox);
        div.appendChild(content);
        div.appendChild(actions);
        
        // Setup drag and drop for this element
        this.setupDragAndDrop(div, task.id);
        
        return div;
    }
    
    /**
     * Setup drag and drop for a task element
     */
    setupDragAndDrop(taskElement, taskId) {
        taskElement.addEventListener('dragstart', (e) => {
            this.taskManager.draggedTaskId = taskId;
            taskElement.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', taskId);
        });
        
        taskElement.addEventListener('dragend', (e) => {
            taskElement.classList.remove('dragging');
            document.querySelectorAll('.task-item.drag-over').forEach(item => {
                item.classList.remove('drag-over');
            });
            this.taskManager.draggedTaskId = null;
            this.taskManager.dragTargetId = null;
        });
        
        taskElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            if (this.taskManager.draggedTaskId !== taskId) {
                taskElement.classList.add('drag-over');
                this.taskManager.dragTargetId = taskId;
            }
        });
        
        taskElement.addEventListener('dragleave', (e) => {
            if (!taskElement.contains(e.relatedTarget)) {
                taskElement.classList.remove('drag-over');
                if (this.taskManager.dragTargetId === taskId) {
                    this.taskManager.dragTargetId = null;
                }
            }
        });
        
        taskElement.addEventListener('drop', (e) => {
            e.preventDefault();
            
            const draggedId = this.taskManager.draggedTaskId;
            const targetId = taskId;
            
            if (draggedId && targetId && draggedId !== targetId) {
                const success = this.taskManager.reorderTasks(draggedId, targetId);
                
                if (success) {
                    this.sortSelect.value = 'manual';
                    this.taskManager.sort = 'manual';
                    this.renderFullTaskList(); // Need full re-render for reordering
                    this.showToast('Task order updated', 'success');
                }
            }
            
            taskElement.classList.remove('drag-over');
        });
    }
    
    // ==========================================
    // OPTIMIZED EVENT HANDLERS
    // ==========================================
    
    handleToggleCompletion(taskId, taskElement) {
        const updatedTask = this.taskManager.toggleTaskCompletion(taskId);
        
        if (updatedTask) {
            // Partial update - only update the affected task
            this.updateTaskElement(taskId, updatedTask);
            
            // Update analytics if they're visible
            if (!this.analyticsSection.classList.contains('collapsed')) {
                this.renderAnalytics();
            }
        }
    }
    
    handleEditTask(task, textElement, taskElement) {
        const originalText = textElement.textContent;
        
        textElement.contentEditable = true;
        textElement.focus();
        
        const range = document.createRange();
        range.selectNodeContents(textElement);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        
        const finishEdit = () => {
            textElement.contentEditable = false;
            const newText = textElement.textContent.trim();
            
            if (newText && newText !== originalText) {
                this.taskManager.updateTask(task.id, { text: newText });
                this.showToast('Task updated', 'success');
                // No need to re-render - text is already updated
            } else {
                textElement.textContent = originalText;
            }
        };
        
        const handleKey = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                finishEdit();
            } else if (e.key === 'Escape') {
                textElement.textContent = originalText;
                textElement.contentEditable = false;
            }
        };
        
        textElement.addEventListener('keydown', handleKey);
        textElement.addEventListener('blur', finishEdit, { once: true });
    }
    
    handleDeleteTask(id, taskElement) {
        if (confirm('Delete this task?')) {
            const deletedTask = this.taskManager.deleteTask(id);
            if (deletedTask) {
                // Remove from DOM immediately
                taskElement.remove();
                
                // Update stats
                this.updateStats();
                
                // Show undo toast
                this.showUndoToast('Task deleted', () => {
                    const restoredTask = this.taskManager.undoDelete();
                    if (restoredTask) {
                        // Add task back to the beginning
                        const newTaskElement = this.createTaskElement(restoredTask);
                        this.taskList.prepend(newTaskElement);
                        this.taskElements.set(restoredTask.id, newTaskElement);
                        this.updateStats();
                        this.renderAnalytics();
                        this.showToast('Task restored', 'success');
                    }
                });
            }
        }
    }
    
    handleAddTask() {
        const text = this.taskInput.value.trim();
        const priority = this.prioritySelect.value;
        const category = this.categorySelect.value;
        const dueDate = this.dueDate.value;
        
        if (!text) {
            this.showError('Please enter a task description');
            return;
        }
        
        const newTask = this.taskManager.addTask({
            text,
            priority,
            category,
            dueDate: dueDate || null
        });
        
        // Clear form
        this.taskInput.value = '';
        this.categorySelect.value = '';
        this.dueDate.value = '';
        
        // Add task to the beginning of the list
        const taskElement = this.createTaskElement(newTask);
        this.taskList.prepend(taskElement);
        this.taskElements.set(newTask.id, taskElement);
        
        // Update stats and analytics
        this.updateStats();
        this.renderAnalytics();
        
        this.showToast('Task added successfully!', 'success');
        this.taskInput.focus();
    }
    
    // ==========================================
    // STATS & ANALYTICS METHODS
    // ==========================================
    
    updateStats() {
        const stats = this.taskManager.getStats();
        
        // Update counters
        this.totalTasks.textContent = stats.total;
        this.pendingTasks.textContent = stats.pending;
        this.completedTasks.textContent = stats.completed;
        this.productivityScore.textContent = `${stats.productivity}%`;
        
        // Update filter counts
        this.filterCounts.all.textContent = stats.total;
        this.filterCounts.pending.textContent = stats.pending;
        this.filterCounts.completed.textContent = stats.completed;
        
        // Update productivity ring
        const circumference = 2 * Math.PI * 36;
        const offset = circumference - (stats.productivity / 100) * circumference;
        this.productivityRing.style.strokeDashoffset = offset;
        
        // Calculate streak
        const streak = this.taskManager.calculateStreak();
        this.streakCount.textContent = streak;
    }
    
    renderEmptyState() {
        const filter = this.taskManager.filter;
        const search = this.taskManager.searchQuery;
        
        let message, description;
        
        if (search) {
            message = 'No tasks found';
            description = 'Try a different search term';
        } else {
            switch (filter) {
                case 'pending':
                    message = 'No pending tasks';
                    description = 'Great job! All tasks are completed! 🎉';
                    break;
                case 'completed':
                    message = 'No completed tasks yet';
                    description = 'Start checking off tasks to see them here';
                    break;
                default:
                    message = 'Ready to conquer your goals?';
                    description = 'Start by adding your first task above. You\'ve got this! 🎯';
            }
        }
        
        this.taskList.innerHTML = `
            <div class="empty-state">
                <div class="empty-illustration">
                    <i class="fas fa-rocket"></i>
                </div>
                <h3>${message}</h3>
                <p>${description}</p>
            </div>
        `;
    }
    
    renderAnalytics() {
        this.renderCategoryBreakdown();
        this.renderInsights();
    }
    
    renderCategoryBreakdown() {
        const tasks = this.taskManager.tasks;
        const categories = {};
        
        tasks.forEach(task => {
            const category = task.category || 'other';
            if (!categories[category]) {
                categories[category] = { total: 0, completed: 0 };
            }
            categories[category].total++;
            if (task.completed) {
                categories[category].completed++;
            }
        });
        
        const fragment = document.createDocumentFragment();
        
        Object.entries(categories).forEach(([category, data]) => {
            const item = document.createElement('div');
            item.className = 'category-item';
            
            const icon = document.createElement('span');
            icon.className = 'category-icon';
            icon.textContent = this.getCategoryIcon(category);
            
            const info = document.createElement('div');
            info.className = 'category-info';
            
            const name = document.createElement('div');
            name.className = 'category-name';
            name.textContent = this.getCategoryLabel(category);
            
            const count = document.createElement('div');
            count.className = 'category-count';
            count.textContent = `${data.completed}/${data.total} completed`;
            
            info.appendChild(name);
            info.appendChild(count);
            
            item.appendChild(icon);
            item.appendChild(info);
            
            fragment.appendChild(item);
        });
        
        this.categoryBreakdown.innerHTML = '';
        if (Object.keys(categories).length === 0) {
            this.categoryBreakdown.innerHTML = '<p style="color: var(--text-muted);">No categories yet</p>';
        } else {
            this.categoryBreakdown.appendChild(fragment);
        }
    }
    
    renderInsights() {
        const stats = this.taskManager.getStats();
        const tasks = this.taskManager.tasks;
        const streak = this.taskManager.calculateStreak();
        const insights = [];
        
        if (stats.total === 0) {
            insights.push('Add your first task to get started!');
        } else {
            if (stats.productivity >= 80) {
                insights.push(`Excellent! ${stats.productivity}% completion rate! 🎯`);
            } else if (stats.productivity >= 50) {
                insights.push(`Good progress! ${stats.productivity}% of tasks completed.`);
            } else {
                insights.push(`Keep going! ${stats.productivity}% completion rate.`);
            }
            
            if (streak > 0) {
                if (streak >= 7) {
                    insights.push(`🔥 Amazing ${streak}-day streak! Keep it up!`);
                } else if (streak >= 3) {
                    insights.push(`Nice ${streak}-day streak! Building momentum.`);
                } else {
                    insights.push(`You're on a ${streak}-day streak!`);
                }
            } else {
                insights.push('Complete a task today to start your streak!');
            }
            
            const overdue = tasks.filter(task => {
                if (!task.dueDate || task.completed) return false;
                const date = new Date(task.dueDate);
                const today = new Date();
                return date < today;
            }).length;
            
            if (overdue > 0) {
                insights.push(`${overdue} overdue task${overdue > 1 ? 's' : ''} need attention.`);
            }
            
            const dueToday = tasks.filter(task => {
                if (!task.dueDate || task.completed) return false;
                const date = new Date(task.dueDate);
                const today = new Date();
                return date.toDateString() === today.toDateString();
            }).length;
            
            if (dueToday > 0) {
                insights.push(`${dueToday} task${dueToday > 1 ? 's' : ''} due today.`);
            }
        }
        
        this.insightsContent.innerHTML = insights
            .map(insight => `<div class="insight-item">${insight}</div>`)
            .join('');
    }
    
    // ==========================================
    // UTILITY METHODS
    // ==========================================
    
    getCategoryLabel(category) {
        const labels = {
            homework: '📚 Homework',
            project: '💼 Project',
            study: '📖 Study',
            exam: '📝 Exam',
            reading: '📕 Reading',
            other: '📌 Other'
        };
        return labels[category] || category;
    }
    
    getCategoryIcon(category) {
        const icons = {
            homework: '📚',
            project: '💼',
            study: '📖',
            exam: '📝',
            reading: '📕',
            other: '📌'
        };
        return icons[category] || '📌';
    }
    
    formatDueDate(dateString) {
        const date = new Date(dateString);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const isToday = date.toDateString() === today.toDateString();
        const isTomorrow = date.toDateString() === tomorrow.toDateString();
        const isOverdue = date < today && !isToday;
        
        let text = date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        });
        let indicator = '';
        
        if (isToday) {
            text = 'Today';
            indicator = 'today';
        } else if (isTomorrow) {
            text = 'Tomorrow';
            indicator = 'tomorrow';
        } else if (isOverdue) {
            text = 'Overdue';
            indicator = 'overdue';
        }
        
        return { text, indicator };
    }
    
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        this.updateThemeIcon(newTheme);
    }
    
    updateThemeIcon(theme) {
        const icon = this.themeToggle.querySelector('i');
        icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
    
    showExportModal() {
        const data = this.taskManager.exportTasks();
        this.modals.export.exportData.value = data;
        this.modals.export.element.style.display = 'flex';
    }
    
    handleImport() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                const result = this.taskManager.importTasks(event.target.result);
                
                if (result.success) {
                    this.showToast(`Imported ${result.count} tasks!`, 'success');
                    this.renderFullTaskList();
                    this.updateStats();
                    this.renderAnalytics();
                } else {
                    this.showToast(`Import failed: ${result.error}`, 'error');
                }
            };
            reader.readAsText(file);
        });
        
        input.click();
    }
    
    showShortcutsModal() {
        this.modals.shortcuts.element.style.display = 'flex';
    }
    
    closeModal(modalName) {
        if (this.modals[modalName]) {
            this.modals[modalName].element.style.display = 'none';
        }
    }
    
    closeAllModals() {
        Object.values(this.modals).forEach(modal => {
            if (modal && modal.element) {
                modal.element.style.display = 'none';
            }
        });
    }
    
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icon = type === 'success' ? 'check-circle' : 
                    type === 'error' ? 'exclamation-circle' : 'info-circle';
        
        toast.innerHTML = `
            <i class="fas fa-${icon} toast-icon"></i>
            <div class="toast-content">
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        container.appendChild(toast);
        
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
            toast.remove();
        });
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, CONFIG.TOAST_DURATION);
    }
    
    showUndoToast(message, undoCallback) {
        const container = document.getElementById('undo-container');
        
        const toast = document.createElement('div');
        toast.className = 'undo-toast';
        toast.innerHTML = `
            <span class="undo-message">${message}</span>
            <button class="undo-btn">Undo</button>
        `;
        
        container.appendChild(toast);
        container.style.display = 'block';
        
        const undoBtn = toast.querySelector('.undo-btn');
        undoBtn.addEventListener('click', () => {
            undoCallback();
            toast.remove();
            if (container.children.length === 0) {
                container.style.display = 'none';
            }
        });
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
                if (container.children.length === 0) {
                    container.style.display = 'none';
                }
            }
        }, CONFIG.UNDO_DURATION);
    }
    
    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.style.display = 'block';
        
        setTimeout(() => {
            this.errorMessage.style.display = 'none';
        }, 3000);
    }
    
    initTheme() {
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = savedTheme || (prefersDark ? 'dark' : 'light');
        
        document.documentElement.setAttribute('data-theme', theme);
        this.updateThemeIcon(theme);
        
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('theme')) {
                document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
                this.updateThemeIcon(e.matches ? 'dark' : 'light');
            }
        });
    }
    
    initDate() {
        const today = new Date().toISOString().split('T')[0];
        this.dueDate.min = today;
        
        if (this.currentYear) {
            this.currentYear.textContent = new Date().getFullYear();
        }
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    try {
        const taskManager = new TaskManager();
        const uiController = new UIController(taskManager);
        
        // Make available globally for debugging
        window.taskManager = taskManager;
        window.uiController = uiController;
        
        console.log('✅ TaskFlow Pro initialized with optimized rendering!');
        console.log('📋 Features:');
        console.log('  • Partial DOM updates for toggle/edit');
        console.log('  • Full re-renders only for add/delete/reorder');
        console.log('  • Drag and drop reordering');
        console.log('  • Production-ready performance');
        
    } catch (error) {
        console.error('❌ Failed to initialize:', error);
        alert('Failed to initialize application. Please refresh the page.');
    }
});