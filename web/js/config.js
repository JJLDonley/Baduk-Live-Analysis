// Configuration constants for the Baduk Analysis client
export const CONFIG = {
    // Board configuration
    BOARD: {
        SIZE: 19,
        OFFSET: 50,
        GRID_SIZE: 600,
        VIEW_BOX_SIZE: 700, // GRID_SIZE + 2 * OFFSET
        get CELL_SIZE() { return this.GRID_SIZE / (this.SIZE - 1); }
    },
    
    // Score bar configuration
    SCORE_BAR: {
        WIDTH: 524,
        HEIGHT: 38,
        TOTAL_BOXES: 10,
        MAX_SCORE: 368
    },
    
    // Star points on Go board
    STAR_POINTS: [
        { x: 3, y: 3 },
        { x: 9, y: 3 },
        { x: 15, y: 3 },
        { x: 3, y: 9 },
        { x: 9, y: 9 },
        { x: 15, y: 9 },
        { x: 3, y: 15 },
        { x: 9, y: 15 },
        { x: 15, y: 15 }
    ],
    
    // Image sources
    IMAGES: {
        BLACK_STONE: '../assets/black_stone.png',
        WHITE_STONE: '../assets/white_stone.png',
        BOARD_BACKGROUND: '../assets/kaya.jpg',
        // Fallback to external sources
        BLACK_STONE_FALLBACK: 'https://ai-sensei.com/img/black_small.png',
        WHITE_STONE_FALLBACK: 'https://ai-sensei.com/img/white_small.png',
        BOARD_BACKGROUND_FALLBACK: 'https://ai-sensei.com/img/kaya14d.jpg'
    },
    
    // SVG namespace
    SVG_NS: "http://www.w3.org/2000/svg",
    
    // Move value color thresholds
    MOVE_VALUE_COLORS: {
        THRESHOLDS: [1, 3, 6, 12, 24],
        COLORS: ["green", "yellowgreen", "rgb(255,206,0)", "orange", "red", "purple"]
    },
    
    // Element IDs
    ELEMENT_IDS: {
        CURRENT_MOVE_MARKER: 'current-move-marker',
        STONES_GROUP: 'stonesGroup',
        BOARD: 'board',
        BLACK_POINTS_BACK: 'black-points-back',
        WHITE_POINTS_BACK: 'white-points-back'
    }
};

// Generate stone position ID
export const getStoneId = (x, y) => `stone-${x}-${y}`;

// Generate confidence point ID
export const getConfidencePointId = (color, index) => `${color}-points-${index}`;

// Get move value color based on value
export const getMoveValueColor = (value) => {
    const absValue = Math.abs(value);
    const { THRESHOLDS, COLORS } = CONFIG.MOVE_VALUE_COLORS;
    
    for (let i = 0; i < THRESHOLDS.length; i++) {
        if (absValue < THRESHOLDS[i]) {
            return COLORS[i];
        }
    }
    return COLORS[COLORS.length - 1];
}; 