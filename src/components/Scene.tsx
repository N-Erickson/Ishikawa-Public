import { useRef, useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { HolographicGlobe } from './HolographicGlobe';
import { CountryBorders } from './CountryBorders';
import { IncidentMarker } from './IncidentMarker';
import { IncidentPopup } from './IncidentPopup';
import { Incident } from '../types';
import { getCameraPosition } from '../utils/coordinates';

interface SceneProps {
  incidents: Incident[];
  selectedIncident: Incident | null;
  onIncidentSelect: (incident: Incident) => void;
}

function CameraController({ targetIncident }: { targetIncident: Incident | null }) {
  const { camera } = useThree();
  const targetPosition = useRef(new THREE.Vector3(5, 2, 5));
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));

  useEffect(() => {
    if (targetIncident) {
      const [x, y, z] = getCameraPosition(targetIncident.location, 6);
      targetPosition.current.set(x, y, z);
      targetLookAt.current.set(0, 0, 0);
    } else {
      targetPosition.current.set(5, 2, 5);
      targetLookAt.current.set(0, 0, 0);
    }
  }, [targetIncident]);

  useFrame(() => {
    // Smooth camera movement
    camera.position.lerp(targetPosition.current, 0.05);
    camera.lookAt(targetLookAt.current);
  });

  return null;
}

export function Scene({ incidents, selectedIncident, onIncidentSelect }: SceneProps) {
  return (
    <div style={{ width: '100%', height: '100%', background: '#000' }}>
      <Canvas>
        <PerspectiveCamera makeDefault position={[5, 2, 5]} fov={60} />
        <CameraController targetIncident={selectedIncident} />

        {/* Ambient lighting for holographic effect */}
        <ambientLight intensity={0.3} />
        <pointLight position={[10, 10, 10]} intensity={0.5} color={0x00ff00} />

        {/* The holographic globe */}
        <HolographicGlobe autoRotate={!selectedIncident} />

        {/* Country borders */}
        <CountryBorders />

        {/* Incident markers */}
        {incidents.map((incident) => (
          <IncidentMarker
            key={incident.id}
            incident={incident}
            onClick={() => onIncidentSelect(incident)}
          />
        ))}

        {/* Show popup for selected incident */}
        {selectedIncident && (
          <IncidentPopup
            incident={selectedIncident}
            onClose={() => onIncidentSelect(null as any)}
          />
        )}

        {/* Allow user to rotate the globe */}
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={3}
          maxDistance={10}
          autoRotate={false}
        />
      </Canvas>
    </div>
  );
}
