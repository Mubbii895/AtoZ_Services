// AI Group Conversation Manager
// Automatically manages group conversations with random learner selection

class AIGroupConversationManager {
    constructor() {
        this.allLearners = [];
        this.currentGroup = [];
        this.usedGroups = [];
        this.currentRound = 0;
        this.maxRoundsPerGroup = 4;
        this.isActive = false;
        this.conversationHistory = [];
        this.autoAdvanceEnabled = true;
        this.roundCompleteCallback = null;
        this.groupChangeCallback = null;
        
        console.log('AI Group Conversation Manager initialized');
    }

    // Initialize with available learners
    initialize(learners) {
        if (!Array.isArray(learners) || learners.length < 4) {
            throw new Error('At least 4 learners are required for group conversations');
        }
        
        this.allLearners = [...learners];
        this.usedGroups = [];
        this.conversationHistory = [];
        this.isActive = false;
        
        console.log(`AI Group Manager initialized with ${this.allLearners.length} learners`);
        return this;
    }

    // Start AI group conversation system
    startAIConversation() {
        if (this.allLearners.length < 4) {
            throw new Error('Need at least 4 learners to start AI group conversation');
        }

        this.isActive = true;
        this.selectNewGroup();
        this.currentRound = 0;
        
        console.log('AI Group Conversation started');
        console.log('First group:', this.currentGroup);
        
        return {
            group: this.currentGroup,
            round: this.currentRound + 1,
            totalRounds: this.maxRoundsPerGroup
        };
    }

    // Stop AI conversation system
    stopAIConversation() {
        this.isActive = false;
        this.currentGroup = [];
        this.currentRound = 0;
        console.log('AI Group Conversation stopped');
    }

    // Select a new random group of 4 learners
    selectNewGroup() {
        let attempts = 0;
        const maxAttempts = 50; // Prevent infinite loops
        let newGroup;

        do {
            newGroup = this.getRandomLearners(4);
            attempts++;
            
            if (attempts >= maxAttempts) {
                // If we can't find a unique group, clear history and start fresh
                console.log('Clearing group history to allow new combinations');
                this.usedGroups = [];
                newGroup = this.getRandomLearners(4);
                break;
            }
        } while (this.isGroupUsed(newGroup));

        this.currentGroup = newGroup;
        this.usedGroups.push([...newGroup]);
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

    // Check if a group combination has been used before
    isGroupUsed(group) {
        const groupNames = group.sort();
        return this.usedGroups.some(usedGroup => {
            const usedNames = usedGroup.sort();
            return groupNames.length === usedNames.length &&
                   groupNames.every((name, index) => name === usedNames[index]);
        });
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

        // Check if we need to change group
        if (this.currentRound >= this.maxRoundsPerGroup) {
            console.log('Group rounds completed, selecting new group...');
            this.selectNewGroup();
            
            return {
                groupChanged: true,
                newGroup: this.currentGroup,
                round: this.currentRound + 1,
                totalRounds: this.maxRoundsPerGroup
            };
        }

        return {
            groupChanged: false,
            group: this.currentGroup,
            round: this.currentRound + 1,
            totalRounds: this.maxRoundsPerGroup
        };
    }

    // Get current group information
    getCurrentGroupInfo() {
        return {
            group: [...this.currentGroup],
            round: this.currentRound + 1,
            totalRounds: this.maxRoundsPerGroup,
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

    // Reset the system
    reset() {
        this.currentGroup = [];
        this.usedGroups = [];
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