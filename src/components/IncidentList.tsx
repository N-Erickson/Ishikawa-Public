import { useEffect, useRef } from 'react';
import { Incident, IncidentSeverity } from '../types';

interface IncidentListProps {
  incidents: Incident[];
  selectedIncident: Incident | null;
  onIncidentSelect: (incident: Incident) => void;
  onFilterChange: (filter: string) => void;
  currentFilter: string;
  autoRotate?: boolean;
  rotationInterval?: number;
  activeTransmissionIncidentIds?: string[];
}

const severityColors = {
  [IncidentSeverity.LOW]: '#00ff00',
  [IncidentSeverity.MEDIUM]: '#ffff00',
  [IncidentSeverity.HIGH]: '#ff8800',
  [IncidentSeverity.CRITICAL]: '#ff0000',
};

const severityOrder = {
  [IncidentSeverity.CRITICAL]: 0,
  [IncidentSeverity.HIGH]: 1,
  [IncidentSeverity.MEDIUM]: 2,
  [IncidentSeverity.LOW]: 3,
};

export function IncidentList({
  incidents,
  selectedIncident,
  onIncidentSelect,
  onFilterChange,
  currentFilter,
  autoRotate = true,
  rotationInterval = 5000,
  activeTransmissionIncidentIds = [],
}: IncidentListProps) {
  const currentIndexRef = useRef(0);
  const incidentsRef = useRef(incidents);
  const incidentRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter and sort incidents
  const filteredIncidents = incidents
    .filter(incident => currentFilter === 'all' || incident.type === currentFilter)
    .sort((a, b) => {
      // First sort by severity
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      // Then sort by time (newest first)
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

  // Update incidents ref without resetting rotation
  useEffect(() => {
    incidentsRef.current = filteredIncidents;
  }, [filteredIncidents]);

  // Scroll to selected incident (from globe popup rotation) when it changes
  useEffect(() => {
    if (selectedIncident && incidentRefs.current[selectedIncident.id]) {
      incidentRefs.current[selectedIncident.id]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [selectedIncident]);

  // Scroll to active transmission incident when it changes (overrides normal selection)
  useEffect(() => {
    if (activeTransmissionIncidentIds.length > 0) {
      // Find the first matching incident in the current filtered list
      const firstMatchingId = activeTransmissionIncidentIds.find(id =>
        filteredIncidents.some(inc => inc.id === id)
      );

      if (firstMatchingId && incidentRefs.current[firstMatchingId]) {
        console.log('[IncidentList] Scrolling to transmission incident:', firstMatchingId);
        incidentRefs.current[firstMatchingId]?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  }, [activeTransmissionIncidentIds, filteredIncidents]);

  useEffect(() => {
    if (!autoRotate) return;

    const interval = setInterval(() => {
      if (incidentsRef.current.length === 0) return;

      // Keep index in bounds if incidents list changes
      currentIndexRef.current = (currentIndexRef.current + 1) % incidentsRef.current.length;
      onIncidentSelect(incidentsRef.current[currentIndexRef.current]);
    }, rotationInterval);

    return () => clearInterval(interval);
  }, [autoRotate, rotationInterval, onIncidentSelect]);

  // Get unique incident types for filter buttons
  const incidentTypes = ['all', ...new Set(incidents.map(i => i.type))];

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '350px',
        height: '100%',
        background: 'rgba(0, 0, 0, 0.9)',
        borderLeft: '2px solid #00ff00',
        boxShadow: '-5px 0 20px rgba(0, 255, 0, 0.2)',
        overflowY: 'auto',
        overflowX: 'hidden',
        fontFamily: 'monospace',
        zIndex: 10,
      }}
    >
      <div
        style={{
          padding: '20px',
          borderBottom: '2px solid #00ff00',
          position: 'sticky',
          top: 0,
          background: 'rgba(0, 0, 0, 0.95)',
          backdropFilter: 'blur(10px)',
          zIndex: 1,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: '18px',
            color: '#00ff00',
            textTransform: 'uppercase',
            letterSpacing: '2px',
          }}
        >
          Global Incidents
        </h2>
        <div
          style={{
            marginTop: '12px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
          }}
        >
          {incidentTypes.map((type) => (
            <button
              key={type}
              onClick={() => onFilterChange(type)}
              style={{
                background: currentFilter === type ? 'rgba(0, 255, 0, 0.2)' : 'rgba(0, 0, 0, 0.5)',
                border: `1px solid ${currentFilter === type ? '#00ff00' : '#00ff0066'}`,
                borderRadius: '3px',
                padding: '4px 10px',
                fontSize: '9px',
                color: '#00ff00',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: 'monospace',
                fontWeight: currentFilter === type ? 'bold' : 'normal',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0, 255, 0, 0.15)';
                e.currentTarget.style.borderColor = '#00ff00';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = currentFilter === type ? 'rgba(0, 255, 0, 0.2)' : 'rgba(0, 0, 0, 0.5)';
                e.currentTarget.style.borderColor = currentFilter === type ? '#00ff00' : '#00ff0066';
              }}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '10px' }}>
        {filteredIncidents.map((incident) => {
          const isSelected = selectedIncident?.id === incident.id;
          const isActiveTransmission = activeTransmissionIncidentIds.includes(incident.id);
          const color = severityColors[incident.severity];

          return (
            <div
              key={incident.id}
              ref={(el) => { incidentRefs.current[incident.id] = el; }}
              onClick={() => onIncidentSelect(incident)}
              style={{
                background: isActiveTransmission
                  ? 'rgba(0, 255, 255, 0.15)'
                  : isSelected
                    ? 'rgba(0, 255, 0, 0.1)'
                    : 'rgba(0, 0, 0, 0.5)',
                border: isActiveTransmission ? `2px solid #00ffff` : `1px solid ${color}`,
                borderRadius: '4px',
                padding: '12px',
                marginBottom: '10px',
                cursor: 'pointer',
                transition: 'all 0.3s',
                boxShadow: isActiveTransmission
                  ? `0 0 20px #00ffff, inset 0 0 10px rgba(0, 255, 255, 0.3)`
                  : isSelected
                    ? `0 0 15px ${color}, inset 0 0 15px ${color}`
                    : `0 0 5px ${color}`,
              }}
              onMouseEnter={(e) => {
                if (!isActiveTransmission) {
                  e.currentTarget.style.background = 'rgba(0, 255, 0, 0.15)';
                }
                e.currentTarget.style.transform = 'translateX(-5px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isActiveTransmission
                  ? 'rgba(0, 255, 255, 0.15)'
                  : isSelected
                    ? 'rgba(0, 255, 0, 0.1)'
                    : 'rgba(0, 0, 0, 0.5)';
                e.currentTarget.style.transform = 'translateX(0)';
              }}
            >
              {/* LIVE indicator for active transmission */}
              {isActiveTransmission && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '8px',
                    padding: '4px 8px',
                    background: 'rgba(0, 255, 255, 0.2)',
                    borderRadius: '3px',
                    width: 'fit-content',
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#00ffff',
                      animation: 'pulse 1s infinite',
                    }}
                  />
                  <span
                    style={{
                      fontSize: '9px',
                      color: '#00ffff',
                      fontWeight: 'bold',
                      letterSpacing: '1px',
                    }}
                  >
                    LIVE TRANSMISSION
                  </span>
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                }}
              >
                <span
                  style={{
                    fontSize: '9px',
                    color: isActiveTransmission ? '#00ffff' : color,
                    textTransform: 'uppercase',
                    fontWeight: 'bold',
                  }}
                >
                  {incident.type}
                </span>
                <span
                  style={{
                    fontSize: '9px',
                    color: isActiveTransmission ? '#00ffff' : color,
                    textTransform: 'uppercase',
                  }}
                >
                  {incident.severity}
                </span>
              </div>

              <h3
                style={{
                  margin: '0 0 6px 0',
                  fontSize: '12px',
                  color: '#00ff00',
                  fontWeight: 'bold',
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word',
                }}
              >
                {incident.title}
              </h3>

              <p
                style={{
                  margin: '0 0 8px 0',
                  fontSize: '10px',
                  color: '#00ff00',
                  lineHeight: '1.4',
                  opacity: 0.8,
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word',
                }}
              >
                {incident.description.length > 100
                  ? incident.description.substring(0, 100) + '...'
                  : incident.description}
              </p>

              <div
                style={{
                  fontSize: '9px',
                  color: '#00ff00',
                  opacity: 0.6,
                }}
              >
                {incident.locationName}
              </div>

              <div
                style={{
                  fontSize: '8px',
                  color: '#00ff00',
                  opacity: 0.5,
                  marginTop: '4px',
                }}
              >
                {new Date(incident.timestamp).toLocaleTimeString()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Keyframe animation for pulse effect */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
