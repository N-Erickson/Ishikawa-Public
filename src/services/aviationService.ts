import { Incident, IncidentSeverity, IncidentType } from '../types';

// Using OpenSky Network - completely free, no API key required
// Provides real-time aircraft position data

interface OpenSkyState {
  icao24: string;
  callsign: string | null;
  origin_country: string;
  time_position: number | null;
  last_contact: number;
  longitude: number | null;
  latitude: number | null;
  baro_altitude: number | null;
  on_ground: boolean;
  velocity: number | null;
  true_track: number | null;
  vertical_rate: number | null;
  sensors: number[] | null;
  geo_altitude: number | null;
  squawk: string | null;
  spi: boolean;
  position_source: number;
}

interface OpenSkyResponse {
  time: number;
  states: OpenSkyState[] | null;
}

// Emergency squawk codes that indicate incidents
const EMERGENCY_SQUAWKS = {
  '7500': 'Aircraft Hijacking',
  '7600': 'Radio Communication Failure',
  '7700': 'General Emergency',
};

export async function fetchAviationIncidents(): Promise<Incident[]> {
  try {
    // OpenSky Network API - free, no key required
    const response = await fetch('https://opensky-network.org/api/states/all');

    if (!response.ok) {
      throw new Error(`OpenSky API error: ${response.status}`);
    }

    const data: OpenSkyResponse = await response.json();

    if (!data.states) {
      return [];
    }

    const incidents: Incident[] = [];

    // Check for emergency squawk codes
    data.states.forEach((state) => {
      if (
        state.squawk &&
        state.squawk in EMERGENCY_SQUAWKS &&
        state.latitude &&
        state.longitude
      ) {
        incidents.push({
          id: `aviation-${state.icao24}-${Date.now()}`,
          title: `Aircraft Emergency: ${EMERGENCY_SQUAWKS[state.squawk as keyof typeof EMERGENCY_SQUAWKS]}`,
          description: `Flight ${state.callsign?.trim() || 'Unknown'} from ${state.origin_country} squawking ${state.squawk}`,
          type: IncidentType.AIRLINE,
          severity: IncidentSeverity.CRITICAL,
          location: {
            lat: state.latitude,
            lon: state.longitude,
          },
          locationName: `Airspace over ${state.origin_country}`,
          timestamp: new Date(state.last_contact * 1000),
          source: 'OpenSky Network',
        });
      }
    });

    // If no emergencies, create incidents for unusual patterns
    // (very low altitude over populated areas, unusual speeds, etc.)
    if (incidents.length === 0) {
      const unusualFlights = data.states
        .filter(
          (state) =>
            state.latitude &&
            state.longitude &&
            state.baro_altitude !== null &&
            state.baro_altitude < 500 && // Very low altitude
            !state.on_ground &&
            state.velocity !== null &&
            state.velocity > 50 // Moving (not parked)
        )
        .slice(0, 3); // Limit to 3

      unusualFlights.forEach((state) => {
        incidents.push({
          id: `aviation-low-${state.icao24}`,
          title: `Low Altitude Flight Alert`,
          description: `Aircraft ${state.callsign?.trim() || state.icao24} flying at unusually low altitude (${Math.round(state.baro_altitude! * 3.28084)} ft)`,
          type: IncidentType.AIRLINE,
          severity: IncidentSeverity.MEDIUM,
          location: {
            lat: state.latitude!,
            lon: state.longitude!,
          },
          locationName: `${state.origin_country} airspace`,
          timestamp: new Date(state.last_contact * 1000),
          source: 'OpenSky Network',
        });
      });
    }

    return incidents;
  } catch (error) {
    console.error('Error fetching aviation incidents:', error);
    return [];
  }
}

// FAA NOTAM (Notices to Airmen) - Public data
export async function fetchFAANotams(): Promise<Incident[]> {
  try {
    // FAA provides public NOTAM data
    // Note: Direct API access may require coordination with FAA
    // This is a placeholder for the structure
    console.log('FAA NOTAM: Public feed available through FAA website scraping or official channels');
    return [];
  } catch (error) {
    console.error('Error fetching FAA NOTAMs:', error);
    return [];
  }
}
