// AI Group Conversation Manager - Conversation Flow Controller
// RULE 1: Group = random 4 from learners list
    // RULE 2: 4 conversations = 1 round per group
// RULE 3: When 4 conversations done → current group END, roundCount reset
// RULE 4: Before next group → discard old group, new random 4, no repeat of previous group
// RULE 5: New group → roundCount 1–4 again
// RULE 6: Continuous loop, no manual trigger, group change automatic

class AIGroupConversationManager {
    constructor() {
        this.allLearners = [];
        this.currentGroup = [];
        this.usedGroups = [];
        this.usedGroupKeys = new Set();
        this.lastGroupKey = null;
        this.currentRound = 0;
        this.maxRoundsPerGroup = 1; // 1 round = 4 conversations; after 4 conversations → new group
        this.isActive = false;
        this.conversationHistory = [];
        this.autoAdvanceEnabled = true;
        this.roundCompleteCallback = null;
        this.groupChangeCallback = null;
        this.manualGroupRequestCallback = null;
        /** 'random' | 'manual' - how groups are selected */
        this.selectionMode = 'random';
        
        console.log('AI Group Conversation Manager initialized');
    }

    // Initialize with available learners
    initialize(learners, options = {}) {
        if (!Array.isArray(learners) || learners.length < 4) {
            throw new Error('At least 4 learners are required for group conversations');
        }
        
        this.allLearners = [...learners];
        this.usedGroups = [];
        this.usedGroupKeys = new Set();
        this.lastGroupKey = null;
        this.conversationHistory = [];
        this.isActive = false;
        this.selectionMode = options.selectionMode || 'random';
        
        console.log(`AI Group Manager initialized with ${this.allLearners.length} learners, mode: ${this.selectionMode}`);
        return this;
    }

    // Start AI group conversation system (first group: random or use provided group for manual)
    startAIConversation(initialGroup = null) {
        if (this.allLearners.length < 4) {
            throw new Error('Need at least 4 learners to start AI group conversation');
        }

        this.isActive = true;
        this.currentRound = 0;
        
        if (initialGroup && Array.isArray(initialGroup) && initialGroup.length === 4) {
            // Manual: use user-selected group
            this.setManualGroup(initialGroup);
        } else {
            // Random: select new group
            this.selectNewGroup();
        }
        
        console.log('AI Group Conversation started, group:', this.currentGroup);
        
        return {
            group: this.currentGroup,
            round: this.currentRound + 1,
            totalRounds: AIGroupConversationManager.CONVERSATIONS_PER_GROUP
        };
    }

    // Set group manually (used for manual selection mode)
    setManualGroup(learnerNames) {
        if (!Array.isArray(learnerNames) || learnerNames.length !== 4) {
            throw new Error('Manual group must have exactly 4 learners');
        }
        const key = this.getGroupKey(learnerNames);
        this.currentGroup = [...learnerNames];
        this.usedGroups.push([...this.currentGroup]);
        this.usedGroupKeys.add(key);
        this.lastGroupKey = key;
        this.currentRound = 0;

        if (this.groupChangeCallback) {
            this.groupChangeCallback(this.currentGroup, this.getCurrentGroupInfo());
        }
        console.log('Manual group set:', this.currentGroup);
        return this.currentGroup;
    }

    // Stop AI conversation system
    stopAIConversation() {
        this.isActive = false;
        this.currentGroup = [];
        this.currentRound = 0;
        console.log('AI Group Conversation stopped');
    }

    // Select a new random group of 4 learners (2nd group: no name repeat from previous group)
    selectNewGroup() {
        const previousGroup = [...this.currentGroup];
        const pool = previousGroup.length > 0
            ? this.allLearners.filter(name => !previousGroup.includes(name))
            : this.allLearners;
        const useNoRepeat = pool.length >= 4;

        let attempts = 0;
        const maxAttempts = 80;
        let newGroup;
        let newGroupKey;

        do {
            newGroup = useNoRepeat ? this.getRandomLearnersFromPool(pool, 4) : this.getRandomLearners(4);
            newGroupKey = this.getGroupKey(newGroup);
            attempts++;

            if (attempts >= maxAttempts) {
                if (this.usedGroupKeys.size >= this.getMaxUniqueGroups()) {
                    this.usedGroups = [];
                    this.usedGroupKeys = new Set();
                }
                newGroup = useNoRepeat && pool.length >= 4
                    ? this.getRandomLearnersFromPool(pool, 4)
                    : this.getRandomLearners(4);
                newGroupKey = this.getGroupKey(newGroup);
                break;
            }
        } while (this.isGroupUsed(newGroup) || (this.lastGroupKey && newGroupKey === this.lastGroupKey));

        this.currentGroup = newGroup;
        this.usedGroups.push([...newGroup]);
        this.usedGroupKeys.add(newGroupKey);
        this.lastGroupKey = newGroupKey;
        this.currentRound = 0;

        // Trigger group change callback
        if (this.groupChangeCallback) {
            this.groupChangeCallback(this.currentGroup, this.getCurrentGroupInfo());
        }

        console.log('New group selected:', this.currentGroup);
        return this.currentGroup;
    }

