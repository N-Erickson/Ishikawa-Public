import { Incident, IncidentSeverity, IncidentType } from '../types';

interface NOAAAlertFeature {
  id: string;
  type: string;
  properties: {
    '@id': string;
    '@type': string;
    id: string;
    areaDesc: string;
    geocode: {
      SAME: string[];
      UGC: string[];
    };
    affectedZones: string[];
    references: any[];
    sent: string;
    effective: string;
    onset: string;
    expires: string;
    ends: string | null;
    status: string;
    messageType: string;
    category: string;
    severity: string;
    certainty: string;
    urgency: string;
    event: string;
    sender: string;
    senderName: string;
    headline: string | null;
    description: string;
    instruction: string | null;
    response: string;
    parameters: any;
  };
  geometry: {
    type: string;
    coordinates: number[][][];
  } | null;
}

interface NOAAResponse {
  '@context': any;
  type: string;
  features: NOAAAlertFeature[];
  title: string;
  updated: string;
}

function mapNOAASeverity(severity: string): IncidentSeverity {
  switch (severity?.toLowerCase()) {
    case 'extreme':
      return IncidentSeverity.CRITICAL;
    case 'severe':
      return IncidentSeverity.HIGH;
    case 'moderate':
      return IncidentSeverity.MEDIUM;
    default:
      return IncidentSeverity.LOW;
  }
}

// State abbreviation to coordinates mapping (UGC codes use 2-letter state codes)
const STATE_COORDS: { [key: string]: { lat: number; lon: number } } = {
  'AL': { lat: 32.806671, lon: -86.791130 },
  'AK': { lat: 61.370716, lon: -152.404419 },
  'AZ': { lat: 33.729759, lon: -111.431221 },
  'AR': { lat: 34.969704, lon: -92.373123 },
  'CA': { lat: 36.116203, lon: -119.681564 },
  'CO': { lat: 39.059811, lon: -105.311104 },
  'CT': { lat: 41.597782, lon: -72.755371 },
  'DE': { lat: 39.318523, lon: -75.507141 },
  'FL': { lat: 27.766279, lon: -81.686783 },
  'GA': { lat: 33.040619, lon: -83.643074 },
  'HI': { lat: 21.094318, lon: -157.498337 },
  'ID': { lat: 44.240459, lon: -114.478828 },
  'IL': { lat: 40.349457, lon: -88.986137 },
  'IN': { lat: 39.849426, lon: -86.258278 },
  'IA': { lat: 42.011539, lon: -93.210526 },
  'KS': { lat: 38.526600, lon: -96.726486 },
  'KY': { lat: 37.668140, lon: -84.670067 },
  'LA': { lat: 31.169546, lon: -91.867805 },
  'ME': { lat: 44.693947, lon: -69.381927 },
  'MD': { lat: 39.063946, lon: -76.802101 },
  'MA': { lat: 42.230171, lon: -71.530106 },
  'MI': { lat: 43.326618, lon: -84.536095 },
  'MN': { lat: 45.694454, lon: -93.900192 },
  'MS': { lat: 32.741646, lon: -89.678696 },
  'MO': { lat: 38.456085, lon: -92.288368 },
  'MT': { lat: 46.921925, lon: -110.454353 },
  'NE': { lat: 41.125370, lon: -98.268082 },
  'NV': { lat: 38.313515, lon: -117.055374 },
  'NH': { lat: 43.452492, lon: -71.563896 },
  'NJ': { lat: 40.298904, lon: -74.521011 },
  'NM': { lat: 34.840515, lon: -106.248482 },
  'NY': { lat: 42.165726, lon: -74.948051 },
  'NC': { lat: 35.630066, lon: -79.806419 },
  'ND': { lat: 47.528912, lon: -99.784012 },
  'OH': { lat: 40.388783, lon: -82.764915 },
  'OK': { lat: 35.565342, lon: -96.928917 },
  'OR': { lat: 44.572021, lon: -122.070938 },
  'PA': { lat: 40.590752, lon: -77.209755 },
  'RI': { lat: 41.680893, lon: -71.511780 },
  'SC': { lat: 33.856892, lon: -80.945007 },
  'SD': { lat: 44.299782, lon: -99.438828 },
  'TN': { lat: 35.747845, lon: -86.692345 },
  'TX': { lat: 31.054487, lon: -97.563461 },
  'UT': { lat: 40.150032, lon: -111.862434 },
  'VT': { lat: 44.045876, lon: -72.710686 },
  'VA': { lat: 37.769337, lon: -78.169968 },
  'WA': { lat: 47.400902, lon: -121.490494 },
  'WV': { lat: 38.491226, lon: -80.954453 },
  'WI': { lat: 44.268543, lon: -89.616508 },
  'WY': { lat: 42.755966, lon: -107.302490 },
};

