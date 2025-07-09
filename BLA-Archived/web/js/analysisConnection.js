/**
 * Analysis Connection
 * Handles communication with the backend analysis server
 */
class AnalysisConnection {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.pendingRequests = new Map();
        this.requestTimeout = 30000; // 30 seconds
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        
        // Event callbacks
        this.eventCallbacks = new Map();
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.eventCallbacks.set('connected', []);
        this.eventCallbacks.set('disconnected', []);
        this.eventCallbacks.set('analysisResult', []);
        this.eventCallbacks.set('error', []);
    }

    // Event callback management
    on(event, callback) {
        if (!this.eventCallbacks.has(event)) {
            this.eventCallbacks.set(event, []);
        }
        this.eventCallbacks.get(event).push(callback);
    }

    emit(event, ...args) {
        if (this.eventCallbacks.has(event)) {
            this.eventCallbacks.get(event).forEach(callback => {
                try {
                    callback(...args);
                } catch (error) {
                    console.error(`Error in analysis connection callback for ${event}:`, error);
                }
            });
        }
    }

    async connect(serverUrl) {
        try {
            const hostname = serverUrl || window.location.hostname;
            const port = window.location.port || 3000;
            const url = `${hostname}:${port}`;
            
            console.log(`[AnalysisConnection] Connecting to analysis server at ${url}`);
            
            this.socket = io(url, {
                transports: ['websocket'],
                upgrade: false,
                autoConnect: false
            });

            this.attachEventListeners();
            this.socket.connect();
            
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Analysis connection timeout'));
                }, 10000);

                this.socket.once('connect', () => {
                    clearTimeout(timeout);
                    this.handleConnect();
                    resolve();
                });

                this.socket.once('connect_error', (error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
            });
        } catch (error) {
            console.error('[AnalysisConnection] Connection failed:', error);
            throw error;
        }
    }

    attachEventListeners() {
        this.socket.on('connect', this.handleConnect.bind(this));
        this.socket.on('disconnect', this.handleDisconnect.bind(this));
        this.socket.on('error', this.handleError.bind(this));
        this.socket.on('analysisResult', this.handleAnalysisResult.bind(this));
        this.socket.on('analysisError', this.handleAnalysisError.bind(this));
    }

    handleConnect() {
        console.log('[AnalysisConnection] Connected to analysis server');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');
    }

    handleDisconnect() {
        console.log('[AnalysisConnection] Disconnected from analysis server');
        this.isConnected = false;
        this.emit('disconnected');
        this.attemptReconnect();
    }

    handleError(error) {
        console.error('[AnalysisConnection] Connection error:', error);
        this.emit('error', error);
    }

    handleAnalysisResult(result) {
        console.log('[AnalysisConnection] Received analysis result:', result);
        
        // Find and resolve pending request
        const requestId = result.requestId;
        if (this.pendingRequests.has(requestId)) {
            const { resolve, timeout } = this.pendingRequests.get(requestId);
            clearTimeout(timeout);
            this.pendingRequests.delete(requestId);
            resolve(result);
        }
        
        // Emit to all listeners
        this.emit('analysisResult', result);
    }

    handleAnalysisError(error) {
        console.error('[AnalysisConnection] Analysis error:', error);
        
        // Find and reject pending request
        const requestId = error.requestId;
        if (this.pendingRequests.has(requestId)) {
            const { reject, timeout } = this.pendingRequests.get(requestId);
            clearTimeout(timeout);
            this.pendingRequests.delete(requestId);
            reject(new Error(error.message));
        }
        
        this.emit('error', error);
    }

    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[AnalysisConnection] Max reconnection attempts reached');
            return;
        }

        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
        console.log(`[AnalysisConnection] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
        
        setTimeout(() => {
            this.reconnectAttempts++;
            this.socket.connect();
        }, delay);
    }

    /**
     * Request analysis from the backend
     * @param {Object} analysisRequest - Analysis request object
     * @returns {Promise} Promise that resolves with analysis result
     */
    async requestAnalysis(analysisRequest) {
        if (!this.isConnected) {
            throw new Error('Not connected to analysis server');
        }

        const requestId = this.generateRequestId();
        const request = {
            ...analysisRequest,
            requestId,
            timestamp: Date.now()
        };

        console.log(`[AnalysisConnection] Sending analysis request:`, request);

        return new Promise((resolve, reject) => {
            // Set up timeout
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error('Analysis request timeout'));
            }, this.requestTimeout);

            // Store pending request
            this.pendingRequests.set(requestId, { resolve, reject, timeout });

            // Send request
            this.socket.emit('analysisRequest', request);
        });
    }

    /**
     * Cancel pending analysis request
     * @param {string} requestId - Request ID to cancel
     */
    cancelRequest(requestId) {
        if (this.pendingRequests.has(requestId)) {
            const { timeout } = this.pendingRequests.get(requestId);
            clearTimeout(timeout);
            this.pendingRequests.delete(requestId);
            
            // Notify server
            this.socket.emit('cancelAnalysis', { requestId });
        }
    }

    /**
     * Get connection status
     */
    getConnectionStatus() {
        return {
            connected: this.isConnected,
            pendingRequests: this.pendingRequests.size,
            reconnectAttempts: this.reconnectAttempts
        };
    }

    /**
     * Generate unique request ID
     */
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Disconnect from server
     */
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.isConnected = false;
        
        // Clear pending requests
        for (const [requestId, { reject, timeout }] of this.pendingRequests) {
            clearTimeout(timeout);
            reject(new Error('Connection closed'));
        }
        this.pendingRequests.clear();
    }
}

export { AnalysisConnection }; 