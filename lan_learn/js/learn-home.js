// Learn Home Page JavaScript
class LearnHome {
    constructor() {
        this.learners = [];
        this.selectedLearners = [];
        this.dataTable = null;
        this.init();
    }

    async init() {
        await this.loadLearners();
        this.setupEventListeners();
        this.initializeDataTable();
        this.updateCounts();
        // Update select-all checkbox after initialization
        setTimeout(() => {
            this.updateSelectAllCheckbox();
        }, 100);
        console.log('Learn Home initialized');
    }

    setupEventListeners() {
        // Add learner button
        const addBtn = document.getElementById('add-learner-btn');
        const learnerInput = document.getElementById('learner-input');
        
        if (addBtn) {
            addBtn.addEventListener('click', () => this.addLearner());
        }

        // Enter key on input
        if (learnerInput) {
            learnerInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.addLearner();
                }
            });
        }

        // Start learning button
        const startBtn = document.getElementById('start-learning-btn');
        if (startBtn) {
            startBtn.addEventListener('click', () => this.startLearning());
        }

        // Select all checkbox
        const selectAllCheckbox = document.getElementById('select-all');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                this.handleSelectAll(e.target.checked);
            });
        }

        // Popup event listeners
        this.setupPopupListeners();
    }

    setupPopupListeners() {
        // Warning popup OK button
        const warningOkBtn = document.getElementById('warning-ok-btn');
        if (warningOkBtn) {
            warningOkBtn.addEventListener('click', () => {
                Utils.hidePopup('warning-popup');
            });
        }

        // Delete popup buttons
        const deleteConfirmBtn = document.getElementById('delete-confirm-btn');
        const deleteCancelBtn = document.getElementById('delete-cancel-btn');
        
        if (deleteConfirmBtn) {
            deleteConfirmBtn.addEventListener('click', () => {
                this.confirmDelete();
            });
        }

        if (deleteCancelBtn) {
            deleteCancelBtn.addEventListener('click', () => {
                Utils.hidePopup('delete-popup');
                this.pendingDeleteId = null;
            });
        }
    }

    addLearner() {
        const input = document.getElementById('learner-input');
        const name = input.value.trim();

        if (!Utils.validateInput(name, 'name')) {
            Utils.showToast('Please enter a valid learner name (minimum 2 characters, letters only)', 'warning');
            return;
        }

        const formattedName = Utils.formatName(name);

        // Check for duplicates
        if (this.learners.some(learner => learner.name.toLowerCase() === formattedName.toLowerCase())) {
            Utils.showToast(`The name "${formattedName}" already exists. Please enter a unique name.`, 'error');
            return;
        }

        // Create new learner
        const newLearner = {
            id: Utils.generateId(),
            name: formattedName
        };

        this.learners.push(newLearner);
        
        // Automatically select the new learner for studies
        this.selectedLearners.push(newLearner.id);
        
        this.saveLearners();
        this.saveSelectedLearners();
        this.refreshTable();
        this.updateCounts();

        // Clear input
        input.value = '';
        Utils.showToast(`${formattedName} added and selected for studies`, 'success');
    }

    deleteLearner(id) {
        console.log('Delete learner called with ID:', id);
        
        const learner = this.learners.find(l => l.id === id);
        if (!learner) {
            console.warn('Learner not found with ID:', id);
            Utils.showToast('Learner not found', 'error');
            return;
        }

        this.pendingDeleteId = id;
        const deleteMessage = document.getElementById('delete-message');
        if (deleteMessage) {
            deleteMessage.textContent = `Are you sure you want to delete "${learner.name}"?`;
        }
        
        console.log('Showing delete popup for:', learner.name);
        Utils.showPopup('delete-popup');
    }

    confirmDelete() {
        if (!this.pendingDeleteId) return;

        this.learners = this.learners.filter(learner => learner.id !== this.pendingDeleteId);
        this.selectedLearners = this.selectedLearners.filter(id => id !== this.pendingDeleteId);
        
        this.saveLearners();
        this.saveSelectedLearners();
        this.refreshTable();
        this.updateCounts();
        
        Utils.hidePopup('delete-popup');
        Utils.showToast('Learner deleted successfully', 'success');
        this.pendingDeleteId = null;
    }

    handleSelectLearner(id, isChecked) {
        if (isChecked) {
            if (!this.selectedLearners.includes(id)) {
                this.selectedLearners.push(id);
            }
        } else {
            this.selectedLearners = this.selectedLearners.filter(selectedId => selectedId !== id);
        }
        
        this.saveSelectedLearners();
        this.updateCounts();
        this.updateSelectAllCheckbox();
    }

    handleSelectAll(isChecked) {
        if (isChecked) {
            this.selectedLearners = this.learners.map(learner => learner.id);
        } else {
            this.selectedLearners = [];
        }
        
        this.saveSelectedLearners();
        this.refreshTable();
        this.updateCounts();
    }

    updateSelectAllCheckbox() {
        const selectAllCheckbox = document.getElementById('select-all');
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = this.learners.length > 0 && 
                                       this.selectedLearners.length === this.learners.length;
        }
    }

    startLearning() {
        const selectedNames = this.getSelectedLearnerNames();
        const learnerNamesForDialogue = selectedNames.length > 0
            ? selectedNames
            : this.getAllLearnerNames();

        if (learnerNamesForDialogue.length === 0) {
            const warningMessage = document.getElementById('warning-message');
            if (warningMessage) {
                warningMessage.textContent = 'Please add at least one learner to start learning.';
            }
            Utils.showPopup('warning-popup');
            return;
        }

        // Navigate to existing dialogue page without changing dialogue UI/logic
        if (app) {
            app.showPage('dialogue');
            if (window.dialoguePage) {
                window.dialoguePage.initializeWithLearners(learnerNamesForDialogue);
            }
        }
    }

    getAllLearnerNames() {
        return this.learners.map(learner => learner.name);
    }

    getSelectedLearnerNames() {
        return this.learners
            .filter(learner => this.selectedLearners.includes(learner.id))
            .map(learner => learner.name);
    }

    initializeDataTable() {
        const table = document.getElementById('learners-table');
        if (!table || !$) return;

        this.dataTable = $(table).DataTable({
            data: [],
            columns: [
                {
                    title: '<input type="checkbox" id="select-all">',
                    data: null,
                    orderable: false,
                    className: 'text-center',
                    width: '60px',
                    render: (data, type, row) => {
                        const checked = this.selectedLearners.includes(row.id) ? 'checked' : '';
                        return `<input type="checkbox" class="learner-checkbox" data-id="${row.id}" ${checked}>`;
                    }
                },
                {
                    title: 'Name',
                    data: 'name',
                    className: 'learner-name-cell'
                },
                {
                    title: 'Actions',
                    data: null,
                    orderable: false,
                    className: 'text-center',
                    width: '80px',
                    render: (data, type, row) => {
                        return `<i data-lucide="trash-2" class="delete-icon" data-id="${row.id}" title="Delete learner"></i>`;
                    }
                }
            ],
            pageLength: 10,
            responsive: true,
            language: {
                emptyTable: "No learners added yet. Add some learners to get started!",
                zeroRecords: "No learners found matching your search.",
                search: "Search learners:",
                lengthMenu: "Show _MENU_ learners per page",
                info: "Showing _START_ to _END_ of _TOTAL_ learners",
                infoEmpty: "No learners to show",
                infoFiltered: "(filtered from _MAX_ total learners)"
            },
            drawCallback: () => {
                // Reinitialize icons and event listeners after table redraw
                this.initializeTableEvents();
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            }
        });

        this.refreshTable();
    }

    initializeTableEvents() {
        // Remove existing event listeners to prevent duplicates
        $('#learners-table').off('change', '.learner-checkbox');
        $('#learners-table').off('click', '.delete-icon');
        
        // Use event delegation for better compatibility with DataTables
        $('#learners-table').on('change', '.learner-checkbox', (e) => {
            const id = e.target.getAttribute('data-id');
            if (id) {
            this.handleSelectLearner(id, e.target.checked);
            }
        });

        // Delete button events with event delegation
        $('#learners-table').on('click', '.delete-icon', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const target = e.target;
            const id = target.getAttribute('data-id') || 
                      target.closest('[data-id]')?.getAttribute('data-id');
            
            if (id) {
                console.log('Delete button clicked for ID:', id);
                this.deleteLearner(id);
            } else {
                console.warn('No ID found for delete button');
            }
        });

        // Handle select all checkbox
        $('#select-all').off('change').on('change', (e) => {
            this.handleSelectAll(e.target.checked);
        });

        // Update select all checkbox state
        this.updateSelectAllCheckbox();
    }

    refreshTable() {
        if (this.dataTable) {
            this.dataTable.clear().rows.add(this.learners).draw();
        }
    }

    updateCounts() {
        const totalElement = document.getElementById('total-learners');
        const selectedElement = document.getElementById('selected-learners');
        
        if (totalElement) {
            totalElement.textContent = this.learners.length;
        }
        
        if (selectedElement) {
            selectedElement.textContent = this.selectedLearners.length;
        }
    }

    async loadLearners() {
        this.learners = Utils.getFromStorage('learners', []);
        this.selectedLearners = Utils.getFromStorage('selectedLearners', []);
        
        // Clean up selected learners (remove IDs that no longer exist)
        this.selectedLearners = this.selectedLearners.filter(id =>
            this.learners.some(learner => learner.id === id)
        );
        
        // If no learners are selected but learners exist,
        // select all by default
        if (this.selectedLearners.length === 0 && this.learners.length > 0) {
            this.selectedLearners = this.learners.map(learner => learner.id);
        }
        
        this.saveSelectedLearners();
    }

    async loadDefaultLearners() {
        try {
            // Fetch default learners from JSON file
            const response = await fetch('js/default-learners.json');
            
            if (!response.ok) {
                throw new Error(`Failed to fetch default learners: ${response.status}`);
            }
            
            const data = await response.json();
            const defaultNames = data.learners || [];
            
            if (!Array.isArray(defaultNames) || defaultNames.length === 0) {
                console.warn('No default learners found in JSON file');
                return;
            }

            // Create learner objects from default names
            this.learners = defaultNames.map(name => ({
                id: Utils.generateId(),
                name: Utils.formatName(name.trim())
            }));

            // Select all default learners by default
            this.selectedLearners = this.learners.map(learner => learner.id);

            // Save to storage
            this.saveLearners();
            this.saveSelectedLearners();

            console.log(`Loaded ${this.learners.length} default learners from JSON, all selected by default`);
        } catch (error) {
            console.error('Error loading default learners from JSON:', error);
            
            // Fallback to JavaScript constant if available (for backward compatibility)
            if (typeof DEFAULT_LEARNERS !== 'undefined' && Array.isArray(DEFAULT_LEARNERS)) {
                console.log('Falling back to JavaScript DEFAULT_LEARNERS constant');
                this.learners = DEFAULT_LEARNERS.map(name => ({
                    id: Utils.generateId(),
                    name: Utils.formatName(name.trim())
                }));
                this.selectedLearners = this.learners.map(learner => learner.id);
                this.saveLearners();
                this.saveSelectedLearners();
                console.log(`Loaded ${this.learners.length} default learners from JavaScript constant`);
            } else {
                console.warn('No default learners available');
            }
        }
    }

    saveLearners() {
        Utils.saveToStorage('learners', this.learners);
    }

    saveSelectedLearners() {
        Utils.saveToStorage('selectedLearners', this.selectedLearners);
    }

    resetLearners() {
        this.learners = [];
        this.selectedLearners = [];
        this.saveLearners();
        this.saveSelectedLearners();
        this.refreshTable();
        this.updateCounts();
    }

    // Public methods for external access
    getLearners() {
        return this.learners;
    }

    getSelectedLearners() {
        return this.selectedLearners;
    }

    setSelectedLearners(ids) {
        this.selectedLearners = ids.filter(id =>
            this.learners.some(learner => learner.id === id)
        );
        this.saveSelectedLearners();
        this.refreshTable();
        this.updateCounts();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LearnHome;
} 