// Rough geocoding for US states/areas mentioned in NOAA alerts
const US_LOCATION_COORDS: { [key: string]: { lat: number; lon: number } } = {
  // States
  'alabama': { lat: 32.806671, lon: -86.791130 },
  'alaska': { lat: 61.370716, lon: -152.404419 },
  'arizona': { lat: 33.729759, lon: -111.431221 },
  'arkansas': { lat: 34.969704, lon: -92.373123 },
  'california': { lat: 36.116203, lon: -119.681564 },
  'colorado': { lat: 39.059811, lon: -105.311104 },
  'connecticut': { lat: 41.597782, lon: -72.755371 },
  'delaware': { lat: 39.318523, lon: -75.507141 },
  'florida': { lat: 27.766279, lon: -81.686783 },
  'georgia': { lat: 33.040619, lon: -83.643074 },
  'hawaii': { lat: 21.094318, lon: -157.498337 },
  'idaho': { lat: 44.240459, lon: -114.478828 },
  'illinois': { lat: 40.349457, lon: -88.986137 },
  'indiana': { lat: 39.849426, lon: -86.258278 },
  'iowa': { lat: 42.011539, lon: -93.210526 },
  'kansas': { lat: 38.526600, lon: -96.726486 },
  'kentucky': { lat: 37.668140, lon: -84.670067 },
  'louisiana': { lat: 31.169546, lon: -91.867805 },
  'maine': { lat: 44.693947, lon: -69.381927 },
  'maryland': { lat: 39.063946, lon: -76.802101 },
  'massachusetts': { lat: 42.230171, lon: -71.530106 },
  'michigan': { lat: 43.326618, lon: -84.536095 },
  'minnesota': { lat: 45.694454, lon: -93.900192 },
  'mississippi': { lat: 32.741646, lon: -89.678696 },
  'missouri': { lat: 38.456085, lon: -92.288368 },
  'montana': { lat: 46.921925, lon: -110.454353 },
  'nebraska': { lat: 41.125370, lon: -98.268082 },
  'nevada': { lat: 38.313515, lon: -117.055374 },
  'new hampshire': { lat: 43.452492, lon: -71.563896 },
  'new jersey': { lat: 40.298904, lon: -74.521011 },
  'new mexico': { lat: 34.840515, lon: -106.248482 },
  'new york': { lat: 42.165726, lon: -74.948051 },
  'north carolina': { lat: 35.630066, lon: -79.806419 },
  'north dakota': { lat: 47.528912, lon: -99.784012 },
  'ohio': { lat: 40.388783, lon: -82.764915 },
  'oklahoma': { lat: 35.565342, lon: -96.928917 },
  'oregon': { lat: 44.572021, lon: -122.070938 },
  'pennsylvania': { lat: 40.590752, lon: -77.209755 },
  'rhode island': { lat: 41.680893, lon: -71.511780 },
  'south carolina': { lat: 33.856892, lon: -80.945007 },
  'south dakota': { lat: 44.299782, lon: -99.438828 },
  'tennessee': { lat: 35.747845, lon: -86.692345 },
  'texas': { lat: 31.054487, lon: -97.563461 },
  'utah': { lat: 40.150032, lon: -111.862434 },
  'vermont': { lat: 44.045876, lon: -72.710686 },
  'virginia': { lat: 37.769337, lon: -78.169968 },
  'washington': { lat: 47.400902, lon: -121.490494 },
  'west virginia': { lat: 38.491226, lon: -80.954453 },
  'wisconsin': { lat: 44.268543, lon: -89.616508 },
  'wyoming': { lat: 42.755966, lon: -107.302490 },
  // Major cities
  'new york city': { lat: 40.7128, lon: -74.0060 },
  'los angeles': { lat: 34.0522, lon: -118.2437 },
  'chicago': { lat: 41.8781, lon: -87.6298 },
  'houston': { lat: 29.7604, lon: -95.3698 },
  'phoenix': { lat: 33.4484, lon: -112.0740 },
  'philadelphia': { lat: 39.9526, lon: -75.1652 },
  'san antonio': { lat: 29.4241, lon: -98.4936 },
  'san diego': { lat: 32.7157, lon: -117.1611 },
  'dallas': { lat: 32.7767, lon: -96.7970 },
  'seattle': { lat: 47.6062, lon: -122.3321 },
  'boston': { lat: 42.3601, lon: -71.0589 },
  'miami': { lat: 25.7617, lon: -80.1918 },
  'atlanta': { lat: 33.7490, lon: -84.3880 },
  'denver': { lat: 39.7392, lon: -104.9903 },
  'portland': { lat: 45.5152, lon: -122.6784 },
  'las vegas': { lat: 36.1699, lon: -115.1398 },
};

