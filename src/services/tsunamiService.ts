import { Incident, IncidentSeverity, IncidentType } from '../types';

// NOAA Tsunami Warning System
// Pacific Tsunami Warning Center (PTWC) provides global tsunami alerts

interface TsunamiMessage {
  properties: {
    identifier: string;
    sender: string;
    sent: string;
    effective: string;
    expires: string;
    messageType: string;
    event: string;
    headline: string;
    description: string;
    instruction: string | null;
    web: string;
    contact: string;
    parameters: {
      VTEC?: string[];
      EAS_ORG?: string[];
    };
  };
  geometry: {
    type: string;
    coordinates: number[][] | number[][][];
  } | null;
}

export async function fetchTsunamiWarnings(): Promise<Incident[]> {
  try {
    // NOAA CAP feed for tsunami messages
    const response = await fetch(
      'https://api.weather.gov/alerts/active?event=Tsunami'
    );

    if (!response.ok) {
      console.warn('Tsunami API returned status:', response.status);
      return [];
    }

    const data = await response.json();
    const incidents: Incident[] = [];

    if (!data.features || data.features.length === 0) {
      console.log('🌊 Tsunami Warnings: No active warnings');
      return [];
    }

    data.features.forEach((feature: any) => {
      const props = feature.properties;

      // Extract coordinates from geometry or use default Pacific location
      let lat = 20.0; // Default to Pacific Ocean
      let lon = -155.0;

      if (feature.geometry && feature.geometry.coordinates) {
        const coords = feature.geometry.coordinates;
        // Handle different geometry types
        if (Array.isArray(coords[0])) {
          if (Array.isArray(coords[0][0])) {
            // Polygon
            lon = coords[0][0][0];
            lat = coords[0][0][1];
          } else {
            // LineString
            lon = coords[0][0];
            lat = coords[0][1];
          }
        }
      }

      // Determine severity from event type
      let severity = IncidentSeverity.CRITICAL;
      if (props.event?.toLowerCase().includes('watch')) {
        severity = IncidentSeverity.HIGH;
      } else if (props.event?.toLowerCase().includes('advisory')) {
        severity = IncidentSeverity.MEDIUM;
      }

      incidents.push({
        id: `tsunami-${props.identifier}`,
        title: props.event || 'Tsunami Alert',
        description: props.headline || props.description?.substring(0, 200) || 'Tsunami warning in effect',
        type: IncidentType.TSUNAMI,
        severity,
        location: { lat, lon },
        locationName: props.areaDesc || 'Pacific Ocean',
        timestamp: new Date(props.effective || props.sent),
        source: 'NOAA Tsunami Warning Center',
      });
    });

    console.log(`🌊 Tsunami Warnings: ${incidents.length} active alerts`);
    return incidents;
  } catch (error) {
    console.error('Error fetching tsunami warnings:', error);
    return [];
  }
}
