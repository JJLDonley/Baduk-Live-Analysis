import { PatternMatchingService, ogsStringToVertex } from './pattern.ts';

async function testSpecificMoves() {
    console.log('Testing specific moves from your sequence...');
    
    const patternMatcher = new PatternMatchingService();
    
    // Your actual move sequence
    const moves: [string, string][] = [
        ['black', 'r16'],
        ['white', 'd4'],
        ['black', 'd17'],
        ['white', 'q4'],
        ['black', 'd15'],
        ['white', 'd14'],
        ['black', 'e14'],
        ['white', 'c15'],
        ['black', 'e15'],
        ['white', 'c16'],
        ['black', 'd13'],
        ['white', 'd16']
    ];
    
    console.log('Testing each move for pattern recognition:');
    
    for (let i = 0; i < moves.length; i++) {
        const [color, move] = moves[i];
        const vertex = ogsStringToVertex(move);
        const sign = color === 'black' ? 1 : -1;
        
        // Build board up to this move
        const boardBeforeMove = Array.from({ length: 19 }, () => Array(19).fill(0));
        for (let j = 0; j < i; j++) {
            const [prevColor, prevMove] = moves[j];
            const prevVertex = ogsStringToVertex(prevMove);
            const prevSign = prevColor === 'black' ? 1 : -1;
            boardBeforeMove[prevVertex[1]][prevVertex[0]] = prevSign;
        }
        
        const patternRequest = {
            id: `test-move-${i}`,
            boardData: boardBeforeMove,
            sign: sign,
            vertex: vertex,
            boardSize: 19
        };
        
        const result = patternMatcher.nameMove(patternRequest);
        const moveName = result.moveName || 'No pattern found';
        
        console.log(`Move ${i + 1}: ${move} (${color}) -> ${moveName}`);
        
        if (result.pattern) {
            console.log(`  Pattern: ${result.pattern.name}`);
            console.log(`  URL: ${result.pattern.url}`);
        }
    }
    
    console.log('Test completed!');
}

testSpecificMoves().catch(console.error); 