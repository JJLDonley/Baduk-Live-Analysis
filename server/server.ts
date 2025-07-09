import { AIChildProcess } from './ai.ts';
import { ConfigManager, ArgumentParser, ServerConfig } from './config.ts';
import { PatternMatchingService, PatternMatchRequest, PatternMatchResponse, ogsStringToVertex } from './pattern.ts';

interface AnalysisRequest {
    id: string;
    moves: [string, string][];
    initialStones: [string, string][];
    rules: string;
    komi: number;
    boardXSize: number;
    boardYSize: number;
    includePolicy: boolean;
    includeOwnership: boolean;
    maxVisits: number;
}

interface AnalysisResponse {
    id: string;
    analysis?: any;
    error?: string;
    timestamp: number;
}

class AnalysisServer {
    private config: ServerConfig;
    private configManager: ConfigManager;
    private katago: AIChildProcess | null = null;
    private patternMatcher: PatternMatchingService;
    private activeAnalyses: Map<string, AnalysisRequest> = new Map();
    private analysisQueue: AnalysisRequest[] = [];
    private processingAnalysis = false;
    private websocketConnections: Set<WebSocket> = new Set();
    private serverStartTime: number;
    
    constructor(config: ServerConfig, configManager: ConfigManager) {
        this.config = config;
        this.configManager = configManager;
        this.patternMatcher = new PatternMatchingService();
        this.serverStartTime = Date.now();
    }
    
    public async start(): Promise<void> {
        try {
            // Initialize KataGo
            await this.initializeKataGo();
            
            // Start WebSocket server
            await this.startWebSocketServer();
            
            console.log(`[Server] Baduk Live Analysis Server started on ${this.config.host}:${this.config.port}`);
            console.log(`[Server] KataGo ready for analysis`);
            
        } catch (error) {
            console.error(`[Server] Failed to start server:`, error);
            throw error;
        }
    }
    
    private async initializeKataGo(): Promise<void> {
        const executablePath = this.configManager.getKataGoExecutablePath();
        const modelPath = this.configManager.getKataGoModelPath();
        const configPath = this.configManager.getKataGoConfigPath();
        
        console.log(`[KataGo] Starting KataGo process...`);
        console.log(`[KataGo] Executable: ${executablePath}`);
        console.log(`[KataGo] Model: ${modelPath}`);
        console.log(`[KataGo] Config: ${configPath}`);
        
        const args = [
            'analysis',
            '-config', configPath,
            '-model', modelPath
        ];
        
        this.katago = new AIChildProcess(executablePath, args);
        
        // Initialize KataGo with a dummy query to ensure it's ready
        await this.initializeKataGoEngine();
        
        // Start processing analysis queue
        this.processAnalysisQueue();
    }
    
    private async initializeKataGoEngine(): Promise<void> {
        if (!this.katago) {
            throw new Error('KataGo process not initialized');
        }
        
        // Send initial query to KataGo
        const initQuery = {
            id: 'init',
            initialStones: [],
            moves: [],
            rules: this.config.analysis.includePolicy ? 'japanese' : 'chinese',
            komi: 6.5,
            boardXSize: 19,
            boardYSize: 19,
            includePolicy: this.config.analysis.includePolicy,
            includeOwnership: this.config.analysis.includeOwnership,
            maxVisits: 1
        };
        
        const queryString = JSON.stringify(initQuery) + '\n';
        await this.katago.ProcessIOWriter(queryString);
        
        // Wait for response
        const response = await this.katago.ProcessIOReader();
        console.log(`[KataGo] Engine initialized successfully`);
    }
    
    private async startWebSocketServer(): Promise<void> {
        const server = Deno.serve({
            port: this.config.port,
            hostname: this.config.host,
            onError: (error) => {
                console.error(`[Server] WebSocket error:`, error);
                return new Response('Internal Server Error', { status: 500 });
            }
        }, (req) => {
            return this.handleWebSocketConnection(req);
        });
        
        console.log(`[Server] WebSocket server listening on ws://${this.config.host}:${this.config.port}`);
    }
    
