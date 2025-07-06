import { setScoreBar } from "./scorebar.js";
import { startCountdown, stopClock, getClockState } from "./clock.js";
import { updateBoard, markCurrentMove, updateCurrentMoveColor } from "./board.js";
import { updateWinrate } from "./winrate.js";
import { updatePlayerInfomation } from "./players.js";
import { WINRATE_OVER } from "./domElements.js";
import { domManager } from "./domManager.js";
import { AnalysisManager } from "./analysisManager.js";

export const APP = {};

// Make APP globally accessible for debugging
window.APP = APP;

// Application state
APP.previous = {};
APP.current = { black: 50, white: 50 };
APP.lastMoveValue = 0;
APP.socket = null;
APP.isConnected = false;
APP.analysisManager = new AnalysisManager();
APP.gameInfo = null;
APP.reviewData = null;

// Event names
APP.events = {
    event: '',
    clock: '',
    board: '',
    finished: ''
};

// Initialize the application
APP.start = function() {
    console.log('Starting Baduk Analysis Client...');
    
    // Wait for DOM to be ready
    if (!domManager.isReady()) {
        console.log('Waiting for DOM to be ready...');
        setTimeout(() => APP.start(), 100);
        return;
    }

    // Initialize with default score bar
    setScoreBar(
        [10, 10, 10, 10, 10, 10, 10, 10, 10, 10], 
        [10, 10, 10, 10, 10, 10, 10, 10, 10, 10]
    );
    
    // Setup socket connection
    APP.setupSocket();
    
    // Setup event listeners
    APP.setupEventListeners();
    
    // Add debugging capabilities
    APP.setupDebugging();
    
    console.log('Application started successfully');
};

// Setup Socket.IO connection
APP.setupSocket = function() {
    const hostname = window.location.hostname;
    const port = window.location.port;
    APP.socket = io(`${hostname}:${port}`);
    
    // Parse URL path to get type and id
    const path = window.location.pathname;
    const pathSegments = path.split("/").filter(segment => segment);
    const type = pathSegments[0];
    const id = pathSegments[1];

    // Convert demo to review to match backend logic
    const adjustedType = type === "demo" ? "review" : type;

    // Set event names using adjusted type
    APP.events.event = `${adjustedType}/${id}`;
    APP.events.clock = `clock/${id}`;
    APP.events.board = `board/${id}`;
    APP.events.gameinfo = `gameinfo/${id}`;
    APP.events.reviewdata = `reviewdata/${id}`;
    APP.events.finished = `${adjustedType}/${id}/finished`;

    // Connection events
    APP.socket.on("connect", () => {
        console.log("Connected to server");
        APP.isConnected = true;
        APP.socket.emit("subscribe", { type: type, id: id });
    });

    APP.socket.on("error", (err) => {
        console.error("Socket error:", err);
        APP.isConnected = false;
    });

    APP.socket.on("disconnect", () => {
        console.log("Disconnected from server");
        APP.isConnected = false;
        // Stop clock on disconnect to prevent drift
        stopClock();
    });
};

// Setup event listeners for game events
APP.setupEventListeners = function() {
    // Handle AI evaluations with AnalysisManager
    APP.socket.on(APP.events.event, (data) => {
        try {
            const parsedPayload = JSON.parse(data);
            
            // Check if this is initial game data without analysis metadata (during initial connection)
            if (!parsedPayload.analysisId && parsedPayload.data) {
                APP.handleAIEvaluation(parsedPayload.data);
                return;
            }
            
            // Validate the parsed payload for regular analysis
            if (!parsedPayload.analysisId || parsedPayload.moveNumber === undefined) {
                console.error("Invalid analysis payload received:", parsedPayload);
                return;
            }
            
            // Create analysis data structure for AnalysisManager
            const analysisData = {
                analysisId: parsedPayload.analysisId,
                gameType: parsedPayload.gameType,
                gameId: parsedPayload.gameId,
                moveNumber: parsedPayload.moveNumber,
                timestamp: parsedPayload.timestamp,
                data: parsedPayload.data
            };
            
            // Use AnalysisManager to handle the analysis
            APP.analysisManager.addAnalysis(analysisData);
        } catch (error) {
            console.error("Error parsing AI evaluation data:", error);
        }
    });

    // Handle clock updates
    APP.socket.on(APP.events.clock, (data) => {
        try {
            const jsonData = JSON.parse(data);
            const receiveTime = Date.now();
            console.log(`Clock update received at ${new Date(receiveTime).toISOString()}`);
            APP.handleClockUpdate(jsonData.data, receiveTime);
        } catch (error) {
            console.error("Error parsing clock data:", error);
        }
    });

    // Handle board updates
    APP.socket.on(APP.events.board, (data) => {
        try {
            const parsedData = JSON.parse(data);
            APP.handleBoardUpdate(parsedData);
        } catch (error) {
            console.error("Error parsing board data:", error);
        }
    });

    // Handle game finished
    APP.socket.on(APP.events.finished, (data) => {
        console.log("Game finished:", data);
        APP.handleGameFinished(data);
    });

    // Handle initial game info
    APP.socket.on(APP.events.gameinfo, (data) => {
        try {
            const parsedData = JSON.parse(data);
            console.log("Received game info:", parsedData);
            APP.handleGameInfo(parsedData.data);
        } catch (error) {
            console.error("Error parsing game info data:", error);
        }
    });

    // Handle review data
    APP.socket.on(APP.events.reviewdata, (data) => {
        try {
            const parsedData = JSON.parse(data);
            console.log("Received review data:", parsedData);
            APP.handleReviewData(parsedData.data);
        } catch (error) {
            console.error("Error parsing review data:", error);
        }
    });
};

