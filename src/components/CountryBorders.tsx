import { useEffect, useState } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { feature } from 'topojson-client';

// Component to render country borders on the globe
export function CountryBorders() {
  const [borders, setBorders] = useState<number[][][]>([]);

  useEffect(() => {
    // Fetch world atlas data
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(response => response.json())
      .then(topology => {
        // Convert TopoJSON to GeoJSON
        const geojson = feature(topology, topology.objects.countries);
        const borderPaths: number[][][] = [];

    // Convert GeoJSON coordinates to 3D sphere coordinates
    geojson.features.forEach((country) => {
      if (country.geometry.type === 'Polygon') {
        country.geometry.coordinates.forEach((ring) => {
          const points = ring.map(([lon, lat]) => latLonToVector3(lat, lon));
          borderPaths.push(points);
        });
      } else if (country.geometry.type === 'MultiPolygon') {
        country.geometry.coordinates.forEach((polygon) => {
          polygon.forEach((ring) => {
            const points = ring.map(([lon, lat]) => latLonToVector3(lat, lon));
            borderPaths.push(points);
          });
        });
      }
        });

        setBorders(borderPaths);
      })
      .catch(error => {
        console.error('Error loading country borders:', error);
      });
  }, []);

  return (
    <group>
      {borders.map((path, index) => {
        // Convert path to Vector3 array for Line component
        const points = path.map((p) => new THREE.Vector3(p[0], p[1], p[2]));

        return (
          <group key={index}>
            {/* Main border line - brighter and thicker */}
            <Line
              points={points}
              color="#00ff00"
              lineWidth={2}
              transparent
              opacity={0.7}
              depthTest={true}
              depthWrite={false}
            />
            {/* Glow effect - wider, dimmer line behind */}
            <Line
              points={points}
              color="#00ff00"
              lineWidth={4}
              transparent
              opacity={0.2}
              depthTest={true}
              depthWrite={false}
            />
          </group>
        );
      })}
    </group>
  );
}

// Convert lat/lon to 3D coordinates on sphere (slightly above surface)
function latLonToVector3(lat: number, lon: number, radius: number = 2.02): number[] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);

  return [x, y, z];
}
