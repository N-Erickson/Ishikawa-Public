import { Incident, IncidentSeverity, IncidentType } from '../types';

// OpenAQ - Open Air Quality Data
// Provides global air quality measurements from government monitoring stations

interface AQMeasurement {
  location: string;
  city: string;
  country: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  measurements: Array<{
    parameter: string;
    value: number;
    unit: string;
  }>;
}

// Major cities to monitor for air quality
const MONITORED_CITIES = [
  { name: 'Beijing', lat: 39.9042, lon: 116.4074, country: 'CN' },
  { name: 'Delhi', lat: 28.7041, lon: 77.1025, country: 'IN' },
  { name: 'Mumbai', lat: 19.0760, lon: 72.8777, country: 'IN' },
  { name: 'Shanghai', lat: 31.2304, lon: 121.4737, country: 'CN' },
  { name: 'Seoul', lat: 37.5665, lon: 126.9780, country: 'KR' },
  { name: 'Jakarta', lat: -6.2088, lon: 106.8456, country: 'ID' },
  { name: 'Manila', lat: 14.5995, lon: 120.9842, country: 'PH' },
  { name: 'Bangkok', lat: 13.7563, lon: 100.5018, country: 'TH' },
  { name: 'Los Angeles', lat: 34.0522, lon: -118.2437, country: 'US' },
  { name: 'Mexico City', lat: 19.4326, lon: -99.1332, country: 'MX' },
  { name: 'Cairo', lat: 30.0444, lon: 31.2357, country: 'EG' },
  { name: 'Lahore', lat: 31.5497, lon: 74.3436, country: 'PK' },
];

export async function fetchAirQuality(): Promise<Incident[]> {
  const incidents: Incident[] = [];

  try {
    // Using OpenWeatherMap Air Pollution API (free tier, no key for some endpoints)
    // Alternative: Use AQI data from WAQI.info (requires API key)

    // For now, we'll use Open-Meteo's air quality endpoint (free, no auth)
    const promises = MONITORED_CITIES.map(async (city) => {
      try {
        const response = await fetch(
          `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${city.lat}&longitude=${city.lon}&current=pm10,pm2_5,us_aqi&timezone=auto`
        );

        if (!response.ok) return null;

        const data = await response.json();
        const aqi = data.current?.us_aqi;
        const pm25 = data.current?.pm2_5;

        // Only report unhealthy or worse AQI (101+)
        if (aqi && aqi > 100) {
          let severity = IncidentSeverity.MEDIUM;
          let category = 'Unhealthy for Sensitive Groups';

          if (aqi > 300) {
            severity = IncidentSeverity.CRITICAL;
            category = 'Hazardous';
          } else if (aqi > 200) {
            severity = IncidentSeverity.HIGH;
            category = 'Very Unhealthy';
          } else if (aqi > 150) {
            severity = IncidentSeverity.HIGH;
            category = 'Unhealthy';
          }

          return {
            id: `airquality-${city.name.toLowerCase().replace(/\s/g, '-')}-${Date.now()}`,
            title: `Poor Air Quality: ${city.name}`,
            description: `${category} - AQI: ${Math.round(aqi)}, PM2.5: ${pm25?.toFixed(1) || 'N/A'} μg/m³`,
            type: IncidentType.ENVIRONMENTAL,
            severity,
            location: { lat: city.lat, lon: city.lon },
            locationName: `${city.name}, ${city.country}`,
            timestamp: new Date(),
            source: 'Open-Meteo Air Quality',
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

    console.log(`💨 Air Quality Alerts: ${incidents.length} cities with poor air quality`);
    return incidents;
  } catch (error) {
    console.error('Error fetching air quality data:', error);
    return [];
  }
}
