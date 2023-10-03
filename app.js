const express = require('express');
const { Server } = require('socket.io');
const io = require('socket.io-client');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
const { spawn } = require('child_process')
const path = require('path');
const { writeFileSync, fstat } = require('fs');

const PORT = 2468;
const URL = 'https://online-go.com'; // OGS URL
const PARAMS = { "transports": ["websocket"] };


class Queue {
    constructor() {
        this.queue = [];
        this.processing = false;
    }

    async process(game, moves) {
        this.queue.push({ game, moves });
        if (!this.processing) this.processNext();
    }

    async processNext() {
        if (this.queue.length === 0) {
            this.processing = false;
            return;
        }
    
        this.processing = true;
        const { game, moves } = this.queue.shift();
        try {
            await engineAnalysis(game, moves);
        } catch (error) {
            console.error('Error processing query:', error);
        }
    
        await this.processNext(); // Use 'await' here
    }
    
}

class KataGo {
    constructor() {
        this.engine = spawn(AIEXE, [
            'analysis',
            '-config',
            AICONFIG,
            '-model',
            AIMODEL
        ]);

        this.queue = new Queue
        this.totalQueries = 1
        this.stderrThread = null;
        this.startErrorThread();
    }

    startErrorThread() {
        this.stderrThread = setInterval(() => {
            const data = this.engine.stderr.read();
            if (data) {
                console.log('KataGo: ', data.toString());
            }
        }, 100);
    }

    moveToString(move) {
        const Letters = 'ABCDEFGHJKLMNOPQRST';
        const Numbers = Array.from({ length: 19 }, (_, i) => 19 - i);

        const [x, y] = move
        const col = Letters[x] || '';
        const row = Numbers[y] || '';
        return col + row;
    }

    queryHash(moves, maxVisits) {
        console.log(moves)
        let query = {
            "id": String(this.totalQueries),
            "moves": moves.map(([color, x, y]) => [color, `${x}${y}`]),
            "rules": 'chinese',
            "komi": 7.5,
            "boardXSize": 19,
            "boardYSize": 19,
            "includePolicy": true,
            "kata_analysis": true,
            "includeOwnership": true,
        }
        console.log(query["moves"])

        if (maxVisits !== null) { query.maxVisits = maxVisits; }

        this.totalQueries++

        return query
    }

    async query(game, maxVisits = null, maxRetries = 3) {
        const listOfMoves = game.moves
        const gameQueryID = GAMES[game.id].name + ': ' + GAMES[game.id].totalQueries;
        const query = this.queryHash(listOfMoves, maxVisits)

        this.engine.stdin.write(JSON.stringify(query) + '\n');

        return new Promise((resolve, reject) => {
            const tryParse = (data, retries = 0) => {
                try {
                    const buffer = data;
                    const jsonString = buffer.toString();
                    const response = JSON.parse(jsonString);
                    resolve(response);
                } catch (error) {
                    if (retries < maxRetries) {
                        console.warn('query: ', gameQueryID, `Error parsing JSON. Retrying... (${retries + 1}/${maxRetries})`);
                        console.log(data.toString())
                        tryParse(data, retries + 1); // Recursive call
                    } else {
                        console.error('query: ', gameQueryID, ' Error parsing JSON. Max retries reached.');
                        reject('failed to parse'); // Reject the promise if max retries reached
                    }
                }
            };

            this.engine.stdout.once('data', (data) => {
                tryParse(data);
            });

            this.engine.once('error', (error) => {
                reject(error);
            });
        })
            .catch((error) => {
                console.error('query: ', gameQueryID, "Error occurred while querying:");
                throw error; // Re-throw the error to propagate it to the caller
            });
    };


    close() {
        this.engine.stdin.end();
        clearInterval(this.stderrThread);
        console.log('Closing KataGo Engine')
    }
}

const APP = express();
const HTTP_SERVER = http.createServer(APP);
const BES = new Server(HTTP_SERVER); // Using Server constructor backend server
const OGS = io(URL, PARAMS); // OGS connection using 'io' 
const GAMES = {};
const AIEXE = "./katago/katago.exe"
const AICONFIG = "./katago/default_config.cfg"
const AIMODEL = "./katago/default_model.bin.gz"
const AI = new KataGo()