    // Get random learners from the pool
    getRandomLearners(count) {
        const shuffled = [...this.allLearners].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count);
    }

    // Get random 4 from a given pool (e.g. allLearners minus previous group — no name repeat)
    getRandomLearnersFromPool(pool, count) {
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count);
    }

    // Check if a group combination has been used before
    isGroupUsed(group) {
        const groupKey = this.getGroupKey(group);
        return this.usedGroupKeys.has(groupKey);
    }

    getGroupKey(group) {
        return [...group].sort().join('|');
    }

    getMaxUniqueGroups() {
        const n = this.allLearners.length;
        if (n < 4) return 0;
        return (n * (n - 1) * (n - 2) * (n - 3)) / 24;
    }

    // Complete current round and check if group should change
    completeRound() {
        if (!this.isActive) {
            return null;
        }

        this.currentRound++;
        
        // Record round completion
        this.conversationHistory.push({
            group: [...this.currentGroup],
            round: this.currentRound,
            timestamp: new Date().toISOString()
        });

        // Trigger round complete callback
        if (this.roundCompleteCallback) {
            this.roundCompleteCallback(this.currentRound, this.getCurrentGroupInfo());
        }

        console.log(`Round ${this.currentRound} completed for group:`, this.currentGroup);

        // RULE 3 & 4: Round 4 reached → end group, reset roundCount, discard old group, new random 4
        if (this.currentRound >= this.maxRoundsPerGroup) {
            console.log('Group rounds completed (4/4). Resetting roundCount, selecting new group...');
            if (this.selectionMode === 'manual' && this.manualGroupRequestCallback) {
                this.manualGroupRequestCallback();
                return {
                    groupChanged: true,
                    awaitingManualSelection: true,
                    newGroup: null,
                    round: 1,
                    totalRounds: AIGroupConversationManager.CONVERSATIONS_PER_GROUP
                };
            }
            // RULE 4: Completely discard old group; new random 4 (no repeat)
            this.selectNewGroup();
            return {
                groupChanged: true,
                newGroup: this.currentGroup,
                round: 1,
                totalRounds: AIGroupConversationManager.CONVERSATIONS_PER_GROUP
            };
        }

        return {
            groupChanged: false,
            group: this.currentGroup,
            round: this.currentRound + 1,
            totalRounds: AIGroupConversationManager.CONVERSATIONS_PER_GROUP
        };
    }

    // Conversations per group for display (4 conversations = 1 round, then new group)
    static get CONVERSATIONS_PER_GROUP() { return 4; }

    // Get current group information
    getCurrentGroupInfo() {
        return {
            group: [...this.currentGroup],
            round: this.currentRound + 1,
            totalRounds: AIGroupConversationManager.CONVERSATIONS_PER_GROUP,
            isActive: this.isActive,
            totalGroups: this.usedGroups.length,
            conversationsCompleted: this.conversationHistory.length
        };
    }

    // Get conversation statistics
    getStatistics() {
        const totalConversations = this.conversationHistory.length;
        const uniqueGroups = this.usedGroups.length;
        const learnerParticipation = {};

        // Count participation for each learner
        this.allLearners.forEach(learner => {
            learnerParticipation[learner] = 0;
        });

        this.conversationHistory.forEach(entry => {
            entry.group.forEach(learner => {
                if (learnerParticipation[learner] !== undefined) {
                    learnerParticipation[learner]++;
                }
            });
        });

        return {
            totalConversations,
            uniqueGroups,
            learnerParticipation,
            currentGroup: [...this.currentGroup],
            currentRound: this.currentRound,
            isActive: this.isActive
        };
    }

    // Set callbacks for events
    onRoundComplete(callback) {
        this.roundCompleteCallback = callback;
    }

    onGroupChange(callback) {
        this.groupChangeCallback = callback;
    }

    onManualGroupRequest(callback) {
        this.manualGroupRequestCallback = callback;
    }

    // Reset the system
    reset() {
        this.currentGroup = [];
        this.usedGroups = [];
        this.usedGroupKeys = new Set();
        this.lastGroupKey = null;
        this.currentRound = 0;
        this.isActive = false;
        this.conversationHistory = [];
        console.log('AI Group Conversation Manager reset');
    }

    // Get next conversation info without completing current round
    getNextConversationInfo() {
        if (!this.isActive) {
            return null;
        }

        const nextRound = this.currentRound + 1;
        
        if (nextRound > this.maxRoundsPerGroup) {
            // Would trigger group change
            return {
                willChangeGroup: true,
                currentGroup: [...this.currentGroup],
                currentRound: this.currentRound,
                nextRound: 1
            };
        }

        return {
            willChangeGroup: false,
            currentGroup: [...this.currentGroup],
            currentRound: this.currentRound,
            nextRound: nextRound
        };
    }

    // Check if system is active
    isAIActive() {
        return this.isActive;
    }

    // Get current group
    getCurrentGroup() {
        return [...this.currentGroup];
    }

    // Get current round
    getCurrentRound() {
        return this.currentRound;
    }

    // Get max rounds per group
    getMaxRoundsPerGroup() {
        return this.maxRoundsPerGroup;
    }

    // Set max rounds per group
    setMaxRoundsPerGroup(rounds) {
        if (rounds > 0) {
            this.maxRoundsPerGroup = rounds;
            console.log(`Max rounds per group set to: ${rounds}`);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIGroupConversationManager;
}
