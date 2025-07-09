import { OGSConnection } from './ogsConnection.js';
import { GameEngine } from './gameEngine.js';
import { AnalysisConnection } from './analysisConnection.js';
import { AnalysisResultAnalyzer } from './analysisResultAnalyzer.js';
import { AnalysisManager } from './analysisManager.js';
import { updateBoard, markCurrentMove, updateCurrentMoveColor } from './board.js';
import { updateWinrate } from './winrate.js';
import { updatePlayerInfomation } from './players.js';
import { setScoreBar } from './scorebar.js';
import { startCountdown, stopClock } from './clock.js';
import { domManager } from './domManager.js';
import { DOM } from './domElements.js';

/**
 * New Baduk Analysis Application
 * Clean architecture with proper separation of concerns
 */
class BadukAnalysisApp {
    constructor() {
        this.ogsConnection = null;
        this.gameEngine = null;
        this.analysisConnection = null;
        this.analysisResultAnalyzer = null;
        this.analysisManager = null;
        
        this.currentGameId = null;
        this.currentGameType = null;
        this.isInitialized = false;
        
        this.setupEventHandlers();
    }

    async initialize() {
        try {
            console.log('[App] Initializing Baduk Analysis Application...');
            
            // Wait for DOM to be ready
            await this.waitForDOM();
            
            // Validate required DOM elements
            if (!DOM.validate()) {
                throw new Error('Required DOM elements not found');
            }
            
            // Parse URL to get game info
            const { gameType, gameId } = this.parseURL();
            this.currentGameType = gameType;
            this.currentGameId = gameId;
            
            // Initialize core components
            await this.initializeComponents();
            
            // Setup component event handlers
            this.setupComponentEventHandlers();
            
            // Connect to services
            await this.connectToServices();
            
            // Initialize UI
            this.initializeUI();
            
            this.isInitialized = true;
            console.log('[App] Application initialized successfully');
            
        } catch (error) {
            console.error('[App] Initialization failed:', error);
            this.showError('Failed to initialize application: ' + error.message);
        }
    }

    async waitForDOM() {
        if (domManager.isReady()) {
            return;
        }
        
        return new Promise((resolve) => {
            const checkDOM = () => {
                if (domManager.isReady()) {
                    resolve();
                } else {
                    setTimeout(checkDOM, 100);
                }
            };
            checkDOM();
        });
    }

    parseURL() {
        const path = window.location.pathname;
        const segments = path.split('/').filter(segment => segment);
        
        if (segments.length >= 2) {
            return {
                gameType: segments[0],
                gameId: segments[1]
            };
        }
        
        return {
            gameType: 'demo',
            gameId: '1'
        };
    }

    async initializeComponents() {
        // Initialize analysis connection first
        this.analysisConnection = new AnalysisConnection();
        
        // Initialize game engine
        this.gameEngine = new GameEngine(this.analysisConnection);
        
        // Initialize OGS connection
        this.ogsConnection = new OGSConnection(this.gameEngine);
        
        // Initialize analysis components
        this.analysisResultAnalyzer = new AnalysisResultAnalyzer();
        this.analysisManager = new AnalysisManager();
        
        console.log('[App] Core components initialized');
    }

    setupComponentEventHandlers() {
        // OGS Connection events
        this.ogsConnection.on('connected', () => {
            console.log('[App] OGS connected');
        });

        this.ogsConnection.on('disconnected', () => {
            console.log('[App] OGS disconnected');
            this.showError('Lost connection to OGS servers');
        });

        // Game Engine events
        this.gameEngine.on('gameData', (game) => {
            console.log('[App] Game data received:', game);
            this.handleGameData(game);
        });

        this.gameEngine.on('move', (game, move) => {
            console.log('[App] Move received:', move);
            this.handleMove(game, move);
        });

        this.gameEngine.on('clock', (game, clockData) => {
            console.log('[App] Clock update:', clockData);
            this.handleClock(game, clockData);
        });

        this.gameEngine.on('analysisReady', (game, analysisResult) => {
            console.log('[App] Analysis ready:', analysisResult);
            this.handleAnalysisResult(game, analysisResult);
        });

        // Analysis Connection events
        this.analysisConnection.on('connected', () => {
            console.log('[App] Analysis server connected');
        });

        this.analysisConnection.on('disconnected', () => {
            console.log('[App] Analysis server disconnected');
            this.showError('Lost connection to analysis server');
        });

        this.analysisConnection.on('analysisResult', (result) => {
            console.log('[App] Analysis result received:', result);
            this.processAnalysisResult(result);
        });

        this.analysisConnection.on('error', (error) => {
            console.error('[App] Analysis connection error:', error);
            this.showError('Analysis error: ' + error.message);
        });
    }

    async connectToServices() {
        try {
            // Connect to analysis server
            await this.analysisConnection.connect();
            console.log('[App] Connected to analysis server');
            
            // Connect to OGS
            await this.ogsConnection.connect();
            console.log('[App] Connected to OGS servers');
            
            // Subscribe to game
            if (this.currentGameId && this.currentGameType) {
                this.ogsConnection.subscribeToGame(this.currentGameId, this.currentGameType);
                console.log(`[App] Subscribed to ${this.currentGameType} ${this.currentGameId}`);
            }
            
        } catch (error) {
            console.error('[App] Connection failed:', error);
            throw error;
        }
    }