// Setup debugging capabilities
APP.setupDebugging = function() {
    // Add global debugging functions
    window.debugClock = function() {
        const state = getClockState();
        console.log("Clock Debug Info:", state);
        return state;
    };
    
    window.debugApp = function() {
        console.log("App Debug Info:", {
            isConnected: APP.isConnected,
            socketConnected: APP.socket ? APP.socket.connected : false,
            events: APP.events,
            current: APP.current,
            previous: APP.previous,
            lastMoveValue: APP.lastMoveValue,
            gameInfo: APP.gameInfo,
            reviewData: APP.reviewData
        });
    };
    
    window.debugAnalysis = function() {
        const state = APP.analysisManager.getState();
        console.log("Analysis Manager Debug Info:", state);
        return state;
    };
    
    window.resetAnalysis = function() {
        APP.analysisManager.reset();
        console.log("Analysis manager reset");
    };
    
    console.log("Debug functions available: debugClock(), debugApp(), debugAnalysis(), resetAnalysis()");
};

// Handle AI evaluation data
APP.handleAIEvaluation = function(data) {
    // Update previous and current winrates
    APP.setPreviousAndCurrent(data.current.player, data.winrate.human);
    
    // Update player information
    updatePlayerInfomation(data.players.black.name, data.players.white.name);
    
    // Update score bar
    setScoreBar(data.confidence.black.values, data.confidence.white.values);
    
    // Check if AI move matches last move for special coloring
    const isAIMove = data.ai.colors[0] && 
                     data.ai.colors[0][0] === data.last.move[1] && 
                     data.ai.colors[0][1] === data.last.move[2];
    
    if (isAIMove) {
        updateWinrate(data.winrate.human, APP.lastMoveValue, "blue");
        updateCurrentMoveColor(data.last, APP.lastMoveValue, "blue");
    } else {
        updateWinrate(data.winrate.human, APP.lastMoveValue);
        updateCurrentMoveColor(data.last, APP.lastMoveValue);
    }
};

// Handle clock update with improved timing
APP.handleClockUpdate = function(clockData, receiveTime) {
    const current = clockData.current_player === clockData.black_player_id ? "black" : "white";
    const black = clockData.black_time;
    const white = clockData.white_time;
    
    // Log clock data for debugging
    console.log(`Clock update - Current: ${current}, Black: ${black.thinking_time}s, White: ${white.thinking_time}s`);
    
    startCountdown(current, black, white);
};

// Handle board update
APP.handleBoardUpdate = function(data) {
    updateBoard(data.board);
    markCurrentMove(data.move);
    
    // Reset winrate background
    if (WINRATE_OVER) {
        WINRATE_OVER.style.backgroundColor = "rgb(145, 145, 145)";
    }
};

// Handle game finished
APP.handleGameFinished = function(data) {
    console.log("Game has finished - stopping clock");
    
    // Stop the clock when game finishes
    stopClock();
    
    // You could add other end-game logic here
    // For example: show final result, disable interactions, etc.
};

// Handle initial game info
APP.handleGameInfo = function(gameInfo) {
    console.log("Processing initial game info:", gameInfo);
    
    // Update player information immediately
    if (gameInfo.players) {
        updatePlayerInfomation(
            gameInfo.players.black.username, 
            gameInfo.players.white.username
        );
        
        // Store player info in app state
        APP.gameInfo = gameInfo;
        
        console.log(`Game: ${gameInfo.game_name}`);
        console.log(`Black: ${gameInfo.players.black.username} (${gameInfo.players.black.rank})`);
        console.log(`White: ${gameInfo.players.white.username} (${gameInfo.players.white.rank})`);
        
        if (gameInfo.komi) {
            console.log(`Komi: ${gameInfo.komi}`);
        }
        
        if (gameInfo.handicap && gameInfo.handicap.length > 0) {
            console.log(`Handicap: ${gameInfo.handicap.length} stones`);
        }
    }
    
    // Handle time control info
    if (gameInfo.time_control) {
        console.log("Time control:", gameInfo.time_control);
    }
    
    // Handle rules
    if (gameInfo.rules) {
        console.log("Rules:", gameInfo.rules);
    }
};

// Handle review data
APP.handleReviewData = function(reviewData) {
    console.log("Processing review data:", reviewData);
    
    // Store review data in app state
    APP.reviewData = reviewData;
    
    console.log(`Review ID: ${reviewData.review_id}`);
    console.log(`Total moves: ${reviewData.total_moves}`);
    console.log(`Moves string: ${reviewData.moves_string}`);
};

// Update winrate tracking
APP.setPreviousAndCurrent = function(current, winrate) {
    APP.previous = { ...APP.current };
    APP.current = { ...winrate };
    APP.player = current;

    let value = 0;
    if (APP.player === "B") {
        value = APP.previous.white - APP.current.white;
    } else {
        value = APP.previous.black - APP.current.black;
    }

    APP.lastMoveValue = value;
};

// Get connection status
APP.getConnectionStatus = function() {
    return {
        isConnected: APP.isConnected,
        socket: APP.socket ? APP.socket.connected : false,
        clockState: getClockState()
    };
};

// Utility method to reset application state
APP.reset = function() {
    APP.previous = {};
    APP.current = { black: 50, white: 50 };
    APP.lastMoveValue = 0;
    APP.gameInfo = null;
    APP.reviewData = null;
    stopClock();
    domManager.reset();
    APP.analysisManager.reset();
};
