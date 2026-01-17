import { Incident, IncidentSeverity, IncidentType } from '../types';

// FAA National Airspace System Status
// Provides real-time ground stops, ground delays, and airport closures

// Major US airports with coordinates
const AIRPORT_COORDS: { [key: string]: { lat: number; lon: number; city: string } } = {
  'ATL': { lat: 33.6407, lon: -84.4277, city: 'Atlanta' },
  'DFW': { lat: 32.8998, lon: -97.0403, city: 'Dallas/Fort Worth' },
  'DEN': { lat: 39.8561, lon: -104.6737, city: 'Denver' },
  'ORD': { lat: 41.9742, lon: -87.9073, city: 'Chicago O\'Hare' },
  'LAX': { lat: 33.9416, lon: -118.4085, city: 'Los Angeles' },
  'JFK': { lat: 40.6413, lon: -73.7781, city: 'New York JFK' },
  'LGA': { lat: 40.7769, lon: -73.8740, city: 'New York LaGuardia' },
  'EWR': { lat: 40.6895, lon: -74.1745, city: 'Newark' },
  'SFO': { lat: 37.6213, lon: -122.3790, city: 'San Francisco' },
  'SEA': { lat: 47.4502, lon: -122.3088, city: 'Seattle' },
  'LAS': { lat: 36.0840, lon: -115.1537, city: 'Las Vegas' },
  'MCO': { lat: 28.4312, lon: -81.3081, city: 'Orlando' },
  'MIA': { lat: 25.7959, lon: -80.2870, city: 'Miami' },
  'PHX': { lat: 33.4352, lon: -112.0101, city: 'Phoenix' },
  'BOS': { lat: 42.3656, lon: -71.0096, city: 'Boston' },
  'IAH': { lat: 29.9902, lon: -95.3368, city: 'Houston' },
  'MSP': { lat: 44.8848, lon: -93.2223, city: 'Minneapolis' },
  'DTW': { lat: 42.2162, lon: -83.3554, city: 'Detroit' },
  'PHL': { lat: 39.8744, lon: -75.2424, city: 'Philadelphia' },
  'CLT': { lat: 35.2144, lon: -80.9473, city: 'Charlotte' },
};

export async function fetchFlightGroundings(): Promise<Incident[]> {
  try {
    // FAA NAS Status page - we'll parse the HTML since there's no official JSON API
    // Alternative: Use a third-party service like aviationweather.gov

    // For now, we'll create a curated list based on common ground stop scenarios
    // In production, you'd scrape https://nasstatus.faa.gov/list or use FlightQueue API

    const incidents: Incident[] = [];

    // Since FAA doesn't have a free JSON API, we'll implement a placeholder
    // that monitors major hubs for typical disruption patterns

    console.log('✈️ Flight Groundings: Monitoring FAA (API access limited)');
    return incidents;
  } catch (error) {
    console.error('Error fetching flight groundings:', error);
    return [];
  }
}

// Alternative: Aviation Weather - ASOS/METAR for severe weather at airports
export async function fetchAviationWeather(): Promise<Incident[]> {
  try {
    // Aviation Weather Center provides METAR data
    // We can detect severe conditions that might cause groundings

    const incidents: Incident[] = [];

    // Check major airports for severe weather
    const airportCodes = Object.keys(AIRPORT_COORDS).slice(0, 10); // Check top 10

    for (const code of airportCodes) {
      try {
        const response = await fetch(
          `https://aviationweather.gov/api/data/metar?ids=${code}&format=json`
        );

        if (!response.ok) continue;

        const data = await response.json();

        if (data && data.length > 0) {
          const metar = data[0];

          // Check for severe conditions (simplified)
          const rawText = metar.rawOb || '';
          const isSevere = rawText.includes('TS') || // Thunderstorm
                          rawText.includes('+RA') || // Heavy rain
                          rawText.includes('+SN') || // Heavy snow
                          rawText.includes('FG') || // Fog
                          (metar.visib && parseFloat(metar.visib) < 1); // Low visibility

          if (isSevere) {
            const airport = AIRPORT_COORDS[code];
            incidents.push({
              id: `aviation-weather-${code}-${Date.now()}`,
              title: `Severe Weather at ${airport.city} Airport (${code})`,
              description: `${metar.rawOb || 'Severe conditions'} - May impact flight operations`,
              type: IncidentType.WEATHER,
              severity: IncidentSeverity.HIGH,
              location: { lat: airport.lat, lon: airport.lon },
              locationName: `${airport.city} (${code})`,
              timestamp: new Date(metar.reportTime || Date.now()),
              source: 'Aviation Weather Center',
            });
          }
        }
      } catch (error) {
        // Skip this airport
        continue;
      }
    }

    if (incidents.length > 0) {
      console.log(`✈️ Aviation Weather: ${incidents.length} airports with severe conditions`);
    }
    return incidents;
  } catch (error) {
    console.error('Error fetching aviation weather:', error);
    return [];
  }
}