    initializeUI() {
        // Set default score bar
        setScoreBar(
            [10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
            [10, 10, 10, 10, 10, 10, 10, 10, 10, 10]
        );
        
        // Set default winrate
        updateWinrate({ black: 50, white: 50 });
        
        // Set default player info
        updatePlayerInfomation({
            black: { name: 'Black', rank: '' },
            white: { name: 'White', rank: '' }
        });
        
        console.log('[App] UI initialized');
    }

    handleGameData(game) {
        try {
            // Update player information
            updatePlayerInfomation(game.players);
            
            // Update board
            updateBoard(game.boardState);
            
            // Mark current move if available
            if (game.moves.length > 0) {
                const lastMove = game.moves[game.moves.length - 1];
                if (lastMove.x !== 'pass' && lastMove.y !== 'pass') {
                    markCurrentMove([lastMove.x, lastMove.y]);
                }
            }
            
            // Update clock if available
            if (game.clock) {
                startCountdown(
                    game.clock.current,
                    game.clock.black,
                    game.clock.white
                );
            }
            
        } catch (error) {
            console.error('[App] Error handling game data:', error);
        }
    }

    handleMove(game, move) {
        try {
            // Update board
            updateBoard(game.boardState);
            
            // Mark new move
            if (move.x !== 'pass' && move.y !== 'pass') {
                markCurrentMove([move.x, move.y]);
            }
            
        } catch (error) {
            console.error('[App] Error handling move:', error);
        }
    }

    handleClock(game, clockData) {
        try {
            startCountdown(
                clockData.current,
                clockData.black,
                clockData.white
            );
            
        } catch (error) {
            console.error('[App] Error handling clock:', error);
        }
    }

    handleAnalysisResult(game, analysisResult) {
        try {
            // Add to analysis manager
            this.analysisManager.addAnalysis(analysisResult);
            
        } catch (error) {
            console.error('[App] Error handling analysis result:', error);
        }
    }

    processAnalysisResult(result) {
        try {
            // Process with analyzer
            const gameContext = {
                gameId: result.gameId,
                gameType: result.gameType,
                moveNumber: result.moveNumber,
                currentPlayer: this.getCurrentPlayer(result.moveNumber)
            };
            
            const processedAnalysis = this.analysisResultAnalyzer.processAnalysis(
                result.result,
                gameContext
            );
            
            // Update UI with processed analysis
            this.updateUIWithAnalysis(processedAnalysis);
            
        } catch (error) {
            console.error('[App] Error processing analysis result:', error);
        }
    }

    updateUIWithAnalysis(analysis) {
        try {
            // Update winrate
            updateWinrate({
                black: analysis.winrate.black,
                white: analysis.winrate.white
            });
            
            // Update score bar
            setScoreBar(
                analysis.confidence.black.values,
                analysis.confidence.white.values
            );
            
            // Update move value color
            if (analysis.lastMoveValue !== 0) {
                const game = this.gameEngine.getCurrentGame();
                if (game && game.moves.length > 0) {
                    const lastMove = game.moves[game.moves.length - 1];
                    if (lastMove.x !== 'pass' && lastMove.y !== 'pass') {
                        updateCurrentMoveColor(
                            { move: [lastMove.color, lastMove.x, lastMove.y] },
                            analysis.lastMoveValue
                        );
                    }
                }
            }
            
            // Update player winrates
            if (analysis.winrate) {
                const game = this.gameEngine.getCurrentGame();
                if (game) {
                    game.players.black.winrate = analysis.winrate.black;
                    game.players.white.winrate = analysis.winrate.white;
                    updatePlayerInfomation(game.players);
                }
            }
            
        } catch (error) {
            console.error('[App] Error updating UI with analysis:', error);
        }
    }

    getCurrentPlayer(moveNumber) {
        return moveNumber % 2 === 0 ? 'b' : 'w';
    }

    showError(message) {
        console.error('[App] Error:', message);
        
        // Show error in UI (you might want to implement a proper error display)
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff4444;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 1000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;
        
        document.body.appendChild(errorDiv);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }

    setupEventHandlers() {
        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('[App] Page hidden');
                // Optionally pause some operations
            } else {
                console.log('[App] Page visible');
                // Resume operations
            }
        });

        // Handle window unload
        window.addEventListener('beforeunload', () => {
            this.shutdown();
        });
    }

    // Public API methods
    getGameState() {
        return this.gameEngine ? this.gameEngine.getGameState() : null;
    }

    getAnalysisState() {
        return this.analysisResultAnalyzer ? this.analysisResultAnalyzer.getLastAnalysis() : null;
    }

    getConnectionStatus() {
        return {
            ogs: this.ogsConnection ? this.ogsConnection.getConnectionState() : null,
            analysis: this.analysisConnection ? this.analysisConnection.getConnectionStatus() : null
        };
    }

    shutdown() {
        console.log('[App] Shutting down application...');
        
        // Stop clock
        stopClock();
        
        // Disconnect services
        if (this.ogsConnection) {
            this.ogsConnection.disconnect();
        }
        
        if (this.analysisConnection) {
            this.analysisConnection.disconnect();
        }
        
        // Reset analyzers
        if (this.analysisResultAnalyzer) {
            this.analysisResultAnalyzer.reset();
        }
        
        if (this.analysisManager) {
            this.analysisManager.reset();
        }
        
        this.isInitialized = false;
    }
}

// Create and initialize the application
const app = new BadukAnalysisApp();

// Make app globally accessible for debugging
window.BadukApp = app;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        app.initialize();
    });
} else {
    app.initialize();
}

export default app; 