// ==========================================
// TASKFLOW PRO - COMPLETE & WORKING JAVASCRIPT
// ==========================================

'use strict';

// Configuration
const CONFIG = {
    STORAGE_KEY: 'taskflow_tasks',
    VERSION: '1.0.0',
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
            createdAt: new Date().toISOString()
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
            this.saveTasks();
        }
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
                        createdAt: task.createdAt || new Date().toISOString()
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

// UI Controller
class UIController {
    constructor(taskManager) {
        this.taskManager = taskManager;
        this.init();
    }
    
    init() {
        this.cacheDOM();
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
        
        // Sort
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
        });
        
        // Show shortcuts button
        document.getElementById('showShortcuts').addEventListener('click', () => {
            this.showShortcutsModal();
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
        });
        
        this.taskList.innerHTML = '';
        this.taskList.appendChild(fragment);
    }
    
    createTaskElement(task) {
        const div = document.createElement('div');
        div.className = `task-item priority-${task.priority} ${task.completed ? 'completed' : ''}`;
        div.dataset.id = task.id;
        div.draggable = true;
        
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
        
        // Calculate streak (simplified)
        const today = new Date().toISOString().split('T')[0];
        const completedToday = this.taskManager.tasks.filter(task => 
            task.completed && task.createdAt.split('T')[0] === today
        ).length;
        
        this.streakCount.textContent = completedToday > 0 ? '1' : '0';
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
        document.getElementById('exportData').value = data;
        this.exportModal.style.display = 'flex';
        
        // Setup export modal events
        const closeBtn = this.exportModal.querySelector('.modal-close');
        const cancelBtn = document.getElementById('cancelExport');
        const exportBtn = document.getElementById('exportJsonBtn');
        const copyBtn = document.getElementById('copyExportBtn');
        
        const closeModal = () => {
            this.exportModal.style.display = 'none';
        };
        
        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        this.exportModal.addEventListener('click', (e) => {
            if (e.target === this.exportModal) closeModal();
        });
        
        exportBtn.addEventListener('click', () => {
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tasks-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            closeModal();
            this.showToast('Tasks exported successfully!', 'success');
        });
        
        copyBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(data);
                this.showToast('Copied to clipboard!', 'success');
            } catch (err) {
                document.getElementById('exportData').select();
                document.execCommand('copy');
                this.showToast('Copied to clipboard!', 'success');
            }
        });
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
        this.shortcutsModal.style.display = 'flex';
        
        const closeBtn = this.shortcutsModal.querySelector('.modal-close');
        const closeShortcuts = document.getElementById('closeShortcuts');
        
        const closeModal = () => {
            this.shortcutsModal.style.display = 'none';
        };
        
        closeBtn.addEventListener('click', closeModal);
        closeShortcuts.addEventListener('click', closeModal);
        this.shortcutsModal.addEventListener('click', (e) => {
            if (e.target === this.shortcutsModal) closeModal();
        });
    }
    
    closeAllModals() {
        this.shortcutsModal.style.display = 'none';
        this.exportModal.style.display = 'none';
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
        
        console.log('✅ TaskFlow Pro initialized successfully!');
    } catch (error) {
        console.error('❌ Failed to initialize:', error);
        alert('Failed to initialize application. Please refresh the page.');
    }
});