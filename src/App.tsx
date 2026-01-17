import { useState, useEffect } from 'react';
import { Scene } from './components/Scene';
import { IncidentList } from './components/IncidentList';
import { MarketTicker } from './components/MarketTicker';
import { MysticalData } from './components/MysticalData';
import { useIncidents } from './hooks/useIncidents';
import { Incident } from './types';
import './App.css';

function App() {
  const { incidents, loading, error, lastUpdate } = useIncidents();
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [incidentFilter, setIncidentFilter] = useState<string>('all');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update clock every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 5000);
    return () => clearInterval(timer);
  }, []);

  // Filter incidents based on selected filter
  const filteredIncidents = incidentFilter === 'all'
    ? incidents
    : incidents.filter(incident => incident.type === incidentFilter);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <div className="loading-text">CONNECTING TO OSINT SOURCES...</div>
        <div className="loading-subtext">
          • USGS Earthquake Data
          <br />
          • NOAA Weather Alerts
          <br />
          • NASA Earth Observatory
          <br />
          • OpenSky Aviation Network
          <br />
          • UN OCHA ReliefWeb
          <br />• Global Event Database
        </div>
      </div>
    );
  }

  if (error && incidents.length === 0) {
    return (
      <div className="error-screen">
        <div className="error-text">ERROR: {error}</div>
        <div className="error-subtext">
          Unable to connect to data sources. Check console for details.
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <h1 className="title">ISHIKAWA</h1>
        <div className="subtitle">Global Incident Monitoring System</div>
        <MarketTicker />
        <div className="header-right">
          <div className="current-time">
            {currentTime.toLocaleDateString('en-US', { day: '2-digit', month: 'short', timeZone: 'UTC' }).toUpperCase()} {currentTime.toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' })} UTC
          </div>
          <div className="live-indicator">
            <span className="pulse"></span>
            LIVE
          </div>
        </div>
      </header>

      {/* 3D Globe Scene */}
      <div className="scene-container">
        <Scene
          incidents={filteredIncidents}
          selectedIncident={selectedIncident}
          onIncidentSelect={setSelectedIncident}
        />
      </div>

      {/* Incident List Sidebar */}
      <IncidentList
        incidents={incidents}
        selectedIncident={selectedIncident}
        onIncidentSelect={setSelectedIncident}
        onFilterChange={setIncidentFilter}
        currentFilter={incidentFilter}
        autoRotate={true}
        rotationInterval={8000}
        activeTransmissionIncidentIds={[]}
      />

      {/* Footer Stats */}
      <footer className="footer">
        <div className="stat">
          <span className="stat-label">INCIDENTS:</span>
          <span className="stat-value">{incidents.length}</span>
        </div>
        <div className="stat">
          <span className="stat-label">STATUS:</span>
          <span className="stat-value">{error ? 'DEGRADED' : 'OPERATIONAL'}</span>
        </div>
        <div className="stat">
          <span className="stat-label">LAST UPDATE:</span>
          <span className="stat-value">
            {lastUpdate ? lastUpdate.toLocaleTimeString() : '--:--'}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">SOURCES:</span>
          <span className="stat-value">OSINT</span>
        </div>
      </footer>

      {/* Mystical Data Widget */}
      <MysticalData />
    </div>
  );
}

export default App;
