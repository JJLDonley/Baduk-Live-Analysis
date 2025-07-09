// Test pattern matching integration with the server
import { PatternMatchingService, ogsStringToVertex } from './pattern.ts';

async function testPatternIntegration() {
    console.log('Testing pattern matching integration...');
    
    const patternMatcher = new PatternMatchingService();
    
    // Test with a simple move sequence
    const testMoves: [string, string][] = [
        ["black", "dd"],
        ["white", "dp"],
        ["black", "dc"]
    ];
    
    // Simulate the server's buildBoardFromMoves function
    function buildBoardFromMoves(moves: [string, string][], boardXSize: number, boardYSize: number): number[][] {
        const board = Array.from({ length: boardYSize }, () => Array(boardXSize).fill(0));
        
        for (const [moveColor, move] of moves) {
            let vertex: [number, number];
            
            if (typeof move === 'string') {
                vertex = ogsStringToVertex(move);
            } else {
                vertex = move as [number, number];
            }
            
            if (vertex[0] >= 0 && vertex[0] < boardXSize && vertex[1] >= 0 && vertex[1] < boardYSize) {
                const sign = moveColor === 'black' ? 1 : -1;
                board[vertex[1]][vertex[0]] = sign;
            }
        }
        
        return board;
    }
    
    // Test pattern matching for the latest move
    const boardBeforeLastMove = buildBoardFromMoves(testMoves.slice(0, -1), 19, 19);
    const lastMove = testMoves[testMoves.length - 1];
    const [color, move] = lastMove;
    const vertex = ogsStringToVertex(move);
    const sign = color === 'black' ? 1 : -1;
    
    console.log('Board before last move:');
    console.log(boardBeforeLastMove.slice(0, 5).map(row => row.slice(0, 5)));
    
    console.log(`Last move: ${move} (${color}) at vertex [${vertex[0]}, ${vertex[1]}]`);
    
    const patternRequest = {
        id: 'test-integration',
        boardData: boardBeforeLastMove,
        sign: sign,
        vertex: vertex,
        boardSize: 19
    };
    
    const result = patternMatcher.nameMove(patternRequest);
    console.log('Pattern match result:', result);
    
    console.log('Integration test completed!');
}

testPatternIntegration().catch(console.error); 