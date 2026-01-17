import * as THREE from 'three';
import { MarkerBase } from './MarkerBase';
import { IncidentSeverity } from '../../types';

interface MilitaryMarkerProps {
  color: number;
  severity: IncidentSeverity;
}

export function MilitaryMarker({ color, severity }: MilitaryMarkerProps) {
  return (
    <MarkerBase color={color} severity={severity}>
      {/* Center point */}
      <mesh>
        <sphereGeometry args={[0.03, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Crosshair rings */}
      <mesh>
        <torusGeometry args={[0.08, 0.008, 8, 32]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh>
        <torusGeometry args={[0.12, 0.005, 8, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} />
      </mesh>

      {/* Crosshair lines */}
      <mesh position={[0.1, 0, 0]}>
        <boxGeometry args={[0.04, 0.002, 0.002]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[-0.1, 0, 0]}>
        <boxGeometry args={[0.04, 0.002, 0.002]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[0.002, 0.04, 0.002]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[0.002, 0.04, 0.002]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Corner brackets */}
      <group rotation={[0, 0, Math.PI / 4]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} rotation={[0, 0, (Math.PI / 2) * i]} position={[0.14, 0.14, 0]}>
            <boxGeometry args={[0.03, 0.002, 0.002]} />
            <meshBasicMaterial color={color} />
          </mesh>
        ))}
      </group>
    </MarkerBase>
  );
}
