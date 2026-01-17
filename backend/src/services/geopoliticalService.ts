import { Incident, IncidentSeverity, IncidentType } from '../types';

// Geopolitical Events Service
// Tracks border closures, sanctions, government actions
// Note: Most of this data requires manual curation or paid APIs

// Recent border closures and restrictions (manually curated)
// In production, this would be updated via news feeds or government APIs
const ACTIVE_BORDER_SITUATIONS = [
  // Example structure - would be populated from news/government sources
  // { country: 'Ukraine', lat: 48.3794, lon: 31.1656, reason: 'Conflict', severity: 'CRITICAL' },
];

// Recent sanctions (manually curated from OFAC, UN, EU databases)
const ACTIVE_SANCTIONS = [
  // Example: { target: 'Country/Entity', date: '2025-01-01', reason: 'Human rights violations' }
];

export async function fetchBorderClosures(): Promise<Incident[]> {
  // Border closure data is typically announced via:
  // - Government websites (no unified API)
  // - IATA Travel Centre (requires subscription)
  // - News sources

  const incidents: Incident[] = [];

  // Placeholder: In production, you would:
  // 1. Monitor government embassy websites
  // 2. Scrape travel advisory sites
  // 3. Use GDAC (Global Disaster Alert and Coordination System)

  console.log('🚧 Border Closures: Monitoring (manual curation required)');
  return incidents;
}

export async function fetchSanctions(): Promise<Incident[]> {
  // Sanctions data sources:
  // - US OFAC (Office of Foreign Assets Control)
  // - EU Sanctions Map
  // - UN Security Council Sanctions
  // None have free real-time APIs

  const incidents: Incident[] = [];

  console.log('⚖️ Sanctions: Monitoring (manual curation required)');
  return incidents;
}

export async function fetchGovernmentStatements(): Promise<Incident[]> {
  // Government emergency declarations/statements
  // Would require monitoring official government channels
  // Could integrate with RSS feeds from:
  // - White House press releases
  // - UN press releases
  // - National emergency management agencies

  const incidents: Incident[] = [];

  console.log('📢 Government Statements: Monitoring (RSS feeds required)');
  return incidents;
}

// GDACS - Global Disaster Alert and Coordination System
// This is actually a good free source for major disasters!
export async function fetchGDACS(): Promise<Incident[]> {
  try {
    // GDACS provides RSS/JSON feeds for global disasters
    const response = await fetch(
      'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH'
    );

    if (!response.ok) {
      console.warn('GDACS API returned status:', response.status);
      return [];
    }

    const data = await response.json();
    const incidents: Incident[] = [];

    if (!data.features || data.features.length === 0) {
      console.log('🌍 GDACS: No active alerts');
      return [];
    }

    data.features.forEach((event: any) => {
      const props = event.properties;
      const coords = event.geometry?.coordinates;

      if (!coords) return;

      // Determine type
      let type = IncidentType.EMERGENCY;
      if (props.eventtype === 'EQ') type = IncidentType.EARTHQUAKE;
      else if (props.eventtype === 'TC') type = IncidentType.HURRICANE;
      else if (props.eventtype === 'FL') type = IncidentType.FLOOD;
      else if (props.eventtype === 'VO') type = IncidentType.VOLCANIC;
      else if (props.eventtype === 'DR') type = IncidentType.ENVIRONMENTAL;

      // Determine severity from alert level
      let severity = IncidentSeverity.MEDIUM;
      if (props.alertlevel === 'Red') severity = IncidentSeverity.CRITICAL;
      else if (props.alertlevel === 'Orange') severity = IncidentSeverity.HIGH;
      else if (props.alertlevel === 'Green') severity = IncidentSeverity.MEDIUM;

      incidents.push({
        id: `gdacs-${props.eventid}`,
        title: `${props.eventtype}: ${props.name}`,
        description: props.description || `${props.alertlevel} alert - ${props.severitydata?.severity || 'N/A'}`,
        type,
        severity,
        location: { lat: coords[1], lon: coords[0] },
        locationName: props.country || 'Unknown',
        timestamp: new Date(props.fromdate),
        source: 'GDACS',
      });
    });

    console.log(`🌍 GDACS Global Alerts: ${incidents.length} active disasters`);
    return incidents;
  } catch (error) {
    console.error('Error fetching GDACS data:', error);
    return [];
  }
}