function getCoordinatesFromGeometry(
  geometry: any,
  areaDesc: string,
  ugcCodes: string[]
): { lat: number; lon: number } {
  // Try to extract from geometry first
  if (geometry && geometry.coordinates && geometry.coordinates.length > 0) {
    const coords = geometry.coordinates[0];
    if (Array.isArray(coords) && coords.length > 0) {
      const point = Array.isArray(coords[0]) ? coords[0] : coords;
      return {
        lon: point[0],
        lat: point[1],
      };
    }
  }

  // Try to extract state from UGC codes (e.g., "NMZ123" → "NM" → New Mexico)
  if (ugcCodes && ugcCodes.length > 0) {
    for (const ugc of ugcCodes) {
      if (ugc && ugc.length >= 2) {
        const stateCode = ugc.substring(0, 2).toUpperCase();
        if (STATE_COORDS[stateCode]) {
          console.log(`✓ Geocoded via UGC "${ugc}" → ${stateCode} (${STATE_COORDS[stateCode].lat}, ${STATE_COORDS[stateCode].lon})`);
          return STATE_COORDS[stateCode];
        }
      }
    }
  }

  // Fallback: try to geocode from areaDesc
  if (areaDesc) {
    const lowerArea = areaDesc.toLowerCase();
    // Check for state or city matches
    for (const [location, coords] of Object.entries(US_LOCATION_COORDS)) {
      if (lowerArea.includes(location)) {
        console.log(`✓ Geocoded via areaDesc "${areaDesc}" → ${location} (${coords.lat}, ${coords.lon})`);
        return coords;
      }
    }
    console.warn(`⚠️ No geocode match for: "${areaDesc}"`);
  }

  // Default to center of US if no coordinates found
  console.warn(`⚠️ Using default coords for: "${areaDesc || 'unknown'}"`);
  return { lat: 39.8283, lon: -98.5795 };
}

// Fetch USA weather alerts from NOAA
export async function fetchWeatherAlerts(): Promise<Incident[]> {
  try {
    const response = await fetch('https://api.weather.gov/alerts/active');

    if (!response.ok) {
      throw new Error(`NOAA API error: ${response.status}`);
    }

    const data: NOAAResponse = await response.json();

    // Filter for significant alerts and limit to 20
    const significantAlerts = data.features
      .filter((alert) =>
        ['Extreme', 'Severe', 'Moderate'].includes(alert.properties.severity)
      )
      .slice(0, 20);

    return significantAlerts.map((alert) => {
      const coords = getCoordinatesFromGeometry(
        alert.geometry,
        alert.properties.areaDesc,
        alert.properties.geocode?.UGC || []
      );

      return {
        id: `weather-${alert.id}`,
        title: alert.properties.event || 'Weather Alert',
        description:
          alert.properties.headline ||
          alert.properties.description?.substring(0, 200) ||
          'Weather alert in effect',
        type: IncidentType.WEATHER,
        severity: mapNOAASeverity(alert.properties.severity),
        location: coords,
        locationName: alert.properties.areaDesc || 'Unknown area',
        timestamp: new Date(alert.properties.effective || alert.properties.sent),
        source: 'NOAA National Weather Service',
      };
    });
  } catch (error) {
    console.error('Error fetching weather alerts:', error);
    return [];
  }
}

