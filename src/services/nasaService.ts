import { Incident, IncidentSeverity, IncidentType } from '../types';

interface EONETEvent {
  id: string;
  title: string;
  description: string | null;
  link: string;
  categories: Array<{
    id: string;
    title: string;
  }>;
  sources: Array<{
    id: string;
    url: string;
  }>;
  geometry: Array<{
    magnitudeValue: number | null;
    magnitudeUnit: string | null;
    date: string;
    type: string;
    coordinates: number[];
  }>;
}

interface EONETResponse {
  title: string;
  description: string;
  link: string;
  events: EONETEvent[];
}

function mapEONETCategory(categoryId: string): IncidentType {
  switch (categoryId) {
    case 'wildfires':
    case 'volcanoes':
      return IncidentType.EMERGENCY;
    case 'severeStorms':
    case 'snow':
    case 'floods':
    case 'drought':
    case 'dustHaze':
      return IncidentType.WEATHER;
    default:
      return IncidentType.OTHER;
  }
}

function mapEONETSeverity(categoryId: string): IncidentSeverity {
  switch (categoryId) {
    case 'wildfires':
    case 'volcanoes':
      return IncidentSeverity.HIGH;
    case 'severeStorms':
    case 'floods':
      return IncidentSeverity.HIGH;
    case 'snow':
    case 'drought':
      return IncidentSeverity.MEDIUM;
    default:
      return IncidentSeverity.MEDIUM;
  }
}

export async function fetchNASAEvents(): Promise<Incident[]> {
  try {
    const response = await fetch(
      'https://eonet.gsfc.nasa.gov/api/v3/events?days=7&limit=20'
    );

    if (!response.ok) {
      throw new Error(`NASA EONET API error: ${response.status}`);
    }

    const data: EONETResponse = await response.json();

    return data.events
      .filter((event) => event.geometry && event.geometry.length > 0)
      .map((event) => {
        // Get the most recent geometry point
        const geometry = event.geometry[event.geometry.length - 1];
        const category = event.categories[0];

        return {
          id: `nasa-${event.id}`,
          title: event.title,
          description:
            event.description || `${category.title} event detected by NASA EONET`,
          type: mapEONETCategory(category.id),
          severity: mapEONETSeverity(category.id),
          location: {
            lat: geometry.coordinates[1],
            lon: geometry.coordinates[0],
          },
          locationName: event.title,
          timestamp: new Date(geometry.date),
          source: 'NASA Earth Observatory',
        };
      });
  } catch (error) {
    console.error('Error fetching NASA EONET events:', error);
    return [];
  }
}
