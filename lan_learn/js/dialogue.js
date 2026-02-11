// Dialogue Page JavaScript
class DialoguePage {
    constructor() {
        this.originalDialogue = '';
        this.modifiedDialogue = [];
        this.learnerNames = [];
        this.currentConversationIndex = 0;
        this.currentLineIndex = -1;
        this.isLoading = false;
        this.currentLanguage = 'English';

        // Auto-advance (dialog-to-dialog) settings
        this.autoAdvanceEnabled = true;
        this.autoAdvanceInitialDelayMs = 4000; // first line in a new conversation
        this.autoAdvanceDelayMs = 3000; // subsequent lines
        this.autoAdvanceTimeoutId = null;

        // Keep initial-vs-normal gap consistent when changing speed via slider
        this.autoAdvanceInitialOffsetMs = Math.max(0, this.autoAdvanceInitialDelayMs - this.autoAdvanceDelayMs);
        
        // AI Group Conversation System
        this.aiGroupManager = null;
        this.isAIMode = false;
        this.aiRoundCount = 0;
        this.autoStartAIMode = false;
        this.showSelectionStep = false;
        this.selectionMode = 'random'; // 'random' | 'manual'
        this.allLearnersForSelection = []; // full list for manual picker
        /** Global conversation number (1, 2, 3 …); never reset on group change */
        this.globalConversationCount = 0;

        // Unsubscribe handle for global conversation-state listener
        this._conversationStateUnsub = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeAIGroupManager();
        this.setupConversationStartListeners();
        this.setupManualLearnersListeners();
        this.setupConversationStateSync();
        console.log('Dialogue Page initialized');
    }

    setupConversationStateSync() {
        if (!window.ConversationState?.onChange) return;

        // Reflect global state into UI (and dropdown in manual mode)
        this._conversationStateUnsub = window.ConversationState.onChange((nextState) => {
            window.ConversationState?.syncUI?.();

            // Only bind dropdown to global state in manual mode
            if (nextState?.mode === 'manual' && !this.isAIMode) {
                const selector = document.getElementById('conversation-selector');
                if (!selector) return;
                const idx = Math.max(0, (Number(nextState.conversationNumber) || 1) - 1);
                const value = String(idx);
                if (selector.value !== value) selector.value = value;
            }
        });
    }

    initializeAIGroupManager() {
        if (typeof AIGroupConversationManager !== 'undefined') {
            this.aiGroupManager = new AIGroupConversationManager();
            
            this.aiGroupManager.onRoundComplete((round, groupInfo) => {
                console.log(`AI Round ${round} completed:`, groupInfo);
                this.updateAIStatus(groupInfo);
                this.updateRoundBanner(groupInfo);
            });

            this.aiGroupManager.onGroupChange((newGroup, groupInfo) => {
                console.log('AI Group changed to:', newGroup, groupInfo);
                this.handleAIGroupChange(newGroup, groupInfo);
            });

            this.aiGroupManager.onManualGroupRequest(() => {
                // Manual mode: 4 rounds done, show picker for next 4 learners
                this.showManualLearnersPopupForNextGroup();
            });
        } else {
            console.warn('AIGroupConversationManager not available');
        }
    }

