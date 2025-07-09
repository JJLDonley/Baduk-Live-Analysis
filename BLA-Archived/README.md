# Baduk Live Analysis

A real-time Go/Baduk game analysis application that connects to Online-Go.com (OGS) and provides AI-powered analysis using KataGo.

## Features

- Real-time analysis of live Go games and reviews from OGS
- AI-powered move suggestions and position evaluation using KataGo
- Web-based visualization of game state and analysis
- Support for both games and demo boards
- Configurable KataGo integration

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd Baduk-Live-Analysis
```

2. Install dependencies:
```bash
npm install
```

3. Set up KataGo:
   - Download KataGo from https://github.com/lightvector/KataGo
   - Extract to the `katago/` directory
   - Ensure you have the executable, config file, and model file

## Usage

### Command Line Interface

```bash
node app.js [options]
```

### Options

- `-dir <path>` - KataGo directory (default: ./katago)
- `-exe <name>` - KataGo executable name (default: katago.exe)
- `-c <file>` - Config file name (default: default_config.cfg)
- `-m <file>` - Model file name (default: default_model.bin.gz)
- `-p, --port <n>` - Server port (default: 2468)
- `-h, --help` - Show help message

### Examples

Basic usage with default settings:
```bash
node app.js
```

Custom KataGo configuration:
```bash
node app.js -dir katago/ -exe katago -c default_config.cfg -m default_model.bin.gz
```

Using a different port:
```bash
node app.js -p 3000
```

## Accessing Games

Once the server is running, you can access games and reviews using the following URLs:

- Live games: `http://localhost:2468/game/{game_id}`
- Reviews: `http://localhost:2468/review/{review_id}`
- Demo boards: `http://localhost:2468/demo/{review_id}`

## Architecture

The application uses a modular architecture with clear separation of concerns:

- **Config Module** (`src/config.js`) - Command-line arguments and configuration
- **Server Module** (`src/server.js`) - HTTP server setup and routing
- **OGS Connection** (`src/ogsConnection.js`) - WebSocket communication with OGS
- **Queue System** (`src/queue.js`) - Analysis request queue management
- **AI Integration** (`src/ai.js`) - KataGo engine interface
- **Game Logic** (`src/game.js`) - Pure game state and board management
- **Analysis Engine** (`src/analysis.js`) - AI analysis processing (separated from game logic)
- **Constants** (`src/constants.js`) - Shared constants and instances

For detailed architecture documentation, see [ARCHITECTURE.md](ARCHITECTURE.md).

## File Structure

```
Baduk-Live-Analysis/
├── app.js              # Main application entry point
├── src/
│   ├── config.js       # Configuration and CLI argument handling
│   ├── constants.js    # Shared constants
│   ├── server.js       # HTTP server setup
│   ├── ogsConnection.js # OGS WebSocket connection
│   ├── queue.js        # Analysis queue management
│   ├── ai.js           # KataGo integration
│   ├── game.js         # Game logic and state management
│   └── analysis.js     # AI analysis processing engine
├── web/                # Frontend files
├── katago/             # KataGo installation directory
├── README.md
└── ARCHITECTURE.md     # Detailed architecture documentation
```

## Requirements

- Node.js 14+
- KataGo (compatible with your system)
- Internet connection for OGS integration

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License.
