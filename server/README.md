# Baduk Live Analysis Server

A WebSocket-based AI analysis server that uses KataGo to provide real-time Go/Baduk game analysis.

## Features

- **WebSocket API** for real-time analysis requests
- **Configurable KataGo integration** with flexible file paths
- **Command-line configuration** with argument parsing
- **JSON configuration file** support
- **Analysis queue management** to handle multiple concurrent requests
- **Automatic server validation** and error handling
- **Graceful shutdown** with proper resource cleanup

## Installation

1. Ensure you have Deno installed
2. Place KataGo files in the `server/katago/` directory:
   - `katago.exe` (or `katago` on Linux/Mac)
   - `weights.bin.gz` (or your preferred model)
   - `default.cfg` (or your preferred config)
   - Required DLL files (on Windows)

## Configuration

The server uses a configuration file (`config.json`) that is automatically created with default values on first run.

### Default Configuration

```json
{
  "port": 8081,
  "host": "localhost",
  "katago": {
    "directory": "./katago",
    "executable": "katago.exe",
    "model": "default_model.bin.gz",
    "config": "default.cfg"
  },
  "analysis": {
    "maxVisits": 100,
    "maxConcurrentAnalyses": 3,
    "timeoutMs": 30000,
    "includePolicy": false,
    "includeOwnership": true
  },
  "logging": {
    "level": "info"
  }
}
```

### Configuration Options

#### Server Settings
- `port`: WebSocket server port (default: 8081)
- `host`: Server hostname (default: localhost)

#### KataGo Settings
- `katago.directory`: Path to KataGo installation directory
- `katago.executable`: KataGo executable filename
- `katago.model`: Model file name (e.g., `default_model.bin.gz`)
- `katago.config`: Config file name (e.g., `default.cfg`)

#### Analysis Settings
- `analysis.maxVisits`: Maximum visits per analysis (default: 100)
- `analysis.maxConcurrentAnalyses`: Maximum concurrent analyses (default: 3)
- `analysis.timeoutMs`: Analysis timeout in milliseconds (default: 30000)
- `analysis.includePolicy`: Include policy data in analysis (default: false)
- `analysis.includeOwnership`: Include ownership data in analysis (default: true)

#### Logging Settings
- `logging.level`: Log level (debug, info, warn, error)
- `logging.logFile`: Optional log file path

## Usage

### Basic Usage

```bash
# Start server with default configuration (run from project root)
deno run --allow-all server/server.ts

# Start server with custom port
deno run --allow-all server/server.ts --port 8082

# Start server with custom KataGo directory
deno run --allow-all server/server.ts --katago-dir ./my-katago

# Start server accessible from all interfaces
deno run --allow-all server/server.ts --host 0.0.0.0
```

### Command Line Arguments

```bash
deno run --allow-all server/server.ts [options]

Options:
  -p, --port <port>           Server port (default: 8081)
  -h, --host <host>           Server host (default: localhost)
  --katago-dir <directory>    KataGo directory path (default: ./katago)
  --katago-exe <executable>   KataGo executable name (default: katago.exe)
  --katago-model <model>      KataGo model file (default: default_model.bin.gz)
  --katago-config <config>    KataGo config file (default: default.cfg)
  --max-visits <visits>       Maximum visits per analysis (default: 100)
  --max-concurrent <count>    Maximum concurrent analyses (default: 3)
  --timeout <ms>              Analysis timeout in milliseconds (default: 30000)
  --log-level <level>         Logging level: debug, info, warn, error (default: info)
  --log-file <file>           Log file path (optional)
  --help                      Show help message
```

### Examples

```bash
# High-performance setup
deno run --allow-all server/server.ts --port 8082 --max-visits 200 --max-concurrent 5

# Custom KataGo installation
deno run --allow-all server/server.ts --katago-dir ./custom-katago --katago-exe katago

# Public server (accessible from network)
deno run --allow-all server/server.ts --host 0.0.0.0 --port 8080

# Debug mode with logging
deno run --allow-all server/server.ts --log-level debug --log-file analysis.log
```

## WebSocket API

### Connection

Connect to the WebSocket server:
```javascript
const ws = new WebSocket('ws://localhost:8081');
```

### Analysis Request Format

```json
{
  "id": "unique-request-id",
  "moves": [
    ["black", "pd"],
    ["white", "dp"],
    ["black", "pp"]
  ],
  "initialStones": [],
  "rules": "japanese",
  "komi": 6.5,
  "boardXSize": 19,
  "boardYSize": 19,
  "includePolicy": false,
  "includeOwnership": true,
  "maxVisits": 100
}
```

### Analysis Response Format

```json
{
  "id": "unique-request-id",
  "analysis": {
    // KataGo analysis results
    "turnNumber": 3,
    "moveInfos": [...],
    "rootInfo": {...},
    "ownership": [...]
  },
  "timestamp": 1640995200000
}
```

### Error Response Format

```json
{
  "error": "Error message",
  "timestamp": 1640995200000
}
```

## Client Integration

The server automatically integrates with the client-side AI analysis manager:

```javascript
// Connect to AI server
connectToAI('localhost', 8081);

// Request analysis for current game
requestAnalysis();

// Set analysis parameters
setAIMaxVisits(200);

// Get AI status
const status = getAIStatus();
```

## Troubleshooting

### Common Issues

1. **KataGo executable not found**
   - Verify KataGo is installed in the correct directory
   - Check executable permissions (Linux/Mac)
   - Ensure all required DLL files are present (Windows)

2. **Model file not found**
   - Verify model file exists in KataGo directory
   - Check file extension (.bin.gz)
   - Ensure file is not corrupted

3. **Port already in use**
   - Change port with `--port` argument
   - Check if another service is using the port

4. **Connection timeout**
   - Increase timeout with `--timeout` argument
   - Check KataGo performance and system resources

### Debug Mode

Enable debug logging to troubleshoot issues:

```bash
deno run --allow-all server/server.ts --log-level debug
```

### Configuration Validation

The server automatically validates configuration on startup and will report any errors:

```
[Config] Configuration validation failed:
  - KataGo executable not found at: ./katago/katago.exe
  - KataGo model not found at: ./katago/default_model.bin.gz
```

## Performance Tuning

### Recommended Settings

For different use cases:

**Light Usage (1-2 concurrent analyses)**
```bash
deno run --allow-all server/server.ts --max-visits 50 --max-concurrent 2
```

**Heavy Usage (Multiple concurrent games)**
```bash
deno run --allow-all server/server.ts --max-visits 200 --max-concurrent 5 --timeout 60000
```

**Production Server**
```bash
deno run --allow-all server/server.ts --host 0.0.0.0 --port 8080 --max-visits 100 --max-concurrent 3
```

### Resource Requirements

- **CPU**: KataGo is CPU-intensive; more cores = better performance
- **RAM**: ~1-2GB for KataGo process + models
- **Storage**: ~100MB for KataGo + models
- **Network**: Minimal bandwidth requirements

## Security Considerations

- The server doesn't include authentication by default
- Use firewall rules to restrict access if needed
- Consider using a reverse proxy for production deployments
- Monitor resource usage to prevent abuse

## License

This project is part of the Baduk Live Analysis application. 