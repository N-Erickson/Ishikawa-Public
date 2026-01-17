import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere } from '@react-three/drei';
import * as THREE from 'three';

interface HolographicGlobeProps {
  rotation?: [number, number, number];
  autoRotate?: boolean;
}

export function HolographicGlobe({ rotation = [0, 0, 0], autoRotate = true }: HolographicGlobeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const gridRef = useRef<THREE.LineSegments>(null);

  // Create holographic grid material
  const holographicMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: 0x001100, // Very dark green for maximum opacity
      wireframe: false,
      transparent: true,
      opacity: 0.85, // Nearly solid to block back-side borders
      side: THREE.FrontSide, // Only render front faces
      depthWrite: true, // Enable depth writing
    });
  }, []);

  // Create wireframe overlay
  const wireframeMaterial = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.4,
      linewidth: 1,
    });
  }, []);

  // Create latitude/longitude grid
  const gridGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const points = [];
    const segments = 32;
    const radius = 2.01; // Slightly larger than sphere to prevent z-fighting

    // Latitude lines
    for (let lat = -80; lat <= 80; lat += 20) {
      for (let i = 0; i <= segments; i++) {
        const lon = (i / segments) * Math.PI * 2;
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = lon;

        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.cos(phi);
        const z = radius * Math.sin(phi) * Math.sin(theta);

        points.push(x, y, z);
      }
    }

    // Longitude lines
    for (let lon = 0; lon < 360; lon += 20) {
      for (let i = 0; i <= segments; i++) {
        const lat = -90 + (i / segments) * 180;
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lon * Math.PI) / 180;

        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.cos(phi);
        const z = radius * Math.sin(phi) * Math.sin(theta);

        points.push(x, y, z);
      }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    return geometry;
  }, []);

  // Auto-rotate the globe
  useFrame((_state, delta) => {
    if (meshRef.current && autoRotate) {
      meshRef.current.rotation.y += delta * 0.1;
    }
    if (gridRef.current && autoRotate) {
      gridRef.current.rotation.y += delta * 0.1;
    }
  });

  return (
    <group rotation={rotation}>
      {/* Main sphere with holographic effect */}
      <Sphere ref={meshRef} args={[2, 64, 64]}>
        <primitive object={holographicMaterial} attach="material" />
      </Sphere>

      {/* Wireframe overlay */}
      <Sphere args={[2.005, 32, 32]}>
        <meshBasicMaterial
          color={0x00ff00}
          wireframe={true}
          transparent={true}
          opacity={0.2}
        />
      </Sphere>

      {/* Lat/Long grid */}
      <lineSegments ref={gridRef} geometry={gridGeometry}>
        <primitive object={wireframeMaterial} attach="material" />
      </lineSegments>

      {/* Glow effect */}
      <Sphere args={[2.2, 32, 32]}>
        <meshBasicMaterial
          color={0x00ff00}
          transparent={true}
          opacity={0.05}
          side={THREE.BackSide}
        />
      </Sphere>
    </group>
  );
}
