// Test websocket pattern matching integration
// This simulates a frontend client sending analysis requests

const testAnalysisRequest = {
    id: "test-analysis-1",
    moves: [
        ["black", "dd"],
        ["white", "dp"], 
        ["black", "dc"],
        ["white", "pp"],
        ["black", "pd"]
    ],
    initialStones: [],
    rules: "japanese",
    komi: 6.5,
    boardXSize: 19,
    boardYSize: 19,
    includePolicy: false,
    includeOwnership: true,
    maxVisits: 100
};

console.log('Test Analysis Request:');
console.log(JSON.stringify(testAnalysisRequest, null, 2));

console.log('\nExpected Pattern Match Response:');
console.log('The server should send a "pattern-match" event for the latest move "pd" (Black)');

console.log('\nExpected Response Format:');
const expectedResponse = {
    type: "pattern-match",
    id: "test-analysis-1-pattern",
    moveName: "Some pattern name or null",
    pattern: {
        name: "Pattern name",
        url: "https://example.com",
        size: 19,
        type: "corner",
        anchors: [[[3, 3], 1]],
        vertices: [[[3, 3], 1]]
    },
    match: {
        symmetryIndex: 0,
        invert: false,
        anchors: [[3, 3]],
        vertices: [[3, 3]]
    },
    timestamp: Date.now()
};

console.log(JSON.stringify(expectedResponse, null, 2));

console.log('\nTo test this:');
console.log('1. Start the server: deno run --allow-all server/server.ts');
console.log('2. Connect a websocket client to ws://localhost:8081');
console.log('3. Send the test analysis request');
console.log('4. You should receive both analysis results and pattern-match events'); 