const stringMovesToCoordinates = (moveString) => {
    const letters = 'abcdefghjklmnopqrst'

    if (typeof moveString !== 'string') {
        console.error('Expected a string for moveString but received:', moveString);
        return [];
    }

    const coordinates = 'abcdefghijklmnopqrs';
    const pairs = moveString.match(/.{1,2}/g); // split into pairs

    if (!pairs) {
        return [];
    }

    const moves = pairs.map((pair, i) => {
        const x_num = coordinates.indexOf(pair[0]);
        const y = 19 - coordinates.indexOf(pair[1]); // subtract from 19 for correct row
        const x = letters[x_num]
        const player = i % 2 === 0 ? 'b' : 'w'; // assume 'b' goes first
        return [player, x, y];
    });

    return moves;
};

// format moves

function formatGameMoveData(submission, moves, moveNumber = 0) {
    const letters = 'abcdefghjklmnopqrst'
    switch (submission) {
        case 'initial': {
            const formatedMoves = [];
            moves.forEach((move, index) => {
                const color = index % 2 === 0 ? 'b' : 'w';
                const x = letters[move[0]]
                const y = 19 - move[1]
                formatedMoves.push([color, x, y]);
            });
            return formatedMoves;
        }

        case 'move': {
            const color = moveNumber % 2 == 0 ? 'b' : 'w'
            const x = letters[moves[0]]
            const y = 19 - moves[1]
            const formatedMoves = [color, x, y]
            return formatedMoves
        }
    }
}

function formatReviewMoveData(submission, moves) {
    switch (submission) {
        case 'initial': {
            const formatedMoves = stringMovesToCoordinates(moves)
            return formatedMoves
        }
        case 'move': {
            const formatedMoves = stringMovesToCoordinates(moves)
            return formatedMoves
        }
    }
}

// formate game data

function formatGameStateData(type, data) {
    switch (type) {
        case 'game': {
            const id = data.game_id;
            const name = data.game_name
            const moves = data.moves;
            const BP = data.players.black.username;
            const BR = parseInt(data.players.black.rank);
            const WP = data.players.white.username;
            const WR = parseInt(data.players.white.rank);
            const formatedMoves = formatGameMoveData('initial', moves)
            const isBeingViewed = true

            GAMES[id] = {
                id: id,
                name: name,
                type: type,
                uuid: uuidv4(),
                black: {
                    name: BP,
                    rank: BR
                },
                white: {
                    name: WP,
                    rank: WR
                },
                moves: formatedMoves,
                totalQueries: 0,
                evaluation: {}
            };

            return formatedMoves
        }
        case 'review': {
            const filteredData = data.filter(entry => !entry.chat);
            const id = filteredData[0].id;
            const name = filteredData[0].gamedata.game_name
            const moves = filteredData[filteredData.length - 1].m;
            const BP = filteredData[0].gamedata.players.black.name;
            const BR = parseInt(filteredData[0].gamedata.players.black.rank);
            const WP = filteredData[0].gamedata.players.white.name;
            const WR = parseInt(filteredData[0].gamedata.players.white.rank);
            const formatedMoves = formatReviewMoveData('initial', moves)

            GAMES[id] = {
                id: id,
                name: name,
                type: type,
                uuid: uuidv4(),
                black: {
                    name: BP,
                    rank: BR
                },
                white: {
                    name: WP,
                    rank: WR
                },
                moves: formatedMoves,
                totalQueries: 0,
                evaluation: {}
            };
            return formatedMoves
        }
    }
}

// OGS listeners

