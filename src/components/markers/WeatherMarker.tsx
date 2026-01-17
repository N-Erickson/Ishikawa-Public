import * as THREE from 'three';
import { MarkerBase } from './MarkerBase';
import { IncidentSeverity } from '../../types';

interface WeatherMarkerProps {
  color: number;
  severity: IncidentSeverity;
}

export function WeatherMarker({ color, severity }: WeatherMarkerProps) {
  return (
    <MarkerBase color={color} severity={severity}>
      {/* Cloud/storm icon - wireframe sphere cluster */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial color={color} wireframe={true} />
      </mesh>
      <mesh position={[-0.04, 0.02, 0]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial color={color} wireframe={true} />
      </mesh>
      <mesh position={[0.04, 0.02, 0]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial color={color} wireframe={true} />
      </mesh>

      {/* Lightning bolt for severe weather */}
      {(severity === IncidentSeverity.HIGH || severity === IncidentSeverity.CRITICAL) && (
        <>
          {/* Simple lightning bolt made of thin boxes */}
          <mesh position={[0, -0.04, 0]} rotation={[0, 0, Math.PI / 6]}>
            <boxGeometry args={[0.01, 0.06, 0.01]} />
            <meshBasicMaterial color={color} />
          </mesh>
          <mesh position={[0.01, -0.08, 0]} rotation={[0, 0, -Math.PI / 6]}>
            <boxGeometry args={[0.01, 0.05, 0.01]} />
            <meshBasicMaterial color={color} />
          </mesh>
        </>
      )}

      {/* Spinning weather radar effect for critical */}
      {severity === IncidentSeverity.CRITICAL && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.12, 0.005, 6, 24, Math.PI]} />
          <meshBasicMaterial color={color} transparent opacity={0.6} />
        </mesh>
      )}
    </MarkerBase>
  );
}
