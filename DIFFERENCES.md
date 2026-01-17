# Differences from Main Version

This document explains what was removed to create the public version of Ishikawa.

## Removed Features

### 1. Section9 AI System (Complete Removal)
- **Directory**: `/section9` - Entire AI character system removed
- **Component**: `Section9Comms.tsx` - AI transmission popup component
- **Characters**: All 5 AI characters (Aiko, Kanzaki, Elena, Marcus, Elias)
- **TTS Integration**: Kokoro TTS service and audio generation
- **LLM Integration**: Ollama/Anthropic/OpenAI script generation
- **WebSocket Server**: Real-time AI transmission broadcasting
- **Database**: `section9.db` - AI messages and scheduling database

### 2. YouTube Listener (Complete Removal)
- **Directory**: `/youtube-listener` - Chat command system removed
- **Commands**: !news, !askAiko, !conversation, etc.
- **Integration**: YouTube live chat scraping and AI interaction

### 3. Configuration Removed
- **Vite Proxies**: Removed `/section9` and `/ws` proxy routes
- **Environment Variables**: Removed AI provider configs (OLLAMA, ANTHROPIC, etc.)
- **OBS Integration**: Removed frontend heartbeat for OBS browser source watchdog

### 4. Dependencies Cleaned
- No LLM SDK dependencies
- No TTS library dependencies
- No WebSocket server dependencies
- Smaller bundle size overall

## What Remains (Public Features)

### Core Functionality
✅ **3D Globe Visualization** - Three.js interactive globe
✅ **Real-time OSINT Data** - All 9+ data sources intact:
   - USGS Earthquake Data
   - NOAA Weather Alerts
   - GDACS Disaster Alerts
   - NASA Earth Observatory
   - NVD Vulnerability Database
   - UN OCHA ReliefWeb
   - Global Event RSS Feeds
   - Aviation data (OpenSky Network)
   - Market data (crypto, metals, stocks)

✅ **Backend Service** - Express + SQLite incident aggregation
✅ **Market Ticker** - Live price updates
✅ **Incident Filtering** - Type-based filtering
✅ **Auto-rotation** - Cycles through incidents
✅ **All Visualizations** - Markers, country borders, animations

## File Changes

### Modified Files
- `App.tsx` - Removed Section9Comms import and WebSocket state (36 lines removed)
- `vite.config.ts` - Simplified proxy configuration
- `tsconfig.json` - Relaxed TypeScript strictness for easier deployment
- `.gitignore` - Added `Ishikawa-public/` exclusion

### Unchanged Files
- All `/src/components/` (except Section9Comms.tsx)
- All `/src/services/` - OSINT data fetching services
- All `/src/hooks/` - React hooks for incidents and markets
- `/backend/` - Complete backend unchanged
- All visualization components

## Bundle Size Comparison

**Main Version (with AI)**:
- Frontend: ~1.3 MB (minified)
- Dependencies: 250+ packages
- Services: 4 separate processes

**Public Version (no AI)**:
- Frontend: ~1.26 MB (minified)
- Dependencies: 133 packages (-117)
- Services: 2 processes (frontend + backend)

## Use Cases

**Main Version**:
- Live streaming with AI commentary
- Interactive AI Q&A during streams
- Automated news briefings
- Character-based incident analysis

**Public Version**:
- Clean OSINT data visualization
- Educational demonstrations
- Research and analysis
- Embeddable in other projects
- Deployment without AI infrastructure costs

## Reverting to Full Version

To use the full version with AI:
1. Use the main repository root (not `Ishikawa-public/`)
2. Follow setup in main `README.md`
3. Configure Section9 `.env` with AI provider
4. Run `./start-all.sh` instead of `./start-public.sh`
