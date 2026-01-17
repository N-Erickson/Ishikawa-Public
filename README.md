# Ishikawa - Public Version

**Global Incident Monitoring System**

This is a simplified public version without AI integration features. It displays real-time global incidents from OSINT sources on a 3D globe visualization.


https://github.com/user-attachments/assets/b25e93ff-e963-4f92-a565-98bcd4d3b027



## Features


## Quick Start

```bash
# Install dependencies
npm install

# Start backend (incident aggregation)
cd backend
npm install
npm run dev

# In a new terminal, start frontend
cd ..
npm run dev
```

Visit http://localhost:5173

## Architecture

**Frontend** (React + Three.js) - Port 5173
- 3D globe visualization
- Incident list sidebar
- Market ticker

**Backend** (Express + SQLite) - Port 3000
- Polls OSINT sources every 5 minutes
- Deduplicates incidents (10km geo radius)
- Stores in SQLite database
- Serves via `/api/incidents` and `/api/markets`

