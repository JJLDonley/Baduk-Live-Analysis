import { ogsStringToVertex } from './pattern.ts';

console.log('Debugging coordinate conversion...');

const testMoves = ['r16', 'd4', 'd17', 'q4', 'd15', 'd14', 'e14', 'c15', 'e15', 'c16', 'd13', 'd16'];

for (const move of testMoves) {
    try {
        const vertex = ogsStringToVertex(move);
        console.log(`Move: ${move} -> Vertex: [${vertex[0]}, ${vertex[1]}]`);
        
        // Check if coordinates are valid for 19x19 board
        if (vertex[0] >= 0 && vertex[0] < 19 && vertex[1] >= 0 && vertex[1] < 19) {
            console.log(`  ✅ Valid coordinates`);
        } else {
            console.log(`  ❌ Invalid coordinates for 19x19 board`);
        }
    } catch (error) {
        console.log(`Move: ${move} -> Error: ${error}`);
    }
}

console.log('\nCoordinate conversion test completed!'); 