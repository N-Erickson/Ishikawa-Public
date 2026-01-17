import { Incident, IncidentSeverity, IncidentType } from '../types';

// Real-time 911 call aggregators and scanner feeds
// These provide MASSIVE volumes of live emergency calls

// PulsePoint - Real-time fire/EMS incidents across USA
export async function fetchPulsePointIncidents(): Promise<Incident[]> {
  try {
    // PulsePoint provides real-time active incidents
    const response = await fetch(
      `/api/pulsepoint?agency_id=ALL&limit=1000`
    );
    if (!response.ok) throw new Error(`PulsePoint API error: ${response.status}`);
    const data = await response.json();

    if (!data.incidents) return [];

    return data.incidents
      .filter((inc: any) => inc.Latitude && inc.Longitude)
      .slice(0, 500)
      .map((inc: any) => ({
        id: `pulsepoint-${inc.ID}`,
        title: `Fire/EMS: ${inc.PulsePointIncidentCallType}`,
        description: `Active ${inc.Call_Type} - ${inc.AgencyID}`,
        type: IncidentType.EMERGENCY,
        severity: IncidentSeverity.HIGH,
        location: {
          lat: parseFloat(inc.Latitude),
          lon: parseFloat(inc.Longitude),
        },
        locationName: `${inc.AgencyID}`,
        timestamp: new Date(inc.CallReceivedDateTime || Date.now()),
        source: 'PulsePoint Real-Time',
      }));
  } catch (error) {
    console.error('Error fetching PulsePoint:', error);
    return [];
  }
}

// Broadcastify - Police scanner aggregator
export async function fetchBroadcastifyIncidents(): Promise<Incident[]> {
  try {
    // Note: Broadcastify doesn't have a public API, returning empty for now
    // In production, would need to use scanner audio transcription services
    console.log('Broadcastify: No public API available');
    return [];
  } catch (error) {
    console.error('Error fetching Broadcastify:', error);
    return [];
  }
}

// Active 911 - Emergency response platform
export async function fetchActive911Incidents(): Promise<Incident[]> {
  try {
    // Active911 requires authentication, returning placeholder
    console.log('Active911: Requires authentication');
    return [];
  } catch (error) {
    console.error('Error fetching Active911:', error);
    return [];
  }
}

// CrisisTracker - Global crisis monitoring
export async function fetchCrisisTrackerIncidents(): Promise<Incident[]> {
  try {
    const response = await fetch(
      `/api/crisistracker?limit=500&active=true`
    );
    if (!response.ok) throw new Error(`CrisisTracker API error: ${response.status}`);
    const data = await response.json();

    return data.events
      .filter((event: any) => event.location?.coordinates)
      .slice(0, 200)
      .map((event: any) => ({
        id: `crisis-${event.id}`,
        title: `Crisis: ${event.title}`,
        description: event.description,
        type: IncidentType.EMERGENCY,
        severity: IncidentSeverity.HIGH,
        location: {
          lat: event.location.coordinates[1],
          lon: event.location.coordinates[0],
        },
        locationName: event.location.name || 'Unknown',
        timestamp: new Date(event.created_at),
        source: 'CrisisTracker',
      }));
  } catch (error) {
    console.error('Error fetching CrisisTracker:', error);
    return [];
  }
}

// 511 Traffic Incidents - Real-time traffic emergencies
export async function fetch511TrafficIncidents(): Promise<Incident[]> {
  try {
    // Aggregate multiple state 511 systems
    const states = [
      { url: '/api/511', name: 'National' },
      { url: 'https://511ny.org/api/getincidents', name: 'New York' },
      { url: 'https://511nj.org/api/incidents', name: 'New Jersey' },
      { url: 'https://511pa.com/api/incidents', name: 'Pennsylvania' },
    ];

    const allIncidents: Incident[] = [];

    for (const state of states) {
      try {
        const response = await fetch(state.url);
        if (!response.ok) continue;
        const data = await response.json();

        if (data.incidents) {
          const incidents = data.incidents
            .filter((inc: any) => inc.latitude && inc.longitude)
            .slice(0, 100)
            .map((inc: any) => ({
              id: `511-${state.name}-${inc.id}`,
              title: `Traffic: ${inc.type}`,
              description: `${inc.description} - ${inc.roadway}`,
              type: IncidentType.TRAFFIC,
              severity: IncidentSeverity.MEDIUM,
              location: {
                lat: parseFloat(inc.latitude),
                lon: parseFloat(inc.longitude),
              },
              locationName: `${inc.location}, ${state.name}`,
              timestamp: new Date(inc.start_time || Date.now()),
              source: `511 ${state.name}`,
            }));
          allIncidents.push(...incidents);
        }
      } catch (err) {
        console.warn(`Failed to fetch ${state.name} 511:`, err);
      }
    }

    return allIncidents;
  } catch (error) {
    console.error('Error fetching 511 traffic:', error);
    return [];
  }
}

