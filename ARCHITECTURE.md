# Baduk Live Analysis - Architecture Documentation

## Overview

The Baduk Live Analysis application has been modularized into distinct components, each with specific responsibilities. This separation makes the code more maintainable, testable, and easier to understand.

## Architecture Diagram

```
┌─────────────────┐
│      app.js     │ ── Main Application Controller
│ BadukAnalysisApp│
└─────────────────┘
         │
         ├─── Config ────────────────────────┐
         │                                   │
         ├─── Server ────────────────────────┼─── HTTP/Express Server
         │                                   │
         ├─── OGS Connection ────────────────┼─── WebSocket Management
         │                                   │
         ├─── Queue ─────────────────────────┼─── Analysis Queue
         │                                   │
         ├─── KataGo AI ─────────────────────┼─── AI Engine Interface
         │                                   │
         └─── Game Logic ────────────────────┼─── Game State & Analysis
                                             │
                                             └─── Analysis Engine
```

## Module Breakdown

### 1. **Main Application (`app.js`)**
- **Purpose**: Application orchestration and initialization
- **Responsibilities**:
  - Initialize all modules
  - Setup monitoring
  - Start the server
- **Key Classes**: `BadukAnalysisApp`

### 2. **Configuration Module (`src/config.js`)**
- **Purpose**: Command-line argument parsing and configuration management
- **Responsibilities**:
  - Parse CLI arguments
  - Provide default values
  - Build file paths
  - Show help information
- **Key Features**:
  - Support for `-dir`, `-exe`, `-c`, `-m`, `-p` arguments
  - Cross-platform path handling
  - Help command support

### 3. **Server Module (`src/server.js`)**
- **Purpose**: HTTP server setup and routing
- **Responsibilities**:
  - Express server configuration
  - Static file serving
  - Route handling for games/reviews
  - Server startup
- **Key Classes**: `Server`

### 4. **OGS Connection Module (`src/ogsConnection.js`)**
- **Purpose**: WebSocket communication with Online-Go.com
- **Responsibilities**:
  - OGS WebSocket connection management
  - Game/review connection handling
  - Event listener setup
  - Data formatting for different game types
- **Key Classes**: `OGSConnection`
- **Key Methods**:
  - `connectLiveGame()` - Connect to games/reviews
  - `setupGameListeners()` - Game-specific event handling
  - `setupReviewListeners()` - Review-specific event handling
  - `formatGameStateData()` - Data transformation

### 5. **Queue Module (`src/queue.js`)**
- **Purpose**: Analysis request queue management
- **Responsibilities**:
  - Queue analysis requests
  - Process requests sequentially
  - Handle unique moves
  - Error handling
- **Key Classes**: `Queue`
- **Key Methods**:
  - `process()` - Add request to queue
  - `processNext()` - Process next request
  - `latestUniqueMove()` - Get latest unique move

### 6. **AI Integration Module (`src/ai.js`)**
- **Purpose**: KataGo engine interface
- **Responsibilities**:
  - KataGo process management
  - Query formatting
  - Response parsing
  - Engine lifecycle management
- **Key Classes**: `KataGo`
- **Key Methods**:
  - `query()` - Send analysis query
  - `queryHash()` - Format query data
  - `close()` - Cleanup engine

### 7. **Game Logic Module (`src/game.js`)**
- **Purpose**: Core game state management
- **Responsibilities**:
  - Game entity management
  - Board state representation
  - Move validation and execution
  - Game data formatting
- **Key Classes**: `GameEntity`, `Board`
- **Key Methods**:
  - `playMove()` - Execute moves
  - `findGroups()` - Group detection
  - `calculateLiberties()` - Liberty calculation
  - `state()` - Generate board state

### 8. **Analysis Engine Module (`src/analysis.js`)**
- **Purpose**: AI analysis processing (NEW)
- **Responsibilities**:
  - AI query processing
  - Winrate calculations
  - Territory analysis
  - Move evaluation
  - Confidence mapping
- **Key Classes**: `GameAnalysis`
- **Key Methods**:
  - `processQuery()` - Main analysis processing
  - `calculateHumanWinRate()` - Human winrate calculation
  - `confidenceOwnershipMap()` - Territory confidence
  - `getAnalysisData()` - Analysis data export

### 9. **Constants Module (`src/constants.js`)**
- **Purpose**: Shared configuration and instances
- **Responsibilities**:
  - Express app instance
  - Socket.io instances
  - Configuration values
  - Shared data structures

## Data Flow

```
1. User Request → Server → OGS Connection
2. OGS Event → OGS Connection → Queue → Analysis Request
3. Analysis Request → KataGo AI → Analysis Response
4. Analysis Response → Game Analysis → Game Entity
5. Game Entity → Data Formatting → Frontend via Socket.io
```

## Key Separations

### Game Logic vs Analysis Logic
- **Game Logic** (`src/game.js`): Pure game state, moves, board representation
- **Analysis Logic** (`src/analysis.js`): AI processing, winrate calculations, territory analysis

### Connection vs Processing
- **Connection** (`src/ogsConnection.js`): WebSocket communication, event handling
- **Processing** (`src/queue.js`): Request queuing, analysis processing

### Configuration vs Runtime
- **Configuration** (`src/config.js`): Static configuration, CLI parsing
- **Runtime** (`app.js`): Dynamic application state, monitoring

## Benefits of This Architecture

1. **Modularity**: Each module has a single responsibility
2. **Testability**: Individual components can be tested in isolation
3. **Maintainability**: Changes to one module don't affect others
4. **Scalability**: Easy to add new features or modify existing ones
5. **Reusability**: Components can be reused in other projects
6. **Debugging**: Easier to isolate issues to specific modules

## Usage Examples

### Basic Usage
```bash
node app.js
```

### Custom Configuration
```bash
node app.js -dir katago/ -exe katago -c default_config.cfg -m default_model.bin.gz
```

### Different Port
```bash
node app.js -p 3000
```

## Future Enhancements

The modular architecture makes it easy to add:
- Multiple AI engines
- Different game types
- Advanced analysis features
- Better error handling
- Performance monitoring
- Database integration

## Dependencies

- **External**: Express, Socket.io, UUID
- **Internal**: Clear module dependencies with no circular references
- **AI**: KataGo engine (configurable path) 