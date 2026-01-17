import { Incident, IncidentSeverity, IncidentType } from '../types';

// NOAA National Hurricane Center (NHC) active storms
// Provides real-time tropical storm and hurricane data

interface Storm {
  id: string;
  binNumber: number;
  name: string;
  classification: string;
  intensity: number;
  pressure: number;
  latitude: number;
  longitude: number;
  latitudeNumeric: number;
  longitudeNumeric: number;
  movementDir: number;
  movementSpeed: number;
  lastUpdate: string;
  publicAdvisory: {
    advNum: string;
    issuance: string;
    url: string;
  };
  forecastAdvisory: {
    advNum: string;
    issuance: string;
    url: string;
  };
  windSpeed: {
    mph: number;
    kph: number;
  };
  headline: string;
}

export async function fetchHurricanes(): Promise<Incident[]> {
  try {
    // NOAA NHC active storms JSON feed
    // Using Vite proxy to bypass CORS
    const response = await fetch('/api/nhc');

    if (!response.ok) {
      console.warn('Hurricane API returned status:', response.status);
      return [];
    }

    const data = await response.json();
    const incidents: Incident[] = [];

    if (!data.activeStorms || data.activeStorms.length === 0) {
      console.log('🌀 Hurricanes/Typhoons: No active storms');
      return [];
    }

    data.activeStorms.forEach((storm: Storm) => {
      // Determine severity based on classification
      let severity = IncidentSeverity.MEDIUM;
      const classification = storm.classification?.toLowerCase() || '';

      if (classification.includes('hurricane') || classification.includes('typhoon')) {
        if (storm.intensity >= 3) {
          severity = IncidentSeverity.CRITICAL; // Major hurricane (Cat 3+)
        } else {
          severity = IncidentSeverity.HIGH;
        }
      } else if (classification.includes('tropical storm')) {
        severity = IncidentSeverity.MEDIUM;
      }

      incidents.push({
        id: `hurricane-${storm.id}`,
        title: `${storm.classification || 'Storm'}: ${storm.name}`,
        description: `${storm.headline || 'Active tropical system'} - Winds: ${storm.windSpeed?.mph || 'N/A'} mph, Pressure: ${storm.pressure || 'N/A'} mb`,
        type: IncidentType.HURRICANE,
        severity,
        location: {
          lat: storm.latitudeNumeric,
          lon: storm.longitudeNumeric,
        },
        locationName: `${storm.latitude} ${storm.longitude}`,
        timestamp: new Date(storm.lastUpdate),
        source: 'NOAA National Hurricane Center',
      });
    });

    console.log(`🌀 Hurricanes/Typhoons: ${incidents.length} active storms`);
    return incidents;
  } catch (error) {
    console.error('Error fetching hurricane data:', error);
    return [];
  }
}
