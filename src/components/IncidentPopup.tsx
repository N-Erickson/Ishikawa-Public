import { Html } from '@react-three/drei';
import { useMemo } from 'react';
import { Incident, IncidentSeverity } from '../types';
import { latLonToVector3 } from '../utils/coordinates';

interface IncidentPopupProps {
  incident: Incident;
  onClose?: () => void;
}

const severityStyles = {
  [IncidentSeverity.LOW]: {
    border: '#00ff00',
    glow: 'rgba(0, 255, 0, 0.3)',
  },
  [IncidentSeverity.MEDIUM]: {
    border: '#ffff00',
    glow: 'rgba(255, 255, 0, 0.3)',
  },
  [IncidentSeverity.HIGH]: {
    border: '#ff8800',
    glow: 'rgba(255, 136, 0, 0.3)',
  },
  [IncidentSeverity.CRITICAL]: {
    border: '#ff0000',
    glow: 'rgba(255, 0, 0, 0.3)',
  },
};

export function IncidentPopup({ incident, onClose }: IncidentPopupProps) {
  const position = useMemo(
    () => latLonToVector3(incident.location.lat, incident.location.lon, 2.5),
    [incident.location.lat, incident.location.lon]
  );
  const style = severityStyles[incident.severity];

  return (
    <Html
      key={incident.id}
      position={[position.x, position.y, position.z]}
      style={{
        transition: 'all 0.5s',
        opacity: 1,
        pointerEvents: 'auto',
      }}
      occlude={false}
      zIndexRange={[100, 0]}
    >
      <div
        style={{
          background: 'rgba(0, 0, 0, 0.95)',
          border: `2px solid ${style.border}`,
          borderRadius: '8px',
          padding: '16px',
          minWidth: '300px',
          maxWidth: '400px',
          color: '#00ff00',
          fontFamily: 'monospace',
          fontSize: '12px',
          boxShadow: `0 0 20px ${style.glow}, inset 0 0 20px ${style.glow}`,
          backdropFilter: 'blur(10px)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '12px',
          }}
        >
          <div
            style={{
              fontSize: '10px',
              color: style.border,
              textTransform: 'uppercase',
              fontWeight: 'bold',
            }}
          >
            {incident.type} • {incident.severity}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#00ff00',
                cursor: 'pointer',
                fontSize: '16px',
                padding: '0',
                lineHeight: '1',
              }}
            >
              ×
            </button>
          )}
        </div>

        <h3
          style={{
            margin: '0 0 8px 0',
            fontSize: '14px',
            color: style.border,
            fontWeight: 'bold',
          }}
        >
          {incident.title}
        </h3>

        <p
          style={{
            margin: '0 0 12px 0',
            lineHeight: '1.4',
            color: '#00ff00',
          }}
        >
          {incident.description}
        </p>

        <div
          style={{
            borderTop: `1px solid ${style.border}`,
            paddingTop: '8px',
            fontSize: '10px',
            color: '#00ff00',
            opacity: 0.7,
          }}
        >
          <div>{incident.locationName}</div>
          <div>
            {new Date(incident.timestamp).toLocaleString()}
          </div>
          {incident.source && <div>Source: {incident.source}</div>}
        </div>

        {incident.livestreamUrl && (
          <div style={{ marginTop: '12px' }}>
            <a
              href={incident.livestreamUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: style.border,
                textDecoration: 'none',
                fontSize: '11px',
                display: 'inline-block',
                padding: '4px 8px',
                border: `1px solid ${style.border}`,
                borderRadius: '4px',
              }}
            >
              🔗 Source
            </a>
          </div>
        )}
      </div>
    </Html>
  );
}
