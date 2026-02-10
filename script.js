// ==========================================
// TASKFLOW PRO - COMPLETE & WORKING JAVASCRIPT
// WITH DRAG AND DROP REORDERING
// ==========================================

'use strict';

// Configuration
const CONFIG = {
    STORAGE_KEY: 'taskflow_tasks',
    VERSION: '1.3.0', // Updated version for drag-and-drop
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
    }
    
    loadTasks() {
        try {
            const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
            return saved ? JSON.parse(saved) : [];
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
            order: this.tasks.length // Add order property for drag-and-drop
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
        }
    }
    
    // NEW: Reorder tasks based on drag-and-drop
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
                task.category.toLowerCase().includes(query)
            );
        }
        
        // Apply sort - but preserve drag order for manual sorting
        if (this.sort === 'manual') {
            // Sort by order property (set during drag-and-drop)
            filtered.sort((a, b) => a.order - b.order);
        } else {
            // Apply other sorts
            filtered.sort(this.getSortFunction());
        }
        
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
                // Already handled in getFilteredTasks
                return (a, b) => a.order - b.order;
            default:
                return (a, b) => new Date(b.createdAt) - new Date(a.createdAt);
        }
    }
    
    clearCompleted() {
        const completedCount = this.tasks.filter(t => t.completed).length;
        this.tasks = this.tasks.filter(task => !task.completed);
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
        
        // Get unique completion days using UTC timestamps for timezone safety
        const uniqueDays = new Set();
        
        this.tasks.forEach(task => {
            if (task.completed && task.completedAt) {
                const date = new Date(task.completedAt);
                // Use UTC to avoid timezone issues, normalize to start of day
                const dayKey = Date.UTC(
                    date.getUTCFullYear(),
                    date.getUTCMonth(),
                    date.getUTCDate()
                );
                uniqueDays.add(dayKey);
            }
        });
        
        if (uniqueDays.size === 0) return 0;
        
        // Convert to array and sort descending (most recent first)
        const sortedDays = Array.from(uniqueDays).sort((a, b) => b - a);
        
        // Get today's date in UTC (start of day)
        const now = new Date();
        const today = Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate()
        );
        
        // Get yesterday in UTC
        const yesterday = today - 86400000; // 24 hours in milliseconds
        
        // Start counting from the most recent completion
        let streak = 0;
        let expectedDate = today;
        
        // Check if we have a completion today to start the streak
        if (sortedDays[0] === today) {
            streak = 1;
            expectedDate = yesterday;
        } else if (sortedDays[0] === yesterday) {
            // Started yesterday, continue checking backward
            streak = 1;
            expectedDate = yesterday - 86400000;
        } else {
            // Most recent completion is older than yesterday, no active streak
            return 0;
        }
        
        // Continue checking for consecutive days
        for (let i = 1; i < sortedDays.length; i++) {
            if (sortedDays[i] === expectedDate) {
                streak++;
                expectedDate -= 86400000; // Move back one day
            } else if (sortedDays[i] < expectedDate) {
                // Found a gap, streak ends
                break;
            }
            // If sortedDays[i] > expectedDate, it's a duplicate day (shouldn't happen due to Set)
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
            
            // Validate and merge tasks
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
            
            this.saveTasks();
            return { success: true, count: tasks.length };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

// UI Controller with Drag-and-Drop
class UIController {
    constructor(taskManager) {
        this.taskManager = taskManager;
        this.modals = {
            shortcuts: null,
            export: null
        };
        this.init();
    }
    
    init() {
        this.cacheDOM();
        this.initModals();
        this.bindEvents();
        this.initTheme();
        this.initDate();
        this.initDragAndDrop();
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
        // Keyboard Shortcuts Modal
        this.modals.shortcuts = {
            element: this.shortcutsModal,
            closeBtn: this.shortcutsModal.querySelector('.modal-close'),
            cancelBtn: document.getElementById('closeShortcuts'),
            isInitialized: false
        };
        
        // Export Modal
        this.modals.export = {
            element: this.exportModal,
            closeBtn: this.exportModal.querySelector('.modal-close'),
            cancelBtn: document.getElementById('cancelExport'),
            exportBtn: document.getElementById('exportJsonBtn'),
            copyBtn: document.getElementById('copyExportBtn'),
            exportData: document.getElementById('exportData'),
            isInitialized: false
        };
        
        // Initialize event listeners for modals
        this.initModalEventListeners();
    }
    
    initModalEventListeners() {
        // Shortcuts Modal
        if (!this.modals.shortcuts.isInitialized) {
            const closeShortcutsModal = () => this.closeModal('shortcuts');
            
            this.modals.shortcuts.closeBtn.addEventListener('click', closeShortcutsModal);
            this.modals.shortcuts.cancelBtn.addEventListener('click', closeShortcutsModal);
            this.modals.shortcuts.element.addEventListener('click', (e) => {
                if (e.target === this.modals.shortcuts.element) closeShortcutsModal();
            });
            
            this.modals.shortcuts.isInitialized = true;
        }
        
        // Export Modal
        if (!this.modals.export.isInitialized) {
            const closeExportModal = () => this.closeModal('export');
            
            // Close buttons
            this.modals.export.closeBtn.addEventListener('click', closeExportModal);
            this.modals.export.cancelBtn.addEventListener('click', closeExportModal);
            this.modals.export.element.addEventListener('click', (e) => {
                if (e.target === this.modals.export.element) closeExportModal();
            });
            
            // Export button
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
            
            // Copy button
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
            this.render();
            this.clearSearch.style.display = this.taskManager.searchQuery ? 'block' : 'none';
        });
        
        this.clearSearch.addEventListener('click', () => {
            this.searchInput.value = '';
            this.taskManager.searchQuery = '';
            this.render();
            this.clearSearch.style.display = 'none';
        });
        
        // Filters
        this.filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.filterButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.taskManager.filter = btn.dataset.filter;
                this.render();
            });
        });
        
        // Sort - Add manual option
        const manualOption = document.createElement('option');
        manualOption.value = 'manual';
        manualOption.textContent = 'Manual (Drag Order)';
        this.sortSelect.appendChild(manualOption);
        
        this.sortSelect.addEventListener('change', () => {
            this.taskManager.sort = this.sortSelect.value;
            this.render();
        });
        
        // Clear buttons
        this.clearCompletedBtn.addEventListener('click', () => {
            if (confirm('Clear all completed tasks?')) {
                const count = this.taskManager.clearCompleted();
                if (count > 0) {
                    this.showToast(`Cleared ${count} completed task${count > 1 ? 's' : ''}`, 'success');
                    this.render();
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
                    this.render();
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
            // Ctrl/Cmd + F: Focus search
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                this.searchInput.focus();
            }
            
            // ?: Show shortcuts
            if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                this.showShortcutsModal();
            }
            
            // Escape: Close modals
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
            
            // Space: Toggle completion on selected task
            if (e.key === ' ' && !e.ctrlKey && !e.metaKey) {
                const focusedElement = document.activeElement;
                if (!focusedElement.matches('input, textarea, button, select')) {
                    e.preventDefault();
                    const taskItem = focusedElement.closest('.task-item');
                    if (taskItem) {
                        const taskId = taskItem.dataset.id;
                        const checkbox = taskItem.querySelector('.task-checkbox');
                        if (checkbox) {
                            checkbox.checked = !checkbox.checked;
                            this.taskManager.toggleTaskCompletion(taskId);
                            this.render();
                        }
                    }
                }
            }
        });
        
        // Show shortcuts button
        document.getElementById('showShortcuts').addEventListener('click', () => {
            this.showShortcutsModal();
        });
    }
    
    // NEW: Initialize drag and drop event handlers
    initDragAndDrop() {
        // These will be attached to individual task elements in renderTaskList
    }
    
    // NEW: Setup drag and drop for a task element
    setupDragAndDrop(taskElement) {
        const taskId = taskElement.dataset.id;
        
        // Drag start
        taskElement.addEventListener('dragstart', (e) => {
            this.taskManager.draggedTaskId = taskId;
            taskElement.classList.add('dragging');
            
            // Set drag image (optional)
            e.dataTransfer.effectAllowed = 'move';
            
            // Add some data to satisfy Firefox
            e.dataTransfer.setData('text/plain', taskId);
        });
        
        // Drag end
        taskElement.addEventListener('dragend', (e) => {
            taskElement.classList.remove('dragging');
            
            // Remove drag-over class from all tasks
            document.querySelectorAll('.task-item.drag-over').forEach(item => {
                item.classList.remove('drag-over');
            });
            
            // Reset dragged task
            this.taskManager.draggedTaskId = null;
            this.taskManager.dragTargetId = null;
        });
        
        // Drag over
        taskElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            // Only highlight if it's not the dragged element itself
            if (this.taskManager.draggedTaskId !== taskId) {
                taskElement.classList.add('drag-over');
                this.taskManager.dragTargetId = taskId;
            }
        });
        
        // Drag leave
        taskElement.addEventListener('dragleave', (e) => {
            // Only remove highlight if leaving the element (not just moving between children)
            if (!taskElement.contains(e.relatedTarget)) {
                taskElement.classList.remove('drag-over');
                if (this.taskManager.dragTargetId === taskId) {
                    this.taskManager.dragTargetId = null;
                }
            }
        });
        
        // Drop
        taskElement.addEventListener('drop', (e) => {
            e.preventDefault();
            
            const draggedId = this.taskManager.draggedTaskId;
            const targetId = taskId;
            
            if (draggedId && targetId && draggedId !== targetId) {
                // Reorder tasks
                const success = this.taskManager.reorderTasks(draggedId, targetId);
                
                if (success) {
                    // Update sort to manual
                    this.sortSelect.value = 'manual';
                    this.taskManager.sort = 'manual';
                    
                    // Re-render
                    this.render();
                    
                    // Show success toast
                    this.showToast('Task order updated', 'success');
                }
            }
            
            taskElement.classList.remove('drag-over');
        });
    }
    
    initTheme() {
        // Check for saved theme or system preference
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = savedTheme || (prefersDark ? 'dark' : 'light');
        
        document.documentElement.setAttribute('data-theme', theme);
        this.updateThemeIcon(theme);
        
        // Watch for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('theme')) {
                document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
                this.updateThemeIcon(e.matches ? 'dark' : 'light');
            }
        });
    }
    
    initDate() {
        // Set min date to today
        const today = new Date().toISOString().split('T')[0];
        this.dueDate.min = today;
        
        // Set current year
        if (this.currentYear) {
            this.currentYear.textContent = new Date().getFullYear();
        }
    }
    
    render() {
        this.renderTaskList();
        this.renderStats();
        this.renderAnalytics();
    }
    
    renderTaskList() {
        const tasks = this.taskManager.getFilteredTasks();
        
        if (tasks.length === 0) {
            this.renderEmptyState();
            return;
        }
        
        const fragment = document.createDocumentFragment();
        
        tasks.forEach(task => {
            const taskElement = this.createTaskElement(task);
            fragment.appendChild(taskElement);
            
            // Setup drag and drop for this element
            this.setupDragAndDrop(taskElement);
        });
        
        this.taskList.innerHTML = '';
        this.taskList.appendChild(fragment);
    }
    
    createTaskElement(task) {
        const div = document.createElement('div');
        div.className = `task-item priority-${task.priority} ${task.completed ? 'completed' : ''}`;
        div.dataset.id = task.id;
        div.draggable = true;
        div.tabIndex = 0; // Make task focusable for keyboard accessibility
        div.setAttribute('aria-label', `Task: ${task.text}. Drag to reorder.`);
        
        // Checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'task-checkbox';
        checkbox.checked = task.completed;
        checkbox.addEventListener('change', () => {
            this.taskManager.toggleTaskCompletion(task.id);
            this.render();
        });
        
        // Content
        const content = document.createElement('div');
        content.className = 'task-content';
        
        const text = document.createElement('div');
        text.className = 'task-text';
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
            this.editTask(task, text);
        });
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.title = 'Delete task';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteTask(task.id);
        });
        
        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);
        
        // NEW: Drag handle
        const dragHandle = document.createElement('div');
        dragHandle.className = 'drag-handle';
        dragHandle.innerHTML = '<i class="fas fa-grip-vertical"></i>';
        dragHandle.title = 'Drag to reorder';
        dragHandle.setAttribute('aria-label', 'Drag handle');
        
        div.appendChild(dragHandle);
        div.appendChild(checkbox);
        div.appendChild(content);
        div.appendChild(actions);
        
        return div;
    }
    
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
    
    renderStats() {
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
        
        // Calculate streak using the improved function
        const streak = this.taskManager.calculateStreak();
        this.streakCount.textContent = streak;
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
            
            // Streak insight
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
    
    handleAddTask() {
        const text = this.taskInput.value.trim();
        const priority = this.prioritySelect.value;
        const category = this.categorySelect.value;
        const dueDate = this.dueDate.value;
        
        if (!text) {
            this.showError('Please enter a task description');
            return;
        }
        
        this.taskManager.addTask({
            text,
            priority,
            category,
            dueDate: dueDate || null
        });
        
        this.taskInput.value = '';
        this.categorySelect.value = '';
        this.dueDate.value = '';
        
        this.showToast('Task added successfully!', 'success');
        this.render();
        this.taskInput.focus();
    }
    
    editTask(task, textElement) {
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
                this.render();
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
    
    deleteTask(id) {
        if (confirm('Delete this task?')) {
            const deletedTask = this.taskManager.deleteTask(id);
            if (deletedTask) {
                this.showUndoToast('Task deleted', () => {
                    this.taskManager.undoDelete();
                    this.showToast('Task restored', 'success');
                    this.render();
                });
                this.render();
            }
        }
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
                    this.render();
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
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    try {
        const taskManager = new TaskManager();
        const uiController = new UIController(taskManager);
        
        // Make available globally for debugging
        window.taskManager = taskManager;
        window.uiController = uiController;
        
        console.log('✅ TaskFlow Pro initialized with drag-and-drop!');
        console.log('📋 Features:');
        console.log('  • Drag and drop reordering');
        console.log('  • Visual feedback while dragging');
        console.log('  • Order persists in localStorage');
        console.log('  • Production-ready implementation');
        
    } catch (error) {
        console.error('❌ Failed to initialize:', error);
        alert('Failed to initialize application. Please refresh the page.');
    }
});