function setupOGSListeners(type, id) {
    if (GAMES[id] && GAMES[id].listenersSet) return;

    if (type === 'game') {

        OGS.on("game/" + id + "/move", (data) => {
            if (!data.move) { return }
            const moves = formatGameMoveData('move', data.move, data.move_number)
            GAMES[id].moves.push(moves)
            GAMES[id].totalQueries++;

            AI.queue.process(GAMES[id], moves)
        });

    } else if (type === 'review') {

        OGS.on("review/" + id + "/r", (data) => {
            if (!data.m) { return }
            const moves = formatReviewMoveData('move', data.m)
            GAMES[id].moves = moves
            GAMES[id].totalQueries++;

            AI.queue.process(GAMES[id], moves)
        });
    }

    if (!GAMES[id]) GAMES[id] = {};
    GAMES[id].listenersSet = true;
}
// OGS game connection
function connectLiveGame(type, id) {
    // Emit the required signals for connection
    switch (type) {
        case 'game':
            OGS.emit('game/connect', {
                'game_id': id,
                'chat': false
            });

            OGS.on('game/' + id + '/gamedata', data => {
                const moves = formatGameStateData(type, data);
                if (moves == undefined) {
                    console.log(`Game: ${GAMES[id].id} doesn't have moves yet`);
                    return;
                }
                GAMES[id].totalQueries++;
                AI.queue.process(GAMES[id], moves);
                setupOGSListeners(type, id);
            });
            break;
        case 'review':
            OGS.emit('review/connect', {
                'review_id': id,
                'chat': false
            });

            OGS.on('review/' + id + '/full_state', data => {
                const moves = formatGameStateData(type, data)
                if (moves == undefined) {
                    console.log(`Game: ${GAMES[id].id} doesn't have moves yet`)
                    return
                }
                GAMES[id].totalQueries++;
    
                AI.queue.process(GAMES[id], moves)
                setupOGSListeners(type, id);
            });
            break;
        default:
            return;
    }
}

// Express route
APP.get('/:type/:id', (req, res) => {
    let type = req.params.type;
    const id = req.params.id;
    // Validate the type
    if (!['game', 'demo', 'review'].includes(type)) {
        return res.status(400).send('Error: Not a proper type.');
    }

    // If type is 'demo', change it to 'review'
    if (type === 'demo') type = 'review';

    connectLiveGame(type, id);

    res.sendFile(path.join(__dirname, 'game.html'));
});

APP.get('/', (req, res) => {

})

BES.on('connection', (socket) => {
    console.log('Frontend client connected');

    socket.on('subscribe', (gameId) => {
        // Send game data if available in GAMES hashmap
        if (GAMES[gameId]) {
            socket.emit(`${GAMES[gameId].type}/${GAMES[gameId].id}`, GAMES[gameId]);
        }
    });

    socket.on('disconnect', () => {
        console.log('Frontend client disconnected');
    });
});

// OGS socket connection

OGS.on('connect', () => {
    const client_name = uuidv4()
    console.log('client:', client_name)
    console.log('OGS connected');
    OGS.emit('hostinfo');
    OGS.emit('authenticate', { device_id: client_name })
});

OGS.on('hostinfo', (hostinfo) => {
    console.log('Termination server', hostinfo);
    
    if (GAMES && Object.keys(GAMES).length > 0) {
        console.log('Detected games in the GAMES object. Reconnecting...');

        // Iterate over the games and reinitialize or reconnect them
        for (let gameId in GAMES) {
            let gameType = GAMES[gameId].type;
            connectLiveGame(gameType, gameId);
        }
    }
});

OGS.on('authenticate', (auth) => {
    console.log(auth)
});

OGS.on('disconnect', () => {
    console.log('Disconnected from OGS. Attempting to reconnect...');
});

OGS.on('error', (error) => {
    console.error('Socket connection error:', error);
});

// Start the server
HTTP_SERVER.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

const engineAnalysis = async (game) => {
    let modifiedGame = game

    try {
        const result = await AI.query(modifiedGame);
        const evaluation = analyzeAIQuery(result);

        modifiedGame = createGameAnalysisStatistics(game, evaluation);
        updateGameAndEmit(modifiedGame);
        return modifiedGame

    } catch (err) {
        console.error('Error during engine analysis:', err);
    }

    return true
};

const analyzeAIQuery = (queryResult) => {
    let queryMap; // Declare outside of try block

    try {
        queryMap = {
            currentPlayer: queryResult["rootInfo"]["currentPlayer"],
            root: {
                scoreLead: queryResult["rootInfo"]["scoreLead"],
                winrate: queryResult["rootInfo"]["winrate"],
            },
            sent: queryResult["sent"],
            moves: mapSuggestedAIMoves(queryResult["moveInfos"]),
            ownerShipMap: setToGrid(queryResult["ownership"])
        };
        return queryMap;
    } catch(err) {
        console.log(err);
    }
 // Now it's available here
};


