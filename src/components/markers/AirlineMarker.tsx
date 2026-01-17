import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MarkerBase } from './MarkerBase';
import { IncidentSeverity } from '../../types';

interface AirlineMarkerProps {
  color: number;
  severity: IncidentSeverity;
}

export function AirlineMarker({ color, severity }: AirlineMarkerProps) {
  const planeRef = useRef<THREE.Group>(null);

  // Gentle rotation for airline markers
  useFrame((state) => {
    if (planeRef.current) {
      planeRef.current.rotation.y = state.clock.elapsedTime * 0.5;
    }
  });

  return (
    <MarkerBase color={color} severity={severity}>
      <group ref={planeRef}>
        {/* Simplified airplane shape */}
        {/* Fuselage */}
        <mesh>
          <cylinderGeometry args={[0.01, 0.01, 0.12, 8]} />
          <meshBasicMaterial color={color} />
        </mesh>

        {/* Wings */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[0.16, 0.01, 0.03]} />
          <meshBasicMaterial color={color} />
        </mesh>

        {/* Tail */}
        <mesh position={[0, 0.06, 0]} rotation={[Math.PI / 4, 0, 0]}>
          <boxGeometry args={[0.04, 0.01, 0.04]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </group>

      {/* Pulsing radar rings */}
      <mesh>
        <torusGeometry args={[0.1, 0.005, 8, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} />
      </mesh>
      <mesh>
        <torusGeometry args={[0.14, 0.003, 8, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} />
      </mesh>
    </MarkerBase>
  );
}