    private async handleWebSocketConnection(req: Request): Promise<Response> {
        const { socket, response } = Deno.upgradeWebSocket(req);
        
        socket.onopen = () => {
            console.log(`[WebSocket] Client connected`);
            this.websocketConnections.add(socket);
        };
        
        socket.onmessage = (event) => {
            this.handleAnalysisRequest(socket, event.data);
        };
        
        socket.onclose = () => {
            console.log(`[WebSocket] Client disconnected`);
            this.websocketConnections.delete(socket);
        };
        
        socket.onerror = (error) => {
            console.error(`[WebSocket] Connection error:`, error);
            this.websocketConnections.delete(socket);
        };
        
        return response;
    }
    
    private async handleAnalysisRequest(socket: WebSocket, data: string): Promise<void> {
        try {
            const request = JSON.parse(data);
            
            // Check if this is a pattern matching request
            if (request.type === 'pattern-match') {
                await this.handlePatternMatchRequest(socket, request);
                return;
            }
            
            // Handle regular analysis request
            const analysisRequest: AnalysisRequest = request;
            
            // Validate request
            if (!analysisRequest.id || !Array.isArray(analysisRequest.moves)) {
                this.sendError(socket, 'Invalid analysis request format');
                return;
            }
            
            // Apply server limits
            analysisRequest.maxVisits = Math.min(analysisRequest.maxVisits || this.config.analysis.maxVisits, this.config.analysis.maxVisits);
            analysisRequest.includePolicy = analysisRequest.includePolicy && this.config.analysis.includePolicy;
            analysisRequest.includeOwnership = analysisRequest.includeOwnership && this.config.analysis.includeOwnership;
            
            console.log(`[Analysis] Received request ${analysisRequest.id} with ${analysisRequest.moves.length} moves`);
            
            // Add to queue
            this.analysisQueue.push(analysisRequest);
            
            // Store socket reference for response
            (analysisRequest as any).socket = socket;
            
            // Process queue if not already processing
            if (!this.processingAnalysis) {
                this.processAnalysisQueue();
            }
            
        } catch (error) {
            console.error(`[Analysis] Error parsing request:`, error);
            this.sendError(socket, 'Invalid JSON in analysis request');
        }
    }
    
