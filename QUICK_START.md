# Ishikawa Public Version - Quick Start

**Clean OSINT visualization without AI integration**

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

## Installation

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

## Running the Application

### Option 1: Automated Start (Recommended)

```bash
./start-public.sh
```

This will:
- Start the backend on port 3000
- Start the frontend on port 5173
- Show you log file locations

Access the app at: **http://localhost:5173**

### Option 2: Manual Start

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

## Stopping the Application

```bash
./stop-public.sh
```

## What You'll See

- **3D Interactive Globe** - Rotate and zoom with your mouse
- **Real-time Incidents** - Updated every 15 minutes from OSINT sources
- **Incident List** - Right sidebar with filtering by type
- **Market Ticker** - Top bar showing crypto, metals, and stock prices
- **Live Indicator** - Shows when data is actively streaming

## Data Sources


Data refreshes automatically every 15 minutes.

## Troubleshooting

**Frontend won't start:**
- Check if port 5173 is already in use: `lsof -i :5173`
- Kill the process: `lsof -ti:5173 | xargs kill -9`

**Backend won't start:**
- Check if port 3000 is already in use: `lsof -i :3000`
- Kill the process: `lsof -ti:3000 | xargs kill -9`

**No incidents showing:**
- Check backend logs: `tail -f /tmp/ishikawa-public-backend.log`
- Wait 5 minutes for first data fetch to complete
- Some sources may be temporarily unavailable (this is normal)

**Build errors:**
- Delete `node_modules` and `package-lock.json`
- Run `npm install` again
- Make sure you're using Node.js 18 or higher

## Customization

### Change refresh interval

Edit `src/hooks/useIncidents.ts`:
```typescript
const REFRESH_INTERVAL = 15 * 60 * 1000; // Change to your preferred milliseconds
```

### Filter incident types

Edit `src/App.tsx` to modify the filter options or add new filters.

### Adjust globe appearance

Edit `src/components/Scene.tsx` for globe colors, rotation speed, marker sizes, etc.

## Production Build

```bash
npm run build
```

Built files will be in the `dist/` folder. Serve them with any static file server.

## Support

This is a simplified public version. For questions about the full AI-integrated version, see the main repository README.

