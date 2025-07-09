// Use dynamic import for CommonJS compatibility
const boardmatcherModule = await import('npm:@sabaki/boardmatcher');
const BoardMatcher = boardmatcherModule.default || boardmatcherModule;

// Access library data - the library contains pattern data for move naming
const libraryModule = await import('@sabaki/boardmatcher/library');
const library = libraryModule.default || libraryModule;

// --- OGS Move Conversion Utilities ---

/**
 * Convert OGS/KataGo move string (e.g. 'r16', 'd4') to [x, y] vertex (0-indexed, top-left is [0,0])
 * X: A-H = 0-7, J-T = 8-18 (skip I)
 * Y: 1-19, but top is 0, so y = 19 - parseInt(yStr)
 */
export function ogsStringToVertex(ogsMove: string): [number, number] {
    if (ogsMove.length < 2 || ogsMove.length > 3) {
        throw new Error(`Invalid OGS move format: ${ogsMove}`);
    }
    const xChar = ogsMove.charAt(0).toLowerCase();
    const yStr = ogsMove.slice(1);
    // X: A-H = 0-7, J-T = 8-18 (skip I)
    let x;
    if (xChar >= 'a' && xChar <= 'h') {
        x = xChar.charCodeAt(0) - 'a'.charCodeAt(0);
    } else if (xChar >= 'j' && xChar <= 't') {
        x = xChar.charCodeAt(0) - 'a'.charCodeAt(0) - 1;
    } else {
        throw new Error(`Invalid x-coordinate: ${xChar}`);
    }
    // Y: 1-19, top is 0
    const y = 19 - parseInt(yStr);
    if (isNaN(y) || y < 0 || y >= 19) {
        throw new Error(`Invalid y-coordinate: ${yStr}`);
    }
    return [x, y];
}

/**
 * Convert a long OGS review move string (e.g. 'qddpdcppd...') to a move list [[x, y], ...]
 * Each move is two characters.
 */
export function ogsMoveListFromString(moveString: string): [number, number][] {
    const moves: [number, number][] = [];
    for (let i = 0; i < moveString.length; i += 2) {
        moves.push(ogsStringToVertex(moveString.slice(i, i + 2)));
    }
    return moves;
}

/**
 * For game-type 'game', OGS moves are already [x, y] arrays (0-indexed)
 * For game-type 'review', use ogsStringToVertex or ogsMoveListFromString
 */

// --- Pattern Matching Service and Types ---
// Interface for pattern matching request
export interface PatternMatchRequest {
    id: string;
    boardData: number[][]; // Board arrangement: -1=white, 1=black, 0=empty
    sign: number; // -1 for white, 1 for black
    vertex: [number, number]; // [x, y] coordinates of the move
    boardSize?: number; // Optional board size for size-specific patterns
}

// Interface for pattern matching response
export interface PatternMatchResponse {
    id: string;
    moveName?: string | null; // Named move or null if no pattern found
    pattern?: {
        name?: string | null;
        url?: string | null;
        size?: number | null;
        type?: 'corner' | null;
        anchors?: [number, number, number][]; // [[x, y], sign][]
        vertices: [number, number, number][]; // [[x, y], sign][]
    } | null;
    match?: {
        symmetryIndex: number;
        invert: boolean;
        anchors: [number, number][];
        vertices: [number, number][];
    } | null;
    timestamp: number;
}

/**
 * Pattern Matching Service
 * Provides move naming and pattern recognition using @sabaki/boardmatcher
 */
export class PatternMatchingService {
    private boardmatcher: any;
    private library: any;

    constructor() {
        this.boardmatcher = BoardMatcher;
        this.library = library;
    }