    private async processAnalysisQueue(): Promise<void> {
        if (this.processingAnalysis || this.analysisQueue.length === 0) {
            return;
        }
        
        this.processingAnalysis = true;
        
        while (this.analysisQueue.length > 0) {
            const request = this.analysisQueue.shift()!;
            
            try {
                await this.processAnalysisRequest(request);
            } catch (error) {
                console.error(`[Analysis] Error processing request ${request.id}:`, error);
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.sendError((request as any).socket, `Analysis failed: ${errorMessage}`);
            }
            
            // Small delay to prevent overwhelming KataGo
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        this.processingAnalysis = false;
    }
    
    private async processAnalysisRequest(request: AnalysisRequest): Promise<void> {
        if (!this.katago) {
            throw new Error('KataGo not initialized');
        }
        
        const socket = (request as any).socket;
        
        // Convert moves to KataGo format
        const katagoQuery = this.convertToKataGoFormat(request);
        
        console.log(`[Analysis] Processing ${request.id} with ${request.maxVisits} visits`);
        
        // Send query to KataGo
        const queryString = JSON.stringify(katagoQuery) + '\n';
        await this.katago.ProcessIOWriter(queryString);
        
        // Wait for response with timeout
        const startTime = Date.now();
        const timeout = this.config.analysis.timeoutMs;
        
        try {
            const response = await Promise.race([
                this.katago.ProcessIOReader(),
                new Promise<never>((_, reject) => 
                    setTimeout(() => reject(new Error('Analysis timeout')), timeout)
                )
            ]);
            
            const processingTime = Date.now() - startTime;
            console.log(`[Analysis] Completed ${request.id} in ${processingTime}ms`);
            
            // Parse and send response
            const analysisResult = JSON.parse(response);
            this.sendAnalysisResponse(socket, {
                id: request.id,
                analysis: analysisResult,
                timestamp: Date.now()
            });
            
            // Process pattern matching for the latest move
            await this.processPatternMatchingForLatestMove(socket, request);
            
        } catch (error) {
            console.error(`[Analysis] Request ${request.id} failed:`, error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.sendError(socket, `Analysis failed: ${errorMessage}`);
        }
    }
    
    private async processPatternMatchingForLatestMove(socket: WebSocket, request: AnalysisRequest): Promise<void> {
        try {
            // Get the latest move from the request
            if (request.moves.length === 0) {
                console.log(`[PatternMatch] No moves to analyze for request ${request.id}`);
                return;
            }
            
            const latestMove = request.moves[request.moves.length - 1];
            const [color, move] = latestMove;
            
            // Convert OGS move format to vertex coordinates
            let vertex: [number, number];
            if (typeof move === 'string') {
                // Review format: "dd" -> [3, 3]
                vertex = ogsStringToVertex(move);
            } else {
                // Game format: already [x, y] array
                vertex = move as [number, number];
            }
            
            // Determine sign based on color
            const sign = color === 'black' ? 1 : -1;
            
            // Build board state from all moves except the latest
            const boardData = this.buildBoardFromMoves(request.moves.slice(0, -1), request.boardXSize, request.boardYSize);
            
            // Create pattern matching request
            const patternRequest: PatternMatchRequest = {
                id: `${request.id}-pattern`,
                boardData: boardData,
                sign: sign,
                vertex: vertex,
                boardSize: request.boardXSize
            };
            
            // Get pattern match result
            const patternResult = this.patternMatcher.nameMove(patternRequest);
            
            // Send pattern match response
            const patternResponse = {
                type: 'pattern-match',
                ...patternResult
            };
            
            this.sendPatternMatchResponse(socket, patternResponse);
            
            console.log(`[PatternMatch] Sent pattern match for move ${move}: ${patternResult.moveName || 'No pattern found'}`);
            
        } catch (error) {
            console.error(`[PatternMatch] Error processing pattern matching:`, error);
            // Don't send error to client for pattern matching failures
        }
    }
    
    private buildBoardFromMoves(moves: [string, string][], boardXSize: number, boardYSize: number): number[][] {
        // Create board with proper dimensions
        const board = Array.from({ length: boardYSize }, () => Array(boardXSize).fill(0));
        
        for (const [moveColor, move] of moves) {
            let vertex: [number, number];
            
            if (typeof move === 'string') {
                // Review format: "dd" -> [3, 3]
                vertex = ogsStringToVertex(move);
            } else {
                // Game format: already [x, y] array
                vertex = move as [number, number];
            }
            
            // Validate vertex bounds
            if (vertex[0] >= 0 && vertex[0] < boardXSize && vertex[1] >= 0 && vertex[1] < boardYSize) {
                const sign = moveColor === 'black' ? 1 : -1;
                board[vertex[1]][vertex[0]] = sign;
            } else {
                console.warn(`[PatternMatch] Invalid vertex [${vertex[0]}, ${vertex[1]}] for board size ${boardXSize}x${boardYSize}`);
            }
        }
        
        return board;
    }
    
    private convertToKataGoFormat(request: AnalysisRequest): any {
        return {
            id: request.id,
            initialStones: request.initialStones,
            moves: request.moves,
            rules: request.rules,
            komi: request.komi,
            boardXSize: request.boardXSize,
            boardYSize: request.boardYSize,
            includePolicy: request.includePolicy,
            includeOwnership: request.includeOwnership,
            maxVisits: request.maxVisits
        };
    }
    
    private sendAnalysisResponse(socket: WebSocket, response: AnalysisResponse): void {
        try {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify(response));
            }
        } catch (error) {
            console.error(`[WebSocket] Error sending response:`, error);
        }
    }
    
