import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { Cluster } from '../utils/clustering';
import { latLonToVector3 } from '../utils/coordinates';
import { IncidentSeverity } from '../types';

interface ClusterMarkerProps {
  cluster: Cluster;
  onClick: () => void;
}

const severityColors = {
  [IncidentSeverity.LOW]: 0x00ff88,
  [IncidentSeverity.MEDIUM]: 0x00ffff,
  [IncidentSeverity.HIGH]: 0xff8800,
  [IncidentSeverity.CRITICAL]: 0xff0044,
};

export function ClusterMarker({ cluster, onClick }: ClusterMarkerProps) {
  const markerRef = useRef<THREE.Group>(null);
  const color = severityColors[cluster.severity as IncidentSeverity] || severityColors[IncidentSeverity.LOW];

  const position = latLonToVector3(cluster.location.lat, cluster.location.lon, 2.05);

  // Orient the marker to point radially outward from Earth's center
  useFrame(() => {
    if (markerRef.current) {
      markerRef.current.lookAt(0, 0, 0);
      markerRef.current.rotateX(Math.PI);
    }
  });

  return (
    <group ref={markerRef} position={[position.x, position.y, position.z]} onClick={onClick}>
      {/* Outer pulsing ring */}
      <mesh>
        <torusGeometry args={[0.12, 0.008, 8, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} />
      </mesh>

      {/* Inner ring */}
      <mesh>
        <torusGeometry args={[0.09, 0.01, 8, 32]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Center hexagon */}
      <mesh>
        <cylinderGeometry args={[0.07, 0.07, 0.02, 6]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Count text */}
      <Text
        position={[0, 0, 0.015]}
        fontSize={0.04}
        color="#000000"
        anchorX="center"
        anchorY="middle"
      >
        {cluster.incidents.length}
      </Text>
    </group>
  );
}
