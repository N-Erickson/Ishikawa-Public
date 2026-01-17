import { Incident, IncidentSeverity, IncidentType } from '../types';

interface USGSFeature {
  id: string;
  properties: {
    mag: number;
    place: string;
    time: number;
    updated: number;
    tz: number | null;
    url: string;
    detail: string;
    felt: number | null;
    cdi: number | null;
    mmi: number | null;
    alert: string | null;
    status: string;
    tsunami: number;
    sig: number;
    net: string;
    code: string;
    ids: string;
    sources: string;
    types: string;
    nst: number | null;
    dmin: number | null;
    rms: number;
    gap: number | null;
    magType: string;
    type: string;
    title: string;
  };
  geometry: {
    type: string;
    coordinates: [number, number, number];
  };
}

interface USGSResponse {
  type: string;
  metadata: {
    generated: number;
    url: string;
    title: string;
    status: number;
    api: string;
    count: number;
  };
  features: USGSFeature[];
}

function mapEarthquakeSeverity(magnitude: number): IncidentSeverity {
  if (magnitude >= 7.0) return IncidentSeverity.CRITICAL;
  if (magnitude >= 6.0) return IncidentSeverity.HIGH;
  if (magnitude >= 5.0) return IncidentSeverity.MEDIUM;
  return IncidentSeverity.LOW;
}

export async function fetchEarthquakes(): Promise<Incident[]> {
  try {
    const response = await fetch(
      'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=4.0&orderby=time&limit=20'
    );

    if (!response.ok) {
      throw new Error(`USGS API error: ${response.status}`);
    }

    const data: USGSResponse = await response.json();

    return data.features.map((quake) => ({
      id: `earthquake-${quake.id}`,
      title: `M${quake.properties.mag.toFixed(1)} Earthquake`,
      description: quake.properties.title,
      type: IncidentType.EMERGENCY,
      severity: mapEarthquakeSeverity(quake.properties.mag),
      location: {
        lat: quake.geometry.coordinates[1],
        lon: quake.geometry.coordinates[0],
      },
      locationName: quake.properties.place,
      timestamp: new Date(quake.properties.time),
      source: 'USGS Earthquake Hazards Program',
    }));
  } catch (error) {
    console.error('Error fetching earthquakes:', error);
    return [];
  }
}