    private sendError(socket: WebSocket, errorMessage: string): void {
        try {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    error: errorMessage,
                    timestamp: Date.now()
                }));
            }
        } catch (error) {
            console.error(`[WebSocket] Error sending error:`, error);
        }
    }
    
    private async handlePatternMatchRequest(socket: WebSocket, request: any): Promise<void> {
        try {
            // Validate pattern matching request
            if (!request.id || !request.boardData || request.sign === undefined || !request.vertex) {
                this.sendError(socket, 'Invalid pattern matching request format');
                return;
            }
            
            console.log(`[PatternMatch] Received request ${request.id} for move at [${request.vertex[0]}, ${request.vertex[1]}]`);
            
            // Convert request to PatternMatchRequest format
            const patternRequest: PatternMatchRequest = {
                id: request.id,
                boardData: request.boardData,
                sign: request.sign,
                vertex: request.vertex,
                boardSize: request.boardSize
            };
            
            // Process pattern matching
            const response = this.patternMatcher.nameMove(patternRequest);
            
            // Send response with pattern-match event type
            const patternResponse = {
                type: 'pattern-match',
                ...response
            };
            
            this.sendPatternMatchResponse(socket, patternResponse);
            
        } catch (error) {
            console.error(`[PatternMatch] Error processing request:`, error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.sendError(socket, `Pattern matching failed: ${errorMessage}`);
        }
    }
    
    private sendPatternMatchResponse(socket: WebSocket, response: any): void {
        try {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify(response));
            }
        } catch (error) {
            console.error(`[WebSocket] Error sending pattern match response:`, error);
        }
    }
    
    public async shutdown(): Promise<void> {
        console.log(`[Server] Shutting down server...`);
        
        // Close all WebSocket connections
        this.websocketConnections.forEach(socket => {
            try {
                socket.close();
            } catch (error) {
                console.error(`[WebSocket] Error closing connection:`, error);
            }
        });
        
        // Kill KataGo process
        if (this.katago) {
            this.katago.ProcessKill();
            this.katago = null;
        }
        
        console.log(`[Server] Server shutdown complete`);
    }
    
    public getServerStats(): any {
        return {
            uptime: Date.now() - this.serverStartTime,
            activeConnections: this.websocketConnections.size,
            queuedAnalyses: this.analysisQueue.length,
            processingAnalysis: this.processingAnalysis,
            config: this.config
        };
    }
}

// Main server startup
async function main(): Promise<void> {
    console.log('Starting Baduk Live Analysis Server...');
    
    // Parse command line arguments
    const argumentParser = new ArgumentParser(Deno.args);
    const argConfig = argumentParser.parseArgs();
    
    // Load configuration
    const configManager = new ConfigManager();
    const config = await configManager.loadConfig();
    
    // Apply command line overrides
    if (Object.keys(argConfig).length > 0) {
        configManager.updateConfig(argConfig);
        console.log(`[Config] Applied command line overrides`);
    }
    
    // Validate configuration
    const validation = configManager.validateConfig();
    if (!validation.valid) {
        console.error(`[Config] Configuration validation failed:`);
        validation.errors.forEach(error => console.error(`  - ${error}`));
        Deno.exit(1);
    }
    
    console.log(`[Config] Configuration validated successfully`);
    
    // Create and start server
    const server = new AnalysisServer(configManager.getConfig(), configManager);
    
    // Handle shutdown signals
    const handleShutdown = async () => {
        console.log(`[Server] Received shutdown signal`);
        await server.shutdown();
        Deno.exit(0);
    };
    
    // Listen for shutdown signals
    Deno.addSignalListener('SIGINT', handleShutdown);
    
    // Only add SIGTERM on non-Windows platforms
    if (Deno.build.os !== 'windows') {
        Deno.addSignalListener('SIGTERM', handleShutdown);
    }
    
    try {
        await server.start();
        
        // Keep server running
        console.log(`[Server] Server is running. Press Ctrl+C to stop.`);
        
    } catch (error) {
        console.error(`[Server] Fatal error:`, error);
        Deno.exit(1);
    }
}

// Run the server
if (import.meta.main) {
    main();
}