function setToGrid(ownership) {
    const size = 19;
    const board = [];
    for (let i = 0; i < size; i++) {
        const row = [];
        for (let j = 0; j < size; j++) {
            const index = i * size + j; // Calculate the index based on i and j
            const currentValue = ownership[index];
            const isVisited = (currentValue >= -0.4 && currentValue <= 0.4);
      
            row.push({ value: currentValue, visited: isVisited });
        }
        board.push(row);
    }

    return board;
}

const mapSuggestedAIMoves = (suggestedMoves) => {
    return suggestedMoves
        .sort((a, b) => b["order"] - a["order"])  // Sort by descending order of lcb
        .map(move => [
            move["move"],
            move["order"],
            move["prior"],
            move["pv"]
        ]);
};

function logGameStatistics(game) {
    const evaluation = game.evaluation;
    const { black, white } = game;
    const { territory, percent } = evaluation;
    const currentMoveNumber = game.moves.length

    const logMessage = [
        `Game UUID: ${game.uuid}`,
        `Game ID: ${game.id}`,
        `Query Count: ${game.totalQueries}`,
        ' ',
        `Current Player: ${evaluation.currentPlayer}`,
        `Player Names:`,
        `  Black: ${black.name}`,
        `  White: ${white.name}`,
        ' ',
        `Move: ${currentMoveNumber}`,
        `Blue Move: ${evaluation.blueMove}`,
        `Winrate: ${evaluation.percentage}`,
        `Black Winrate: ${percent.black}`,
        `White Winrate: ${percent.white}`,
        `Last Move Value: ${evaluation.lastMoveValue}`,
        ' ',
        `Score: ${evaluation.score}`,
        `Territory:`,
        `  Black: ${territory.black}`,
        `  White: ${territory.white}`,
        `Score Difference: ${evaluation.scoreDifference}`,
        ' '
    ].join('\n'); // Join each line with a newline character

    console.log(logMessage);
}

const createGameAnalysisStatistics = (game, evaluation) => {
    const {
        currentPlayer,
        root: { scoreLead, winrate: percentage },
        moves: suggestedMoves,
        ownerShipMap,
    } = evaluation;

    const lastMoveValue = calculateLastMoveValue(game, percentage);
    const territory = convertOwnershipMapToTerritory(currentPlayer, ownerShipMap);
    const scoreDifference = calculateScoreDifference(territory);
    const leadingPlayer = determineLeadingPlayer(scoreLead, currentPlayer);
    const { blackPercentage, whitePercentage } = calculatePlayerPercentages(percentage, currentPlayer);
    const topAIMove = suggestedMoves[0][0];

    const modifiedGame = {
        ...game,
        evaluation: {
            moves: suggestedMoves,
            blueMove: topAIMove,
            currentPlayer,
            scoreLead,
            percentage: percentage.toFixed(2),
            percent: {
                black: `${blackPercentage.toFixed(2)} %`,
                white: `${whitePercentage.toFixed(2)} %`
            },
            humanwinrate: `not available yet`,
            score: `${leadingPlayer} + ${Math.abs(scoreLead.toFixed(2))}`,
            scoreDifference,
            territory: {
                help: 'these are just estimates',
                ...territory
            },
            lastMoveValue: `${lastMoveValue.toFixed(2)} %`,
        }
    };

    logGameStatistics(modifiedGame);

    return modifiedGame;
};

const calculateLastMoveValue = (game, percentage) => {
    return game.evaluation?.percentage !== undefined
        ? game.evaluation.percentage - percentage
        : 0;
}

const calculateScoreDifference = (territory) => {
    const score = territory.black - territory.white;
    return score > 0 ? `B + ${Math.abs(score)}` : `W + ${Math.abs(score)}`;
}

const determineLeadingPlayer = (scoreLead, currentPlayer) => {
    return Math.sign(scoreLead) > 0
        ? currentPlayer
        : (currentPlayer === 'W' ? 'B' : 'W');
}

