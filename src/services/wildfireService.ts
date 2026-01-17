import { Incident, IncidentSeverity, IncidentType } from '../types';

// NASA FIRMS (Fire Information for Resource Management System)
// Provides near real-time active fire data from MODIS and VIIRS satellites
// Updated every 3 hours, no API key required for recent data

interface FIRMSFire {
  latitude: number;
  longitude: number;
  brightness: number;
  scan: number;
  track: number;
  acq_date: string;
  acq_time: string;
  satellite: string;
  confidence: number | string;
  version: string;
  bright_t31: number;
  frp: number; // Fire Radiative Power
  daynight: string;
}

export async function fetchWildfires(): Promise<Incident[]> {
  try {
    // NASA FIRMS provides last 24 hours of VIIRS data without API key
    // Using CSV format for simplicity (no auth required)
    // Using Vite proxy to bypass CORS
    const response = await fetch('/api/firms');

    if (!response.ok) {
      console.warn('FIRMS API returned status:', response.status);
      return [];
    }

    const csvText = await response.text();
    const lines = csvText.split('\n');

    // First line is header
    if (lines.length < 2) {
      return [];
    }

    const headers = lines[0].split(',');
    const incidents: Incident[] = [];

    // Parse CSV rows (skip header)
    for (let i = 1; i < lines.length && i < 201; i++) { // Limit to 200 fires
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(',');
      if (values.length < 15) continue;

      const latitude = parseFloat(values[0]);
      const longitude = parseFloat(values[1]);
      const brightness = parseFloat(values[2]);
      const acq_date = values[5];
      const acq_time = values[6];
      const satellite = values[7];
      const confidence = values[8];
      const frp = parseFloat(values[13]); // Fire Radiative Power

      // Skip if coordinates are invalid
      if (isNaN(latitude) || isNaN(longitude)) continue;

      // Only include high confidence fires
      if (confidence === 'l' || confidence === 'low') continue;

      // Determine severity based on FRP (Fire Radiative Power in MW)
      let severity = IncidentSeverity.MEDIUM;
      if (frp > 100) severity = IncidentSeverity.CRITICAL;
      else if (frp > 50) severity = IncidentSeverity.HIGH;

      // Parse timestamp
      const dateStr = acq_date.replace(/-/g, '/');
      const timeStr = acq_time.padStart(4, '0');
      const hour = timeStr.substring(0, 2);
      const minute = timeStr.substring(2, 4);
      const timestamp = new Date(`${dateStr} ${hour}:${minute}:00 UTC`);

      incidents.push({
        id: `wildfire-${latitude}-${longitude}-${acq_date}-${acq_time}`,
        title: `Active Fire Detection`,
        description: `Satellite-detected fire with ${Math.round(frp)} MW radiative power (${confidence} confidence)`,
        type: IncidentType.FIRE,
        severity,
        location: {
          lat: latitude,
          lon: longitude,
        },
        locationName: `Fire at ${latitude.toFixed(3)}°, ${longitude.toFixed(3)}°`,
        timestamp,
        source: `NASA FIRMS ${satellite}`,
      });
    }

    console.log(`🔥 Wildfires: ${incidents.length} active fires detected (last 24h)`);
    return incidents;
  } catch (error) {
    console.error('Error fetching wildfire data:', error);
    return [];
  }
}
