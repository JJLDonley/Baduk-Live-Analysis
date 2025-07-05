// Legacy constants file - most functionality moved to config.js and domElements.js
// This file is kept for backward compatibility

import { CONFIG } from './config.js';
import { 
    BLACK_IMAGE, 
    WHITE_IMAGE, 
    BOARD_IMAGE,
    BLACK_NAME,
    WHITE_NAME,
    BLACK_CLOCK,
    WHITE_CLOCK,
    WINRATE_PIE,
    WINRATE_OVER,
    WINRATE_TEXT,
    CONFIDENCE_BLACK_TEXT,
    CONFIDENCE_WHITE_TEXT
} from './domElements.js';

// Re-export for backward compatibility
export const CURRENT_MOVE_MARKER_ID = CONFIG.ELEMENT_IDS.CURRENT_MOVE_MARKER;

// Re-export DOM elements for backward compatibility
export {
    BLACK_IMAGE,
    WHITE_IMAGE,
    BOARD_IMAGE,
    BLACK_NAME,
    WHITE_NAME,
    BLACK_CLOCK,
    WHITE_CLOCK,
    WINRATE_PIE,
    WINRATE_OVER,
    WINRATE_TEXT,
    CONFIDENCE_BLACK_TEXT,
    CONFIDENCE_WHITE_TEXT
};

// Legacy exports that are now handled by clock.js
export const BLACK_TIME = {};
export const WHITE_TIME = {};