const calculatePlayerPercentages = (percentage, currentPlayer) => {
    const blackPercentage = currentPlayer === 'B' ? percentage * 100 : 100 - percentage * 100;
    return {
        blackPercentage,
        whitePercentage: 100 - blackPercentage
    };
}

function updateGameAndEmit(game) {
    //await writeGamesToFile(game);

    const gameEmitID = `${game.type}/${game.id}`

    const payload = {
        type: gameEmitID,
        data: game,
    };
    
    GAMES[game.id].evaluation = game.evaluation

    BES.emit(gameEmitID, JSON.stringify(payload));
}

function convertOwnershipMapToTerritory(currentPlayer, ownershipGrid) {
    // This uses the floodFill and estimateScoreFromOwnership functions.
    
    const { whiteScore, blackScore } = estimateScoreFromOwnership(ownershipGrid, currentPlayer);
    
    // Adjust the scores to get the territory
    let whiteEstimatedPoints = Math.floor(whiteScore);
    let blackEstimatedPoints = Math.floor(blackScore);
    
    return { black: blackEstimatedPoints, white: whiteEstimatedPoints };
}

function floodFill(grid, startX, startY) {
    const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    const size = grid.length;
    const startCell = grid[startY][startX];

    if (startCell.visited || Math.abs(startCell.value) < 0.4) return [];

    const targetSign = Math.sign(startCell.value);
    let points = [{ x: startX, y: startY }];
    let group = [];

    while (points.length) {
        const current = points.pop();
        const { x, y } = current;

        if (x < 0 || x >= size || y < 0 || y >= size) continue;
        if (grid[y][x].visited || Math.sign(grid[y][x].value) !== targetSign) continue;

        grid[y][x].visited = true;
        group.push({ x, y });

        for (let dir of directions) {
            points.push({ x: x + dir[0], y: y + dir[1] });
        }
    }

    // return group.length >= 3 ? group : [];  potentially limiting one off stones that cannot survive even if the enginge thinks it can.
    return group
}

function estimateScoreFromOwnership(grid, currentPlayer) {
    let whiteScore = 0;
    let blackScore = 0;
    let allLogs = []; // Initialize an array to collect all logs

    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            if (Math.abs(grid[y][x].value) >= 0.6) {
                const group = floodFill(grid, x, y, currentPlayer);

                // if (group.length) {
                //     const groupPlayer = Math.sign(grid[y][x].value) > 0 ? currentPlayer : (currentPlayer === 'W' ? 'B' : 'W');
                //     const logs = logOwnershipDetails(x, y, group, grid, groupPlayer);
                //     allLogs = allLogs.concat(logs); // Add the logs to the accumulated logs array
                // }

                const score = group.reduce((acc, point) => acc + grid[point.y][point.x].value, 0);

                if (currentPlayer === 'W') {
                    if (grid[y][x].value > 0) whiteScore += Math.abs(score);
                    else blackScore += Math.abs(score);
                } else {
                    if (grid[y][x].value < 0) whiteScore += Math.abs(score);
                    else blackScore += Math.abs(score);
                }
            }
        }
    }

    // saveLogsToFile(allLogs); // Save the accumulated logs to file
    return { whiteScore, blackScore };
}

// const fs = require('fs');

// function saveLogsToFile(logs) {
//     fs.writeFileSync('flood_fill_logs.json', JSON.stringify(logs, null, 2), 'utf8');
// }

// function logOwnershipDetails(startX, startY, group, grid, currentPlayer) {
//     const allCoords = group.map(point => `(${point.x}, ${point.y})`);
//     const allValues = group.map(point => grid[point.y][point.x].value);

//     const chunkedCoords = chunkArray(allCoords, 10);
//     const chunkedValues = chunkArray(allValues, 10);

//     return {
//         player: currentPlayer,
//         start: { x: startX, y: startY },
//         coords: chunkedCoords,
//         values: chunkedValues
//     };
// }

// function chunkArray(array, chunkSize) {
//     const results = [];
//     while (array.length) {
//         results.push(array.splice(0, chunkSize));
//     }
//     return results;
// }


