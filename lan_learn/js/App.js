// Main Application JavaScript
class GTongueLearnApp {
    constructor() {
        this.currentPage = 'login';
        this.isLoggedIn = false;
        this.userEmail = '';
        this.translationService = null;
        this.init();
    }

    init() {
        this.setupTranslationService();
        this.setupLogin();
        this.setupNavigation();
        this.setupLanguageSelector();
        this.restoreLoginSession();
        this.initializeLucideIcons();
        console.log('GTongue Learn App initialized');
    }

    setupLogin() {
        const loginForm = document.getElementById('login-form');
        const emailInput = document.getElementById('login-email');

        if (!loginForm || !emailInput) return;

        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = emailInput.value.trim();
            const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

            if (!isValidEmail) {
                Utils.showToast('Please enter a valid email address', 'warning');
                return;
            }

            this.isLoggedIn = true;
            this.userEmail = email;
            try {
                localStorage.setItem('gtongue_logged_in_email', email);
                localStorage.removeItem('learners');
                localStorage.removeItem('selectedLearners');
            } catch (error) {
                console.warn('Could not save login session:', error);
            }

            if (window.learnHome?.resetLearners) {
                window.learnHome.resetLearners();
            }

            this.showPage('home');
            Utils.showToast('Login successful', 'success');
            emailInput.value = '';
        });
    }

    restoreLoginSession() {
        let savedEmail = '';
        try {
            savedEmail = localStorage.getItem('gtongue_logged_in_email') || '';
        } catch (error) {
            console.warn('Could not read login session:', error);
        }

        if (savedEmail) {
            this.isLoggedIn = true;
            this.userEmail = savedEmail;
            this.showPage('home');
            return;
        }

        this.showPage('login');
    }

    logout() {
        this.isLoggedIn = false;
        this.userEmail = '';

        try {
            localStorage.removeItem('gtongue_logged_in_email');
        } catch (error) {
            console.warn('Could not clear login session:', error);
        }

        this.showPage('login');
        Utils.showToast('Logged out successfully', 'info');
    }

    setupTranslationService() {
        if (typeof TranslationService !== 'undefined') {
            this.translationService = new TranslationService();
            
            // Load saved language preference
            this.translationService.loadLanguagePreference();
            
            // Populate language dropdown
            this.populateLanguageDropdown();
        }
    }

    populateLanguageDropdown() {
        const languageSelect = document.getElementById('language-select');
        if (!languageSelect || !this.translationService) return;

        const languages = this.translationService.getSupportedLanguages();
        
        // Clear existing options
        languageSelect.innerHTML = '';
        
        // Add language options
        Object.entries(languages).forEach(([code, name]) => {
            const option = document.createElement('option');
            option.value = code;
            option.textContent = `🌐 ${name}`;
            option.className = 'notranslate';
            languageSelect.appendChild(option);
        });

        // Set current language (default to English)
        const currentLang = this.translationService.getCurrentLanguage() || 'en';
        languageSelect.value = currentLang;
    }

    setupLanguageSelector() {
        const languageSelect = document.getElementById('language-select');
        if (!languageSelect) return;

        let isChangingLanguage = false;

        languageSelect.addEventListener('change', (e) => {
            // Prevent multiple rapid changes
            if (isChangingLanguage) {
                e.preventDefault();
                return;
            }

            const selectedLanguage = e.target.value;
            const currentLanguage = this.translationService?.getCurrentLanguage() || 'en';
            
            // Don't change if it's the same language (unless it's English and we need to force it)
            if (selectedLanguage === currentLanguage && selectedLanguage !== 'en') {
                return;
            }
            
            // Special handling for English selection
            if (selectedLanguage === 'en') {
                console.log('English selected from dropdown - forcing English display');
                // Don't use translation service for English, just reload
                localStorage.setItem('ensure_english_display', 'true');
                localStorage.removeItem('preferred_language');
                window.location.reload();
                return;
            }

            if (this.translationService) {
                isChangingLanguage = true;
                
                // Disable the selector while changing
                languageSelect.disabled = true;
                languageSelect.style.opacity = '0.6';
                
                const languageName = this.translationService.getSupportedLanguages()[selectedLanguage];
                Utils.showToast(`Changing language to ${languageName}...`, 'info');
                
                try {
                    this.translationService.setCurrentLanguage(selectedLanguage);
                    
                    // Re-enable after a shorter delay
                    setTimeout(() => {
                        isChangingLanguage = false;
                        languageSelect.disabled = false;
                        languageSelect.style.opacity = '1';
                    }, 1000);
                    
                } catch (error) {
                    console.error('Language change error:', error);
                    Utils.showToast('Failed to change language. Please try again.', 'error');
                    
                    // Reset selector
                    languageSelect.value = currentLanguage;
                    isChangingLanguage = false;
                    languageSelect.disabled = false;
                    languageSelect.style.opacity = '1';
                }
            }
        });

        // Handle page visibility change to reset state
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && isChangingLanguage) {
                // Reset state when page becomes visible again
                setTimeout(() => {
                    isChangingLanguage = false;
                    languageSelect.disabled = false;
                    languageSelect.style.opacity = '1';
                }, 1000);
            }
        });
    }

    setupNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                
                // Skip navigation handling for external links (GitHub link)
                if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
                    // Let the link open normally in a new tab
                    return;
                }

                const page = href.substring(1); // Remove the # from href
                if (!this.isLoggedIn && page !== 'login') {
                    e.preventDefault();
                    Utils.showToast('Please login first', 'warning');
                    this.showPage('login');
                    return;
                }
                
                e.preventDefault();
                this.showPage(page);
                this.updateActiveNavLink(link);
            });
        });

        // Handle go back buttons
        document.getElementById('go-back-btn')?.addEventListener('click', () => {
            this.showPage('home');
        });

        document.getElementById('about-back-btn')?.addEventListener('click', () => {
            this.showPage('dialogue');
        });

        document.getElementById('opensource-back-btn')?.addEventListener('click', () => {
            this.showPage('home');
        });

        document.getElementById('about-btn')?.addEventListener('click', () => {
            this.showPage('about');
        });

        document.getElementById('logout-btn')?.addEventListener('click', () => {
            this.logout();
        });
    }

    showPage(pageId) {
        if (!this.isLoggedIn && pageId !== 'login') {
            pageId = 'login';
        }

        const previousPage = this.currentPage;

        // Pause auto-advance when leaving Dialogue page
        if (previousPage === 'dialogue' && pageId !== 'dialogue') {
            window.dialoguePage?.stopAutoAdvance?.();
        }

        // Hide all pages
        const pages = document.querySelectorAll('.page');
        pages.forEach(page => page.classList.remove('active'));

        // Show the selected page
        const targetPage = document.getElementById(`${pageId}-page`);
        if (targetPage) {
            targetPage.classList.add('active');
            this.currentPage = pageId;
        }

        // Resume auto-advance when returning to Dialogue page
        if (pageId === 'dialogue' && previousPage !== 'dialogue') {
            window.dialoguePage?.resumeAutoAdvance?.();
        }

        // Update navigation
        this.updateNavigation(pageId);
        this.updateNavbarForPage(pageId);

        // Keep global conversation number reflected on every page
        window.ConversationState?.syncUI?.();
        
        // Reinitialize Lucide icons for the new page
        setTimeout(() => this.initializeLucideIcons(), 100);
    }

    updateNavbarForPage(pageId) {
        const navLinksContainer = document.querySelector('.nav-links');
        if (!navLinksContainer) return;

        if (pageId === 'login') {
            navLinksContainer.style.display = 'none';
        } else {
            navLinksContainer.style.display = 'flex';
        }
    }

    updateActiveNavLink(activeLink) {
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => link.classList.remove('active'));
        activeLink.classList.add('active');
    }

    updateNavigation(pageId) {
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${pageId}`) {
                link.classList.add('active');
            }
        });
    }

    initializeLucideIcons() {
        // Initialize Lucide icons when they're available
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        } else {
            // Retry after a short delay if lucide is not loaded yet
            setTimeout(() => this.initializeLucideIcons(), 100);
        }
    }
}

// Utility Functions
const Utils = {
    // Show toast notification
    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        toastContainer.appendChild(toast);

        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 10);

        // Remove toast after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    },

    // Show popup
    showPopup(popupId) {
        const popup = document.getElementById(popupId);
        if (popup) {
            popup.classList.add('show');
        }
    },

    // Hide popup
    hidePopup(popupId) {
        const popup = document.getElementById(popupId);
        if (popup) {
            popup.classList.remove('show');
        }
    },

    // Generate unique ID
    generateId() {
        return Date.now() + Math.random().toString(36).substr(2, 9);
    },

    // Validate input
    validateInput(value, type = 'text') {
        if (!value || value.trim() === '') {
            return false;
        }
        
        switch (type) {
            case 'name':
                return value.trim().length >= 2 && /^[a-zA-Z\s]+$/.test(value.trim());
            default:
                return value.trim().length > 0;
        }
    },

    // Format name
    formatName(name) {
        return name.trim().split(' ').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
    },

    // Local storage helpers
    getFromStorage(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('Error reading from localStorage:', error);
            return defaultValue;
        }
    },

    saveToStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
    },

    removeFromStorage(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.error('Error removing from localStorage:', error);
        }
    }
};

// Global app instance
let app;

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    app = new GTongueLearnApp();
    
    // Initialize other modules
    if (typeof LearnHome !== 'undefined') {
        window.learnHome = new LearnHome();
    }
    
    if (typeof DialoguePage !== 'undefined') {
        window.dialoguePage = new DialoguePage();
    }
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GTongueLearnApp, Utils };
} 