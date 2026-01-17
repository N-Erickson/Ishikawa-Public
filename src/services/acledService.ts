import { Incident, IncidentSeverity, IncidentType } from '../types';

interface ACLEDAuthResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  token_type: string;
}

interface ACLEDEvent {
  event_id_cnty: string;
  event_date: string;
  event_type: string;
  sub_event_type: string;
  actor1: string;
  assoc_actor_1: string;
  inter1: number;
  actor2: string;
  assoc_actor_2: string;
  inter2: number;
  interaction: number;
  region: string;
  country: string;
  admin1: string;
  admin2: string;
  admin3: string;
  location: string;
  latitude: number;
  longitude: number;
  geo_precision: number;
  source: string;
  source_scale: string;
  notes: string;
  fatalities: number;
  timestamp: number;
  iso3: string;
}

interface ACLEDResponse {
  status: number;
  success: boolean;
  error: any;
  count: number;
  messages: string[];
  data: ACLEDEvent[];
}

// In-memory token cache
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

async function getACLEDToken(): Promise<string | null> {
  // Return cached token if still valid
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  // Check for environment variables
  const email = import.meta.env.VITE_ACLED_EMAIL;
  const password = import.meta.env.VITE_ACLED_PASSWORD;

  if (!email || !password) {
    console.warn('⚠️ ACLED credentials not configured. Set VITE_ACLED_EMAIL and VITE_ACLED_PASSWORD in .env');
    return null;
  }

  try {
    const response = await fetch('/api/acled/oauth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        username: email,
        password: password,
        grant_type: 'password',
        client_id: 'acled',
      }),
    });

    if (!response.ok) {
      console.error(`ACLED OAuth failed: ${response.status}`);
      return null;
    }

    const data: ACLEDAuthResponse = await response.json();
    cachedToken = data.access_token;
    // Set expiry to 1 hour before actual expiry for safety
    tokenExpiry = Date.now() + (data.expires_in - 3600) * 1000;

    console.log('✓ ACLED OAuth token obtained');
    return cachedToken;
  } catch (error) {
    console.error('Error getting ACLED token:', error);
    return null;
  }
}

function mapACLEDEventType(eventType: string): IncidentType {
  const lowerType = eventType.toLowerCase();

  if (lowerType.includes('protest') || lowerType.includes('demonstration')) {
    return IncidentType.PROTEST;
  }
  if (lowerType.includes('battle') || lowerType.includes('violence') ||
      lowerType.includes('explosion') || lowerType.includes('air strike')) {
    return IncidentType.CONFLICT;
  }
  if (lowerType.includes('riot')) {
    return IncidentType.PROTEST;
  }

  return IncidentType.OTHER;
}

function mapACLEDSeverity(fatalities: number, eventType: string): IncidentSeverity {
  // High fatalities = critical
  if (fatalities >= 10) {
    return IncidentSeverity.CRITICAL;
  }
  if (fatalities >= 1) {
    return IncidentSeverity.HIGH;
  }

  // Events with violence-related keywords
  const lowerType = eventType.toLowerCase();
  if (lowerType.includes('battle') || lowerType.includes('explosion') ||
      lowerType.includes('attack') || lowerType.includes('violence against civilians')) {
    return IncidentSeverity.HIGH;
  }

  if (lowerType.includes('riot')) {
    return IncidentSeverity.MEDIUM;
  }

  // Peaceful protests = low
  return IncidentSeverity.LOW;
}

// Fetch ACLED conflict and protest events from the last 7 days
export async function fetchACLEDIncidents(): Promise<Incident[]> {
  try {
    const token = await getACLEDToken();

    if (!token) {
      console.log('📊 ACLED: Skipping (no credentials configured)');
      return [];
    }

    // Calculate date 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const startDate = sevenDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD

    const response = await fetch(
      `/api/acled/read?` +
      new URLSearchParams({
        event_date: startDate,
        event_date_where: 'BETWEEN',
        limit: '500',
        fields: 'event_id_cnty|event_date|event_type|sub_event_type|country|location|latitude|longitude|fatalities|notes|source'
      }),
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`ACLED API error: ${response.status}`);
    }

    const data: ACLEDResponse = await response.json();

    if (!data.success || !data.data) {
      console.warn('ACLED API returned no data');
      return [];
    }

    const incidents: Incident[] = data.data
      .filter(event => event.latitude && event.longitude) // Only events with valid coordinates
      .map((event) => {
        const type = mapACLEDEventType(event.event_type);
        const severity = mapACLEDSeverity(event.fatalities, event.event_type);

        return {
          id: `acled-${event.event_id_cnty}`,
          title: `${event.event_type}: ${event.location}, ${event.country}`,
          description: event.notes?.substring(0, 200) || `${event.sub_event_type} in ${event.location}`,
          type,
          severity,
          location: {
            lat: event.latitude,
            lon: event.longitude,
          },
          locationName: `${event.location}, ${event.admin1 || event.country}`,
          timestamp: new Date(event.event_date),
          source: `ACLED: ${event.source}`,
        };
      });

    console.log(`📊 ACLED: ${incidents.length} conflict/protest events (last 7 days)`);
    return incidents;
  } catch (error) {
    console.error('Error fetching ACLED incidents:', error);
    return [];
  }
}
