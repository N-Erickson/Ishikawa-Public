import { Incident, IncidentSeverity, IncidentType } from '../types';

// Real-time traffic incidents from Waze crowdsource data
// Major accidents, road closures, hazards

interface WazeAlert {
  uuid: string;
  location: {
    x: number; // longitude
    y: number; // latitude
  };
  type: string;
  subtype: string;
  reportDescription: string;
  reportRating: number;
  confidence: number;
  reliability: number;
  pubMillis: number;
}

export async function fetchTrafficIncidents(): Promise<Incident[]> {
  try {
    // Waze traffic data for major metro areas
    // Note: Waze API requires specific bounding boxes

    const incidents: Incident[] = [];

    // Major US cities bounding boxes
    const regions = [
      { name: 'Los Angeles', top: 34.3, bottom: 33.7, left: -118.7, right: -117.9 },
      { name: 'New York', top: 41.0, bottom: 40.5, left: -74.3, right: -73.7 },
      { name: 'Chicago', top: 42.1, bottom: 41.6, left: -88.0, right: -87.5 },
      { name: 'Houston', top: 30.1, bottom: 29.5, left: -95.8, right: -95.0 },
      { name: 'Phoenix', top: 33.8, bottom: 33.2, left: -112.3, right: -111.7 },
    ];

    for (const region of regions) {
      try {
        // Using Waze CARTO feed (public)
        const url = `/api/waze?top=${region.top}&bottom=${region.bottom}&left=${region.left}&right=${region.right}&types=alerts,jams`;

        const response = await fetch(url);
        if (!response.ok) continue;

        const data = await response.json();

        if (data.alerts) {
          data.alerts.slice(0, 5).forEach((alert: WazeAlert) => {
            // Only major incidents
            if (alert.type === 'ACCIDENT' || alert.type === 'ROAD_CLOSED' || alert.subtype === 'ACCIDENT_MAJOR') {
              incidents.push({
                id: `traffic-${alert.uuid}`,
                title: `Traffic Incident: ${alert.type.replace('_', ' ')}`,
                description: alert.reportDescription || `${alert.type} - ${alert.subtype}`,
                type: IncidentType.EMERGENCY,
                severity: alert.subtype?.includes('MAJOR') ? IncidentSeverity.HIGH : IncidentSeverity.MEDIUM,
                location: { lat: alert.location.y, lon: alert.location.x },
                locationName: region.name,
                timestamp: new Date(alert.pubMillis),
                source: 'Waze Crowdsource',
              });
            }
          });
        }
      } catch (error) {
        continue;
      }
    }

    if (incidents.length > 0) {
      console.log(`🚗 Traffic Incidents: ${incidents.length} major incidents`);
    }
    return incidents;
  } catch (error) {
    console.error('Error fetching traffic incidents:', error);
    return [];
  }
}
