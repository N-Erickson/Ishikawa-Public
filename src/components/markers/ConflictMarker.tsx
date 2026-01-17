import * as THREE from 'three';
import { MarkerBase } from './MarkerBase';
import { IncidentSeverity } from '../../types';

interface ConflictMarkerProps {
  color: number;
  severity: IncidentSeverity;
}

export function ConflictMarker({ color, severity }: ConflictMarkerProps) {
  return (
    <MarkerBase color={color} severity={severity}>
      {/* Warning triangle */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.1, 0.15, 3]} />
        <meshBasicMaterial color={color} wireframe={true} />
      </mesh>

      {/* Inner solid triangle */}
      <mesh rotation={[Math.PI / 2, 0, 0]} scale={0.7}>
        <coneGeometry args={[0.1, 0.15, 3]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Exclamation point in center */}
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.05, 8]} />
        <meshBasicMaterial color={0x000000} />
      </mesh>
      <mesh position={[0, -0.02, 0]}>
        <sphereGeometry args={[0.01, 8, 8]} />
        <meshBasicMaterial color={0x000000} />
      </mesh>

      {/* Surrounding alert rings */}
      <mesh>
        <torusGeometry args={[0.12, 0.005, 6, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} />
      </mesh>
    </MarkerBase>
  );
}
