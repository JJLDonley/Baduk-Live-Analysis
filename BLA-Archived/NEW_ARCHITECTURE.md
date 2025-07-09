# New Baduk Live Analysis Architecture

## Overview

The application has been completely restructured with proper separation of concerns. The frontend now handles all OGS connections and game logic, while the backend serves as a pure analysis service.

## Architecture Components

### Frontend (Client-Side)

#### 1. **OGSConnection** (`web/js/ogsConnection.js`)
- **Purpose**: Direct WebSocket connection to OGS servers from browser
- **Responsibilities**:
  - Connect to OGS servers
  - Subscribe to games and reviews
  - Handle game data, moves, and clock updates
  - Reconnection logic with exponential backoff

#### 2. **GameEngine** (`web/js/gameEngine.js`)
- **Purpose**: Client-side game state management
- **Responsibilities**:
  - Maintain game state and board logic
  - Process moves and update board state
  - Handle player information and metadata
  - Trigger analysis requests
  - Event-driven architecture for UI updates

#### 3. **AnalysisConnection** (`web/js/analysisConnection.js`)
- **Purpose**: Communication with backend analysis server
- **Responsibilities**:
  - WebSocket connection to analysis server
  - Send analysis requests
  - Handle analysis results
  - Request timeout and retry management

#### 4. **AnalysisResultAnalyzer** (`web/js/analysisResultAnalyzer.js`)
- **Purpose**: Process KataGo analysis results
- **Responsibilities**:
  - Extract winrates, confidence scores, move suggestions
  - Calculate move values and score estimations
  - Process ownership data
  - Generate UI-ready analysis data

#### 5. **AnalysisManager** (`web/js/analysisManager.js`)
- **Purpose**: Manage analysis result ordering (existing, enhanced)
- **Responsibilities**:
  - Prevent out-of-order analysis display
  - Queue and process analysis results
  - Handle move sequence validation

#### 6. **BadukAnalysisApp** (`web/js/newApp.js`)
- **Purpose**: Main application coordinator
- **Responsibilities**:
  - Initialize all components
  - Coordinate between OGS and analysis systems
  - Handle UI updates
  - Error handling and connection management

### Backend (Server-Side)

#### 1. **WebSocketManager** (`src/websocketManager.js`)
- **Purpose**: Handle client connections with security
- **Responsibilities**:
  - JWT-based client authentication
  - Rate limiting and security policies
  - Connection tracking and management
  - Request validation and routing

#### 2. **GameMoveQueryManager** (`src/gameMoveQueryManager.js`)
- **Purpose**: Analysis request queue management
- **Responsibilities**:
  - Queue analysis requests with priority
  - Prevent spam and duplicate requests
  - Load balancing and timeout handling
  - Request lifecycle management

#### 3. **AIManager** (`src/aiManager.js`)
- **Purpose**: KataGo process management
- **Responsibilities**:
  - Manage multiple KataGo processes
  - Load balancing across processes
  - Error handling and auto-restart
  - Process isolation and monitoring

#### 4. **AIProcess** (`src/aiManager.js`)
- **Purpose**: Individual KataGo process wrapper
- **Responsibilities**:
  - Single KataGo process management
  - Query handling and response parsing
  - Process lifecycle and error recovery

#### 5. **BadukAnalysisServer** (`src/newServer.js`)
- **Purpose**: Main server application
- **Responsibilities**:
  - Express.js server with security middleware
  - Component initialization and coordination
  - API endpoints for monitoring
  - Graceful shutdown handling

## Key Improvements

### 1. **Separation of Concerns**
- **Frontend**: OGS connections, game logic, UI management
- **Backend**: Analysis processing, security, WebSocket management
- **Clear boundaries**: No mixed responsibilities

### 2. **Security Enhancements**
- JWT-based client authentication
- Rate limiting (per IP and per client)
- Request validation and sanitization
- Security headers (Helmet.js)
- CORS policies and CSP

### 3. **Reliability Improvements**
- Auto-reconnection for all connections
- Request queuing and priority management
- Process monitoring and auto-restart
- Graceful error handling and recovery

### 4. **Performance Optimizations**
- Multiple KataGo processes with load balancing
- Request deduplication and caching
- Efficient WebSocket communication
- Client-side game logic reduces server load

### 5. **Scalability Features**
- Horizontal scaling ready (multiple AI processes)
- Connection pooling and management
- Queue-based request processing
- Resource monitoring and statistics

## Protocol Design

### Client → Server (Analysis Requests)
```javascript
{
  requestId: "unique_id",
  gameId: "game_123",
  gameType: "game" | "review",
  moveNumber: 42,
  moves: [
    { color: "b", x: 3, y: 3 },
    { color: "w", x: 15, y: 15 }
  ],
  metadata: {
    rules: "chinese",
    komi: 7.5,
    width: 19,
    height: 19
  },
  timestamp: 1234567890
}
```

### Server → Client (Analysis Results)
```javascript
{
  requestId: "unique_id",
  gameId: "game_123",
  gameType: "game",
  moveNumber: 42,
  result: {
    // Raw KataGo analysis data
    winrate: 0.65,
    scoreLead: 2.3,
    ownership: [...],
    moveInfos: [...]
  },
  processingTime: 8500,
  timestamp: 1234567890
}
```

## File Structure

```
Baduk-Live-Analysis/
├── src/                          # Backend (Node.js)
│   ├── newServer.js              # Main server application
│   ├── websocketManager.js       # Client connection management
│   ├── gameMoveQueryManager.js   # Analysis queue management
│   ├── aiManager.js              # KataGo process management
│   └── ...                      # Existing config/utils
├── web/js/                       # Frontend (Browser)
│   ├── newApp.js                 # Main application
│   ├── ogsConnection.js          # OGS WebSocket connection
│   ├── gameEngine.js             # Game state management
│   ├── analysisConnection.js     # Analysis server connection
│   ├── analysisResultAnalyzer.js # Analysis processing
│   ├── analysisManager.js        # Result ordering (enhanced)
│   └── ...                      # Existing UI components
└── ...
```

## Migration Guide

### Starting the New Server
```bash
# Install additional dependencies
npm install helmet express-rate-limit jsonwebtoken

# Start new server
node src/newServer.js
```

### Frontend Changes
1. Update `index.html` to use `newApp.js` instead of `app.js`
2. All existing UI components remain compatible
3. OGS connections now happen in browser directly

### Configuration
- Set `JWT_SECRET` environment variable for production
- Adjust `AI_PROCESSES` for number of KataGo instances
- Configure rate limits and security policies as needed

## Benefits

1. **Reduced Server Load**: Client handles OGS connections and game logic
2. **Better Security**: Proper authentication, rate limiting, validation
3. **Improved Reliability**: Auto-reconnection, error recovery, process monitoring
4. **Easier Scaling**: Multiple AI processes, queue management
5. **Cleaner Code**: Clear separation of concerns, event-driven architecture
6. **Better Performance**: Client-side processing, optimized communication

## Testing

To test the new architecture:

1. Start the new server: `node src/newServer.js`
2. Access a game: `http://localhost:3000/game/123456`
3. Monitor connections in browser dev tools
4. Check server logs for analysis processing
5. Verify UI updates correctly with analysis results

The new system maintains all existing functionality while providing a much more robust and scalable foundation. 