    /**
     * Name a move based on board position and move coordinates
     */
    public nameMove(request: PatternMatchRequest): PatternMatchResponse {
        try {
            const { boardData, sign, vertex, boardSize } = request;
            
            // Validate input
            if (!this.validateBoardData(boardData)) {
                throw new Error('Invalid board data format');
            }
            
            if (!this.validateVertex(vertex, boardData)) {
                throw new Error('Invalid vertex coordinates');
            }
            
            if (sign !== -1 && sign !== 1) {
                throw new Error('Invalid sign: must be -1 (white) or 1 (black)');
            }

            // Create options object for boardmatcher
            const options: any = {};
            if (boardSize) {
                options.library = this.library.filter((pattern: any) => 
                    !pattern.size || pattern.size === boardSize
                );
            } else {
                options.library = this.library;
            }

            // Get move name
            const moveName = this.boardmatcher.nameMove(boardData, sign, vertex, options);
            
            // Get pattern details if move was named
            let pattern = null;
            let match = null;
            
            if (moveName) {
                const patternResult = this.boardmatcher.findPatternInMove(boardData, sign, vertex, options);
                if (patternResult) {
                    pattern = patternResult.pattern;
                    match = patternResult.match;
                }
            }

            return {
                id: request.id,
                moveName: moveName,
                pattern: pattern,
                match: match,
                timestamp: Date.now()
            };

        } catch (error) {
            console.error(`[PatternMatching] Error naming move:`, error);
            return {
                id: request.id,
                moveName: null,
                pattern: null,
                match: null,
                timestamp: Date.now()
            };
        }
    }

    /**
     * Find all patterns in a board position
     */
    public findPatterns(boardData: number[][], boardSize?: number): any[] {
        try {
            if (!this.validateBoardData(boardData)) {
                throw new Error('Invalid board data format');
            }

            const options: any = {};
            if (boardSize) {
                options.library = this.library.filter((pattern: any) => 
                    !pattern.size || pattern.size === boardSize
                );
            } else {
                options.library = this.library;
            }

            const patterns: any[] = [];
            
            // Iterate through library patterns to find matches
            for (const pattern of options.library) {
                if (pattern.type === 'corner') {
                    // Use matchCorner for corner patterns
                    for (const match of this.boardmatcher.matchCorner(boardData, pattern)) {
                        patterns.push({
                            pattern: pattern,
                            match: match
                        });
                    }
                } else {
                    // Use matchShape for other patterns
                    for (const anchor of pattern.anchors || []) {
                        const [anchorX, anchorY] = anchor[0];
                        for (const match of this.boardmatcher.matchShape(boardData, [anchorX, anchorY], pattern)) {
                            patterns.push({
                                pattern: pattern,
                                match: match
                            });
                        }
                    }
                }
            }

            return patterns;

        } catch (error) {
            console.error(`[PatternMatching] Error finding patterns:`, error);
            return [];
        }
    }

    /**
     * Validate board data format
     */
    private validateBoardData(boardData: number[][]): boolean {
        if (!Array.isArray(boardData) || boardData.length === 0) {
            return false;
        }
        
        const rowLength = boardData[0].length;
        if (rowLength === 0) {
            return false;
        }
        
        for (const row of boardData) {
            if (!Array.isArray(row) || row.length !== rowLength) {
                return false;
            }
            
            for (const cell of row) {
                if (cell !== -1 && cell !== 0 && cell !== 1) {
                    return false;
                }
            }
        }
        
        return true;
    }

    /**
     * Validate vertex coordinates
     */
    private validateVertex(vertex: [number, number], boardData: number[][]): boolean {
        const [x, y] = vertex;
        return x >= 0 && y >= 0 && y < boardData.length && x < boardData[0].length;
    }

    /**
     * Convert OGS move format to board coordinates
     * OGS uses letters (a-t) for x-axis and numbers (1-19) for y-axis
     */
    public ogsMoveToVertex(ogsMove: string): [number, number] {
        const x = ogsMove.charCodeAt(0) - 'a'.charCodeAt(0);
        const y = parseInt(ogsMove.slice(1)) - 1;
        return [x, y];
    }

    /**
     * Convert board coordinates to OGS move format
     */
    public vertexToOgsMove(vertex: [number, number]): string {
        const [x, y] = vertex;
        const xChar = String.fromCharCode('a'.charCodeAt(0) + x);
        const yNum = y + 1;
        return `${xChar}${yNum}`;
    }
}