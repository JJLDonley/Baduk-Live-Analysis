// Centralized DOM element references for the Baduk Analysis client
class DOMElements {
    constructor() {
        this.elements = new Map();
        this.images = new Map();
        this.initializeElements();
        this.initializeImages();
    }

    initializeElements() {
        // Player information elements
        this.elements.set('blackName', document.getElementById("black-name"));
        this.elements.set('whiteName', document.getElementById("white-name"));
        this.elements.set('blackClock', document.getElementById("black-clock"));
        this.elements.set('whiteClock', document.getElementById("white-clock"));
        
        // Winrate elements
        this.elements.set('winratePie', document.getElementById("pie"));
        this.elements.set('winrateOver', document.getElementById("pie-over"));
        this.elements.set('winrateText', document.getElementById("pie-text"));
        
        // Score elements
        this.elements.set('blackPoints', document.getElementById("black-points"));
        this.elements.set('whitePoints', document.getElementById("white-points"));
        
        // Container elements
        this.elements.set('goBoard', document.querySelector(".goboard"));
        this.elements.set('counting', document.querySelector(".counting"));
    }

    initializeImages() {
        const blackImage = new Image();
        blackImage.src = '../assets/black_stone.png';
        this.images.set('blackStone', blackImage);
        
        const whiteImage = new Image();
        whiteImage.src = '../assets/white_stone.png';
        this.images.set('whiteStone', whiteImage);
        
        const boardImage = new Image();
        boardImage.src = '../assets/kaya.jpg';
        this.images.set('boardBackground', boardImage);
    }

    // Get element by key
    get(key) {
        const element = this.elements.get(key);
        if (!element) {
            console.warn(`DOM element '${key}' not found`);
        }
        return element;
    }

    // Get image by key
    getImage(key) {
        const image = this.images.get(key);
        if (!image) {
            console.warn(`Image '${key}' not found`);
        }
        return image;
    }

    // Check if element exists
    has(key) {
        return this.elements.has(key);
    }

    // Add new element reference
    add(key, selector) {
        const element = typeof selector === 'string' 
            ? document.querySelector(selector) 
            : selector;
        if (element) {
            this.elements.set(key, element);
        } else {
            console.warn(`Failed to add element '${key}' with selector '${selector}'`);
        }
        return element;
    }

    // Remove element reference
    remove(key) {
        return this.elements.delete(key);
    }

    // Get all elements
    getAll() {
        return Object.fromEntries(this.elements);
    }

    // Validate all required elements exist
    validate() {
        const requiredElements = [
            'blackName', 'whiteName', 'blackClock', 'whiteClock',
            'winratePie', 'winrateOver', 'winrateText',
            'blackPoints', 'whitePoints', 'goBoard', 'counting'
        ];

        const missingElements = requiredElements.filter(key => !this.get(key));
        
        if (missingElements.length > 0) {
            console.error('Missing required DOM elements:', missingElements);
            return false;
        }
        
        console.log('All required DOM elements found');
        return true;
    }
}

// Create and export singleton instance
export const DOM = new DOMElements();

// Export individual element getters for backward compatibility
export const BLACK_NAME = DOM.get('blackName');
export const WHITE_NAME = DOM.get('whiteName');
export const BLACK_CLOCK = DOM.get('blackClock');
export const WHITE_CLOCK = DOM.get('whiteClock');
export const WINRATE_PIE = DOM.get('winratePie');
export const WINRATE_OVER = DOM.get('winrateOver');
export const WINRATE_TEXT = DOM.get('winrateText');
export const CONFIDENCE_BLACK_TEXT = DOM.get('blackPoints');
export const CONFIDENCE_WHITE_TEXT = DOM.get('whitePoints');

// Export images
export const BLACK_IMAGE = DOM.getImage('blackStone');
export const WHITE_IMAGE = DOM.getImage('whiteStone');
export const BOARD_IMAGE = DOM.getImage('boardBackground'); 