// Waze Incidents - Crowdsourced traffic and incidents
export async function fetchWazeIncidents(): Promise<Incident[]> {
  try {
    // Waze has limited public API, using major metro areas
    const bbox = '-125,25,-65,50'; // Continental US
    const response = await fetch(
      `/api/waze?tk=ccp_tkn&format=JSON&types=alerts,traffic&bbox=${bbox}`
    );

    if (!response.ok) throw new Error(`Waze API error: ${response.status}`);
    const data = await response.json();

    const incidents: Incident[] = [];

    // Process alerts
    if (data.alerts) {
      data.alerts.slice(0, 200).forEach((alert: any) => {
        if (alert.location) {
          incidents.push({
            id: `waze-alert-${alert.uuid}`,
            title: `Waze Alert: ${alert.type}`,
            description: alert.reportDescription || 'User reported incident',
            type: IncidentType.TRAFFIC,
            severity: alert.reliability > 5 ? IncidentSeverity.MEDIUM : IncidentSeverity.LOW,
            location: {
              lat: alert.location.y,
              lon: alert.location.x,
            },
            locationName: alert.street || 'Unknown',
            timestamp: new Date(alert.pubMillis),
            source: 'Waze Crowdsource',
          });
        }
      });
    }

    // Process traffic jams
    if (data.jams) {
      data.jams.slice(0, 200).forEach((jam: any) => {
        if (jam.line && jam.line.length > 0) {
          const coords = jam.line[0];
          incidents.push({
            id: `waze-jam-${jam.uuid}`,
            title: `Traffic Jam: Level ${jam.level}`,
            description: `${jam.length}m jam on ${jam.street}`,
            type: IncidentType.TRAFFIC,
            severity: jam.level > 3 ? IncidentSeverity.HIGH : IncidentSeverity.MEDIUM,
            location: {
              lat: coords.y,
              lon: coords.x,
            },
            locationName: jam.street || 'Unknown',
            timestamp: new Date(jam.pubMillis),
            source: 'Waze Traffic',
          });
        }
      });
    }

    return incidents;
  } catch (error) {
    console.error('Error fetching Waze incidents:', error);
    return [];
  }
}

// Emergency Response Data - FireDepartment.net aggregator
export async function fetchFireDepartmentIncidents(): Promise<Incident[]> {
  try {
    // Aggregate fire department CAD feeds
    console.log('FireDepartment.net: Limited public access');
    return [];
  } catch (error) {
    console.error('Error fetching fire department incidents:', error);
    return [];
  }
}

// Global Incident Map - Aggregated emergency data
export async function fetchGlobalIncidentMap(): Promise<Incident[]> {
  try {
    const response = await fetch(
      `/api/gim?limit=500&categories=crime,fire,medical,traffic`
    );

    if (!response.ok) throw new Error(`GIM API error: ${response.status}`);
    const data = await response.json();

    return data.incidents
      .filter((inc: any) => inc.lat && inc.lng)
      .slice(0, 300)
      .map((inc: any) => ({
        id: `gim-${inc.id}`,
        title: `${inc.category}: ${inc.title}`,
        description: inc.description,
        type: inc.category === 'fire' ? IncidentType.NATURAL : IncidentType.EMERGENCY,
        severity: IncidentSeverity.MEDIUM,
        location: {
          lat: parseFloat(inc.lat),
          lon: parseFloat(inc.lng),
        },
        locationName: inc.location || 'Unknown',
        timestamp: new Date(inc.timestamp),
        source: 'Global Incident Map',
      }));
  } catch (error) {
    console.error('Error fetching Global Incident Map:', error);
    return [];
  }
}
