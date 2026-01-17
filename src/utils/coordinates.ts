import { Coordinates } from '../types';

// Convert latitude/longitude to 3D sphere coordinates
export function latLonToVector3(lat: number, lon: number, radius: number = 2) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);

  return { x, y, z };
}

// Calculate the camera position to look at a specific point on the globe
export function getCameraPosition(coords: Coordinates, distance: number = 5) {
  const { x, y, z } = latLonToVector3(coords.lat, coords.lon, distance);
  return [x, y, z] as [number, number, number];
}
