# Baduk Live Analysis

A real-time Go (Baduk) game analysis application that connects to Online-Go.com (OGS) to display live games and reviews with beautiful UI and proper Go board representation.

## Features

### ✅ **Core Functionality**
- **Live Game Tracking**: Connect to any OGS game via URL (`/game/[game_id]`)
- **Review Support**: View OGS reviews and demo boards (`/review/[review_id]`)
- **Real-time Updates**: Live clock countdown, move updates, and game state changes
- **Event-driven Architecture**: Responsive UI that updates automatically

### ✅ **Professional Go Board**
- **Authentic SVG Goban**: Traditional 19x19 board with proper proportions
- **Star Points (Hoshi)**: Traditional 9-point star pattern
- **Coordinate System**: A-T horizontal (skipping I), 1-19 vertical numbering
- **Real Stone Images**: High-quality black and white stone graphics
- **Current Move Marker**: Animated circle highlighting the last move
- **Responsive Design**: Scales properly on all devices

### ✅ **Player Information & Clocks**
- **Live Clock Display**: Real-time countdown with multiple time control support
- **Player Names & Ranks**: Automatic fetching from OGS data
- **Time Control Systems**: Fischer, Byo-yomi, and Canadian time support
- **Clock Synchronization**: Accurate time tracking with server sync

### ✅ **Game Analysis UI**
- **Winrate Pie Chart**: Visual representation of position evaluation
- **Score Bar**: Territory and capture tracking
- **Move Quality Indicator**: Color-coded move evaluation system
- **Game Status**: Current phase and player to move

## Quick Start

### Prerequisites
- [Deno](https://deno.land/) runtime installed

### Installation & Running
```bash
# Clone the repository
git clone <repository-url>
cd Baduk-Live-Analysis

# Start the server
deno run --allow-net --allow-read server.ts

# Open browser and navigate to:
# http://localhost:8080/game/[OGS_GAME_ID]
# http://localhost:8080/review/[OGS_REVIEW_ID]
```

### Example URLs
```
http://localhost:8080/game/77081213    # Live game
http://localhost:8080/review/123456    # Review/demo board
```

## Project Structure

```
Baduk-Live-Analysis/
├── server.ts                 # Deno HTTP server
├── client/                   # Client-side files
│   ├── index.html           # Main application UI
│   ├── ogs-ws.js            # OGS WebSocket integration
│   ├── assets/              # Local asset files
│   │   ├── black_stone.png  # Black stone image
│   │   ├── white_stone.png  # White stone image
│   │   ├── kaya.jpg         # Board background (optional)
│   │   └── alarm clock.ttf  # Clock font
│   └── web/                 # Original web folder (archived)
└── README.md                # This file
```

## Architecture

### **Server (server.ts)**
- **Deno HTTP Server**: Serves static files and handles routing
- **Dynamic Routing**: Supports `/game/[id]` and `/review/[id]` patterns
- **Asset Serving**: Handles images, fonts, and static resources
- **CORS Headers**: Proper caching and content-type headers

### **Client Application**
- **OGS-WS Integration**: Real-time WebSocket connection to OGS
- **Event-driven UI**: Responsive updates based on game events
- **SVG Board Renderer**: Professional Go board implementation
- **Game State Management**: Handles moves, clocks, and board state

### **Key Components**
1. **GameEngineWrapper**: Handles OGS connection and game logic
2. **BoardRenderer**: Creates and manages the SVG Go board
3. **UIManager**: Coordinates UI updates and user interactions
4. **BoardStateController**: Manages game rules and board state

## Event System

The application uses an event-driven architecture:

```javascript
// Game events
gameEngine.addEventHandler('gamedata', (gameData) => { ... });
gameEngine.addEventHandler('move', (moveData) => { ... });
gameEngine.addEventHandler('clock', (clockData) => { ... });
gameEngine.addEventHandler('phase', (phase) => { ... });

// Review events  
gameEngine.addEventHandler('reviewdata', (reviewData) => { ... });
gameEngine.addEventHandler('reviewmove', (moves) => { ... });
```

## Supported Time Controls

- **Fischer (Increment)**: Main time + increment per move
- **Byo-yomi (Japanese)**: Main time + overtime periods
- **Canadian**: Main time + time blocks for multiple moves

## Browser Compatibility

- **Modern Browsers**: Chrome, Firefox, Safari, Edge
- **Mobile Support**: Responsive design for tablets and phones
- **SVG Support**: Requires SVG-capable browser (all modern browsers)

## Development

### **Adding New Features**
1. **Server Changes**: Modify `server.ts` for new routes/endpoints
2. **Client Logic**: Update `client/ogs-ws.js` for game engine features
3. **UI Updates**: Modify `client/index.html` for visual changes

### **Debugging**
- **Browser Console**: View connection status and game events
- **Network Tab**: Monitor WebSocket connections to OGS
- **Server Logs**: Check terminal output for server-side issues

## Troubleshooting

### **Common Issues**
- **"Game not found"**: Ensure the game ID is correct and public
- **"No board display"**: Check browser console for JavaScript errors
- **"Clock not updating"**: Verify WebSocket connection to OGS
- **"Images not loading"**: Confirm asset files exist in `client/assets/`

### **OGS Connection**
- The app connects directly to `https://online-go.com` via WebSocket
- Games must be public or you must have viewing permissions
- Some private games may not be accessible

## License

This project is for educational and personal use. Please respect OGS terms of service when using their API.

## Credits

- **Online-Go.com**: Game data and WebSocket API
- **AI Sensei**: Stone image assets (fallback)
- **Original Web Implementation**: Foundation for board rendering logic 