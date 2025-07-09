/**
 * Frontend OGS WebSocket Connection Handler
 * Handles direct connection to OGS servers from the browser
 */
class OGSConnection {
    constructor(gameEngine) {
        this.gameEngine = gameEngine;
        this.socket = null;
        this.isConnected = false;
        this.clientId = this.generateClientId();
        this.connectionState = 'disconnected';
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        
        this.eventHandlers = new Map();
        this.setupEventHandlers();
    }

    generateClientId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    setupEventHandlers() {
        this.eventHandlers.set('connect', this.handleConnect.bind(this));
        this.eventHandlers.set('disconnect', this.handleDisconnect.bind(this));
        this.eventHandlers.set('error', this.handleError.bind(this));
        this.eventHandlers.set('hostinfo', this.handleHostInfo.bind(this));
        this.eventHandlers.set('authenticate', this.handleAuthenticate.bind(this));
    }

    async connect(ogsUrl = 'https://online-go.com/') {
        try {
            console.log('[OGS] Attempting to connect to OGS servers...');
            
            // Import socket.io-client dynamically
            const io = (await import('https://cdn.socket.io/4.7.2/socket.io.esm.min.js')).io;
            
            this.socket = io(ogsUrl, {
                transports: ['websocket'],
                upgrade: false,
                autoConnect: false
            });

            this.attachEventListeners();
            this.socket.connect();
            
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Connection timeout'));
                }, 10000);

                this.socket.once('connect', () => {
                    clearTimeout(timeout);
                    resolve();
                });

                this.socket.once('connect_error', (error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
            });
        } catch (error) {
            console.error('[OGS] Connection failed:', error);
            throw error;
        }
    }

    attachEventListeners() {
        for (const [event, handler] of this.eventHandlers) {
            this.socket.on(event, handler);
        }
    }

    handleConnect() {
        console.log('[OGS] Connected to OGS servers');
        this.isConnected = true;
        this.connectionState = 'connected';
        this.reconnectAttempts = 0;
        
        // Send initial handshake
        this.socket.emit('hostinfo');
        this.socket.emit('authenticate', { device_id: this.clientId });
    }

    handleDisconnect() {
        console.log('[OGS] Disconnected from OGS servers');
        this.isConnected = false;
        this.connectionState = 'disconnected';
        this.attemptReconnect();
    }

    handleError(error) {
        console.error('[OGS] Socket error:', error);
        this.connectionState = 'error';
    }

    handleHostInfo(hostinfo) {
        console.log('[OGS] Host info received:', hostinfo);
        this.connectionState = 'authenticated';
    }

    handleAuthenticate(auth) {
        console.log('[OGS] Authentication response:', auth);
        this.connectionState = 'ready';
        
        // Notify game engine that we're ready
        if (this.gameEngine) {
            this.gameEngine.onOGSReady();
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[OGS] Max reconnection attempts reached');
            return;
        }

        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
        console.log(`[OGS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
        
        setTimeout(() => {
            this.reconnectAttempts++;
            this.connect().catch(console.error);
        }, delay);
    }

    subscribeToGame(gameId, gameType) {
        if (!this.isConnected) {
            console.error('[OGS] Cannot subscribe - not connected');
            return;
        }

        const adjustedType = gameType === 'demo' ? 'review' : gameType;
        console.log(`[OGS] Subscribing to ${adjustedType} ${gameId}`);

        if (adjustedType === 'game') {
            this.connectToGame(gameId);
        } else if (adjustedType === 'review') {
            this.connectToReview(gameId);
        }
    }

    connectToGame(gameId) {
        console.log(`[OGS] Connecting to game ${gameId}`);
        this.socket.emit('game/connect', {
            game_id: gameId,
            chat: false
        });

        // Listen for game data
        this.socket.on(`game/${gameId}/gamedata`, (data) => {
            console.log(`[OGS] Received game data for ${gameId}:`, data);
            this.gameEngine.handleGameData(gameId, 'game', data);
        });

        // Listen for moves
        this.socket.on(`game/${gameId}/move`, (move) => {
            console.log(`[OGS] Received move for ${gameId}:`, move);
            this.gameEngine.handleMove(gameId, move);
        });

        // Listen for clock updates
        this.socket.on(`game/${gameId}/clock`, (clock) => {
            console.log(`[OGS] Received clock update for ${gameId}:`, clock);
            this.gameEngine.handleClock(gameId, clock);
        });
    }

    connectToReview(reviewId) {
        console.log(`[OGS] Connecting to review ${reviewId}`);
        this.socket.emit('review/connect', {
            review_id: reviewId,
            chat: false
        });

        // Listen for review data
        this.socket.on(`review/${reviewId}/full_state`, (data) => {
            console.log(`[OGS] Received review data for ${reviewId}:`, data);
            this.gameEngine.handleReviewData(reviewId, 'review', data);
        });

        // Listen for review moves
        this.socket.on(`review/${reviewId}/move`, (move) => {
            console.log(`[OGS] Received review move for ${reviewId}:`, move);
            this.gameEngine.handleMove(reviewId, move);
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.isConnected = false;
        this.connectionState = 'disconnected';
    }

    getConnectionState() {
        return {
            connected: this.isConnected,
            state: this.connectionState,
            clientId: this.clientId,
            reconnectAttempts: this.reconnectAttempts
        };
    }
}

export { OGSConnection }; 