    setupConversationStartListeners() {
        const randomBtn = document.getElementById('selection-mode-random');
        const manualBtn = document.getElementById('selection-mode-manual');
        const closeBtn = document.getElementById('conversation-start-close');
        if (randomBtn) {
            randomBtn.addEventListener('click', () => this.handleSelectionModeChosen('random'));
        }
        if (manualBtn) {
            manualBtn.addEventListener('click', () => this.handleSelectionModeChosen('manual'));
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeConversationStartPopup());
        }
    }

    closeConversationStartPopup() {
        Utils.hidePopup('conversation-start-popup');
        if (typeof app !== 'undefined' && app.showPage) {
            app.showPage('home');
        }
    }

    setupManualLearnersListeners() {
        const startBtn = document.getElementById('manual-learners-start-btn');
        const cancelBtn = document.getElementById('manual-learners-cancel-btn');
        const closeBtn = document.getElementById('manual-learners-close');
        if (startBtn) startBtn.addEventListener('click', () => this.confirmManualLearners());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.cancelManualLearners());
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeManualLearnersPopup());
        }
    }

    closeManualLearnersPopup() {
        Utils.hidePopup('manual-learners-popup');
        if (!this.isAIMode || !this.aiGroupManager || !this.aiGroupManager.isAIActive()) {
            Utils.showPopup('conversation-start-popup');
        }
    }

    handleSelectionModeChosen(mode) {
        this.selectionMode = mode;
        Utils.hidePopup('conversation-start-popup');
        if (mode === 'random') {
            this.startAIModeWithSelection();
        } else {
            this.showManualLearnersPopupForFirstGroup();
        }
    }

    showManualLearnersPopupForFirstGroup() {
        this.populateManualLearnersList(this.allLearnersForSelection, []);
        const note = document.getElementById('manual-learners-used-note');
        if (note) note.style.display = 'none';
        Utils.showPopup('manual-learners-popup');
    }

    showManualLearnersPopupForNextGroup() {
        this.populateManualLearnersList(this.allLearnersForSelection, []);
        const note = document.getElementById('manual-learners-used-note');
        if (note) note.style.display = this.aiGroupManager && this.aiGroupManager.usedGroupKeys && this.aiGroupManager.usedGroupKeys.size > 0 ? 'block' : 'none';
        Utils.showPopup('manual-learners-popup');
    }

    populateManualLearnersList(allNames, selectedNames) {
        const listEl = document.getElementById('manual-learners-list');
        const countEl = document.getElementById('manual-selected-count');
        const startBtn = document.getElementById('manual-learners-start-btn');
        if (!listEl) return;
        listEl.innerHTML = '';
        const selectedSet = new Set(selectedNames);
        allNames.forEach(name => {
            const label = document.createElement('label');
            label.className = 'manual-learner-item';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.dataset.name = name;
            cb.checked = selectedSet.has(name);
            cb.addEventListener('change', () => this.updateManualLearnersCount());
            label.appendChild(cb);
            label.appendChild(document.createTextNode(' ' + name));
            listEl.appendChild(label);
        });
        this.updateManualLearnersCount();
        if (startBtn) startBtn.disabled = true;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    updateManualLearnersCount() {
        const listEl = document.getElementById('manual-learners-list');
        const countEl = document.getElementById('manual-selected-count');
        const startBtn = document.getElementById('manual-learners-start-btn');
        if (!listEl) return;
        const checked = listEl.querySelectorAll('input[type="checkbox"]:checked');
        const count = checked.length;
        if (countEl) countEl.textContent = count;
        let canStart = count === 4;
        if (canStart && this.aiGroupManager && this.aiGroupManager.isAIActive()) {
            const selected = Array.from(checked).map(cb => cb.dataset.name);
            if (this.aiGroupManager.isGroupUsed(selected)) {
                canStart = false;
            }
        }
        if (startBtn) startBtn.disabled = !canStart;
    }

    confirmManualLearners() {
        const listEl = document.getElementById('manual-learners-list');
        if (!listEl) return;
        const checked = listEl.querySelectorAll('input[type="checkbox"]:checked');
        if (checked.length !== 4) return;
        const selected = Array.from(checked).map(cb => cb.dataset.name);
        try {
            if (this.isAIMode && this.aiGroupManager && this.aiGroupManager.isAIActive()) {
                this.aiGroupManager.setManualGroup(selected);
                Utils.hidePopup('manual-learners-popup');
                this.handleAIGroupChange(selected, this.aiGroupManager.getCurrentGroupInfo());
            } else {
                Utils.hidePopup('manual-learners-popup');
                this.startAIModeWithSelection(selected);
            }
        } catch (err) {
            this.showAINotification(err.message || 'This group was already used. Please select a different combination.');
        }
    }

    cancelManualLearners() {
        Utils.hidePopup('manual-learners-popup');
        if (!this.isAIMode || !this.aiGroupManager || !this.aiGroupManager.isAIActive()) {
            Utils.showPopup('conversation-start-popup');
        }
    }

    setupEventListeners() {
        // Conversation selector
        const conversationSelector = document.getElementById('conversation-selector');
        if (conversationSelector) {
            conversationSelector.addEventListener('change', (e) => {
                // In AI mode, dropdown is global conversation history and always stays on latest
                if (this.isAIMode) {
                    const latest = String(this.globalConversationCount || 0);
                    if (latest && e.target.value !== latest) {
                        e.target.value = latest;
                        this.showAINotification('Auto mode: showing latest conversation.');
                    }
                    return;
                }
                const idx = parseInt(e.target.value, 10);
                // Dropdown selection -> GLOBAL state
                window.ConversationState?.setConversationNumber?.((idx + 1), 'manual');
                this.setCurrentConversation(idx);
            });
        }

        // Navigation buttons
        const prevConversationBtn = document.getElementById('prev-conversation-btn');
        const nextConversationBtn = document.getElementById('next-conversation-btn');
        const prevLineBtn = document.getElementById('prev-line-btn');
        const nextLineBtn = document.getElementById('next-line-btn');
        const toggleAutoAdvanceBtn = document.getElementById('toggle-auto-advance-btn');
        const speedSlider = document.getElementById('speed-slider');
        const aiModeToggle = document.getElementById('ai-mode-toggle');

        if (prevConversationBtn) {
            prevConversationBtn.addEventListener('click', () => this.previousConversation());
        }

        if (nextConversationBtn) {
            nextConversationBtn.addEventListener('click', () => this.nextConversation());
        }

        if (prevLineBtn) {
            prevLineBtn.addEventListener('click', () => this.previousLine());
        }

        if (nextLineBtn) {
            nextLineBtn.addEventListener('click', () => this.nextLine());
        }

        if (toggleAutoAdvanceBtn) {
            toggleAutoAdvanceBtn.addEventListener('click', () => this.toggleAutoAdvance());
            this._syncAutoAdvanceButton();
        }

        if (speedSlider) {
            this._initSpeedSlider(speedSlider);
            speedSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value, 10);
                this.setAutoAdvanceSpeed(value);
            });
        }

        if (aiModeToggle) {
            aiModeToggle.addEventListener('click', () => this.toggleAIMode());
        }
    }

    _initSpeedSlider(speedSlider) {
        // Ensure default knob starts in the middle based on current code value
        const min = 1000;
        const max = Math.max(min + 1000, (this.autoAdvanceDelayMs * 2) - min);
        speedSlider.min = String(min);
        speedSlider.max = String(max);
        speedSlider.step = '250';
        speedSlider.value = String(this.autoAdvanceDelayMs);
        this._updateSpeedValueUI(this.autoAdvanceDelayMs);
    }

    _updateSpeedValueUI(delayMs) {
        const el = document.getElementById('speed-value');
        if (!el) return;
        el.textContent = `${(delayMs / 1000).toFixed(1)}s`;
    }

    setAutoAdvanceSpeed(delayMs) {
        const safeDelayMs = Math.max(250, Number.isFinite(delayMs) ? delayMs : this.autoAdvanceDelayMs);
        this.autoAdvanceDelayMs = safeDelayMs;
        this.autoAdvanceInitialDelayMs = safeDelayMs + this.autoAdvanceInitialOffsetMs;
        this._updateSpeedValueUI(safeDelayMs);

        // If currently running, reschedule with new speed
        if (this.autoAdvanceEnabled) {
            if (this._hasNextLine() || this._hasNextConversation()) {
                const delay = this._isAtFirstLearnerLine()
                    ? this.autoAdvanceInitialDelayMs
                    : this.autoAdvanceDelayMs;
                this._scheduleAutoAdvance(delay);
            } else {
                this.stopAutoAdvance();
            }
        }
    }

    toggleAutoAdvance() {
        this.autoAdvanceEnabled = !this.autoAdvanceEnabled;

        if (!this.autoAdvanceEnabled) {
            this.stopAutoAdvance();
        } else {
            // When resuming, prefer the "initial delay" if currently at the first learner line
            if (this._hasNextLine() || this._hasNextConversation()) {
                const delay = this._isAtFirstLearnerLine()
                    ? this.autoAdvanceInitialDelayMs
                    : this.autoAdvanceDelayMs;
                this._scheduleAutoAdvance(delay);
            }
        }

        this._syncAutoAdvanceButton();
    }

    _isAtFirstLearnerLine() {
        if (this.currentConversationIndex >= this.modifiedDialogue.length) return false;
        if (this.currentLineIndex < 0) return false;

        const conversation = this.modifiedDialogue[this.currentConversationIndex];
        const lines = conversation.split('\n');
        const firstLearnerLineIndex = lines.findIndex(line => line.includes('learner-name'));
        return firstLearnerLineIndex >= 0 && this.currentLineIndex === firstLearnerLineIndex;
    }

    _syncAutoAdvanceButton() {
        const btn = document.getElementById('toggle-auto-advance-btn');
        if (!btn) return;

        const isPaused = !this.autoAdvanceEnabled;
        btn.classList.toggle('is-paused', isPaused);
        btn.title = isPaused ? 'Resume auto scroll' : 'Pause auto scroll';
        btn.setAttribute('aria-label', isPaused ? 'Resume auto scroll' : 'Pause auto scroll');

        // Swap icon (lucide)
        btn.innerHTML = `<i data-lucide="${isPaused ? 'play' : 'pause'}"></i>`;
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    stopAutoAdvance() {
        if (this.autoAdvanceTimeoutId) {
            clearTimeout(this.autoAdvanceTimeoutId);
            this.autoAdvanceTimeoutId = null;
        }
    }

    resumeAutoAdvance() {
        if (!this.autoAdvanceEnabled) return;
        if (this.isLoading) return;
        if (!this._hasNextLine() && !this._hasNextConversation()) return;
        this._scheduleAutoAdvance(this.autoAdvanceDelayMs);
    }

    _scheduleAutoAdvance(delayMs) {
        if (!this.autoAdvanceEnabled) return;
        this.stopAutoAdvance();
        this.autoAdvanceTimeoutId = setTimeout(() => {
            this.autoAdvanceTimeoutId = null;
            this._autoAdvanceTick();
        }, delayMs);
    }

    _autoAdvanceTick() {
        if (!this.autoAdvanceEnabled) return;
        if (this.isLoading) return;

        const didAdvance = this.nextLine({ fromAutoAdvance: true });
        if (didAdvance) {
            this._scheduleAutoAdvance(this.autoAdvanceDelayMs);
            return;
        }

        // If conversation ended, jump to next conversation automatically
        if (this._hasNextConversation()) {
            // RULE: 4 conversations = 1 round. After 4 conversations, select new random 4 learners.
            if (this.isAIMode && this.aiGroupManager && (this.currentConversationIndex + 1) >= 4) {
                this.completeAIRound();
                return;
            }
            this.setCurrentConversation(this.currentConversationIndex + 1);
            return; // setCurrentConversation schedules the initial delay
        }

        // Handle AI mode when all conversations are finished (fallback)
        if (this.isAIMode && this.aiGroupManager) {
            this.completeAIRound();
            return;
        }

        // Last conversation finished
        this.stopAutoAdvance();
    }

    _hasNextLine() {
        if (this.currentConversationIndex >= this.modifiedDialogue.length) return false;
        if (this.currentLineIndex < 0) return false;

        const conversation = this.modifiedDialogue[this.currentConversationIndex];
        const lines = conversation.split('\n');
        return this.currentLineIndex < lines.length - 1;
    }

    _hasNextConversation() {
        return this.currentConversationIndex >= 0 &&
               this.currentConversationIndex < this.modifiedDialogue.length - 1;
    }

    async initializeWithLearners(learnerNames, options = {}) {
        this.learnerNames = learnerNames || [];
        this.allLearnersForSelection = [...(learnerNames || [])];
        if (this.learnerNames.length === 0) {
            this.showError('No learners selected. Please go back and select learners.');
            return;
        }
        this.showSelectionStep = Boolean(options.showSelectionStep);
        this.autoStartAIMode = Boolean(options.autoAI);
        if (options.forceAutoAdvance) {
            this.autoAdvanceEnabled = true;
            this._syncAutoAdvanceButton();
        }

        if (this.learnerNames.length >= 4 && this.aiGroupManager) {
            this.showAIModeOption();
        }

        await this.loadDialogue();

        if (this.showSelectionStep && this.learnerNames.length >= 4) {
            this.showSelectionStep = false;
            Utils.showPopup('conversation-start-popup');
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }
        if (this.autoStartAIMode && this.learnerNames.length >= 4) {
            this.isAIMode = true;
            this.startAIMode();
            this.autoStartAIMode = false;
        }
    }

    startAIModeWithSelection(initialGroup = null) {
        try {
            this.isAIMode = true;
            // IMPORTANT: GLOBAL RULE - never reset conversation number automatically
            const existing = window.ConversationState?.get?.();
            const existingNumber = Number(existing?.conversationNumber);
            const safeExisting = Number.isFinite(existingNumber) && existingNumber >= 1 ? Math.floor(existingNumber) : 0;
            this.globalConversationCount = safeExisting;
            this.aiGroupManager.initialize(this.allLearnersForSelection.length ? this.allLearnersForSelection : this.learnerNames, {
                selectionMode: this.selectionMode
            });
            const groupInfo = this.aiGroupManager.startAIConversation(initialGroup);
            this.learnerNames = groupInfo.group;
            this.aiRoundCount = 0;
            this.processDialogue();
            this.setCurrentConversation(0);
            this.updateAIStatus(groupInfo);
            this.updateRoundBanner(groupInfo);
            this.showRoundBanner(true);
            this.showAINotification(`Group: ${groupInfo.group.join(', ')} — Round 1 of ${groupInfo.totalRounds} started.`);
            if (this.autoAdvanceEnabled) {
                this._scheduleAutoAdvance(this.autoAdvanceInitialDelayMs);
            }
            console.log('AI Mode started with group:', groupInfo.group);
        } catch (error) {
            console.error('Failed to start AI mode:', error);
            this.showError(error.message);
            this.isAIMode = false;
        }
    }

    showRoundBanner(show) {
        const banner = document.getElementById('ai-round-banner');
        if (banner) banner.style.display = show && this.isAIMode ? 'block' : 'none';
    }

    updateRoundBanner(groupInfo) {
        const numEl = document.getElementById('ai-round-number');
        const totalEl = document.getElementById('ai-round-total');
        const namesEl = document.getElementById('ai-round-group-names');
        if (numEl) numEl.textContent = groupInfo.round;
        if (totalEl) totalEl.textContent = groupInfo.totalRounds;
        if (namesEl) namesEl.textContent = groupInfo.group ? groupInfo.group.join(', ') : '-';
    }

    updateGlobalConversationDisplay() {
        // Kept for backward compatibility; primary source is ConversationState
        window.ConversationState?.setConversationNumber?.(this.globalConversationCount, 'ai');
        window.ConversationState?.syncUI?.();
    }

    showAIModeOption() {
        const aiModeContainer = document.getElementById('ai-mode-container');
        if (aiModeContainer) {
            aiModeContainer.style.display = 'block';
        }
    }

    toggleAIMode() {
        if (!this.aiGroupManager || this.learnerNames.length < 4) {
            this.showError('AI Mode requires at least 4 learners. Please add more learners.');
            return;
        }

        this.isAIMode = !this.isAIMode;
        
        if (this.isAIMode) {
            this.startAIMode();
        } else {
            this.stopAIMode();
        }
        
        this.updateAIModeUI();
    }

    startAIMode() {
        try {
            if (!this.isAIMode) {
                this.isAIMode = true;
            }
            // IMPORTANT: GLOBAL RULE - never reset conversation number automatically
            const existing = window.ConversationState?.get?.();
            const existingNumber = Number(existing?.conversationNumber);
            const safeExisting = Number.isFinite(existingNumber) && existingNumber >= 1 ? Math.floor(existingNumber) : 0;
            this.globalConversationCount = safeExisting;
            const learners = this.allLearnersForSelection.length ? this.allLearnersForSelection : this.learnerNames;
            this.aiGroupManager.initialize(learners, { selectionMode: 'random' });
            const groupInfo = this.aiGroupManager.startAIConversation();
            this.learnerNames = groupInfo.group;
            this.aiRoundCount = 0;
            this.processDialogue();
            this.setCurrentConversation(0);
            this.updateAIStatus(groupInfo);
            this.updateRoundBanner(groupInfo);
            this.showRoundBanner(true);
            this.showAINotification(`Group: ${groupInfo.group.join(', ')} — Round 1 of ${groupInfo.totalRounds} started.`);
            console.log('AI Mode started with group:', groupInfo.group);
        } catch (error) {
            console.error('Failed to start AI mode:', error);
            this.showError(error.message);
            this.isAIMode = false;
        }
    }

    stopAIMode() {
        if (this.aiGroupManager) {
            this.aiGroupManager.stopAIConversation();
        }
        
        this.aiRoundCount = 0;
        this.hideAIStatus();
        this.showAINotification('AI Mode Stopped');
        
        console.log('AI Mode stopped');
    }

    handleAIGroupChange(newGroup, groupInfo) {
        if (!this.isAIMode) return;
        
        this.learnerNames = newGroup;
        this.aiRoundCount = 0;
        this.processDialogue();
        this.setCurrentConversation(0);
        this.updateAIStatus(groupInfo);
        this.updateRoundBanner(groupInfo);
        this.showRoundBanner(true);
        this.showGroupChangeNotice('Group changed. Conversation numbering continues.');
        this.showAINotification(`Group changed. Conversation numbering continues. — ${newGroup.join(', ')}`);
        if (this.autoAdvanceEnabled) {
            this._scheduleAutoAdvance(this.autoAdvanceInitialDelayMs);
        }
    }

    showGroupChangeNotice(text) {
        const notice = document.getElementById('ai-group-change-notice');
        const textEl = document.getElementById('ai-group-change-text');
        if (!notice || !textEl) return;
        textEl.textContent = text;
        notice.style.display = 'block';
        notice.classList.add('ai-group-change-visible');
        setTimeout(() => {
            notice.classList.remove('ai-group-change-visible');
            notice.style.display = 'none';
        }, 4000);
    }

    updateAIStatus(groupInfo) {
        const aiStatusElement = document.getElementById('ai-status');
        const aiGroupElement = document.getElementById('ai-current-group');
        const aiRoundElement = document.getElementById('ai-current-round');
        
        if (aiStatusElement) {
            aiStatusElement.style.display = this.isAIMode ? 'block' : 'none';
        }
        
        if (aiGroupElement && this.isAIMode) {
            aiGroupElement.textContent = groupInfo.group.join(', ');
        }
        
        if (aiRoundElement && this.isAIMode) {
            aiRoundElement.textContent = `${groupInfo.round}/${groupInfo.totalRounds}`;
        }
    }

    hideAIStatus() {
        const aiStatusElement = document.getElementById('ai-status');
        if (aiStatusElement) {
            aiStatusElement.style.display = 'none';
        }
    }

    updateAIModeUI() {
        const aiModeToggle = document.getElementById('ai-mode-toggle');
        const aiModeIcon = document.getElementById('ai-mode-icon');
        
        if (aiModeToggle) {
            aiModeToggle.classList.toggle('active', this.isAIMode);
            aiModeToggle.title = this.isAIMode ? 'Disable AI Mode' : 'Enable AI Mode';
        }
        
        if (aiModeIcon) {
            aiModeIcon.setAttribute('data-lucide', this.isAIMode ? 'brain-circuit' : 'brain');
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }
    }

    showAINotification(message) {
        if (typeof Utils !== 'undefined') {
            Utils.showToast(message, 'info');
        } else {
            console.log('AI Notification:', message);
        }
    }

    // Get AI conversation statistics
    getAIStatistics() {
        if (!this.aiGroupManager) return null;
        return this.aiGroupManager.getStatistics();
    }

    // Display AI statistics
    showAIStatistics() {
        const stats = this.getAIStatistics();
        if (!stats) return;

        const message = `AI Stats: ${stats.totalConversations} conversations, ${stats.uniqueGroups} unique groups`;
        this.showAINotification(message);
        console.log('AI Statistics:', stats);
    }

    async loadDialogue() {
        this.setLoading(true);
        
        try {
            // Use embedded dialogue data instead of fetching files
            if (typeof getDialogueForLanguage === 'undefined') {
                throw new Error('Dialogue data not loaded. Please ensure dialogue-data.js is included.');
            }
            
            const dialogueText = getDialogueForLanguage(this.currentLanguage);
            
            if (!dialogueText || dialogueText.trim() === '') {
                throw new Error(`No dialogue content found for language: ${this.currentLanguage}`);
            }

            this.originalDialogue = dialogueText;
            
            // Apply translation if needed
            await this.applyTranslation();
            
            this.processDialogue();
            this.populateConversationSelector();
            // Do NOT reset conversation on page load; use GLOBAL state (manual mode)
            const state = window.ConversationState?.get?.();
            const n = Math.max(1, Number(state?.conversationNumber) || 1);
            const idx = Math.min(this.modifiedDialogue.length - 1, Math.max(0, n - 1));
            this.setCurrentConversation(idx);
            
        } catch (error) {
            console.error('Error loading dialogue:', error);
            this.showError(`Failed to load dialogue script for ${this.currentLanguage}. Available languages: ${getAvailableLanguages().join(', ')}`);
            
            // Navigate back to home after a delay
            setTimeout(() => {
                if (app) {
                    app.showPage('home');
                }
            }, 5000);
        } finally {
            this.setLoading(false);
        }
    }

    async applyTranslation() {
        if (window.app && window.app.translationService) {
            const currentLang = window.app.translationService.getCurrentLanguage();
            if (currentLang !== 'en') {
                try {
                    // For Google Translate Widget, the translation happens automatically
                    // when the content is displayed. We just need to ensure the service is ready.
                    console.log(`Translation will be applied for language: ${currentLang}`);
                    
                    // Update language display
                    const currentLanguageElement = document.getElementById('current-language');
                    if (currentLanguageElement) {
                        const langName = window.app.translationService.getSupportedLanguages()[currentLang] || 'English';
                        currentLanguageElement.textContent = langName;
                    }
                } catch (error) {
                    console.error('Translation setup failed:', error);
                }
            }
        }
    }

    async refreshCurrentDialogue() {
        // Store current state
        const currentConversation = this.currentConversationIndex;
        const currentLine = this.currentLineIndex;
        
        // Reload dialogue with current translation
        await this.loadDialogue();
        
        // Restore state if possible
        if (currentConversation >= 0 && currentConversation < this.modifiedDialogue.length) {
            setTimeout(() => {
                // Translation refresh should not advance global conversation numbering
                this.setCurrentConversation(currentConversation, { incrementGlobal: false });
                if (currentLine >= 0) {
                    this.currentLineIndex = currentLine;
                    this.displayConversation();
                    this.scrollToHighlightedLine();
                    if (this.autoAdvanceEnabled) {
                        this.resumeAutoAdvance();
                    }
                }
            }, 500);
        }
    }

    processDialogue() {
        if (!this.originalDialogue || this.learnerNames.length === 0) {
            return;
        }

        // Replace speaker names with learner names
        const modifiedText = this.replaceAllBeforeColonWithLearners(this.originalDialogue, this.learnerNames);
        
        // Split into conversations
        this.modifiedDialogue = this.splitIntoConversations(modifiedText);
    }

    replaceAllBeforeColonWithLearners(text, learners) {
        if (!text || !Array.isArray(learners) || learners.length === 0) {
            return text;
        }

        const shuffledNames = this.shuffleArray([...learners]);
        const recentlyUsedNames = [];
        const minDistance = Math.min(3, learners.length - 1);

        const getRandomName = () => {
            return shuffledNames[Math.floor(Math.random() * shuffledNames.length)];
        };

        return text.replace(
            /^(.+?)\s*:(.*)$/gm,
            (match, beforeColon, afterColon) => {
                let assignedName = null;
                let attempts = 0;
                const maxAttempts = learners.length * 2;

                // Try to find a name that hasn't been recently used
                while (attempts < maxAttempts) {
                    const candidate = getRandomName();
                    attempts++;

                    if (!recentlyUsedNames.includes(candidate)) {
                        assignedName = candidate;
                        break;
                    }
                }

                // Fallback logic
                if (!assignedName) {
                    const fallbackPool = shuffledNames.filter(name => !recentlyUsedNames.includes(name));
                    assignedName = fallbackPool.length > 0 ? 
                        fallbackPool[Math.floor(Math.random() * fallbackPool.length)] : 
                        getRandomName();
                }

                recentlyUsedNames.push(assignedName);
                if (recentlyUsedNames.length > minDistance) {
                    recentlyUsedNames.shift();
                }

                return `<span class="learner-name"><strong>${assignedName}</strong></span>:<span class="conversation-text">${afterColon}</span>`;
            }
        );
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    splitIntoConversations(text) {
        const lines = text.split('\n');
        const conversations = [];
        let currentConversation = '';

        for (const line of lines) {
            if (line.includes('Conversation ') && currentConversation.trim() !== '') {
                conversations.push(currentConversation.trim());
                currentConversation = '';
            }
            currentConversation += line + '\n';
        }

        if (currentConversation.trim() !== '') {
            conversations.push(currentConversation.trim());
        }

        return conversations.filter(conv => conv.trim() !== '');
    }

    populateConversationSelector() {
        const selector = document.getElementById('conversation-selector');
        if (!selector) return;

        // In AI mode, we maintain a global, strictly increasing dropdown ourselves.
        if (this.isAIMode) return;

        selector.innerHTML = '';
        
        this.modifiedDialogue.forEach((conversation, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `Conversation ${index + 1}`;
            selector.appendChild(option);
        });

        // Bind initial dropdown selection to GLOBAL state (manual mode)
        if (window.ConversationState?.get) {
            const state = window.ConversationState.get();
            const n = Math.max(1, Number(state.conversationNumber) || 1);
            const idx = Math.min(this.modifiedDialogue.length - 1, Math.max(0, n - 1));
            selector.value = String(idx);
        }
    }

    resetAIDropdown() {
        const selector = document.getElementById('conversation-selector');
        if (!selector) return;
        selector.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Conversation History';
        placeholder.disabled = true;
        placeholder.selected = true;
        selector.appendChild(placeholder);
    }

    appendAIDropdownOption() {
        const selector = document.getElementById('conversation-selector');
        if (!selector) return;
        const current = this.globalConversationCount;
        const total = Math.ceil(current / 4) * 4;
        const value = String(current);

        // Create the option if not already present
        if (!selector.querySelector(`option[value="${value}"]`)) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = `Conversation ${current}/${total}`;
            selector.appendChild(option);
        }

        // Always keep latest selected
        selector.value = value;
    }

    setCurrentConversation(index, options = {}) {
        if (index < 0 || index >= this.modifiedDialogue.length) {
            return;
        }

        const { incrementGlobal = true } = options || {};
        this.currentConversationIndex = index;
        this.currentLineIndex = -1;
        this.stopAutoAdvance();

        // Global conversation numbering: starts at 1, never reset on group change
        if (this.isAIMode) {
            if (incrementGlobal) {
                this.globalConversationCount = this.globalConversationCount === 0 ? 1 : this.globalConversationCount + 1;
            } else if (!this.globalConversationCount) {
                // Safety: ensure we have a valid number even when not incrementing
                const existing = window.ConversationState?.get?.();
                const existingNumber = Number(existing?.conversationNumber);
                this.globalConversationCount =
                    Number.isFinite(existingNumber) && existingNumber >= 1 ? Math.floor(existingNumber) : 1;
            }
            // Sync into GLOBAL state so all pages reflect the same conversation number
            window.ConversationState?.setConversationNumber?.(this.globalConversationCount, 'ai');
            window.ConversationState?.syncUI?.();
            // Round within group: 1–4 (track by conversation index)
            const groupInfo = this.aiGroupManager.getCurrentGroupInfo();
            if (groupInfo) {
                this.updateRoundBanner({
                    ...groupInfo,
                    round: index + 1,
                    totalRounds: 4
                });
            }
            this.appendAIDropdownOption();
        } else {
            // Manual mode: conversation number is simply index+1
            window.ConversationState?.setConversationNumber?.(index + 1, 'manual');
            window.ConversationState?.syncUI?.();
        }
        
        // Update conversation selector
        const selector = document.getElementById('conversation-selector');
        if (selector) {
            if (!this.isAIMode) {
                selector.value = index;
            }
        }

        // Display the conversation
        this.displayConversation();
        
        // Set current line to first learner line
        this.setFirstLearnerLine();

        // Auto-advance: first line should stay longer (6s) for every new conversation
        if (this.autoAdvanceEnabled) {
            this._scheduleAutoAdvance(this.autoAdvanceInitialDelayMs);
        }
        this._syncAutoAdvanceButton();
        
        // Update navigation buttons
        this.updateNavigationButtons();
    }

    displayConversation() {
        const scriptText = document.getElementById('script-text');
        if (!scriptText || this.currentConversationIndex >= this.modifiedDialogue.length) {
            return;
        }

        let conversation = this.modifiedDialogue[this.currentConversationIndex];

        // AI mode: ensure the *content header* continues globally (5 → 6) even after group change
        if (this.isAIMode && this.globalConversationCount >= 1) {
            conversation = this._rewriteConversationHeaderNumber(conversation, this.globalConversationCount);
        }
        scriptText.innerHTML = this.renderHighlightedDialogue(conversation);
    }

    _rewriteConversationHeaderNumber(dialogue, globalNumber) {
        if (!dialogue) return dialogue;
        const n = Number(globalNumber);
        if (!Number.isFinite(n) || n < 1) return dialogue;
        const replacement = `Conversation ${Math.floor(n)}`;
        return dialogue.replace(/^Conversation\s+\d+/m, replacement);
    }

    renderHighlightedDialogue(dialogue) {
        const lines = dialogue.split('\n');
        return lines.map((line, index) => {
            const isHighlighted = index === this.currentLineIndex;
            const trimmedLine = line.trim();
            
            // Detect "Conversation X" lines (smaller font)
            const isConversationNumber = trimmedLine.startsWith('Conversation ') && /^Conversation \d+/.test(trimmedLine);
            
            // Detect "Basic Introduction and Greetings" type titles (larger font, bold, underline)
            const isConversationTitle = trimmedLine.includes('Basic Introduction') || 
                                       (trimmedLine !== '' && !trimmedLine.includes(':') && 
                                        !isConversationNumber && trimmedLine.length > 10 && 
                                        !trimmedLine.match(/^Person \d+:/));
            
            let className = isHighlighted ? 'highlighted-line' : '';
            if (isConversationNumber) {
                className = className ? `${className} conversation-number` : 'conversation-number';
            } else if (isConversationTitle) {
                className = className ? `${className} conversation-title` : 'conversation-title';
            }
            
            const id = isHighlighted ? 'highlighted-line' : '';
            
            return `<div class="${className}" id="${id}">${line}</div>`;
        }).join('');
    }

    setFirstLearnerLine() {
        if (this.currentConversationIndex >= this.modifiedDialogue.length) {
            return;
        }

        const conversation = this.modifiedDialogue[this.currentConversationIndex];
        const lines = conversation.split('\n');
        
        // Find the first line that contains learner-name class
        const firstLearnerLineIndex = lines.findIndex(line => 
            line.includes('learner-name')
        );
        
        this.currentLineIndex = firstLearnerLineIndex >= 0 ? firstLearnerLineIndex : 0;
        this.displayConversation();
        this.scrollToHighlightedLine();
    }

    nextLine(options = {}) {
        if (this.currentConversationIndex >= this.modifiedDialogue.length) {
            return false;
        }

        const conversation = this.modifiedDialogue[this.currentConversationIndex];
        const lines = conversation.split('\n');
        let didAdvance = false;
        
        if (this.currentLineIndex < lines.length - 1) {
            this.currentLineIndex++;
            this.displayConversation();
            this.scrollToHighlightedLine();
            didAdvance = true;
        }
        
        this.updateNavigationButtons();

        // Manual navigation should restart auto-advance with normal delay (5s)
        if (!options.fromAutoAdvance && this.autoAdvanceEnabled) {
            this.resumeAutoAdvance();
        }

        return didAdvance;
    }

    previousLine() {
        if (this.currentLineIndex > 0) {
            this.currentLineIndex--;
            this.displayConversation();
            this.scrollToHighlightedLine();
        }
        
        this.updateNavigationButtons();

        // Manual navigation should restart auto-advance with normal delay (5s)
        if (this.autoAdvanceEnabled) {
            this.resumeAutoAdvance();
        }
    }

    nextConversation() {
        if (this.currentConversationIndex < this.modifiedDialogue.length - 1) {
            this.setCurrentConversation(this.currentConversationIndex + 1);
        } else if (this.isAIMode && this.aiGroupManager) {
            // In AI mode, complete round when reaching end of conversations
            this.completeAIRound();
        }
    }

    completeAIRound() {
        if (!this.isAIMode || !this.aiGroupManager) return;
        
        this.aiRoundCount++;
        const result = this.aiGroupManager.completeRound();
        
        if (result) {
            if (result.groupChanged) {
                if (result.awaitingManualSelection) {
                    this.showAINotification('4 rounds complete. Select next 4 learners.');
                }
                console.log('AI Round completed - group changed');
            } else {
                // Same group, start next round
                this.setCurrentConversation(0);
                this.updateAIStatus(result);
                this.updateRoundBanner(result);
                this.showRoundBanner(true);
                this.showAINotification(`Round ${result.round} of ${result.totalRounds} — Current group: ${(result.group || []).join(', ')}`);
                if (this.autoAdvanceEnabled) {
                    this._scheduleAutoAdvance(this.autoAdvanceInitialDelayMs);
                }
            }
        }
    }

    previousConversation() {
        if (this.currentConversationIndex > 0) {
            // Going back should not advance the GLOBAL conversation number
            this.setCurrentConversation(this.currentConversationIndex - 1, { incrementGlobal: false });
        }
    }

    scrollToHighlightedLine() {
        const highlightedLine = document.getElementById('highlighted-line');
        if (highlightedLine) {
            highlightedLine.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }

    updateNavigationButtons() {
        const prevConversationBtn = document.getElementById('prev-conversation-btn');
        const nextConversationBtn = document.getElementById('next-conversation-btn');
        const prevLineBtn = document.getElementById('prev-line-btn');
        const nextLineBtn = document.getElementById('next-line-btn');

        // Conversation navigation
        if (prevConversationBtn) {
            prevConversationBtn.disabled = this.currentConversationIndex <= 0;
        }
        
        if (nextConversationBtn) {
            nextConversationBtn.disabled = this.currentConversationIndex >= this.modifiedDialogue.length - 1;
        }

        // Line navigation
        if (prevLineBtn) {
            prevLineBtn.disabled = this.currentLineIndex <= 0;
        }
        
        if (nextLineBtn && this.currentConversationIndex < this.modifiedDialogue.length) {
            const conversation = this.modifiedDialogue[this.currentConversationIndex];
            const lines = conversation.split('\n');
            nextLineBtn.disabled = this.currentLineIndex >= lines.length - 1;
        }
    }

    setLoading(loading) {
        this.isLoading = loading;
        const scriptText = document.getElementById('script-text');
        
        if (scriptText) {
            if (loading) {
                scriptText.innerHTML = '<div class="loading">Loading dialogue...</div>';
            }
        }
    }

    showError(message) {
        const scriptText = document.getElementById('script-text');
        if (scriptText) {
            scriptText.innerHTML = `
                <div style="text-align: center; color: #ef4444; padding: 2rem;">
                    <h3>Error</h3>
                    <p>${message}</p>
                    <p style="margin-top: 1rem; font-size: 0.9rem; color: #666;">
                        Redirecting to home page in 5 seconds...
                    </p>
                </div>
            `;
        }
    }

    // Public methods
    setLanguage(language) {
        this.currentLanguage = language;
        const languageElement = document.getElementById('current-language');
        if (languageElement) {
            languageElement.textContent = language;
        }
    }

    getCurrentConversation() {
        return this.currentConversationIndex;
    }

    getCurrentLine() {
        return this.currentLineIndex;
    }

    getTotalConversations() {
        return this.modifiedDialogue.length;
    }

    getLearnerNames() {
        return this.learnerNames;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DialoguePage;
} 
