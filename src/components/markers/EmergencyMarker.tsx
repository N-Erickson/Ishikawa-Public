import * as THREE from 'three';
import { MarkerBase } from './MarkerBase';
import { IncidentSeverity } from '../../types';

interface EmergencyMarkerProps {
  color: number;
  severity: IncidentSeverity;
}

export function EmergencyMarker({ color, severity }: EmergencyMarkerProps) {
  return (
    <MarkerBase color={color} severity={severity}>
      {/* Diamond/警告 shape - emergency symbol */}
      <mesh>
        <octahedronGeometry args={[0.08, 0]} />
        <meshBasicMaterial color={color} wireframe={true} />
      </mesh>

      {/* Inner solid diamond */}
      <mesh scale={0.6}>
        <octahedronGeometry args={[0.08, 0]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Outer wireframe sphere */}
      <mesh>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshBasicMaterial
          color={color}
          transparent={true}
          opacity={0.3}
          wireframe={true}
        />
      </mesh>

      {/* Rotating warning rings for critical */}
      {severity === IncidentSeverity.CRITICAL && (
        <>
          <mesh rotation={[0, 0, Math.PI / 4]}>
            <torusGeometry args={[0.15, 0.005, 8, 16]} />
            <meshBasicMaterial color={color} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.15, 0.005, 8, 16]} />
            <meshBasicMaterial color={color} />
          </mesh>
        </>
      )}
    </MarkerBase>
  );
}
