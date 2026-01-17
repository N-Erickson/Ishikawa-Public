import { Incident } from '../types';

export interface Cluster {
  id: string;
  incidents: Incident[];
  location: { lat: number; lon: number };
  severity: string;
}

/**
 * Calculates the distance between two points on a sphere using the Haversine formula
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

/**
 * Clusters nearby incidents within a specified distance threshold
 * @param incidents - Array of incidents to cluster
 * @param thresholdKm - Distance threshold in kilometers for clustering (default: 200km)
 */
export function clusterIncidents(incidents: Incident[], thresholdKm: number = 200): (Incident | Cluster)[] {
  const clustered: (Incident | Cluster)[] = [];
  const processed = new Set<string>();

  incidents.forEach((incident) => {
    if (processed.has(incident.id)) return;

    // Find all nearby incidents
    const nearby: Incident[] = [incident];
    processed.add(incident.id);

    incidents.forEach((other) => {
      if (processed.has(other.id)) return;

      const distance = haversineDistance(
        incident.location.lat,
        incident.location.lon,
        other.location.lat,
        other.location.lon
      );

      if (distance <= thresholdKm) {
        nearby.push(other);
        processed.add(other.id);
      }
    });

    // If only one incident, add it directly
    if (nearby.length === 1) {
      clustered.push(incident);
    } else {
      // Create a cluster
      // Calculate centroid of all incidents
      const avgLat = nearby.reduce((sum, inc) => sum + inc.location.lat, 0) / nearby.length;
      const avgLon = nearby.reduce((sum, inc) => sum + inc.location.lon, 0) / nearby.length;

      // Determine highest severity in cluster
      const severities = ['low', 'medium', 'high', 'critical'];
      const highestSeverity = nearby.reduce((max, inc) => {
        const maxIndex = severities.indexOf(max);
        const incIndex = severities.indexOf(inc.severity);
        return incIndex > maxIndex ? inc.severity : max;
      }, 'low');

      clustered.push({
        id: `cluster-${nearby.map((i) => i.id).join('-')}`,
        incidents: nearby,
        location: { lat: avgLat, lon: avgLon },
        severity: highestSeverity,
      });
    }
  });

  return clustered;
}

/**
 * Type guard to check if an item is a cluster
 */
export function isCluster(item: Incident | Cluster): item is Cluster {
  return 'incidents' in item;
}