// Fetch global weather alerts from major populated areas worldwide
// Using MeteoAlarm RSS feeds for Europe and specific lat/lon queries for major global cities
export async function fetchGlobalWeatherAlerts(): Promise<Incident[]> {
  const incidents: Incident[] = [];

  // Major global cities to check for weather alerts (covering all continents)
  const globalCities = [
    { name: 'Tokyo, Japan', lat: 35.6762, lon: 139.6503 },
    { name: 'Delhi, India', lat: 28.7041, lon: 77.1025 },
    { name: 'Shanghai, China', lat: 31.2304, lon: 121.4737 },
    { name: 'Mumbai, India', lat: 19.0760, lon: 72.8777 },
    { name: 'Beijing, China', lat: 39.9042, lon: 116.4074 },
    { name: 'Dhaka, Bangladesh', lat: 23.8103, lon: 90.4125 },
    { name: 'Karachi, Pakistan', lat: 24.8607, lon: 67.0011 },
    { name: 'Istanbul, Turkey', lat: 41.0082, lon: 28.9784 },
    { name: 'Lagos, Nigeria', lat: 6.5244, lon: 3.3792 },
    { name: 'Manila, Philippines', lat: 14.5995, lon: 120.9842 },
    { name: 'Rio de Janeiro, Brazil', lat: -22.9068, lon: -43.1729 },
    { name: 'Cairo, Egypt', lat: 30.0444, lon: 31.2357 },
    { name: 'Moscow, Russia', lat: 55.7558, lon: 37.6173 },
    { name: 'Bangkok, Thailand', lat: 13.7563, lon: 100.5018 },
    { name: 'London, UK', lat: 51.5074, lon: -0.1278 },
    { name: 'Paris, France', lat: 48.8566, lon: 2.3522 },
    { name: 'Jakarta, Indonesia', lat: -6.2088, lon: 106.8456 },
    { name: 'Seoul, South Korea', lat: 37.5665, lon: 126.9780 },
    { name: 'Mexico City, Mexico', lat: 19.4326, lon: -99.1332 },
    { name: 'Lima, Peru', lat: -12.0464, lon: -77.0428 },
  ];

  // Fetch weather for each city using Open-Meteo (free, no API key needed)
  const promises = globalCities.map(async (city) => {
    try {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,weathercode&timezone=auto`
      );

      if (!response.ok) return null;
      const data = await response.json();

      // Weather codes that indicate severe weather (50-99 are precipitation/storms)
      const weatherCode = data.current?.weathercode;
      const isSevere = weatherCode >= 50; // Rain, snow, thunderstorms, etc.

      if (isSevere) {
        const weatherDescriptions: { [key: number]: string } = {
          51: 'Light Drizzle', 53: 'Moderate Drizzle', 55: 'Dense Drizzle',
          61: 'Light Rain', 63: 'Moderate Rain', 65: 'Heavy Rain',
          71: 'Light Snow', 73: 'Moderate Snow', 75: 'Heavy Snow',
          77: 'Snow Grains', 80: 'Light Rain Showers', 81: 'Moderate Rain Showers',
          82: 'Violent Rain Showers', 85: 'Light Snow Showers', 86: 'Heavy Snow Showers',
          95: 'Thunderstorm', 96: 'Thunderstorm with Hail', 99: 'Severe Thunderstorm with Hail'
        };

        return {
          id: `global-weather-${city.name.replace(/[^a-z0-9]/gi, '-')}-${Date.now()}`,
          title: `${weatherDescriptions[weatherCode] || 'Severe Weather'} - ${city.name}`,
          description: `Current conditions: ${weatherDescriptions[weatherCode] || 'Active weather event'}`,
          type: IncidentType.WEATHER,
          severity: weatherCode >= 80 ? IncidentSeverity.HIGH : IncidentSeverity.MEDIUM,
          location: { lat: city.lat, lon: city.lon },
          locationName: city.name,
          timestamp: new Date(),
          source: 'Open-Meteo Global Weather',
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  });

  const results = await Promise.allSettled(promises);
  results.forEach(result => {
    if (result.status === 'fulfilled' && result.value) {
      incidents.push(result.value);
    }
  });

  console.log(`Global Weather (20 major cities): ${incidents.length} active weather events`);
  return incidents;
}
