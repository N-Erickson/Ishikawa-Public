import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { Incident, IncidentSeverity, IncidentType } from '../types';
import { latLonToVector3 } from '../utils/coordinates';

interface IncidentMarkerProps {
  incident: Incident;
  onClick?: () => void;
}

const severityColors = {
  [IncidentSeverity.LOW]: 0x00ff88,
  [IncidentSeverity.MEDIUM]: 0x00ffff,
  [IncidentSeverity.HIGH]: 0xff8800,
  [IncidentSeverity.CRITICAL]: 0xff0044,
};

// Severity-based pulse speeds
const pulseSpeeds = {
  [IncidentSeverity.LOW]: 1.5,
  [IncidentSeverity.MEDIUM]: 2.5,
  [IncidentSeverity.HIGH]: 4,
  [IncidentSeverity.CRITICAL]: 6,
};

// Severity-based glow intensity
const glowIntensity = {
  [IncidentSeverity.LOW]: 0.15,
  [IncidentSeverity.MEDIUM]: 0.25,
  [IncidentSeverity.HIGH]: 0.35,
  [IncidentSeverity.CRITICAL]: 0.5,
};

export function IncidentMarker({ incident, onClick }: IncidentMarkerProps) {
  const markerRef = useRef<THREE.Group>(null);
  const pulseRef = useRef<THREE.Group>(null);
  const rotateRef = useRef<THREE.Group>(null);
  const glitchRef = useRef<THREE.Group>(null);
  const scanLineRef = useRef<THREE.Mesh>(null);

  // Position markers ABOVE the globe surface (radius 2 + offset 0.05)
  const position = latLonToVector3(incident.location.lat, incident.location.lon, 2.05);
  const color = severityColors[incident.severity];
  const pulseSpeed = pulseSpeeds[incident.severity];
  const glow = glowIntensity[incident.severity];

  // Pulsing animation, rotation, glitch effects, and orient marker
  useFrame((state) => {
    const time = state.clock.elapsedTime;

    // Pulse animation
    if (pulseRef.current) {
      const scale = 1 + Math.sin(time * pulseSpeed) * glow;
      pulseRef.current.scale.set(scale, scale, scale);
    }

    // Rotation for certain markers
    if (rotateRef.current) {
      rotateRef.current.rotation.y = time * 0.8;
    }

    // Glitch effect for high/critical
    if (glitchRef.current && (incident.severity === IncidentSeverity.HIGH || incident.severity === IncidentSeverity.CRITICAL)) {
      const glitchAmount = Math.random() > 0.95 ? Math.random() * 0.02 : 0;
      glitchRef.current.position.x = glitchAmount * (Math.random() - 0.5);
      glitchRef.current.position.y = glitchAmount * (Math.random() - 0.5);
    }

    // Scan line animation
    if (scanLineRef.current) {
      const scanSpeed = pulseSpeed * 0.5;
      scanLineRef.current.position.y = (Math.sin(time * scanSpeed) * 0.15);
      if (scanLineRef.current.material) {
        const mat = scanLineRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.3 + Math.sin(time * scanSpeed * 2) * 0.2;
      }
    }

    // Orient the marker group to point radially outward from Earth's center
    if (markerRef.current) {
      markerRef.current.lookAt(0, 0, 0);
      markerRef.current.rotateX(Math.PI);
    }
  });

  // Render type-specific marker shape - INTERESTING 3D designs
  const renderMarkerShape = () => {
    switch (incident.type) {
      case IncidentType.EMERGENCY:
        // RED BOX with 緊急 (EMERGENCY) - rotated 180 to be upright
        return (
          <>
            <mesh>
              <boxGeometry args={[0.14, 0.07, 0.02]} />
              <meshBasicMaterial color={color} />
            </mesh>
            <Text
              position={[0, 0, 0.015]}
              fontSize={0.04}
              color="#000000"
              anchorX="center"
              anchorY="middle"
              rotation={[0, 0, Math.PI]}
            >
              緊急
            </Text>
          </>
        );

      case IncidentType.MILITARY:
        // TARGET RETICLE - locked to surface
        return (
          <>
            {/* Outer ring */}
            <mesh>
              <torusGeometry args={[0.08, 0.006, 8, 24]} />
              <meshBasicMaterial color={color} />
            </mesh>
            {/* Inner ring */}
            <mesh>
              <torusGeometry args={[0.05, 0.005, 8, 20]} />
              <meshBasicMaterial color={color} />
            </mesh>
            {/* Crosshairs */}
            <mesh>
              <boxGeometry args={[0.16, 0.01, 0.01]} />
              <meshBasicMaterial color={color} />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <boxGeometry args={[0.16, 0.01, 0.01]} />
              <meshBasicMaterial color={color} />
            </mesh>
            {/* Corner brackets */}
            <mesh position={[0.06, 0.06, 0]}>
              <boxGeometry args={[0.02, 0.006, 0.006]} />
              <meshBasicMaterial color={color} />
            </mesh>
            <mesh position={[0.06, 0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
              <boxGeometry args={[0.02, 0.006, 0.006]} />
              <meshBasicMaterial color={color} />
            </mesh>
            <mesh position={[-0.06, 0.06, 0]}>
              <boxGeometry args={[0.02, 0.006, 0.006]} />
              <meshBasicMaterial color={color} />
            </mesh>
            <mesh position={[-0.06, 0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
              <boxGeometry args={[0.02, 0.006, 0.006]} />
              <meshBasicMaterial color={color} />
            </mesh>
          </>
        );

      case IncidentType.AIRLINE:
        // 3D AIRPLANE with wings and tail
        return (
          <group ref={rotateRef}>
            {/* Fuselage */}
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.012, 0.008, 0.1, 8]} />
              <meshBasicMaterial color={color} />
            </mesh>
            {/* Wings */}
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <boxGeometry args={[0.14, 0.015, 0.003]} />
              <meshBasicMaterial color={color} />
            </mesh>
            {/* Tail fin */}
            <mesh position={[-0.04, 0.025, 0]} rotation={[0, 0, Math.PI / 3]}>
              <boxGeometry args={[0.03, 0.012, 0.003]} />
              <meshBasicMaterial color={color} />
            </mesh>
            {/* Horizontal stabilizer */}
            <mesh position={[-0.04, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <boxGeometry args={[0.05, 0.01, 0.003]} />
              <meshBasicMaterial color={color} />
            </mesh>
          </group>
        );

      case IncidentType.CONFLICT:
      case IncidentType.PROTEST:
        // WARNING TRIANGLE with exclamation symbol
        return (
          <>
            {/* Outer triangle */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.09, 0.02, 3]} />
              <meshBasicMaterial color={color} />
            </mesh>
            {/* Inner black triangle for contrast */}
            <mesh rotation={[Math.PI / 2, 0, Math.PI]} position={[0, 0.015, 0]}>
              <coneGeometry args={[0.07, 0.015, 3]} />
              <meshBasicMaterial color={0x000000} />
            </mesh>
            {/* Exclamation mark - using text symbol */}
            <Text
              position={[0, 0.02, 0]}
              fontSize={0.08}
              color={color}
              anchorX="center"
              anchorY="middle"
            >
              !
            </Text>
          </>
        );

      case IncidentType.WEATHER:
        // LIGHTNING BOLT SYMBOL
        return (
          <Text
            position={[0, 0, 0]}
            fontSize={0.12}
            color={color}
            anchorX="center"
            anchorY="middle"
          >
            ⚡
          </Text>
        );

      case IncidentType.TRAFFIC:
        // OCTAGON STOP SIGN
        return (
          <>
            <mesh>
              <cylinderGeometry args={[0.08, 0.08, 0.02, 8]} />
              <meshBasicMaterial color={color} />
            </mesh>
            <mesh position={[0, 0, 0.015]}>
              <cylinderGeometry args={[0.06, 0.06, 0.015, 8]} />
              <meshBasicMaterial color={0x000000} />
            </mesh>
            <Text
              position={[0, 0, 0.02]}
              fontSize={0.045}
              color={color}
              anchorX="center"
              anchorY="middle"
            >
              ⬢
            </Text>
          </>
        );

      case IncidentType.MARITIME:
        // ANCHOR SYMBOL (rotated 180 to be upright)
        return (
          <Text
            position={[0, 0, 0]}
            fontSize={0.12}
            color={color}
            anchorX="center"
            anchorY="middle"
            rotation={[0, 0, Math.PI]}
          >
            ⚓
          </Text>
        );

      case IncidentType.POLITICAL:
        // BALANCE/SCALES SYMBOL (rotated 180 to be upright)
        return (
          <Text
            position={[0, 0, 0]}
            fontSize={0.12}
            color={color}
            anchorX="center"
            anchorY="middle"
            rotation={[0, 0, Math.PI]}
          >
            ⚖
          </Text>
        );

      case IncidentType.ADVISORY:
        // EXCLAMATION MARK (rotated 180 to be upright)
        return (
          <Text
            position={[0, 0, 0]}
            fontSize={0.12}
            color={color}
            anchorX="center"
            anchorY="middle"
            rotation={[0, 0, Math.PI]}
          >
            !
          </Text>
        );

      default:
        // SMALL DOT/PIP for other types
        return (
          <mesh>
            <sphereGeometry args={[0.03, 12, 12]} />
            <meshBasicMaterial color={color} />
          </mesh>
        );
    }
  };

  return (
    <group
      ref={markerRef}
      position={[position.x, position.y, position.z]}
      onClick={onClick}
    >
      {/* Base pulsing ring */}
      <group ref={pulseRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.05, 0.002, 8, 24]} />
          <meshBasicMaterial
            color={color}
            transparent={true}
            opacity={0.5}
          />
        </mesh>
      </group>

      {/* Type-specific marker shape */}
      {renderMarkerShape()}

      {/* Extra ring for CRITICAL */}
      {incident.severity === IncidentSeverity.CRITICAL && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.07, 0.002, 8, 24]} />
          <meshBasicMaterial
            color={color}
            transparent={true}
            opacity={0.4}
          />
        </mesh>
      )}
    </group>
  );
}
