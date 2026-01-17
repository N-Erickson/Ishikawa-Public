import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { IncidentSeverity } from '../../types';

interface MarkerBaseProps {
  color: number;
  severity: IncidentSeverity;
  children: React.ReactNode;
}

// Severity-based animation parameters
const severityParams = {
  [IncidentSeverity.LOW]: {
    pulseSpeed: 2,
    pulseIntensity: 0.15,
    beamHeight: 0.3,
    beamOpacity: 0.3,
  },
  [IncidentSeverity.MEDIUM]: {
    pulseSpeed: 3,
    pulseIntensity: 0.2,
    beamHeight: 0.5,
    beamOpacity: 0.4,
  },
  [IncidentSeverity.HIGH]: {
    pulseSpeed: 4,
    pulseIntensity: 0.25,
    beamHeight: 0.7,
    beamOpacity: 0.5,
  },
  [IncidentSeverity.CRITICAL]: {
    pulseSpeed: 5,
    pulseIntensity: 0.3,
    beamHeight: 1.0,
    beamOpacity: 0.6,
  },
};

export function MarkerBase({ color, severity, children }: MarkerBaseProps) {
  const pulseRef = useRef<THREE.Group>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  const params = severityParams[severity];

  useFrame((state) => {
    const time = state.clock.elapsedTime;

    // Pulse animation
    if (pulseRef.current) {
      const scale = 1 + Math.sin(time * params.pulseSpeed) * params.pulseIntensity;
      pulseRef.current.scale.set(scale, scale, scale);
    }

    // Beam glow animation
    if (beamRef.current && beamRef.current.material) {
      const material = beamRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = params.beamOpacity + Math.sin(time * params.pulseSpeed) * 0.2;
    }
  });

  return (
    <>
      {/* Pulsing elements group */}
      <group ref={pulseRef}>
        {children}
      </group>

      {/* Vertical beam of light */}
      <mesh ref={beamRef} position={[0, params.beamHeight / 2, 0]}>
        <cylinderGeometry args={[0.01, 0.02, params.beamHeight, 8]} />
        <meshBasicMaterial
          color={color}
          transparent={true}
          opacity={params.beamOpacity}
        />
      </mesh>

      {/* Ground ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <ringGeometry args={[0.08, 0.12, 32]} />
        <meshBasicMaterial
          color={color}
          transparent={true}
          opacity={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  );
}
