import { PatternMatchingService, ogsStringToVertex, ogsMoveListFromString } from './pattern.ts';

// Helper to build a board from a move list (alternating colors, 0=empty, 1=black, -1=white)
function buildBoardFromMoves(moves: [number, number][], size = 19): number[][] {
    const board = Array.from({ length: size }, () => Array(size).fill(0));
    let color = 1; // Black starts
    for (const [x, y] of moves) {
        board[y][x] = color;
        color = -color;
    }
    return board;
}

// Helper to build board up to a specific move index
function buildBoardUpToMove(moves: [number, number][], moveIndex: number, size = 19): number[][] {
    const board = Array.from({ length: size }, () => Array(size).fill(0));
    let color = 1; // Black starts
    for (let i = 0; i <= moveIndex; i++) {
        const [x, y] = moves[i];
        board[y][x] = color;
        color = -color;
    }
    return board;
}

async function testPatternMatching() {
    console.log('Testing pattern matching functionality...');
    const patternMatcher = new PatternMatchingService();

    // --- Test 1: OGS review move string conversion ---
    const reviewMoveString = 'qddpdcppdedfefceeecddgddedccebcfcbcgncdhegqmcqdqcpcncodobncrbrbmdncmdrercsfpfidiphjdldfcecifhcggihhdicgigjhifhigdjfjejfkcjbibjcidmdlelemenekfmdkcl';
    const reviewMoves = ogsMoveListFromString(reviewMoveString);
    console.log('First 5 review moves:', reviewMoves.slice(0, 5));

    // --- Test 2: Build board from review moves ---
    const reviewBoard = buildBoardFromMoves(reviewMoves, 19);
    console.log('Board after review moves (top left 5x5):');
    for (let y = 0; y < 5; ++y) {
        console.log(reviewBoard[y].slice(0, 5));
    }

    // --- Test 3: Pattern matching for review (string moves) ---
    // Try the last move
    const lastReviewMove = reviewMoves[reviewMoves.length - 1];
    const reviewRequest = {
        id: 'review-test',
        boardData: reviewBoard,
        sign: reviewMoves.length % 2 === 1 ? 1 : -1, // Next color
        vertex: lastReviewMove as [number, number],
        boardSize: 19
    };
    const reviewResult = patternMatcher.nameMove(reviewRequest);
    console.log('Pattern matching result for last review move:', reviewResult);

    // --- Test 4: Convert to game-type move list (already [x, y]) and test ---
    const gameMoves: [number, number][] = reviewMoves;
    const gameBoard = buildBoardFromMoves(gameMoves, 19);
    const lastGameMove = gameMoves[gameMoves.length - 1];
    const gameRequest = {
        id: 'game-test',
        boardData: gameBoard,
        sign: gameMoves.length % 2 === 1 ? 1 : -1,
        vertex: lastGameMove as [number, number],
        boardSize: 19
    };
    const gameResult = patternMatcher.nameMove(gameRequest);
    console.log('Pattern matching result for last game move:', gameResult);

    // --- Test 5: Edge case: empty board ---
    const emptyBoard = Array.from({ length: 19 }, () => Array(19).fill(0));
    const emptyRequest = {
        id: 'empty-test',
        boardData: emptyBoard,
        sign: 1,
        vertex: [3, 3] as [number, number],
        boardSize: 19
    };
    const emptyResult = patternMatcher.nameMove(emptyRequest);
    console.log('Pattern matching result for empty board:', emptyResult);

    // --- Test 6: Write move names to file for each move in sequence ---
    console.log('\n--- Writing move names to file for each move ---');
    const moveNames: string[] = [];
    
    for (let i = 0; i < reviewMoves.length; i++) {
        const move = reviewMoves[i];
        const boardBeforeMove = buildBoardUpToMove(reviewMoves, i - 1, 19);
        const color = i % 2 === 0 ? 1 : -1; // Black starts
        
        const request = {
            id: `move-${i}`,
            boardData: boardBeforeMove,
            sign: color,
            vertex: move as [number, number],
            boardSize: 19
        };
        
        const result = patternMatcher.nameMove(request);
        const moveName = result.moveName || 'No pattern found';
        const ogsMove = patternMatcher.vertexToOgsMove(move);
        
        moveNames.push(`Move ${i + 1}: ${ogsMove} (${color === 1 ? 'Black' : 'White'}) - ${moveName}`);
        
        if (i < 10 || i % 10 === 0) { // Log first 10 moves and every 10th move
            console.log(`Move ${i + 1}: ${ogsMove} - ${moveName}`);
        }
    }
    
    // Write all move names to file
    const outputText = moveNames.join('\n');
    await Deno.writeTextFile('move_names.txt', outputText);
    console.log(`\nMove names written to 'move_names.txt' (${moveNames.length} moves)`);

    console.log('Pattern matching test suite completed!');
}

testPatternMatching().catch(console.error); 