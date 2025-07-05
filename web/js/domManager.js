import { boardRenderer } from './boardRenderer.js';
import { scoreBarRenderer } from './scoreBarRenderer.js';
import { DOM } from './domElements.js';

export class DOMManager {
    constructor() {
        this.isInitialized = false;
    }

    initialize() {
        if (this.isInitialized) {
            console.warn('DOMManager already initialized');
            return;
        }

        try {
            // Validate DOM elements exist
            if (!DOM.validate()) {
                throw new Error('Required DOM elements are missing');
            }

            // Initialize board and score bar
            this.initializeBoard();
            this.initializeScoreBar();

            this.isInitialized = true;
            console.log('DOM components initialized successfully');
        } catch (error) {
            console.error('Failed to initialize DOM components:', error);
            throw error;
        }
    }

    initializeBoard() {
        try {
            boardRenderer.createBoard();
            console.log('Board initialized');
        } catch (error) {
            console.error('Failed to initialize board:', error);
            throw error;
        }
    }

    initializeScoreBar() {
        try {
            scoreBarRenderer.createScoreBar();
            console.log('Score bar initialized');
        } catch (error) {
            console.error('Failed to initialize score bar:', error);
            throw error;
        }
    }

    // Reset all visual components
    reset() {
        try {
            boardRenderer.clearAllStones();
            console.log('Board reset');
        } catch (error) {
            console.error('Failed to reset board:', error);
        }
    }

    // Get initialization status
    isReady() {
        return this.isInitialized;
    }

    // Force re-initialization
    reinitialize() {
        this.isInitialized = false;
        this.initialize();
    }
}

// Create and export singleton instance
export const domManager = new DOMManager();

// Auto-initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
    try {
        domManager.initialize();
    } catch (error) {
        console.error('Failed to auto-initialize DOM:', error);
    }
}); 