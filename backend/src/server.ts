import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import fetch, { RequestInit } from 'node-fetch';
import { parseString } from 'xml2js';
import * as cheerio from 'cheerio';

const app = express();
const PORT = 3000;

// Fetch with timeout wrapper - prevents hanging requests
const FETCH_TIMEOUT_MS = 15000; // 15 second timeout for all fetches

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal as any,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${FETCH_TIMEOUT_MS}ms: ${url}`);
    }
    throw error;
  }
}

// @ts-ignore
globalThis.fetch = fetch;

app.use(cors());
app.use(express.json());

const db = new Database('incidents.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    title TEXT,
    description TEXT,
    type TEXT,
    severity TEXT,
    lat REAL,
    lon REAL,
    locationName TEXT,
    timestamp INTEGER,
    source TEXT,
    livestreamUrl TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  )
`);

console.log('✓ Database initialized');

// Track data source health
let sourceHealth: Record<string, { status: 'operational' | 'degraded' | 'down'; lastCheck: number; error?: string }> = {};

// STATE COORDS for weather alerts (includes US states, territories, and marine zones)
const STATE_COORDS: any = {
  // US States
  'AL': { lat: 32.806671, lon: -86.791130 }, 'AK': { lat: 61.370716, lon: -152.404419 },
  'AZ': { lat: 33.729759, lon: -111.431221 }, 'AR': { lat: 34.969704, lon: -92.373123 },
  'CA': { lat: 36.116203, lon: -119.681564 }, 'CO': { lat: 39.059811, lon: -105.311104 },
  'CT': { lat: 41.597782, lon: -72.755371 }, 'DE': { lat: 39.318523, lon: -75.507141 },
  'FL': { lat: 27.766279, lon: -81.686783 }, 'GA': { lat: 33.040619, lon: -83.643074 },
  'HI': { lat: 21.094318, lon: -157.498337 }, 'ID': { lat: 44.240459, lon: -114.478828 },
  'IL': { lat: 40.349457, lon: -88.986137 }, 'IN': { lat: 39.849426, lon: -86.258278 },
  'IA': { lat: 42.011539, lon: -93.210526 }, 'KS': { lat: 38.526600, lon: -96.726486 },
  'KY': { lat: 37.668140, lon: -84.670067 }, 'LA': { lat: 31.169546, lon: -91.867805 },
  'ME': { lat: 44.693947, lon: -69.381927 }, 'MD': { lat: 39.063946, lon: -76.802101 },
  'MA': { lat: 42.230171, lon: -71.530106 }, 'MI': { lat: 43.326618, lon: -84.536095 },
  'MN': { lat: 45.694454, lon: -93.900192 }, 'MS': { lat: 32.741646, lon: -89.678696 },
  'MO': { lat: 38.456085, lon: -92.288368 }, 'MT': { lat: 46.921925, lon: -110.454353 },
  'NE': { lat: 41.125370, lon: -98.268082 }, 'NV': { lat: 38.313515, lon: -117.055374 },
  'NH': { lat: 43.452492, lon: -71.563896 }, 'NJ': { lat: 40.298904, lon: -74.521011 },
  'NM': { lat: 34.840515, lon: -106.248482 }, 'NY': { lat: 42.165726, lon: -74.948051 },
  'NC': { lat: 35.630066, lon: -79.806419 }, 'ND': { lat: 47.528912, lon: -99.784012 },
  'OH': { lat: 40.388783, lon: -82.764915 }, 'OK': { lat: 35.565342, lon: -96.928917 },
  'OR': { lat: 44.572021, lon: -122.070938 }, 'PA': { lat: 40.590752, lon: -77.209755 },
  'RI': { lat: 41.680893, lon: -71.511780 }, 'SC': { lat: 33.856892, lon: -80.945007 },
  'SD': { lat: 44.299782, lon: -99.438828 }, 'TN': { lat: 35.747845, lon: -86.692345 },
  'TX': { lat: 31.054487, lon: -97.563461 }, 'UT': { lat: 40.150032, lon: -111.862434 },
  'VT': { lat: 44.045876, lon: -72.710686 }, 'VA': { lat: 37.769337, lon: -78.169968 },
  'WA': { lat: 47.400902, lon: -121.490494 }, 'WV': { lat: 38.491226, lon: -80.954453 },
  'WI': { lat: 44.268543, lon: -89.616508 }, 'WY': { lat: 42.755966, lon: -107.302490 },
  'DC': { lat: 38.907192, lon: -77.036871 },
  // US Territories
  'PR': { lat: 18.220833, lon: -66.590149 }, 'VI': { lat: 18.335765, lon: -64.896335 },
  'GU': { lat: 13.444304, lon: 144.793731 }, 'AS': { lat: -14.270972, lon: -170.132217 },
  'MP': { lat: 15.0979, lon: 145.6739 },
  // Marine zones (GM=Gulf of Mexico, AM=Atlantic, PZ=Pacific, PK=Alaska Pacific, PM=Pacific Marine)
  'GM': { lat: 25.5, lon: -90.0 }, 'AM': { lat: 35.0, lon: -70.0 },
  'PZ': { lat: 40.0, lon: -130.0 }, 'PK': { lat: 55.0, lon: -155.0 },
  'PM': { lat: 20.0, lon: -160.0 }, 'AN': { lat: 58.0, lon: -170.0 },
  'PS': { lat: 10.0, lon: 140.0 }, 'SL': { lat: 45.0, lon: -85.0 },
  'LO': { lat: 43.5, lon: -82.0 }, 'LM': { lat: 44.0, lon: -87.0 },
  'LH': { lat: 47.0, lon: -85.0 }, 'LS': { lat: 47.5, lon: -89.0 },
  'LE': { lat: 42.5, lon: -81.0 },
};

// Calculate centroid from polygon coordinates
function calculatePolygonCentroid(coordinates: number[][][]): { lat: number; lon: number } {
  let totalLat = 0;
  let totalLon = 0;
  let count = 0;

  // For a simple polygon, coordinates[0] is the outer ring
  const ring = coordinates[0];
  for (const coord of ring) {
    totalLon += coord[0];
    totalLat += coord[1];
    count++;
  }

  return {
    lat: totalLat / count,
    lon: totalLon / count,
  };
}

// Calculate centroid from MultiPolygon coordinates
function calculateMultiPolygonCentroid(coordinates: number[][][][]): { lat: number; lon: number } {
  let totalLat = 0;
  let totalLon = 0;
  let count = 0;

  for (const polygon of coordinates) {
    const ring = polygon[0];
    for (const coord of ring) {
      totalLon += coord[0];
      totalLat += coord[1];
      count++;
    }
  }

  return {
    lat: totalLat / count,
    lon: totalLon / count,
  };
}

// Get coordinates from alert - uses geometry if available, otherwise falls back to state coords
function getAlertCoordinates(alert: any): { lat: number; lon: number } {
  // First, try to use the alert's geometry (most accurate)
  if (alert.geometry) {
    try {
      if (alert.geometry.type === 'Polygon') {
        return calculatePolygonCentroid(alert.geometry.coordinates);
      } else if (alert.geometry.type === 'MultiPolygon') {
        return calculateMultiPolygonCentroid(alert.geometry.coordinates);
      }
    } catch (e) {
      console.error('Error calculating centroid from geometry:', e);
    }
  }

  // Fall back to UGC-based state/zone lookup
  const ugc = alert.properties.geocode?.UGC?.[0] || '';
  const prefix = ugc.substring(0, 2).toUpperCase();

  // Check if we have coordinates for this prefix
  const baseCoords = STATE_COORDS[prefix];
  if (baseCoords) {
    // Add a small random offset (up to ~50km) to prevent all alerts in same state from stacking
    // Use alert ID as seed for consistent positioning
    const seed = alert.id?.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0) || 0;
    const latOffset = ((seed % 100) / 100 - 0.5) * 1.0;  // +/- 0.5 degrees
    const lonOffset = (((seed * 7) % 100) / 100 - 0.5) * 1.0;

    return {
      lat: baseCoords.lat + latOffset,
      lon: baseCoords.lon + lonOffset,
    };
  }

  // Ultimate fallback: center of continental US (Kansas)
  console.warn(`Unknown UGC prefix: ${prefix} for alert: ${alert.properties.event}`);
  return { lat: 39.8283, lon: -98.5795 };
}

async function fetchEarthquakes() {
  try {
    const response = await fetchWithTimeout('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson');
    const data: any = await response.json();

    return data.features.map((eq: any) => ({
      id: `earthquake-${eq.id}`,
      title: eq.properties.title,
      description: `Magnitude ${eq.properties.mag} earthquake`,
      type: 'weather',
      severity: eq.properties.mag >= 6 ? 'critical' : eq.properties.mag >= 5 ? 'high' : 'medium',
      lat: eq.geometry.coordinates[1],
      lon: eq.geometry.coordinates[0],
      locationName: eq.properties.place,
      timestamp: eq.properties.time,
      source: 'USGS',
      livestreamUrl: eq.properties.url,
    }));
  } catch (error) {
    console.error('Earthquake fetch error:', error);
    return [];
  }
}

async function fetchWeatherAlerts() {
  try {
    const response = await fetchWithTimeout('https://api.weather.gov/alerts/active');
    const data: any = await response.json();

    return data.features
      .filter((alert: any) => ['Extreme', 'Severe', 'Moderate'].includes(alert.properties.severity))
      .slice(0, 30)
      .map((alert: any) => {
        // Use new helper that tries geometry first, then falls back to state coords with offset
        const coords = getAlertCoordinates(alert);

        return {
          id: `weather-${alert.id}`,
          title: alert.properties.event,
          description: alert.properties.headline?.substring(0, 200) || alert.properties.description?.substring(0, 200),
          type: 'weather',
          severity: alert.properties.severity === 'Extreme' ? 'critical' : alert.properties.severity === 'Severe' ? 'high' : 'medium',
          lat: coords.lat,
          lon: coords.lon,
          locationName: alert.properties.areaDesc,
          timestamp: new Date(alert.properties.effective || alert.properties.sent).getTime(),
          source: 'NOAA',
          livestreamUrl: null,
        };
      });
  } catch (error) {
    console.error('Weather alerts fetch error:', error);
    return [];
  }
}

async function fetchMeteoAlarm() {
  try {
    // MeteoAlarm RSS feed for European severe weather warnings
    const response = await fetchWithTimeout('https://www.meteoalarm.org/documents/rss/wflag-rss-all.xml', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const xml = await response.text();

    return new Promise<any[]>((resolve, reject) => {
      parseString(xml, { strict: false, trim: true }, (err, result) => {
        if (err) {
          reject(err);
          return;
        }

        const alerts: any[] = [];
        const items = result?.rss?.channel?.[0]?.item || [];

        for (const item of items.slice(0, 30)) {
          const title = item.title?.[0] || '';
          const description = item.description?.[0] || '';
          const link = item.link?.[0] || '';
          const pubDate = item.pubDate?.[0] || new Date().toISOString();

          if (!title) continue;

          // Determine severity based on MeteoAlarm colors (Red=critical, Orange=high, Yellow=medium)
          let severity = 'medium';
          const text = (title + ' ' + description).toLowerCase();

          if (text.includes('red') || text.includes('extreme')) {
            severity = 'critical';
          } else if (text.includes('orange') || text.includes('severe')) {
            severity = 'high';
          }

          // Extract country/location from title
          const countryMatch = title.match(/\b([A-Z]{2})\b/); // ISO country codes
          let location = LOCATION_DATABASE['europe'] || { lat: 50.0, lon: 10.0 };
          let locationName = 'Europe';

          // Try to match specific countries
          if (title.includes('Germany') || countryMatch?.[1] === 'DE') {
            location = LOCATION_DATABASE['germany'] || { lat: 51.1657, lon: 10.4515 };
            locationName = 'Germany';
          } else if (title.includes('France') || countryMatch?.[1] === 'FR') {
            location = LOCATION_DATABASE['france'] || { lat: 46.2276, lon: 2.2137 };
            locationName = 'France';
          } else if (title.includes('Italy') || countryMatch?.[1] === 'IT') {
            location = LOCATION_DATABASE['italy'] || { lat: 41.8719, lon: 12.5674 };
            locationName = 'Italy';
          } else if (title.includes('Spain') || countryMatch?.[1] === 'ES') {
            location = LOCATION_DATABASE['spain'] || { lat: 40.4637, lon: -3.7492 };
            locationName = 'Spain';
          } else if (title.includes('UK') || title.includes('United Kingdom') || countryMatch?.[1] === 'GB') {
            location = LOCATION_DATABASE['united kingdom'] || { lat: 51.5074, lon: -0.1278 };
            locationName = 'United Kingdom';
          }

          alerts.push({
            id: `meteoalarm-${Buffer.from(title + pubDate).toString('base64').substring(0, 20)}`,
            title: title.substring(0, 200),
            description: description.replace(/<[^>]*>/g, '').substring(0, 300),
            type: 'weather',
            severity,
            lat: location.lat,
            lon: location.lon,
            locationName,
            timestamp: new Date(pubDate).getTime(),
            source: 'MeteoAlarm',
            livestreamUrl: link || null,
          });
        }

        resolve(alerts);
      });
    });
  } catch (error) {
    console.error('MeteoAlarm fetch error:', error);
    return [];
  }
}

async function fetchEnvironmentCanada() {
  try {
    // Environment Canada weather alerts RSS feed
    const response = await fetchWithTimeout('https://weather.gc.ca/rss/warning/on-14_e.xml', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const xml = await response.text();

    return new Promise<any[]>((resolve, reject) => {
      parseString(xml, { strict: false, trim: true }, (err, result) => {
        if (err) {
          reject(err);
          return;
        }

        const alerts: any[] = [];
        const items = result?.feed?.entry || [];

        for (const item of items.slice(0, 20)) {
          const title = item.title?.[0] || '';
          const summary = item.summary?.[0]?._|| item.summary?.[0] || '';
          const link = item.link?.[0]?.$ ?.href || '';
          const updated = item.updated?.[0] || new Date().toISOString();

          if (!title) continue;

          // Determine severity
          let severity = 'medium';
          const text = (title + ' ' + summary).toLowerCase();

          if (text.includes('warning') || text.includes('severe')) {
            severity = 'high';
          }
          if (text.includes('extreme') || text.includes('blizzard') || text.includes('tornado')) {
            severity = 'critical';
          }

          // Default to Ontario coordinates (can expand to other provinces)
          const location = LOCATION_DATABASE['canada'] || { lat: 43.6532, lon: -79.3832 };

          alerts.push({
            id: `envcanada-${Buffer.from(title + updated).toString('base64').substring(0, 20)}`,
            title: title.substring(0, 200),
            description: summary.replace(/<[^>]*>/g, '').substring(0, 300),
            type: 'weather',
            severity,
            lat: location.lat,
            lon: location.lon,
            locationName: 'Canada',
            timestamp: new Date(updated).getTime(),
            source: 'Environment Canada',
            livestreamUrl: link || null,
          });
        }

        resolve(alerts);
      });
    });
  } catch (error) {
    console.error('Environment Canada fetch error:', error);
    return [];
  }
}

async function fetchAustralianWeather() {
  try {
    // Bureau of Meteorology Australia warnings RSS
    const response = await fetchWithTimeout('http://www.bom.gov.au/fwo/IDZ00059.warnings_national.xml', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const xml = await response.text();

    return new Promise<any[]>((resolve, reject) => {
      parseString(xml, { strict: false, trim: true }, (err, result) => {
        if (err) {
          reject(err);
          return;
        }

        const alerts: any[] = [];
        const items = result?.rss?.channel?.[0]?.item || [];

        for (const item of items.slice(0, 20)) {
          const title = item.title?.[0] || '';
          const description = item.description?.[0] || '';
          const link = item.link?.[0] || '';
          const pubDate = item.pubDate?.[0] || new Date().toISOString();

          if (!title) continue;

          // Determine severity
          let severity = 'medium';
          const text = (title + ' ' + description).toLowerCase();

          if (text.includes('severe') || text.includes('warning')) {
            severity = 'high';
          }
          if (text.includes('extreme') || text.includes('cyclone') || text.includes('major')) {
            severity = 'critical';
          }

          const location = LOCATION_DATABASE['australia'] || { lat: -25.2744, lon: 133.7751 };

          alerts.push({
            id: `bom-${Buffer.from(title + pubDate).toString('base64').substring(0, 20)}`,
            title: title.substring(0, 200),
            description: description.replace(/<[^>]*>/g, '').substring(0, 300),
            type: 'weather',
            severity,
            lat: location.lat,
            lon: location.lon,
            locationName: 'Australia',
            timestamp: new Date(pubDate).getTime(),
            source: 'BOM Australia',
            livestreamUrl: link || null,
          });
        }

        resolve(alerts);
      });
    });
  } catch (error) {
    console.error('BOM Australia fetch error:', error);
    return [];
  }
}

async function fetchGDACS() {
  try {
    const response = await fetchWithTimeout('https://www.gdacs.org/gdacsapi/api/events/geteventlist/ARCHIVE');
    const data: any = await response.json();

    if (!data?.features) return [];

    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000); // 30 days for long-term events

    return data.features.slice(0, 50).map((event: any) => {
      const eventName = event.properties.name || event.properties.country || 'Unknown';
      const urls = event.properties.url;
      const reportUrl = typeof urls === 'object' ? urls.report : urls;
      const eventType = event.properties.eventtype; // VO=Volcano, TC=Tropical Cyclone, DR=Drought, FL=Flood, EQ=Earthquake
      const fromDate = new Date(event.properties.fromdate).getTime();
      const toDate = event.properties.todate ? new Date(event.properties.todate).getTime() : now;

      return {
        id: `gdacs-${event.properties.eventid}`,
        title: `${event.properties.eventtype}: ${eventName}`,
        description: event.properties.description?.substring(0, 200) || `${event.properties.severity} severity event`,
        type: 'weather',
        severity: event.properties.alertlevel === 'Red' ? 'critical' : event.properties.alertlevel === 'Orange' ? 'high' : 'medium',
        lat: event.geometry.coordinates[1],
        lon: event.geometry.coordinates[0],
        locationName: event.properties.country || 'Unknown',
        timestamp: fromDate,
        source: 'GDACS',
        livestreamUrl: reportUrl || null,
        gdacsEventType: eventType, // Store GDACS event type for filtering
        gdacsToDate: toDate, // Store end date for filtering
      };
    }).filter((event: any) => {
      // For tropical cyclones, only show if they're currently active or ended within last 7 days
      if (event.gdacsEventType === 'TC') {
        const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
        return event.gdacsToDate >= sevenDaysAgo; // Show if still ongoing or ended recently
      }
      // For volcanoes and droughts, show if started within last 30 days
      if (event.gdacsEventType === 'VO' || event.gdacsEventType === 'DR') {
        return event.timestamp >= thirtyDaysAgo;
      }
      // For everything else (floods, earthquakes), use normal 24hr filtering (done later)
      return true;
    });
  } catch (error) {
    console.error('GDACS fetch error:', error);
    return [];
  }
}

async function fetchNASA() {
  try {
    const response = await fetchWithTimeout('https://eonet.gsfc.nasa.gov/api/v3/events?limit=10&days=7');
    const data: any = await response.json();

    if (!data?.events) return [];

    return data.events.map((event: any) => {
      const coords = event.geometry?.[0]?.coordinates || [0, 0];
      return {
        id: `nasa-${event.id}`,
        title: event.title,
        description: event.description?.substring(0, 200) || event.title,
        type: 'weather',
        severity: event.categories?.[0]?.title?.toLowerCase().includes('fire') ? 'high' : 'medium',
        lat: coords[1],
        lon: coords[0],
        locationName: event.title,
        timestamp: new Date(event.geometry?.[0]?.date || Date.now()).getTime(),
        source: 'NASA EONET',
        livestreamUrl: event.link,
      };
    }).filter((e: any) => e.lat !== 0 && e.lon !== 0);
  } catch (error) {
    console.error('NASA fetch error:', error);
    return [];
  }
}

// Geocoding database for major world locations
const LOCATION_DATABASE: { [key: string]: { lat: number; lon: number; keywords: string[] } } = {
  'ukraine': { lat: 50.4501, lon: 30.5234, keywords: ['ukraine', 'kyiv', 'kiev', 'kharkiv', 'odesa', 'lviv', 'donetsk', 'mariupol'] },
  'russia': { lat: 55.7558, lon: 37.6173, keywords: ['russia', 'moscow', 'kremlin', 'putin', 'st petersburg'] },
  'israel': { lat: 31.7683, lon: 35.2137, keywords: ['israel', 'jerusalem', 'tel aviv', 'gaza', 'haifa', 'netanyahu'] },
  'palestine': { lat: 31.9522, lon: 35.2332, keywords: ['palestine', 'gaza', 'west bank', 'ramallah', 'palestinian'] },
  'syria': { lat: 33.5138, lon: 36.2765, keywords: ['syria', 'damascus', 'aleppo', 'syrian'] },
  'iran': { lat: 35.6892, lon: 51.3890, keywords: ['iran', 'tehran', 'iranian'] },
  'iraq': { lat: 33.3128, lon: 44.3615, keywords: ['iraq', 'baghdad', 'mosul', 'iraqi'] },
  'afghanistan': { lat: 34.5553, lon: 69.2075, keywords: ['afghanistan', 'kabul', 'taliban', 'afghan'] },
  'china': { lat: 39.9042, lon: 116.4074, keywords: ['china', 'beijing', 'shanghai', 'chinese', 'xi jinping'] },
  'taiwan': { lat: 25.0330, lon: 121.5654, keywords: ['taiwan', 'taipei', 'taiwanese'] },
  'north korea': { lat: 39.0392, lon: 125.7625, keywords: ['north korea', 'pyongyang', 'kim jong'] },
  'south korea': { lat: 37.5665, lon: 126.9780, keywords: ['south korea', 'seoul', 'korean'] },
  'japan': { lat: 35.6762, lon: 139.6503, keywords: ['japan', 'tokyo', 'japanese'] },
  'india': { lat: 28.6139, lon: 77.2090, keywords: ['india', 'delhi', 'mumbai', 'indian', 'modi'] },
  'pakistan': { lat: 33.6844, lon: 73.0479, keywords: ['pakistan', 'islamabad', 'karachi', 'pakistani'] },
  'yemen': { lat: 15.5527, lon: 48.5164, keywords: ['yemen', 'sanaa', 'houthi', 'yemeni'] },
  'lebanon': { lat: 33.8886, lon: 35.4955, keywords: ['lebanon', 'beirut', 'hezbollah', 'lebanese'] },
  'turkey': { lat: 39.9334, lon: 32.8597, keywords: ['turkey', 'ankara', 'istanbul', 'turkish', 'erdogan'] },
  'egypt': { lat: 30.0444, lon: 31.2357, keywords: ['egypt', 'cairo', 'egyptian'] },
  'libya': { lat: 32.8872, lon: 13.1913, keywords: ['libya', 'tripoli', 'libyan'] },
  'sudan': { lat: 15.5007, lon: 32.5599, keywords: ['sudan', 'khartoum', 'sudanese'] },
  'ethiopia': { lat: 9.1450, lon: 40.4897, keywords: ['ethiopia', 'addis ababa', 'ethiopian'] },
  'somalia': { lat: 2.0469, lon: 45.3182, keywords: ['somalia', 'mogadishu', 'somali'] },
  'congo': { lat: -4.3217, lon: 15.3125, keywords: ['congo', 'kinshasa', 'drc', 'congolese'] },
  'nigeria': { lat: 9.0765, lon: 7.3986, keywords: ['nigeria', 'abuja', 'lagos', 'nigerian'] },
  'south africa': { lat: -25.7479, lon: 28.2293, keywords: ['south africa', 'pretoria', 'cape town', 'johannesburg'] },
  'venezuela': { lat: 10.4806, lon: -66.9036, keywords: ['venezuela', 'caracas', 'maduro', 'venezuelan'] },
  'colombia': { lat: 4.7110, lon: -74.0721, keywords: ['colombia', 'bogota', 'colombian'] },
  'brazil': { lat: -15.8267, lon: -47.9218, keywords: ['brazil', 'brasilia', 'rio', 'sao paulo', 'brazilian'] },
  'argentina': { lat: -34.6037, lon: -58.3816, keywords: ['argentina', 'buenos aires', 'argentinian'] },
  'mexico': { lat: 19.4326, lon: -99.1332, keywords: ['mexico', 'mexico city', 'mexican', 'cartel'] },
  'haiti': { lat: 18.5944, lon: -72.3074, keywords: ['haiti', 'port-au-prince', 'haitian'] },
  'myanmar': { lat: 16.8661, lon: 96.1951, keywords: ['myanmar', 'yangon', 'burma', 'rohingya'] },
  'philippines': { lat: 14.5995, lon: 120.9842, keywords: ['philippines', 'manila', 'filipino'] },
  'indonesia': { lat: -6.2088, lon: 106.8456, keywords: ['indonesia', 'jakarta', 'indonesian'] },
  'thailand': { lat: 13.7563, lon: 100.5018, keywords: ['thailand', 'bangkok', 'thai'] },
  'vietnam': { lat: 21.0285, lon: 105.8542, keywords: ['vietnam', 'hanoi', 'vietnamese'] },
  'australia': { lat: -35.2809, lon: 149.1300, keywords: ['australia', 'canberra', 'sydney', 'australian'] },
  'new zealand': { lat: -41.2865, lon: 174.7762, keywords: ['new zealand', 'wellington', 'auckland'] },
  'uk': { lat: 51.5074, lon: -0.1278, keywords: ['uk', 'britain', 'london', 'england', 'scotland', 'wales', 'british'] },
  'france': { lat: 48.8566, lon: 2.3522, keywords: ['france', 'paris', 'french'] },
  'germany': { lat: 52.5200, lon: 13.4050, keywords: ['germany', 'berlin', 'german'] },
  'italy': { lat: 41.9028, lon: 12.4964, keywords: ['italy', 'rome', 'italian'] },
  'spain': { lat: 40.4168, lon: -3.7038, keywords: ['spain', 'madrid', 'barcelona', 'spanish'] },
  'poland': { lat: 52.2297, lon: 21.0122, keywords: ['poland', 'warsaw', 'polish'] },
  'usa': { lat: 38.9072, lon: -77.0369, keywords: ['usa', 'america', 'washington', 'american', 'united states'] },
};

function geocodeNewsArticle(title: string, description: string): { lat: number; lon: number; locationName: string } | null {
  const text = `${title} ${description}`.toLowerCase();

  for (const [location, data] of Object.entries(LOCATION_DATABASE)) {
    for (const keyword of data.keywords) {
      if (text.includes(keyword)) {
        return {
          lat: data.lat,
          lon: data.lon,
          locationName: location.charAt(0).toUpperCase() + location.slice(1)
        };
      }
    }
  }

  return null;
}

function categorizeNews(title: string, description: string): { type: string; severity: string } {
  const text = `${title} ${description}`.toLowerCase();

  // Categorize type FIRST, then determine severity based on type and context

  // Military: actual combat operations, troop movements, military actions
  if (text.match(/\b(airstrike|air strike|combat|troops deployed|military operation|armed forces|battalion|regiment|warship|fighter jet|tank|artillery|drone strike|military base|ceasefire|bombardment|frontline|front line)\b/)) {
    // Military severity based on actual combat vs planning
    let severity = 'medium';
    if (text.match(/\b(killed|casualties|dead|wounded|bombing|airstrike|missile strike)\b/)) severity = 'high';
    if (text.match(/\b(massacre|mass casualties|invasion|nuclear|chemical weapon)\b/)) severity = 'critical';
    return { type: 'military', severity };
  }

  // War zones only if specific military context
  if (text.match(/\bwar\b/) && text.match(/\b(zone|front|combat|offensive|defense|casualties)\b/)) {
    let severity = 'high';
    if (text.match(/\b(nuclear|chemical|genocide|massacre)\b/)) severity = 'critical';
    return { type: 'military', severity };
  }

  // Emergency: mass casualty events, terrorism, active threats
  if (text.match(/\b(terrorist attack|terrorism|mass shooting|active shooter|hostage|bomb plot|bombing)\b/)) {
    let severity = 'high';
    if (text.match(/\b(killed|dead|casualties)\b/)) severity = 'critical';
    if (text.match(/\b(prevented|foiled|arrested|disrupted)\b/) && !text.match(/\b(killed|dead|casualties)\b/)) severity = 'medium';
    return { type: 'emergency', severity };
  }

  // Only categorize as emergency if it's an actual violent incident with casualties
  if (text.match(/\b(mass shooting|school shooting|workplace shooting)\b/) ||
      (text.match(/\b(killed|dead)\b/) && text.match(/\b(shooting|stabbing|attack)\b/) && text.match(/\b(\d+\s+(people|victims|killed|dead))\b/))) {
    return { type: 'emergency', severity: 'high' };
  }

  // Civil unrest - protests, riots (severity based on violence)
  if (text.match(/\b(protest|riot|demonstration|rally|civil unrest|uprising)\b/)) {
    let severity = 'low'; // Most protests are peaceful
    if (text.match(/\b(violent|clash|riot|tear gas|water cannon)\b/)) severity = 'medium';
    if (text.match(/\b(killed|dead|casualties)\b/) && text.match(/\b(protest|riot)\b/)) severity = 'high';
    if (text.match(/\b(state of emergency|martial law|military crackdown)\b/)) severity = 'high';
    return { type: 'protest', severity };
  }

  // Weather/Natural disasters
  if (text.match(/\b(wildfire|flood|storm|hurricane|tornado|earthquake|tsunami|disaster|cyclone|typhoon|volcanic eruption|landslide)\b/)) {
    let severity = 'medium';
    if (text.match(/\b(warning|advisory|watch)\b/) && !text.match(/\b(killed|dead|casualties|destroyed)\b/)) severity = 'low';
    if (text.match(/\b(killed|dead|casualties|destroyed|devastated)\b/)) severity = 'high';
    if (text.match(/\b(catastrophic|mass casualties|hundreds killed|thousands killed)\b/)) severity = 'critical';
    return { type: 'weather', severity };
  }

  // Financial/Economic - significant economic events
  if (text.match(/\b(market crash|economic collapse|bank collapse|currency crisis|debt default|financial crisis)\b/)) {
    return { type: 'financial', severity: 'high' };
  }
  if (text.match(/\b(recession|inflation|sanctions|trade war|tariff)\b/)) {
    return { type: 'financial', severity: 'medium' };
  }

  // Political - diplomatic and political news
  if (text.match(/\b(election|summit|treaty|diplomatic|sanctions|coup|impeachment)\b/)) {
    let severity = 'low'; // Most political news is routine
    if (text.match(/\b(coup|overthrow|assassination|impeachment)\b/)) severity = 'high';
    return { type: 'political', severity };
  }

  // Law enforcement / Maritime incidents - smuggling, fleeing, pursuits
  if (text.match(/\b(fleeing|evading|pursuit|smuggling|coast guard|border patrol|intercepted)\b/) &&
      text.match(/\b(vessel|ship|tanker|boat|cargo|aircraft)\b/)) {
    return { type: 'other', severity: 'medium' };
  }

  // Default to "other" with low severity for everything else (general news, entertainment, sports, etc.)
  return { type: 'other', severity: 'low' };
}

async function fetchRSSFeed(url: string, source: string): Promise<any[]> {
  try {
    const response = await fetchWithTimeout(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const xml = await response.text();

    return new Promise((resolve, reject) => {
      parseString(xml, (err, result) => {
        if (err) {
          reject(err);
          return;
        }

        const items: any[] = [];
        const channel = result?.rss?.channel?.[0];
        const entries = channel?.item || result?.feed?.entry || [];

        for (const entry of entries.slice(0, 20)) {
          const title = entry.title?.[0]?._ || entry.title?.[0] || '';
          const description = entry.description?.[0]?._ || entry.description?.[0] || entry.summary?.[0]?._ || entry.summary?.[0] || '';
          const link = entry.link?.[0]?.$ || entry.link?.[0] || entry.id?.[0] || '';
          // Handle various pubDate field names (pubDate, pubdate, published, updated)
          const pubDate = entry.pubDate?.[0] || entry.pubdate?.[0] || entry.published?.[0] || entry.updated?.[0] || new Date().toISOString();

          if (!title) continue;

          const location = geocodeNewsArticle(title, description);
          if (!location) continue;

          const { type, severity } = categorizeNews(title, description);

          items.push({
            id: `news-${source}-${Buffer.from(title).toString('base64').substring(0, 20)}`,
            title: title.substring(0, 200),
            description: description.substring(0, 300),
            type,
            severity,
            lat: location.lat,
            lon: location.lon,
            locationName: location.locationName,
            timestamp: new Date(pubDate).getTime(),
            source: `${source} News`,
            livestreamUrl: typeof link === 'string' ? link : link?.href || null,
          });
        }

        resolve(items);
      });
    });
  } catch (error) {
    console.error(`RSS fetch error (${source}):`, error);
    return [];
  }
}

async function fetchNewsArticles() {
  const feeds = [
    // === GLOBAL NEWS AGENCIES (Tier 1) ===
    { url: 'http://feeds.bbci.co.uk/news/world/rss.xml', source: 'BBC World' },
    { url: 'https://www.reuters.com/rssFeed/worldNews', source: 'Reuters' },
    // AP News removed their public RSS - replaced with Guardian
    { url: 'https://www.theguardian.com/world/rss', source: 'Guardian World' },
    { url: 'https://www.aljazeera.com/xml/rss/all.xml', source: 'Al Jazeera' },
    { url: 'https://www.france24.com/en/rss', source: 'France24' },
    { url: 'https://www.dw.com/en/top-stories/s-9097?maca=en-rss-en-all-1573-rdf', source: 'DW' },
    { url: 'http://rss.cnn.com/rss/edition_world.rss', source: 'CNN World' },
    { url: 'https://news.sky.com/feeds/rss/world.xml', source: 'Sky News' },

    // === NORTH AMERICA ===
    // United States
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', source: 'NYT' },
    { url: 'https://feeds.washingtonpost.com/rss/world', source: 'Washington Post' },
    { url: 'https://www.latimes.com/world/rss2.0.xml', source: 'LA Times' },
    { url: 'https://www.wsj.com/xml/rss/3_7085.xml', source: 'WSJ' },
    { url: 'https://www.nbcnews.com/id/3032091/device/rss/rss.xml', source: 'NBC News' },
    { url: 'https://abcnews.go.com/abcnews/internationalheadlines', source: 'ABC News' },
    { url: 'https://www.foxnews.com/world.rss', source: 'Fox News' },
    { url: 'https://www.usatoday.com/rss/', source: 'USA Today' },
    { url: 'https://www.npr.org/rss/rss.php?id=1004', source: 'NPR World' },
    { url: 'https://www.politico.com/rss/world.xml', source: 'Politico' },
    { url: 'https://www.csmonitor.com/layout/set/rss/World', source: 'CSM' },

    // Canada
    { url: 'https://www.cbc.ca/webfeed/rss/rss-world', source: 'CBC' },
    { url: 'https://www.theglobeandmail.com/arc/outboundfeeds/rss/category/world/', source: 'Globe and Mail' },
    { url: 'https://torontosun.com/category/news/world/feed', source: 'Toronto Sun' },
    { url: 'https://nationalpost.com/category/news/world/feed', source: 'National Post' },
    { url: 'https://montrealgazette.com/category/news/world/feed', source: 'Montreal Gazette' },

    // === EUROPE ===
    // United Kingdom
    { url: 'https://www.theguardian.com/world/rss', source: 'Guardian' },
    { url: 'https://www.independent.co.uk/news/world/rss', source: 'Independent' },
    { url: 'https://www.telegraph.co.uk/rss.xml', source: 'Telegraph' },
    { url: 'https://www.dailymail.co.uk/news/worldnews/index.rss', source: 'Daily Mail' },
    { url: 'https://www.thetimes.co.uk/world/rss', source: 'The Times' },
    { url: 'https://www.economist.com/international/rss.xml', source: 'Economist' },
    { url: 'https://www.scotsman.com/news/world/rss', source: 'Scotsman' },

    // France
    { url: 'https://www.lemonde.fr/rss/une.xml', source: 'Le Monde' },
    { url: 'https://www.liberation.fr/arc/outboundfeeds/rss-all/', source: 'Liberation' },
    { url: 'https://www.lefigaro.fr/rss/figaro_actualites.xml', source: 'Le Figaro' },
    { url: 'https://www.thelocal.fr/feed/', source: 'The Local FR' },

    // Germany
    { url: 'https://www.spiegel.de/international/index.rss', source: 'Der Spiegel' },
    { url: 'https://www.thelocal.de/feed/', source: 'The Local DE' },

    // Spain
    { url: 'https://elpais.com/rss/elpais/portada.xml', source: 'El Pais' },
    { url: 'https://www.thelocal.es/feed/', source: 'The Local ES' },

    // Italy
    { url: 'https://www.ansa.it/sito/notizie/mondo/mondo_rss.xml', source: 'ANSA' },
    { url: 'https://www.thelocal.it/feed/', source: 'The Local IT' },

    // Netherlands
    { url: 'https://www.dutchnews.nl/feed/', source: 'Dutch News' },

    // Belgium
    { url: 'https://www.vrt.be/vrtnws/en.rss.headlines.xml', source: 'VRT News' },

    // Switzerland
    { url: 'https://www.swissinfo.ch/eng/rss', source: 'SwissInfo' },

    // Austria
    { url: 'https://www.thelocal.at/feed/', source: 'The Local AT' },

    // Nordic Countries
    { url: 'https://www.thelocal.se/feed/', source: 'The Local SE' },
    { url: 'https://www.thelocal.no/feed/', source: 'The Local NO' },
    { url: 'https://www.thelocal.dk/feed/', source: 'The Local DK' },
    { url: 'https://yle.fi/rss/uutiset.rss', source: 'YLE Finland' },
    { url: 'https://www.icelandreview.com/feed/', source: 'Iceland Review' },

    // Eastern Europe
    { url: 'https://www.kyivpost.com/feed', source: 'Kyiv Post' },
    { url: 'https://www.pravda.com.ua/rss/', source: 'Ukrainska Pravda' },
    { url: 'https://www.themoscowtimes.com/rss/news', source: 'Moscow Times' },
    { url: 'https://www.reuters.com/places/russia', source: 'Reuters Russia' },
    { url: 'https://notesfrompoland.com/feed/', source: 'Notes from Poland' },
    { url: 'https://www.praguepost.com/feed', source: 'Prague Post' },
    { url: 'https://balkaninsight.com/feed/', source: 'Balkan Insight' },

    // === MIDDLE EAST ===
    { url: 'https://www.timesofisrael.com/feed/', source: 'Times of Israel' },
    { url: 'https://www.haaretz.com/cmlink/1.628752', source: 'Haaretz' },
    { url: 'https://www.jpost.com/rss/rssfeedsheadlines.aspx', source: 'Jerusalem Post' },
    { url: 'https://www.ynetnews.com/Integration/StoryRss1854.xml', source: 'Ynet' },
    { url: 'https://www.thenationalnews.com/rss', source: 'The National UAE' },
    { url: 'https://english.alarabiya.net/rss.xml', source: 'Al Arabiya' },
    { url: 'https://www.middleeasteye.net/rss', source: 'Middle East Eye' },
    { url: 'https://www.al-monitor.com/rss.xml', source: 'Al-Monitor' },
    { url: 'https://www.dailysabah.com/rssFeed/11', source: 'Daily Sabah' },
    { url: 'https://www.hurriyetdailynews.com/rss', source: 'Hurriyet' },
    { url: 'https://english.ahram.org.eg/services/rss/world/0/8/0/0/233.aspx', source: 'Al-Ahram Egypt' },
    { url: 'https://www.tehrantimes.com/rss', source: 'Tehran Times' },

    // === ASIA-PACIFIC ===
    // China & Hong Kong
    { url: 'https://www.scmp.com/rss/91/feed', source: 'SCMP' },
    { url: 'http://www.globaltimes.cn/rss/outbrain.xml', source: 'Global Times' },
    { url: 'http://english.chinamil.com.cn/rss/pla_top_news.xml', source: 'China Military' },
    // China Daily RSS removed - feed serves stale 2017 articles
    { url: 'https://www.thestandard.com.hk/newsfeed/latest/news.xml', source: 'HK Standard' },

    // Japan
    { url: 'https://www.japantimes.co.jp/feed/', source: 'Japan Times' },
    { url: 'https://english.kyodonews.net/rss/news.xml', source: 'Kyodo News' },
    { url: 'https://www3.nhk.or.jp/rss/news/cat0.xml', source: 'NHK World' },
    { url: 'https://mainichi.jp/english/rss/etc/rss.xml', source: 'Mainichi' },

    // South Korea
    { url: 'https://www.koreaherald.com/common/rss_xml.php', source: 'Korea Herald' },
    { url: 'https://english.hani.co.kr/RSS/', source: 'Hankyoreh' },
    { url: 'https://www.koreatimes.co.kr/www/rss/nation.xml', source: 'Korea Times' },

    // Southeast Asia
    { url: 'https://www.straitstimes.com/news/world/rss.xml', source: 'Straits Times' },
    { url: 'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml', source: 'CNA Singapore' },
    { url: 'https://www.bangkokpost.com/rss/data/news.xml', source: 'Bangkok Post' },
    { url: 'https://www.nationthailand.com/rss/', source: 'The Nation Thailand' },
    { url: 'https://e.vnexpress.net/rss/news.rss', source: 'VnExpress Vietnam' },
    { url: 'https://www.thestar.com.my/rss/News/Nation/', source: 'The Star Malaysia' },
    { url: 'https://www.thejakartapost.com/feed', source: 'Jakarta Post' },
    { url: 'https://www.manilatimes.net/feed/', source: 'Manila Times' },
    { url: 'https://www.phnompenhpost.com/rss', source: 'Phnom Penh Post' },
    { url: 'https://www.mmtimes.com/rss.xml', source: 'Myanmar Times' },

    // South Asia
    { url: 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms', source: 'Times of India' },
    { url: 'https://www.thehindu.com/news/national/feeder/default.rss', source: 'The Hindu' },
    { url: 'https://indianexpress.com/section/india/feed/', source: 'Indian Express' },
    { url: 'https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml', source: 'Hindustan Times' },
    { url: 'https://www.dawn.com/feeds/home', source: 'Dawn Pakistan' },
    { url: 'https://tribune.com.pk/feed/home', source: 'Express Tribune' },
    { url: 'https://www.thedailystar.net/rss.xml', source: 'Daily Star Bangladesh' },
    { url: 'https://www.newsfirst.lk/feed/', source: 'News First Sri Lanka' },

    // Australia & New Zealand
    { url: 'https://www.abc.net.au/news/feed/2942460/rss.xml', source: 'ABC Australia' },
    { url: 'https://www.smh.com.au/rss/feed.xml', source: 'Sydney Morning Herald' },
    { url: 'https://www.theage.com.au/rss/feed.xml', source: 'The Age' },
    { url: 'https://www.nzherald.co.nz/arc/outboundfeeds/rss/section/world/', source: 'NZ Herald' },
    { url: 'https://www.stuff.co.nz/rss', source: 'Stuff NZ' },

    // === AFRICA ===
    { url: 'https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf', source: 'AllAfrica' },
    { url: 'https://www.news24.com/fin24/rss', source: 'News24 SA' },
    { url: 'https://www.timeslive.co.za/rss/', source: 'Times Live SA' },
    { url: 'https://www.dailymaverick.co.za/dmrss/', source: 'Daily Maverick' },
    { url: 'https://www.egypttoday.com/RSS', source: 'Egypt Today' },
    { url: 'https://www.thenewhumanitarian.org/feed', source: 'New Humanitarian' },
    { url: 'https://www.theeastafrican.co.ke/tea/rss', source: 'East African' },
    { url: 'https://www.monitor.co.ug/uganda/rss/news', source: 'Daily Monitor Uganda' },
    { url: 'https://www.standardmedia.co.ke/rss/headlines.php', source: 'Standard Kenya' },
    { url: 'https://www.thecitizen.co.tz/tanzania/rss', source: 'Citizen Tanzania' },
    { url: 'https://www.premiumtimesng.com/feed', source: 'Premium Times Nigeria' },
    { url: 'https://punchng.com/feed/', source: 'Punch Nigeria' },

    // === LATIN AMERICA ===
    { url: 'https://www.clarin.com/rss/mundo/', source: 'Clarin Argentina' },
    { url: 'https://www.lanacion.com.ar/arc/outboundfeeds/rss/', source: 'La Nacion Argentina' },
    { url: 'https://www1.folha.uol.com.br/rss/mundo.xml', source: 'Folha Brazil' },
    { url: 'https://www.estadao.com.br/rss/mundo.xml', source: 'Estadao Brazil' },
    { url: 'https://www.eluniversal.com.mx/rss.xml', source: 'El Universal Mexico' },
    { url: 'https://www.jornada.com.mx/rss/mundo.xml', source: 'La Jornada Mexico' },
    { url: 'https://www.eltiempo.com/rss/mundo.xml', source: 'El Tiempo Colombia' },
    { url: 'https://www.latercera.com/feed/', source: 'La Tercera Chile' },
    { url: 'https://www.elpais.com.uy/rss/', source: 'El Pais Uruguay' },
    { url: 'https://www.milenio.com/rss/mundo', source: 'Milenio Mexico' },
    { url: 'https://rss.dw.com/xml/rss-es-all', source: 'DW Spanish' },

    // === CONFLICT & SECURITY ===
    { url: 'https://www.defensenews.com/arc/outboundfeeds/rss/', source: 'Defense News' },
    { url: 'https://www.janes.com/feeds/news', source: 'Janes' },
    { url: 'https://www.military.com/rss', source: 'Military.com' },
    { url: 'https://warontherocks.com/feed/', source: 'War on the Rocks' },
    { url: 'https://www.crisisgroup.org/rss.xml', source: 'Crisis Group' },
  ];

  const results = await Promise.allSettled(feeds.map(f => fetchRSSFeed(f.url, f.source)));

  const allArticles: any[] = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      allArticles.push(...result.value);
    }
  });

  return allArticles;
}

// CVE Vendor/Product to Location Mapping
const CVE_LOCATION_DATABASE: { [key: string]: { lat: number; lon: number; location: string; keywords: string[] } } = {
  'microsoft': { lat: 47.6062, lon: -122.3321, location: 'Redmond, USA', keywords: ['microsoft', 'windows', 'azure', 'office', 'exchange', 'sharepoint'] },
  'apple': { lat: 37.3346, lon: -122.0090, location: 'Cupertino, USA', keywords: ['apple', 'macos', 'ios', 'iphone', 'ipad', 'safari'] },
  'google': { lat: 37.4220, lon: -122.0841, location: 'Mountain View, USA', keywords: ['google', 'chrome', 'android', 'pixel'] },
  'oracle': { lat: 37.5297, lon: -121.9750, location: 'Redwood City, USA', keywords: ['oracle', 'java', 'mysql', 'solaris'] },
  'cisco': { lat: 37.4088, lon: -121.9388, location: 'San Jose, USA', keywords: ['cisco', 'webex', 'ios xe'] },
  'adobe': { lat: 37.3317, lon: -121.8900, location: 'San Jose, USA', keywords: ['adobe', 'acrobat', 'photoshop', 'flash'] },
  'vmware': { lat: 37.4027, lon: -121.9761, location: 'Palo Alto, USA', keywords: ['vmware', 'esxi', 'vcenter'] },
  'ibm': { lat: 41.1089, lon: -73.7203, location: 'Armonk, USA', keywords: ['ibm', 'websphere', 'db2'] },
  'redhat': { lat: 35.7796, lon: -78.6382, location: 'Raleigh, USA', keywords: ['redhat', 'rhel', 'openshift', 'fedora'] },
  'linux': { lat: 45.5152, lon: -122.6784, location: 'Portland, USA', keywords: ['linux', 'kernel', 'ubuntu', 'debian'] },
  'sap': { lat: 49.2933, lon: 8.6417, location: 'Walldorf, Germany', keywords: ['sap', 'netweaver'] },
  'siemens': { lat: 48.1351, lon: 11.5820, location: 'Munich, Germany', keywords: ['siemens', 'simatic'] },
  'samsung': { lat: 37.5665, lon: 126.9780, location: 'Seoul, South Korea', keywords: ['samsung', 'galaxy'] },
  'huawei': { lat: 22.5431, lon: 114.0579, location: 'Shenzhen, China', keywords: ['huawei'] },
  'fortinet': { lat: 37.3861, lon: -121.9233, location: 'Sunnyvale, USA', keywords: ['fortinet', 'fortigate'] },
  'palo alto': { lat: 37.4419, lon: -122.1430, location: 'Santa Clara, USA', keywords: ['palo alto networks', 'pan-os'] },
  'juniper': { lat: 37.3980, lon: -121.9221, location: 'Sunnyvale, USA', keywords: ['juniper', 'junos'] },
  'dell': { lat: 30.4018, lon: -97.7252, location: 'Round Rock, USA', keywords: ['dell', 'emc'] },
  'hp': { lat: 37.4054, lon: -121.9690, location: 'Palo Alto, USA', keywords: ['hp', 'hewlett packard'] },
  'wordpress': { lat: 37.7749, lon: -122.4194, location: 'San Francisco, USA', keywords: ['wordpress', 'wp'] },
  'drupal': { lat: 45.5152, lon: -122.6784, location: 'Portland, USA', keywords: ['drupal'] },
  'apache': { lat: 38.5816, lon: -121.4944, location: 'Forest Hill, USA', keywords: ['apache', 'tomcat', 'struts'] },
  'nginx': { lat: 37.7749, lon: -122.4194, location: 'San Francisco, USA', keywords: ['nginx'] },
  'mozilla': { lat: 37.3861, lon: -122.0839, location: 'Mountain View, USA', keywords: ['mozilla', 'firefox', 'thunderbird'] },
};

function geocodeCVE(description: string, vendors: string[]): { lat: number; lon: number; locationName: string } {
  const text = description.toLowerCase();

  // Check vendors first
  for (const vendor of vendors) {
    const vendorLower = vendor.toLowerCase();
    for (const [key, data] of Object.entries(CVE_LOCATION_DATABASE)) {
      if (data.keywords.some(kw => vendorLower.includes(kw))) {
        return { lat: data.lat, lon: data.lon, locationName: data.location };
      }
    }
  }

  // Check description for keywords
  for (const [key, data] of Object.entries(CVE_LOCATION_DATABASE)) {
    if (data.keywords.some(kw => text.includes(kw))) {
      return { lat: data.lat, lon: data.lon, locationName: data.location };
    }
  }

  // Default to Silicon Valley for tech vulnerabilities
  return { lat: 37.3861, lon: -122.0839, locationName: 'Silicon Valley, USA' };
}

function getSeverityFromCVSS(score: number): string {
  if (score >= 9.0) return 'critical';
  if (score >= 7.0) return 'high';
  if (score >= 4.0) return 'medium';
  return 'low';
}

async function fetchCVEs() {
  try {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(today);
    endDate.setHours(23, 59, 59, 999);

    const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?pubStartDate=${startDate.toISOString()}&pubEndDate=${endDate.toISOString()}`;

    const response = await fetchWithTimeout(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data: any = await response.json();

    if (!data?.vulnerabilities) return [];

    const cves: any[] = [];

    for (const vuln of data.vulnerabilities.slice(0, 50)) {
      const cve = vuln.cve;
      const cveId = cve.id;
      const description = cve.descriptions?.find((d: any) => d.lang === 'en')?.value || 'No description available';

      // Get CVSS score
      const cvssMetrics = cve.metrics?.cvssMetricV31?.[0] || cve.metrics?.cvssMetricV30?.[0] || cve.metrics?.cvssMetricV40?.[0];
      const cvssScore = cvssMetrics?.cvssData?.baseScore || 5.0;

      // Only include CVEs with CVSS >= 6.0 (medium-high to critical)
      if (cvssScore < 6.0) continue;

      const severity = getSeverityFromCVSS(cvssScore);

      // Extract vendors/products
      const vendors: string[] = [];
      if (cve.configurations?.nodes) {
        for (const node of cve.configurations.nodes) {
          if (node.cpeMatch) {
            for (const match of node.cpeMatch) {
              const cpe = match.criteria || '';
              const parts = cpe.split(':');
              if (parts.length > 3) vendors.push(parts[3]); // vendor name
            }
          }
        }
      }

      const location = geocodeCVE(description, vendors);

      cves.push({
        id: `cve-${cveId}`,
        title: `${cveId} (CVSS ${cvssScore})`,
        description: description.substring(0, 300),
        type: 'cyber',
        severity,
        lat: location.lat,
        lon: location.lon,
        locationName: location.locationName,
        timestamp: new Date(cve.published).getTime(),
        source: 'NIST NVD',
        livestreamUrl: `https://nvd.nist.gov/vuln/detail/${cveId}`,
      });
    }

    return cves;
  } catch (error) {
    console.error('CVE fetch error:', error);
    return [];
  }
}

async function fetchTravelAdvisories() {
  try {
    const response = await fetchWithTimeout('https://travel.state.gov/_res/rss/TAsTWs.xml', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const xml = await response.text();

    return new Promise<any[]>((resolve, reject) => {
      parseString(xml, (err, result) => {
        if (err) {
          reject(err);
          return;
        }

        const advisories: any[] = [];
        const items = result?.rss?.channel?.[0]?.item || [];

        for (const item of items.slice(0, 30)) {
          const title = item.title?.[0] || '';
          const description = item.description?.[0] || '';
          const link = item.link?.[0] || '';
          const pubDate = item.pubDate?.[0] || new Date().toISOString();

          if (!title) continue;

          // Extract country and level from title (e.g., "Russia - Level 4: Do Not Travel")
          const match = title.match(/^(.+?)\s*-\s*Level\s+(\d+):/i);
          if (!match) continue;

          const country = match[1].trim();
          const level = parseInt(match[2]);

          // Map level to severity
          let severity = 'low';
          if (level === 4) severity = 'critical'; // Do Not Travel
          else if (level === 3) severity = 'high'; // Reconsider Travel
          else if (level === 2) severity = 'medium'; // Exercise Increased Caution
          else severity = 'low'; // Exercise Normal Precautions

          // Find country in location database
          const location = LOCATION_DATABASE[country.toLowerCase()];
          if (!location) continue;

          advisories.push({
            id: `travel-${Buffer.from(country).toString('base64').substring(0, 20)}`,
            title: title.substring(0, 200),
            description: description.replace(/<[^>]*>/g, '').substring(0, 300),
            type: 'advisory',
            severity,
            lat: location.lat,
            lon: location.lon,
            locationName: country,
            timestamp: new Date(pubDate).getTime(),
            source: 'US State Dept',
            livestreamUrl: link || null,
          });
        }

        resolve(advisories);
      });
    });
  } catch (error) {
    console.error('Travel advisory fetch error:', error);
    return [];
  }
}

async function fetchAviationWarnings() {
  try {
    // Using Aviation Safety Network's RSS feed which is more reliable
    const response = await fetchWithTimeout('https://aviation-safety.net/news/rss.xml', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const xml = await response.text();

    return new Promise<any[]>((resolve, reject) => {
      parseString(xml, { strict: false, trim: true }, (err, result) => {
        if (err) {
          reject(err);
          return;
        }

        const warnings: any[] = [];
        const items = result?.rss?.channel?.[0]?.item || [];

        for (const item of items.slice(0, 20)) {
          const title = item.title?.[0] || '';
          const description = item.description?.[0] || '';
          const link = item.link?.[0] || '';
          const pubDate = item.pubDate?.[0] || new Date().toISOString();

          if (!title) continue;

          // Determine severity based on keywords in title/description
          let severity = 'low';
          const text = (title + ' ' + description).toLowerCase();

          if (text.includes('crash') || text.includes('fatal') || text.includes('accident') || text.includes('hull loss')) {
            severity = 'critical';
          } else if (text.includes('emergency') || text.includes('smoke') || text.includes('fire') || text.includes('engine') || text.includes('divert')) {
            severity = 'high';
          } else if (text.includes('incident') || text.includes('return') || text.includes('damage') || text.includes('evacuation')) {
            severity = 'medium';
          }

          // Try to extract location from title
          let lat = 40.7128; // Default to New York (major aviation hub)
          let lon = -74.0060;
          let locationName = 'Aviation Incident';

          // Extract country/location patterns
          const locationPatterns = [
            { pattern: /near\s+(\w+)/i, name: 1 },
            { pattern: /at\s+(\w+)/i, name: 1 },
            { pattern: /over\s+(\w+)/i, name: 1 },
            { pattern: /in\s+(\w+)/i, name: 1 },
            { pattern: /,\s+(\w+)$/i, name: 1 },
          ];

          for (const { pattern, name } of locationPatterns) {
            const match = title.match(pattern);
            if (match) {
              const placeName = match[name];
              const location = LOCATION_DATABASE[placeName.toLowerCase()];
              if (location) {
                lat = location.lat;
                lon = location.lon;
                locationName = placeName;
                break;
              }
            }
          }

          warnings.push({
            id: `aviation-${Buffer.from(title).toString('base64').substring(0, 20)}`,
            title: title.substring(0, 200),
            description: description.replace(/<[^>]*>/g, '').substring(0, 300),
            type: 'other',
            severity,
            lat,
            lon,
            locationName,
            timestamp: new Date(pubDate).getTime(),
            source: 'Aviation Safety Network',
            livestreamUrl: link || null,
          });
        }

        resolve(warnings);
      });
    });
  } catch (error) {
    console.error('Aviation warnings fetch error:', error);
    return [];
  }
}

// OpenSky Network - Aircraft Emergency & Military Tracking
async function fetchAircraftTracking() {
  try {
    const response = await fetchWithTimeout('https://opensky-network.org/api/states/all');
    const data: any = await response.json();

    if (!data || !data.states) {
      return [];
    }

    const aircraft: any[] = [];

    // === KNOWN MILITARY/GOVERNMENT CALLSIGNS (Confirmed) ===
    const confirmedMilitaryPatterns = [
      // United States (Confirmed)
      /^USAF\d+$/i,                         // US Air Force
      /^(NAVY|MARINE|COAST)\d+$/i,          // US Navy/Marines/Coast Guard
      /^(RCH|REACH)\d{3,4}$/i,              // US Air Force Reach (transport)
      /^SPAR\d+$/i,                         // Special Air Mission (VIP)
      /^SAM\d+$/i,                          // Air Force One, VIP flights
      /^(TORCH|MAGMA|STEEL|DUKE)\d+$/i,    // Known US military exercises
      /^JANET\d*$/i,                        // Janet Airlines (Area 51 contractor)
      /^CNV\d+$/i,                          // Convoy (military transport)

      // United Kingdom
      /^RAF\d+$/i,                          // Royal Air Force
      /^(ASCOT|TARTAN)\d+$/i,               // RAF transport
      /^RRR\d+$/i,                          // RAF rescue

      // Russia
      /^RFF\d+$/i,                          // Russian Air Force
      /^RSD\d+$/i,                          // Russian State
      /^ROSSIYA\d*$/i,                      // Russian presidential

      // China
      /^CHN\d+$/i,                          // Chinese government

      // NATO & Allies
      /^NATO\d+$/i,                         // NATO
      /^(CTM|COTAM)\d+$/i,                  // France Air Force
      /^GAF\d+$/i,                          // Germany Luftwaffe
      /^(CFC|CANFORCE|RCAF)\d+$/i,         // Canada
      /^(STAL|ASY|RAAF)\d+$/i,             // Australia

      // Generic Confirmed
      /^(RESCUE|MEDEVAC|LIFEGUARD)\d+$/i,  // Medical/rescue
      /^(POLICE|PATROL)\d+$/i,              // Law enforcement
    ];

    // === SUSPECTED MILITARY/GOVERNMENT (Probable) ===
    const suspectedMilitaryPatterns = [
      /^XXX\d+$/i,                          // Blocked callsigns (often military)
      /^(GOV|GOVT|STATE)\d+$/i,            // Generic government
      // REMOVED: /^[A-Z]{3}\d{1,2}$/ - too broad, catches commercial flights
    ];

    // === VIP/ROYAL FLIGHTS ===
    const vipPatterns = [
      /^SAUDIA0[1-9]$/i,                    // Saudi Royal (01-09 only, 100+ is commercial)
      /^HZ-HM\d+$/i,                        // Saudi Royal registration
      /^QATAF\d+$/i,                        // Qatar Amiri Flight (royal family)
      /^(SULTAN|KING|ROYAL)\d+$/i,          // Royal callsigns
    ];

    // === KNOWN CELEBRITY/VIP AIRCRAFT (ICAO codes) ===
    // Curated list of known celebrity/corporate jets
    const knownCelebrityAircraft: { [key: string]: string } = {
      // Celebrities (verified ICAO24 codes)
      'a326ca': 'Taylor Swift (Dassault Falcon 900)',
      'a5094b': 'Drake (Boeing 767)',
      'a835af': 'Elon Musk (Gulfstream G650ER)',
      'a37346': 'Kim Kardashian (Gulfstream G650ER)',

      // Tech Billionaires
      'a3c8e9': 'Jeff Bezos (Gulfstream G650ER)',
      'a2d8de': 'Bill Gates (Bombardier BD-700)',
      'a54b7a': 'Mark Zuckerberg (Gulfstream G650)',

      // Known government contractors / suspicious
      'a1fbe7': 'Suspected Gov Contractor',
      'a802a5': 'Suspected Gov Contractor',

      // Add more as discovered through OSINT
    };

    for (const state of data.states) {
      const callsign = state[1] ? state[1].trim() : '';
      const squawk = state[14]; // Squawk code
      const lat = state[6];
      const lon = state[5];
      const altitude = state[7]; // Barometric altitude in meters
      const velocity = state[9]; // Velocity in m/s
      const onGround = state[8];
      const icao24 = state[0]; // ICAO24 hex code

      // Skip aircraft on ground or without position
      if (onGround || lat === null || lon === null) continue;

      let isInteresting = false;
      let title = '';
      let severity = 'low';
      let description = '';

      let category = '';

      // Priority 1: Emergency squawk codes (highest priority)
      if (squawk === '7700') {
        isInteresting = true;
        title = `🚨 EMERGENCY: ${callsign || icao24} - General Emergency (7700)`;
        description = `Aircraft broadcasting emergency squawk code 7700 (General Emergency)`;
        severity = 'critical';
        category = 'Emergency';
      } else if (squawk === '7600') {
        isInteresting = true;
        title = `⚠️ ALERT: ${callsign || icao24} - Radio Failure (7600)`;
        description = `Aircraft broadcasting squawk code 7600 (Lost Communications)`;
        severity = 'high';
        category = 'Emergency';
      } else if (squawk === '7500') {
        isInteresting = true;
        title = `🔴 HIJACK: ${callsign || icao24} - Unlawful Interference (7500)`;
        description = `Aircraft broadcasting squawk code 7500 (Unlawful Interference/Hijacking)`;
        severity = 'critical';
        category = 'Emergency';
      }
      // Priority 2: Known celebrity/VIP aircraft
      else if (knownCelebrityAircraft[icao24.toLowerCase()]) {
        isInteresting = true;
        const owner = knownCelebrityAircraft[icao24.toLowerCase()];
        title = `⭐ VIP: ${owner}'s Aircraft (${callsign || icao24})`;
        description = `Celebrity/VIP private aircraft: ${owner}`;
        severity = 'low';
        category = 'Celebrity';
      }
      // Priority 3: Confirmed military/government
      else if (callsign && confirmedMilitaryPatterns.some(pattern => pattern.test(callsign))) {
        isInteresting = true;
        title = `✈️ Military: ${callsign}`;
        description = `Confirmed military or government aircraft`;
        severity = 'medium';
        category = 'Military';
      }
      // Priority 4: VIP/Royal flights
      else if (callsign && vipPatterns.some(pattern => pattern.test(callsign))) {
        isInteresting = true;
        title = `👑 Royal/VIP: ${callsign}`;
        description = `Royal family or VIP government flight`;
        severity = 'medium';
        category = 'VIP';
      }
      // Priority 5: Suspected military/government
      else if (callsign && suspectedMilitaryPatterns.some(pattern => pattern.test(callsign))) {
        isInteresting = true;
        title = `🔍 Suspected Gov: ${callsign}`;
        description = `Suspected military or government aircraft (probable)`;
        severity = 'low';
        category = 'Suspected Military';
      }

      if (isInteresting) {
        const altitudeFt = altitude ? Math.round(altitude * 3.28084) : 0;
        const speedKnots = velocity ? Math.round(velocity * 1.94384) : 0;

        // Determine type based on category
        let type = 'other';
        if (squawk && ['7700', '7600', '7500'].includes(squawk)) {
          type = 'emergency';
        } else if (category === 'Military' || category === 'Suspected Military') {
          type = 'military';
        } else if (category === 'VIP' || category === 'Celebrity') {
          type = 'other'; // VIP/Celebrity stay as 'other'
        }

        aircraft.push({
          id: `aircraft-${icao24}-${squawk || category}`, // Use ICAO + squawk/category for stable ID
          title,
          description: `[${category}] ${description}. Altitude: ${altitudeFt}ft, Speed: ${speedKnots}kts`,
          type,
          severity,
          lat,
          lon,
          locationName: `${callsign || icao24} - ICAO: ${icao24}`,
          timestamp: Date.now(),
          source: 'OpenSky Network',
          livestreamUrl: `https://globe.adsbexchange.com/?icao=${icao24}`,
        });
      }
    }

    return aircraft;
  } catch (error) {
    console.error('OpenSky aircraft tracking error:', error);
    return [];
  }
}

// Cloud Provider Status Monitoring
async function fetchCloudStatus() {
  const statusPages = [
    {
      name: 'Cloudflare',
      url: 'https://www.cloudflarestatus.com/api/v2/summary.json',
      type: 'statuspage',
    },
    {
      name: 'AWS',
      url: 'https://status.aws.amazon.com/data.json',
      type: 'aws',
    },
    {
      name: 'Google Cloud',
      url: 'https://status.cloud.google.com/incidents.json',
      type: 'gcp',
    },
    {
      name: 'Microsoft Azure',
      url: 'https://azure.status.microsoft/api/v2/status.json',
      type: 'statuspage',
    },
    {
      name: 'GitHub',
      url: 'https://www.githubstatus.com/api/v2/summary.json',
      type: 'statuspage',
    },
    {
      name: 'OpenAI',
      url: 'https://status.openai.com/api/v2/summary.json',
      type: 'statuspage',
    },
    {
      name: 'Akamai',
      url: 'https://cloudharmony.com/api/status/akamai',
      type: 'generic',
    },
    // Major ISPs and Tier 1 Providers
    {
      name: 'Verizon',
      url: 'https://www.verizon.com/support/status/api/v2/summary.json',
      type: 'statuspage',
    },
    {
      name: 'AT&T',
      url: 'https://www.att.com/outages/api/v2/summary.json',
      type: 'statuspage',
    },
    {
      name: 'Comcast/Xfinity',
      url: 'https://www.xfinity.com/support/status/api/v2/summary.json',
      type: 'statuspage',
    },
    {
      name: 'CenturyLink/Lumen',
      url: 'https://status.ctl.io/api/v2/summary.json',
      type: 'statuspage',
    },
    {
      name: 'Cogent',
      url: 'https://status.cogentco.com/api/v2/summary.json',
      type: 'statuspage',
    },
    {
      name: 'Level3/Lumen',
      url: 'https://status.level3.com/api/v2/summary.json',
      type: 'statuspage',
    },
    {
      name: 'NTT Communications',
      url: 'https://status.gin.ntt.net/api/v2/summary.json',
      type: 'statuspage',
    },
    {
      name: 'Telia Carrier',
      url: 'https://status.teliacarrier.com/api/v2/summary.json',
      type: 'statuspage',
    },
    {
      name: 'GTT',
      url: 'https://status.gtt.net/api/v2/summary.json',
      type: 'statuspage',
    },
    {
      name: 'Hurricane Electric',
      url: 'https://status.he.net/api/v2/summary.json',
      type: 'statuspage',
    },
    {
      name: 'Zayo',
      url: 'https://status.zayo.com/api/v2/summary.json',
      type: 'statuspage',
    },
    // CDNs and Edge Providers
    {
      name: 'Fastly',
      url: 'https://status.fastly.com/api/v2/summary.json',
      type: 'statuspage',
    },
    {
      name: 'DigitalOcean',
      url: 'https://status.digitalocean.com/api/v2/summary.json',
      type: 'statuspage',
    },
    {
      name: 'Linode',
      url: 'https://status.linode.com/api/v2/summary.json',
      type: 'statuspage',
    },
    {
      name: 'Vercel',
      url: 'https://www.vercel-status.com/api/v2/summary.json',
      type: 'statuspage',
    },
    {
      name: 'Netlify',
      url: 'https://www.netlifystatus.com/api/v2/summary.json',
      type: 'statuspage',
    },
  ];

  const incidents: any[] = [];

  for (const provider of statusPages) {
    try {
      const response = await fetchWithTimeout(provider.url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });

      if (!response.ok) continue;

      const data = await response.json();

      if (provider.type === 'statuspage') {
        // Standard Statuspage.io format (Cloudflare, GitHub, Azure, OpenAI)
        // ONLY create incident for ACTIVE incidents (investigating, identified, monitoring), not resolved
        // Check for active incidents within last 12 hours
        if (data.incidents && Array.isArray(data.incidents)) {
          for (const incident of data.incidents.slice(0, 5)) {
            // Only include incidents that are actively being worked on (not resolved)
            if (incident.status === 'investigating' || incident.status === 'identified' || incident.status === 'monitoring') {
              // Check if incident is recent (within last 12 hours)
              const incidentAge = Date.now() - new Date(incident.created_at).getTime();
              const twelveHoursInMs = 12 * 60 * 60 * 1000;

              if (incidentAge < twelveHoursInMs) {
                incidents.push({
                  id: `cloud-incident-${incident.id}`, // Stable ID based on incident ID
                  title: `${provider.name}: ${incident.name}`,
                  description: incident.incident_updates?.[0]?.body || incident.shortlink || 'Active incident',
                  type: 'infrastructure',
                  severity: incident.impact === 'critical' ? 'critical' : incident.impact === 'major' ? 'high' : 'medium',
                  lat: 37.7749,
                  lon: -122.4194,
                  locationName: `${provider.name} - ${incident.impact || 'Impact Unknown'}`,
                  timestamp: new Date(incident.created_at || Date.now()).getTime(),
                  source: `${provider.name} Status`,
                  livestreamUrl: incident.shortlink || provider.url.replace('/api/v2/status.json', '').replace('/api/v2/summary.json', ''),
                });
              }
            }
          }
        }
      } else if (provider.type === 'gcp') {
        // Google Cloud Platform format
        if (Array.isArray(data)) {
          for (const incident of data.slice(0, 5)) {
            if (incident.currently_affected || incident.severity) {
              incidents.push({
                id: `cloud-gcp-${incident.id || Date.now()}`,
                title: `Google Cloud: ${incident.external_desc || incident.service_name}`,
                description: incident.most_recent_update?.text || incident.external_desc || 'Service disruption',
                type: 'infrastructure',
                severity: incident.severity === 'high' ? 'high' : 'medium',
                lat: 37.4221,
                lon: -122.0841,
                locationName: `Google Cloud - ${incident.service_name || 'Multiple Services'}`,
                timestamp: new Date(incident.begin || Date.now()).getTime(),
                source: 'Google Cloud Status',
                livestreamUrl: 'https://status.cloud.google.com/',
              });
            }
          }
        }
      } else if (provider.type === 'aws') {
        // AWS Status format (if it returns JSON)
        // Note: AWS uses a different format, this is a best-effort parser
        if (data.current_events && Array.isArray(data.current_events)) {
          for (const event of data.current_events.slice(0, 5)) {
            incidents.push({
              id: `cloud-aws-${event.event_arn || Date.now()}`,
              title: `AWS: ${event.service || 'Service'} - ${event.event_type_category}`,
              description: event.event_type_code || 'AWS service event',
              type: 'infrastructure',
              severity: 'medium',
              lat: 38.9072,
              lon: -77.0369,
              locationName: `AWS ${event.region || 'Global'}`,
              timestamp: new Date(event.start_time || Date.now()).getTime(),
              source: 'AWS Status',
              livestreamUrl: 'https://status.aws.amazon.com/',
            });
          }
        }
      }
    } catch (error) {
      // Silently fail for individual providers
      continue;
    }
  }

  return incidents;
}

// Warzone and Military Movement Tracking
async function fetchWarzoneData() {
  const incidents: any[] = [];

  // Real-time conflict data sources - defense and conflict focused
  const rssFeeds = [
    { url: 'https://www.defensenews.com/arc/outboundfeeds/rss/', source: 'Defense News' },
    { url: 'https://www.janes.com/feeds/news', source: 'Janes Defence' },
    { url: 'https://www.militarytimes.com/arc/outboundfeeds/rss/', source: 'Military Times' },
    { url: 'https://warisboring.com/feed/', source: 'War is Boring' },
    { url: 'https://www.understandingwar.org/feeds/publications.xml', source: 'ISW' },
  ];

  for (const feed of rssFeeds) {
    try {
      const response = await fetchWithTimeout(feed.url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      const xml = await response.text();

      await new Promise<void>((resolve) => {
        parseString(xml, (err: any, result: any) => {
          if (err) {
            resolve();
            return;
          }

          const channel = result?.rss?.channel?.[0];
          const entries = channel?.item || result?.feed?.entry || [];

          for (const entry of entries.slice(0, 15)) {
            const title = entry.title?.[0]?._ || entry.title?.[0] || '';
            const description = entry.description?.[0]?._ || entry.description?.[0] || '';
            const link = entry.link?.[0]?.$ || entry.link?.[0] || '';
            // Handle various pubDate field names (pubDate, pubdate, published, updated)
          const pubDate = entry.pubDate?.[0] || entry.pubdate?.[0] || entry.published?.[0] || entry.updated?.[0] || new Date().toISOString();

            if (!title) continue;

            const text = `${title} ${description}`.toLowerCase();

            // SPECIFIC military operation keywords - avoid false positives
            const militaryActionKeywords = [
              'airstrike', 'air strike', 'drone strike', 'missile strike',
              'combat', 'battle', 'offensive', 'troops deployed', 'military operation',
              'bombardment', 'shelling', 'artillery fire', 'rocket attack',
              'fighting', 'casualties', 'killed in action', 'wounded',
              'warzone', 'frontline', 'front line', 'ceasefire',
              'invasion', 'occupied', 'liberation', 'siege',
              'military convoy', 'armed forces', 'soldiers', 'battalion',
              'naval', 'warship', 'fighter jet', 'tank', 'armored',
              'terrorist attack', 'insurgent', 'rebel forces', 'militia',
              'hamas attack', 'houthi', 'taliban', 'hezbollah'
            ];

            // Must match at least one specific military action keyword
            if (!militaryActionKeywords.some(kw => text.includes(kw))) continue;

            // Try to geocode the location
            const location = geocodeNewsArticle(title, description);
            if (!location) continue;

            let severity = 'high';
            if (text.includes('casualties') || text.includes('killed') || text.includes('offensive') || text.includes('invasion')) severity = 'critical';

            incidents.push({
              id: `conflict-${feed.source}-${Buffer.from(title).toString('base64').substring(0, 20)}`,
              title: title.substring(0, 200),
              description: description.substring(0, 300),
              type: 'military',
              severity,
              lat: location.lat,
              lon: location.lon,
              locationName: location.locationName,
              timestamp: new Date(pubDate).getTime(),
              source: feed.source,
              livestreamUrl: typeof link === 'string' ? link : link?.href || null,
            });
          }

          resolve();
        });
      });
    } catch (error) {
      // Skip failed feeds
      continue;
    }
  }

  return incidents;
}

// Political Summits and Business Deals News
async function fetchPoliticalBusinessNews() {
  const incidents: any[] = [];

  // Specialized RSS feeds for political/business news
  const feeds = [
    // Political/Diplomatic
    { url: 'https://www.state.gov/rss-feed/secretary-antony-j-blinkens-travels/feed/', source: 'US State Dept' },
    { url: 'https://www.un.org/press/en/content/rss-feeds', source: 'UN News' },
    { url: 'https://www.nato.int/rss/xml-rss.xml', source: 'NATO' },

    // Business/Trade
    { url: 'https://www.ft.com/rss/home', source: 'Financial Times' },
    { url: 'https://www.bloomberg.com/politics/feeds/sitemap_news.xml', source: 'Bloomberg Politics' },
    { url: 'https://www.wsj.com/xml/rss/3_7085.xml', source: 'WSJ World News' },
    { url: 'https://www.economist.com/international/rss.xml', source: 'The Economist' },
  ];

  const results = await Promise.allSettled(
    feeds.map(async f => {
      try {
        const response = await fetchWithTimeout(f.url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        const xml = await response.text();

        return new Promise<any[]>((resolve, reject) => {
          parseString(xml, (err, result) => {
            if (err) {
              reject(err);
              return;
            }

            const items: any[] = [];
            const channel = result?.rss?.channel?.[0];
            const entries = channel?.item || result?.feed?.entry || [];

            for (const entry of entries.slice(0, 15)) {
              const title = entry.title?.[0]?._ || entry.title?.[0] || '';
              const description = entry.description?.[0]?._ || entry.description?.[0] || entry.summary?.[0]?._ || entry.summary?.[0] || '';
              const link = entry.link?.[0]?.$ || entry.link?.[0] || entry.id?.[0] || '';
              // Handle various pubDate field names (pubDate, pubdate, published, updated)
          const pubDate = entry.pubDate?.[0] || entry.pubdate?.[0] || entry.published?.[0] || entry.updated?.[0] || new Date().toISOString();

              if (!title) continue;

              const text = `${title} ${description}`.toLowerCase();

              // Filter for political summits, diplomatic meetings, major business deals
              const politicalKeywords = ['summit', 'meeting', 'talks', 'negotiation', 'treaty', 'agreement',
                                       'diplomatic', 'foreign minister', 'president meets', 'prime minister',
                                       'bilateral', 'multilateral', 'g7', 'g20', 'brics', 'asean', 'eu summit'];

              const businessKeywords = ['merger', 'acquisition', 'deal worth', 'billion dollar', 'investment',
                                       'trade agreement', 'partnership', 'joint venture', 'ipo', 'contract awarded'];

              const isPolitical = politicalKeywords.some(kw => text.includes(kw));
              const isBusiness = businessKeywords.some(kw => text.includes(kw));

              if (!isPolitical && !isBusiness) continue;

              // Try to extract location from the article
              const location = geocodeNewsArticle(title, description);
              if (!location) continue;

              let type = 'political';
              let severity = 'medium';

              if (isBusiness) {
                type = 'business';
                // Check if it's a major deal
                if (text.includes('billion') || text.includes('acquisition')) severity = 'high';
              }

              if (text.includes('summit') || text.includes('treaty') || text.includes('agreement')) {
                severity = 'high';
              }

              items.push({
                id: `polbiz-${f.source}-${Buffer.from(title).toString('base64').substring(0, 20)}`,
                title: title.substring(0, 200),
                description: description.substring(0, 300),
                type,
                severity,
                lat: location.lat,
                lon: location.lon,
                locationName: location.locationName,
                timestamp: new Date(pubDate).getTime(),
                source: `${f.source}`,
                livestreamUrl: typeof link === 'string' ? link : link?.href || null,
              });
            }

            resolve(items);
          });
        });
      } catch (error) {
        console.error(`Political/Business RSS error (${f.source}):`, error);
        return [];
      }
    })
  );

  results.forEach(result => {
    if (result.status === 'fulfilled') {
      incidents.push(...result.value);
    }
  });

  return incidents;
}

// Maritime Incidents (Piracy, Shipping, Naval)
async function fetchMaritimeIncidents() {
  const incidents: any[] = [];

  // IMO (International Maritime Organization) piracy reports
  // Using public maritime news sources
  const feeds = [
    { url: 'https://www.maritime-executive.com/api/content/rss', source: 'Maritime Executive' },
    { url: 'https://gcaptain.com/feed/', source: 'gCaptain' },
    { url: 'https://www.fleetmon.com/rss/news/', source: 'FleetMon' },
  ];

  for (const feed of feeds) {
    try {
      const response = await fetchWithTimeout(feed.url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      const xml = await response.text();

      await new Promise<void>((resolve) => {
        parseString(xml, (err: any, result: any) => {
          if (err) {
            resolve();
            return;
          }

          const channel = result?.rss?.channel?.[0];
          const entries = channel?.item || result?.feed?.entry || [];

          for (const entry of entries.slice(0, 10)) {
            const title = entry.title?.[0]?._ || entry.title?.[0] || '';
            const description = entry.description?.[0]?._ || entry.description?.[0] || '';
            const link = entry.link?.[0]?.$ || entry.link?.[0] || '';
            // Handle various pubDate field names (pubDate, pubdate, published, updated)
          const pubDate = entry.pubDate?.[0] || entry.pubdate?.[0] || entry.published?.[0] || entry.updated?.[0] || new Date().toISOString();

            if (!title) continue;

            const text = `${title} ${description}`.toLowerCase();

            // Filter for maritime incidents
            const maritimeKeywords = ['piracy', 'hijack', 'seized', 'attack', 'collision', 'sinking', 'distress',
                                     'oil spill', 'grounding', 'fire', 'explosion', 'missing vessel', 'rescue',
                                     'naval', 'warship', 'blockade', 'strait', 'port closure'];

            if (!maritimeKeywords.some(kw => text.includes(kw))) continue;

            const location = geocodeNewsArticle(title, description);
            if (!location) continue;

            let severity = 'medium';
            if (text.includes('piracy') || text.includes('hijack') || text.includes('sinking')) severity = 'high';
            if (text.includes('oil spill') || text.includes('blockade')) severity = 'high';

            incidents.push({
              id: `maritime-${feed.source}-${Buffer.from(title).toString('base64').substring(0, 20)}`,
              title: title.substring(0, 200),
              description: description.substring(0, 300),
              type: 'maritime',
              severity,
              lat: location.lat,
              lon: location.lon,
              locationName: location.locationName,
              timestamp: new Date(pubDate).getTime(),
              source: feed.source,
              livestreamUrl: typeof link === 'string' ? link : link?.href || null,
            });
          }

          resolve();
        });
      });
    } catch (error) {
      continue;
    }
  }

  return incidents;
}

// Cyber Attacks and Data Breaches
async function fetchCyberIncidents() {
  console.log('🔐 Fetching cyber incidents from security news feeds...');
  const incidents: any[] = [];

  const feeds = [
    { url: 'https://www.bleepingcomputer.com/feed/', source: 'BleepingComputer' },
    { url: 'https://www.zdnet.com/news/rss.xml', source: 'ZDNet Security' },
    { url: 'https://feeds.feedburner.com/TheHackersNews', source: 'The Hacker News' },
    { url: 'https://krebsonsecurity.com/feed/', source: 'Krebs on Security' },
    { url: 'https://www.securityweek.com/feed/', source: 'SecurityWeek' },
    { url: 'https://cyberscoop.com/feed/', source: 'CyberScoop' },
    { url: 'https://www.cisa.gov/news.xml', source: 'CISA' },
    { url: 'https://www.darkreading.com/rss.xml', source: 'Dark Reading' },
  ];

  for (const feed of feeds) {
    try {
      console.log(`  📡 Fetching ${feed.source}...`);
      const response = await fetchWithTimeout(feed.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      });
      const xml = await response.text();
      console.log(`  ✓ Got response from ${feed.source} (${xml.length} bytes)`);

      await new Promise<void>((resolve) => {
        parseString(xml, (err: any, result: any) => {
          if (err) {
            console.log(`  ✗ Parse error for ${feed.source}:`, err.message);
            resolve();
            return;
          }

          const channel = result?.rss?.channel?.[0];
          const entries = channel?.item || result?.feed?.entry || [];
          console.log(`  📰 ${feed.source}: Found ${entries.length} entries`);

          for (const entry of entries.slice(0, 10)) {
            const title = entry.title?.[0]?._ || entry.title?.[0] || '';
            const description = entry.description?.[0]?._ || entry.description?.[0] || '';
            const link = entry.link?.[0]?.$ || entry.link?.[0] || '';
            // Handle various pubDate field names (pubDate, pubdate, published, updated)
          const pubDate = entry.pubDate?.[0] || entry.pubdate?.[0] || entry.published?.[0] || entry.updated?.[0] || new Date().toISOString();

            if (!title) continue;

            const text = `${title} ${description}`.toLowerCase();

            // Filter for cyber security content (expanded keywords)
            const cyberKeywords = [
              'data breach', 'ransomware', 'hack', 'hacker', 'hacking', 'cyber attack', 'cyberattack', 'ddos',
              'zero-day', 'zero day', '0day', '0-day', 'exploit', 'exploited', 'exploitation',
              'apt', 'malware', 'spyware', 'trojan', 'botnet', 'phishing',
              'vulnerability', 'cve-', 'patch', 'security flaw', 'bug bounty',
              'compromised', 'leaked', 'stolen data', 'exfiltrat',
              'nation-state', 'critical infrastructure', 'threat actor', 'threat group',
              'credential', 'authentication bypass', 'rce', 'remote code execution',
              'encryption', 'decryption', 'cryptojacking', 'cryptomining',
              'firewall', 'intrusion', 'breach', 'attack surface', 'supply chain attack'
            ];

            // These are cybersecurity news sources - accept all articles from them
            const isCyberSource = ['Dark Reading', 'BleepingComputer', 'The Hacker News', 'Krebs on Security', 'SecurityWeek', 'CyberScoop'].includes(feed.source);
            const hasCyberKeyword = cyberKeywords.some(kw => text.includes(kw));

            // Accept if from dedicated cyber source OR has cyber keyword
            if (!isCyberSource && !hasCyberKeyword) continue;

            const location = geocodeNewsArticle(title, description);

            let severity = 'medium';
            if (text.includes('critical infrastructure') || text.includes('nation-state')) severity = 'critical';
            else if (text.includes('ransomware') || text.includes('zero-day') || text.includes('0day')) severity = 'high';

            incidents.push({
              id: `cyber-${feed.source}-${Buffer.from(title).toString('base64').substring(0, 20)}`,
              title: title.substring(0, 200),
              description: description.substring(0, 300),
              type: 'cyber',
              severity,
              lat: location?.lat || null,
              lon: location?.lon || null,
              locationName: location?.locationName || 'Global',
              timestamp: new Date(pubDate).getTime(),
              source: feed.source,
              livestreamUrl: typeof link === 'string' ? link : link?.href || null,
            });
          }

          resolve();
        });
      });
    } catch (error) {
      console.log(`  ✗ Error fetching ${feed.source}:`, error);
      continue;
    }
  }

  console.log(`🔐 Cyber incidents collected: ${incidents.length}`);
  return incidents;
}

// Nuclear Facilities and Radiation Monitoring
async function fetchNuclearIncidents() {
  const incidents: any[] = [];

  // IAEA (International Atomic Energy Agency) and nuclear news
  const feeds = [
    { url: 'https://www.world-nuclear-news.org/RSS/World_Nuclear_News', source: 'World Nuclear News' },
    { url: 'https://www.neimagazine.com/rss/news/', source: 'Nuclear Engineering Intl' },
  ];

  for (const feed of feeds) {
    try {
      const response = await fetchWithTimeout(feed.url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      const xml = await response.text();

      await new Promise<void>((resolve) => {
        parseString(xml, (err: any, result: any) => {
          if (err) {
            resolve();
            return;
          }

          const channel = result?.rss?.channel?.[0];
          const entries = channel?.item || result?.feed?.entry || [];

          for (const entry of entries.slice(0, 10)) {
            const title = entry.title?.[0]?._ || entry.title?.[0] || '';
            const description = entry.description?.[0]?._ || entry.description?.[0] || '';
            const link = entry.link?.[0]?.$ || entry.link?.[0] || '';
            // Handle various pubDate field names (pubDate, pubdate, published, updated)
          const pubDate = entry.pubDate?.[0] || entry.pubdate?.[0] || entry.published?.[0] || entry.updated?.[0] || new Date().toISOString();

            if (!title) continue;

            const text = `${title} ${description}`.toLowerCase();

            // Filter for nuclear incidents and security events
            const nuclearKeywords = ['incident', 'accident', 'leak', 'radiation', 'emergency', 'shutdown',
                                    'safety', 'meltdown', 'contamination', 'alert', 'warning', 'evacuation',
                                    'enrichment', 'weapons', 'proliferation', 'inspection'];

            if (!nuclearKeywords.some(kw => text.includes(kw))) continue;

            const location = geocodeNewsArticle(title, description);
            if (!location) continue;

            let severity = 'medium';
            if (text.includes('meltdown') || text.includes('emergency') || text.includes('leak')) severity = 'critical';
            else if (text.includes('incident') || text.includes('weapons')) severity = 'high';

            incidents.push({
              id: `nuclear-${feed.source}-${Buffer.from(title).toString('base64').substring(0, 20)}`,
              title: title.substring(0, 200),
              description: description.substring(0, 300),
              type: 'nuclear',
              severity,
              lat: location.lat,
              lon: location.lon,
              locationName: location.locationName,
              timestamp: new Date(pubDate).getTime(),
              source: feed.source,
              livestreamUrl: typeof link === 'string' ? link : link?.href || null,
            });
          }

          resolve();
        });
      });
    } catch (error) {
      continue;
    }
  }

  return incidents;
}

// Tech News - Hacker News, TechCrunch, Ars Technica, etc.
async function fetchTechNews() {
  const incidents: any[] = [];

  const feeds = [
    { url: 'https://hnrss.org/frontpage', source: 'Hacker News' },
    { url: 'https://techcrunch.com/feed/', source: 'TechCrunch' },
    { url: 'https://feeds.arstechnica.com/arstechnica/index', source: 'Ars Technica' },
    { url: 'https://www.theverge.com/rss/index.xml', source: 'The Verge' },
    { url: 'https://www.wired.com/feed/rss', source: 'Wired' },
    { url: 'https://www.technologyreview.com/feed/', source: 'MIT Tech Review' },
  ];

  for (const feed of feeds) {
    try {
      const response = await fetchWithTimeout(feed.url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      const xml = await response.text();

      await new Promise<void>((resolve) => {
        parseString(xml, (err: any, result: any) => {
          if (err) {
            resolve();
            return;
          }

          const channel = result?.rss?.channel?.[0];
          const entries = channel?.item || result?.feed?.entry || [];

          for (const entry of entries.slice(0, 15)) {
            const title = entry.title?.[0]?._ || entry.title?.[0] || '';
            const description = entry.description?.[0]?._ || entry.description?.[0] || entry.summary?.[0]?._ || entry.summary?.[0] || '';
            const link = entry.link?.[0]?.$ || entry.link?.[0]?._ || entry.link?.[0] || '';
            // Handle various pubDate field names (pubDate, pubdate, published, updated)
          const pubDate = entry.pubDate?.[0] || entry.pubdate?.[0] || entry.published?.[0] || entry.updated?.[0] || new Date().toISOString();

            if (!title) continue;

            const text = `${title} ${description}`.toLowerCase();

            // Filter for tech-related keywords
            const techKeywords = [
              'ai', 'artificial intelligence', 'machine learning', 'neural', 'llm', 'chatgpt', 'openai', 'claude', 'anthropic', 'gpt', 'gemini', 'copilot',
              'quantum', 'chip', 'semiconductor', 'processor', 'gpu', 'nvidia', 'amd', 'intel', 'apple silicon', 'm1', 'm2', 'm3', 'm4',
              'software', 'hardware', 'app', 'startup', 'tech', 'cloud', 'aws', 'azure', 'google', 'microsoft', 'meta', 'amazon',
              'crypto', 'blockchain', 'bitcoin', 'ethereum', 'web3', 'nft', 'defi',
              'robotics', 'drone', 'autonomous', 'self-driving', 'ev', 'electric vehicle', 'tesla', 'waymo',
              'space', 'spacex', 'rocket', 'satellite', 'mars', 'nasa', 'orbit', 'lunar',
              'cyber', 'security', 'breach', 'hack', 'hacker', 'vulnerability', 'zero-day', 'zero day', '0day', '0-day', 'exploit', 'malware', 'ransomware', 'phishing',
              'biotech', 'crispr', 'gene', 'medical device', 'genomics',
              'vr', 'ar', 'metaverse', 'virtual reality', 'augmented reality', 'headset', 'vision pro',
              'programming', 'programmer', 'coding', 'coder', 'developer', 'code', 'github', 'open source', 'opensource', 'api', 'sdk', 'framework',
              'algorithm', 'database', 'server', 'linux', 'rust', 'python', 'javascript', 'typescript', 'golang', 'swift',
              'privacy', 'encryption', 'vpn', 'data breach', 'leak', 'surveillance',
              'automation', 'bot', 'scraping', 'web scraper'
            ];

            const hasTechKeyword = techKeywords.some(keyword => text.includes(keyword));

            if (hasTechKeyword) {
              incidents.push({
                id: `tech-${feed.source}-${Buffer.from(title).toString('base64').substring(0, 20)}`,
                title,
                description: description.substring(0, 500),
                type: 'other', // Changed to 'other' to match current incident types
                severity: 'low',
                lat: null,
                lon: null,
                locationName: null,
                timestamp: new Date(pubDate).getTime(), // Keep in milliseconds like other incidents
                source: feed.source,
                livestreamUrl: typeof link === 'string' ? link : link?.href || null,
              });
            }
          }

          resolve();
        });
      });
    } catch (error) {
      // Skip failed feeds
    }
  }

  return incidents;
}

// Financial Sanctions and Economic Events
async function fetchFinancialIncidents() {
  const incidents: any[] = [];

  const feeds = [
    { url: 'https://www.bloomberg.com/feeds/podcasts/etf-report.xml', source: 'Bloomberg' },
    { url: 'https://www.cnbc.com/id/10000664/device/rss/rss.html', source: 'CNBC Markets' },
    { url: 'https://www.marketwatch.com/rss/topstories', source: 'MarketWatch' },
    { url: 'https://seekingalpha.com/feed.xml', source: 'Seeking Alpha' },
  ];

  for (const feed of feeds) {
    try {
      const response = await fetchWithTimeout(feed.url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      const xml = await response.text();

      await new Promise<void>((resolve) => {
        parseString(xml, (err: any, result: any) => {
          if (err) {
            resolve();
            return;
          }

          const channel = result?.rss?.channel?.[0];
          const entries = channel?.item || result?.feed?.entry || [];

          for (const entry of entries.slice(0, 20)) {
            const title = entry.title?.[0]?._ || entry.title?.[0] || '';
            const description = entry.description?.[0]?._ || entry.description?.[0] || '';
            const link = entry.link?.[0]?.$ || entry.link?.[0] || '';
            // Handle various pubDate field names (pubDate, pubdate, published, updated)
          const pubDate = entry.pubDate?.[0] || entry.pubdate?.[0] || entry.published?.[0] || entry.updated?.[0] || new Date().toISOString();

            if (!title) continue;

            const text = `${title} ${description}`.toLowerCase();

            // Broader financial/geopolitical keywords including country names with sanction programs
            const financialKeywords = [
              // Sanctions & Trade
              'sanction', 'embargo', 'tariff', 'trade war', 'export control', 'import ban',
              'freeze', 'asset freeze', 'swift', 'financial restriction',

              // Countries under sanctions
              'russia', 'iran', 'north korea', 'venezuela', 'cuba', 'syria', 'belarus',

              // Economic crises
              'default', 'crisis', 'collapse', 'bailout', 'recession', 'inflation surge',
              'currency collapse', 'debt crisis', 'banking crisis',

              // Major market events
              'market crash', 'stock plunge', 'sell-off', 'circuit breaker', 'trading halt'
            ];

            if (!financialKeywords.some(kw => text.includes(kw))) continue;

            const location = geocodeNewsArticle(title, description);
            if (!location) continue;

            let severity = 'medium';
            if (text.includes('collapse') || text.includes('crisis') || text.includes('default')) severity = 'high';
            if (text.includes('sanction') || text.includes('embargo') || text.includes('ban')) severity = 'high';
            if (text.includes('crash') || text.includes('plunge')) severity = 'high';

            incidents.push({
              id: `financial-${feed.source}-${Buffer.from(title).toString('base64').substring(0, 20)}`,
              title: title.substring(0, 200),
              description: description.substring(0, 300),
              type: 'financial',
              severity,
              lat: location.lat,
              lon: location.lon,
              locationName: location.locationName,
              timestamp: new Date(pubDate).getTime(),
              source: feed.source,
              livestreamUrl: typeof link === 'string' ? link : link?.href || null,
            });
          }

          resolve();
        });
      });
    } catch (error) {
      continue;
    }
  }

  return incidents;
}

// Additional Regional News Sources
async function fetchRegionalNews() {
  const incidents: any[] = [];

  const feeds = [
    // Middle East
    { url: 'https://english.alarabiya.net/rss.xml', source: 'Al Arabiya' },
    { url: 'https://www.jpost.com/rss/rssfeedsheadlines.aspx', source: 'Jerusalem Post' },

    // Asia
    { url: 'https://www.straitstimes.com/news/asia/rss.xml', source: 'Straits Times' },
    { url: 'https://www.koreatimes.co.kr/www/rss/rss.xml', source: 'Korea Times' },
    { url: 'https://www.bangkokpost.com/rss/data/news.xml', source: 'Bangkok Post' },

    // Africa
    { url: 'https://www.news24.com/news24/rss', source: 'News24 Africa' },

    // Latin America
    { url: 'https://rss.dw.com/rdf/rss-en-lat', source: 'DW Latin America' },

    // Russia/Eastern Europe
    { url: 'https://www.themoscowtimes.com/rss/news', source: 'Moscow Times' },
    { url: 'https://www.kyivpost.com/feed', source: 'Kyiv Post' },
  ];

  for (const feed of feeds) {
    try {
      const response = await fetchWithTimeout(feed.url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      const xml = await response.text();

      await new Promise<void>((resolve) => {
        parseString(xml, (err: any, result: any) => {
          if (err) {
            resolve();
            return;
          }

          const channel = result?.rss?.channel?.[0];
          const entries = channel?.item || result?.feed?.entry || [];

          for (const entry of entries.slice(0, 10)) {
            const title = entry.title?.[0]?._ || entry.title?.[0] || '';
            const description = entry.description?.[0]?._ || entry.description?.[0] || '';
            const link = entry.link?.[0]?.$ || entry.link?.[0] || '';
            // Handle various pubDate field names (pubDate, pubdate, published, updated)
          const pubDate = entry.pubDate?.[0] || entry.pubdate?.[0] || entry.published?.[0] || entry.updated?.[0] || new Date().toISOString();

            if (!title) continue;

            const location = geocodeNewsArticle(title, description);
            if (!location) continue;

            const { type, severity } = categorizeNews(title, description);

            incidents.push({
              id: `regional-${feed.source}-${Buffer.from(title).toString('base64').substring(0, 20)}`,
              title: title.substring(0, 200),
              description: description.substring(0, 300),
              type,
              severity,
              lat: location.lat,
              lon: location.lon,
              locationName: location.locationName,
              timestamp: new Date(pubDate).getTime(),
              source: feed.source,
              livestreamUrl: typeof link === 'string' ? link : link?.href || null,
            });
          }

          resolve();
        });
      });
    } catch (error) {
      continue;
    }
  }

  return incidents;
}

// Protest and Civil Unrest Tracking
async function fetchProtestsAndCivilUnrest() {
  const incidents: any[] = [];

  const protestSources = [
    // Global protest tracking
    { url: 'https://www.aljazeera.com/xml/rss/all.xml', source: 'Al Jazeera' },
    { url: 'https://www.theguardian.com/world/rss', source: 'The Guardian World' },
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', source: 'NY Times World' },
    { url: 'https://www.france24.com/en/rss', source: 'France 24' },
    { url: 'https://www.dw.com/en/rss', source: 'Deutsche Welle' },

    // Regional protest coverage
    { url: 'https://www.scmp.com/rss/91/feed', source: 'South China Morning Post' },
    { url: 'http://feeds.bbci.co.uk/news/world/rss.xml', source: 'BBC World' },
    { url: 'https://www.trtworld.com/feed/rss', source: 'TRT World' },

    // Labor and activism
    { url: 'https://www.labornotes.org/blogs/feed', source: 'Labor Notes' },

    // Regional unrest
    { url: 'https://www.irishtimes.com/cmlink/news-1.1319192', source: 'Irish Times' },
    { url: 'https://www.thehindu.com/news/national/feeder/default.rss', source: 'The Hindu' },
    { url: 'https://www.dawn.com/feeds/home', source: 'Dawn (Pakistan)' },
    { url: 'https://www.dailysabah.com/rssFeed/11', source: 'Daily Sabah (Turkey)' },
    { url: 'https://www.nation.co.ke/kenya/news/rss', source: 'Daily Nation Kenya' },
    { url: 'https://www.jornada.com.mx/rss/edicion.xml', source: 'La Jornada (Mexico)' },
    { url: 'https://www.clarin.com/rss/', source: 'Clarin (Argentina)' },
    { url: 'https://g1.globo.com/rss/g1/', source: 'G1 (Brazil)' },
    { url: 'https://www.aljazeera.net/rss.xml', source: 'Al Jazeera Arabic' },
  ];

  for (const feed of protestSources) {
    try {
      await new Promise<void>((resolve) => {
        fetch(feed.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Ishikawa/1.0)' },
          signal: AbortSignal.timeout(10000)
        })
          .then((res: any) => res.text())
          .then((xml: any) => {
            parseString(xml, { trim: true }, (err: any, result: any) => {
              if (err || !result) {
                resolve();
                return;
              }

              const items = result.rss?.channel?.[0]?.item || result.feed?.entry || [];

              for (const entry of items.slice(0, 30)) {
                const title = entry.title?.[0]?._ || entry.title?.[0] || '';
                const description = entry.description?.[0]?._ || entry.description?.[0] || entry.summary?.[0]?._ || entry.summary?.[0] || '';
                const link = entry.link?.[0]?.$ || entry.link?.[0] || '';
                // Handle various pubDate field names (pubDate, pubdate, published, updated)
          const pubDate = entry.pubDate?.[0] || entry.pubdate?.[0] || entry.published?.[0] || entry.updated?.[0] || new Date().toISOString();

                if (!title) continue;

                const text = `${title} ${description}`.toLowerCase();

                // Check for actual protest/civil unrest using context-aware patterns
                // These patterns require protest-related words in meaningful contexts
                const protestPatterns = [
                  /\bprotest(s|ers|ing)?\b/,
                  /\b(anti-government|pro-democracy)\b/,
                  /\bcivil unrest\b/,
                  /\briot(s|ing|ers)?\b/,
                  /\buprising\b/,
                  /\brevolt\b/,
                  /\brebellion\b/,
                  /\b(tear gas|water cannon|riot police)\b/,
                  /\b(general|labor|workers?) strike\b/,
                  /\bsit-in\b/,
                  /\bwalkout\b/,
                  /\b(blockade|barricade|roadblock)\b.*\b(protest|demonstr)\b/i,
                  /\b(violent|peaceful)\s+(clash|demonstration|rally|march)\b/,
                  /\bdemonstrators?\b/,  // Only "demonstrators" (people), not "demonstration" (example/proof)
                  /\bopposition rally\b/,
                  /\barrested protesters\b/,
                  /\bdetained activists\b/,
                  /\bpolice crackdown\b/,
                  /\b(curfew|martial law).*\b(protest|unrest)\b/i,
                ];

                // Check if article matches protest patterns
                if (!protestPatterns.some(pattern => text.match(pattern))) continue;

                // Exclude articles that are ABOUT protests but not actual protest events
                const excludePatterns = [
                  /\b(understanding|analysis|opinion|editorial|interview|podcast|video|photo|gallery)\b/,
                  /\b(history of|background|explainer|what are|why|how to|guide to)\b/,
                  /\b(cardiac|health|weather|climate|record|hottest|sunniest|temperature)\b/,
                  /\b(threatens|warns|says|comments|statement|addresses|react)\b.*\bprotest/i, // Trump threatens Iran over protests (just rhetoric)
                ];
                if (excludePatterns.some(pattern => text.match(pattern))) continue;

                const location = geocodeNewsArticle(title, description);
                if (!location) continue;

                // Determine severity based on violence indicators and scale
                let severity = 'medium'; // Default for ongoing protests

                // Critical: Mass casualties, nationwide uprising, revolution-level events
                if (text.match(/\b(killed|dead|deaths)\b/) && text.match(/\b(dozens|hundreds|many|mass|multiple)\b/)) {
                  severity = 'critical';
                } else if (text.match(/\b(revolution|coup attempt|government overthrown|regime change)\b/)) {
                  severity = 'critical';
                }
                // High: Violence, deaths, major crackdowns, large-scale unrest
                else if (text.match(/\b(killed|dead|death|deaths|deadly|casualties|fatalities)\b/)) {
                  severity = 'high';
                } else if (text.match(/\b(violent|riot|clash|clashes|tear gas|water cannon|rubber bullets)\b/)) {
                  severity = 'high';
                } else if (text.match(/\b(state of emergency|martial law|curfew|crackdown|suppression|military deployed)\b/)) {
                  severity = 'high';
                } else if (text.match(/\b(thousands|nationwide|widespread|escalating|intensifying)\b/) && text.match(/\b(protest|unrest|demonstration)\b/)) {
                  severity = 'high';
                }
                // Low: Peaceful demonstrations without escalation
                else if (text.match(/\b(peaceful|march|rally)\b/) && !text.match(/\b(violent|clash|riot|arrest|injured|killed)\b/)) {
                  severity = 'low';
                }

                incidents.push({
                  id: `protest-${feed.source}-${Buffer.from(title).toString('base64').substring(0, 20)}`,
                  title: title.substring(0, 200),
                  description: description.substring(0, 300),
                  type: 'protest',
                  severity,
                  lat: location.lat,
                  lon: location.lon,
                  locationName: location.locationName,
                  timestamp: new Date(pubDate).getTime(),
                  source: feed.source,
                  livestreamUrl: typeof link === 'string' ? link : link?.href || null,
                });
              }

              resolve();
            });
          })
          .catch(() => resolve());
      });
    } catch (error) {
      continue;
    }
  }

  return incidents;
}

function deduplicateIncidents(incidents: any[]) {
  const unique: any[] = [];

  for (const incident of incidents) {
    const isDuplicate = unique.some(existing => {
      const distance = getDistance(incident.lat, incident.lon, existing.lat, existing.lon);
      const titleSimilarity = getSimilarity(incident.title.toLowerCase(), existing.title.toLowerCase());
      return distance < 5 && titleSimilarity > 0.7;
    });

    if (!isDuplicate) {
      unique.push(incident);
    }
  }

  return unique;
}

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.split(/\s+/));
  const words2 = new Set(str2.split(/\s+/));
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  return intersection.size / union.size;
}

async function updateIncidents() {
  console.log('\n🔄 Fetching incidents from all sources...');

  const [earthquakes, weather, gdacs, nasa, news, cves, travel, aviation, aircraft, cloudStatus, warzones, politicalBusiness, maritime, cyber, nuclear, techNews, financial, regional, protests] = await Promise.allSettled([
    fetchEarthquakes(),
    fetchWeatherAlerts(),
    fetchGDACS(),
    fetchNASA(),
    fetchNewsArticles(),
    fetchCVEs(),
    fetchTravelAdvisories(),
    fetchAviationWarnings(),
    fetchAircraftTracking(),
    fetchCloudStatus(),
    fetchWarzoneData(),
    fetchPoliticalBusinessNews(),
    fetchMaritimeIncidents(),
    fetchCyberIncidents(),
    fetchNuclearIncidents(),
    fetchTechNews(),
    fetchFinancialIncidents(),
    fetchRegionalNews(),
    fetchProtestsAndCivilUnrest(),
  ]);

  let allIncidents: any[] = [];
  const now = Date.now();

  // Update source health tracking
  if (earthquakes.status === 'fulfilled') {
    allIncidents.push(...earthquakes.value);
    console.log(`✓ Earthquakes: ${earthquakes.value.length}`);
    sourceHealth['USGS Earthquakes'] = { status: 'operational', lastCheck: now };
  } else {
    sourceHealth['USGS Earthquakes'] = { status: 'down', lastCheck: now, error: String(earthquakes.reason) };
  }

  if (weather.status === 'fulfilled') {
    allIncidents.push(...weather.value);
    console.log(`✓ Weather Alerts (US): ${weather.value.length}`);
    sourceHealth['NOAA Weather'] = { status: 'operational', lastCheck: now };
  } else {
    sourceHealth['NOAA Weather'] = { status: 'down', lastCheck: now, error: String(weather.reason) };
  }

  if (gdacs.status === 'fulfilled') {
    allIncidents.push(...gdacs.value);
    console.log(`✓ GDACS (Global Weather/Disasters): ${gdacs.value.length}`);
    sourceHealth['GDACS'] = { status: 'operational', lastCheck: now };
  } else {
    sourceHealth['GDACS'] = { status: 'down', lastCheck: now, error: String(gdacs.reason) };
  }

  if (nasa.status === 'fulfilled') {
    allIncidents.push(...nasa.value);
    console.log(`✓ NASA: ${nasa.value.length}`);
    sourceHealth['NASA'] = { status: 'operational', lastCheck: now };
  } else {
    sourceHealth['NASA'] = { status: 'down', lastCheck: now, error: String(nasa.reason) };
  }

  if (news.status === 'fulfilled') {
    allIncidents.push(...news.value);
    console.log(`✓ News Articles: ${news.value.length}`);
    sourceHealth['News Feeds'] = { status: 'operational', lastCheck: now };
  } else {
    console.log(`✗ News Articles: ${news.reason}`);
    sourceHealth['News Feeds'] = { status: 'down', lastCheck: now, error: String(news.reason) };
  }

  if (cves.status === 'fulfilled') {
    allIncidents.push(...cves.value);
    console.log(`✓ CVEs: ${cves.value.length}`);
    sourceHealth['NIST CVE'] = { status: 'operational', lastCheck: now };
  } else {
    console.log(`✗ CVEs: ${cves.reason}`);
    sourceHealth['NIST CVE'] = { status: 'down', lastCheck: now, error: String(cves.reason) };
  }

  if (travel.status === 'fulfilled') {
    allIncidents.push(...travel.value);
    console.log(`✓ Travel Advisories: ${travel.value.length}`);
    sourceHealth['US State Dept'] = { status: 'operational', lastCheck: now };
  } else {
    console.log(`✗ Travel Advisories: ${travel.reason}`);
    sourceHealth['US State Dept'] = { status: 'down', lastCheck: now, error: String(travel.reason) };
  }

  if (aviation.status === 'fulfilled') {
    allIncidents.push(...aviation.value);
    console.log(`✓ Aviation Warnings: ${aviation.value.length}`);
    sourceHealth['FAA'] = { status: 'operational', lastCheck: now };
  } else {
    console.log(`✗ Aviation Warnings: ${aviation.reason}`);
    sourceHealth['FAA'] = { status: 'down', lastCheck: now, error: String(aviation.reason) };
  }

  if (aircraft.status === 'fulfilled') {
    allIncidents.push(...aircraft.value);
    console.log(`✓ Aircraft Tracking (OpenSky): ${aircraft.value.length}`);
    sourceHealth['OpenSky Network'] = { status: 'operational', lastCheck: now };
  } else {
    console.log(`✗ Aircraft Tracking: ${aircraft.reason}`);
    sourceHealth['OpenSky Network'] = { status: 'down', lastCheck: now, error: String(aircraft.reason) };
  }

  if (cloudStatus.status === 'fulfilled') {
    allIncidents.push(...cloudStatus.value);
    console.log(`✓ Cloud/ISP Status: ${cloudStatus.value.length}`);
    sourceHealth['Cloud/ISP Status'] = { status: 'operational', lastCheck: now };
  } else {
    console.log(`✗ Cloud/ISP Status: ${cloudStatus.reason}`);
    sourceHealth['Cloud/ISP Status'] = { status: 'down', lastCheck: now, error: String(cloudStatus.reason) };
  }

  if (warzones.status === 'fulfilled') {
    allIncidents.push(...warzones.value);
    console.log(`✓ Warzones/Conflict: ${warzones.value.length}`);
    sourceHealth['Warzone Monitor'] = { status: 'operational', lastCheck: now };
  } else {
    console.log(`✗ Warzones/Conflict: ${warzones.reason}`);
    sourceHealth['Warzone Monitor'] = { status: 'down', lastCheck: now, error: String(warzones.reason) };
  }

  if (politicalBusiness.status === 'fulfilled') {
    allIncidents.push(...politicalBusiness.value);
    console.log(`✓ Political/Business News: ${politicalBusiness.value.length}`);
    sourceHealth['Political/Business'] = { status: 'operational', lastCheck: now };
  } else {
    console.log(`✗ Political/Business News: ${politicalBusiness.reason}`);
    sourceHealth['Political/Business'] = { status: 'down', lastCheck: now, error: String(politicalBusiness.reason) };
  }

  if (maritime.status === 'fulfilled') {
    allIncidents.push(...maritime.value);
    console.log(`✓ Maritime Incidents: ${maritime.value.length}`);
    sourceHealth['Maritime Monitor'] = { status: 'operational', lastCheck: now };
  } else {
    console.log(`✗ Maritime Incidents: ${maritime.reason}`);
    sourceHealth['Maritime Monitor'] = { status: 'down', lastCheck: now, error: String(maritime.reason) };
  }

  if (cyber.status === 'fulfilled') {
    allIncidents.push(...cyber.value);
    console.log(`✓ Cyber Attacks: ${cyber.value.length}`);
    sourceHealth['Cyber Threat Feed'] = { status: 'operational', lastCheck: now };
  } else {
    console.log(`✗ Cyber Attacks: ${cyber.reason}`);
    sourceHealth['Cyber Threat Feed'] = { status: 'down', lastCheck: now, error: String(cyber.reason) };
  }

  if (nuclear.status === 'fulfilled') {
    allIncidents.push(...nuclear.value);
    console.log(`✓ Nuclear Monitoring: ${nuclear.value.length}`);
    sourceHealth['Nuclear Monitor'] = { status: 'operational', lastCheck: now };
  } else {
    console.log(`✗ Nuclear Monitoring: ${nuclear.reason}`);
    sourceHealth['Nuclear Monitor'] = { status: 'down', lastCheck: now, error: String(nuclear.reason) };
  }

  if (techNews.status === 'fulfilled') {
    allIncidents.push(...techNews.value);
    console.log(`✓ Tech News: ${techNews.value.length}`);
    sourceHealth['Tech News'] = { status: 'operational', lastCheck: now };
  } else {
    console.log(`✗ Tech News: ${techNews.reason}`);
    sourceHealth['Tech News'] = { status: 'down', lastCheck: now, error: String(techNews.reason) };
  }

  if (financial.status === 'fulfilled') {
    allIncidents.push(...financial.value);
    console.log(`✓ Financial/Sanctions: ${financial.value.length}`);
    sourceHealth['Financial Feed'] = { status: 'operational', lastCheck: now };
  } else {
    console.log(`✗ Financial/Sanctions: ${financial.reason}`);
    sourceHealth['Financial Feed'] = { status: 'down', lastCheck: now, error: String(financial.reason) };
  }

  if (regional.status === 'fulfilled') {
    allIncidents.push(...regional.value);
    console.log(`✓ Regional News: ${regional.value.length}`);
    sourceHealth['Regional News'] = { status: 'operational', lastCheck: now };
  } else {
    console.log(`✗ Regional News: ${regional.reason}`);
    sourceHealth['Regional News'] = { status: 'down', lastCheck: now, error: String(regional.reason) };
  }

  if (protests.status === 'fulfilled') {
    allIncidents.push(...protests.value);
    console.log(`✓ Protests/Civil Unrest: ${protests.value.length}`);
    sourceHealth['Protest Monitor'] = { status: 'operational', lastCheck: now };
  } else {
    console.log(`✗ Protests/Civil Unrest: ${protests.reason}`);
    sourceHealth['Protest Monitor'] = { status: 'down', lastCheck: now, error: String(protests.reason) };
  }

  console.log(`📊 Total before dedup: ${allIncidents.length}`);
  allIncidents = deduplicateIncidents(allIncidents);
  console.log(`📊 Total after dedup: ${allIncidents.length}`);

  // Reject incidents with future timestamps (bad data from sources)
  const currentTime = Date.now();
  const futureCount = allIncidents.filter(i => i.timestamp > currentTime).length;
  if (futureCount > 0) {
    console.log(`⚠️ Rejecting ${futureCount} incidents with future timestamps`);
    allIncidents = allIncidents.filter(i => i.timestamp <= currentTime);
  }

  // Filter to only incidents from last 24 hours (with exceptions for long-term strategic events)
  const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
  const fortyEightHoursAgo = Date.now() - (48 * 60 * 60 * 1000);
  allIncidents = allIncidents.filter(incident => {
    // Always show travel advisories (strategic warnings)
    if (incident.source === 'US State Dept') return true;

    // Always show volcanoes, droughts, and tropical cyclones from GDACS (ongoing/long-term events)
    if (incident.gdacsEventType && ['VO', 'DR', 'TC'].includes(incident.gdacsEventType)) return true;

    // Always show political summits and major business deals (strategic events)
    if (incident.type === 'political' || incident.type === 'business') return true;

    // Tech news sources get 48-hour window (Hacker News, tech blogs often have older timestamps)
    if (['Hacker News', 'TechCrunch', 'Ars Technica', 'The Verge', 'Wired', 'MIT Tech Review'].includes(incident.source)) {
      return incident.timestamp >= fortyEightHoursAgo;
    }

    // For everything else, apply 24-hour filter
    return incident.timestamp >= twentyFourHoursAgo;
  });
  console.log(`📊 Total after 24hr filter: ${allIncidents.length}`);

  // Delete old incidents from database (older than 24 hours)
  // Exemptions: US State Dept (advisories), political, business types get 7 days
  // Tech news gets 48 hours, everything else gets 24 hours
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

  // Delete old regular incidents (24 hour cutoff)
  db.prepare(`
    DELETE FROM incidents
    WHERE timestamp < ?
    AND source NOT IN ('Hacker News', 'TechCrunch', 'Ars Technica', 'The Verge', 'Wired', 'MIT Tech Review', 'US State Dept')
    AND type NOT IN ('political', 'business')
  `).run(twentyFourHoursAgo);

  // Delete old tech news (48 hour cutoff)
  db.prepare(`
    DELETE FROM incidents
    WHERE timestamp < ?
    AND source IN ('Hacker News', 'TechCrunch', 'Ars Technica', 'The Verge', 'Wired', 'MIT Tech Review')
  `).run(fortyEightHoursAgo);

  // Delete old strategic/political items (7 day cutoff - they shouldn't live forever)
  db.prepare(`
    DELETE FROM incidents
    WHERE timestamp < ?
    AND (source = 'US State Dept' OR type IN ('political', 'business'))
  `).run(sevenDaysAgo);

  console.log(`🗑️ Cleaned up old incidents from database`);

  // Delete ALL existing CVE entries to ensure only filtered CVEs (CVSS >= 6.0) remain
  db.prepare("DELETE FROM incidents WHERE source = 'NIST NVD'").run();

  const insert = db.prepare(`
    INSERT OR REPLACE INTO incidents
    (id, title, description, type, severity, lat, lon, locationName, timestamp, source, livestreamUrl)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const incident of allIncidents) {
    try {
      insert.run(
        incident.id,
        incident.title,
        incident.description,
        incident.type,
        incident.severity,
        incident.lat,
        incident.lon,
        incident.locationName,
        incident.timestamp,
        incident.source,
        incident.livestreamUrl || null
      );
    } catch (err) {
      console.error('Failed to insert incident:', incident.id, err);
      console.error('Incident data:', JSON.stringify(incident, null, 2));
    }
  }

  console.log(`✅ Database updated: ${allIncidents.length} incidents\n`);
}

app.get('/api/incidents', (req, res) => {
  const incidents = db.prepare('SELECT * FROM incidents ORDER BY timestamp DESC').all();

  res.json({
    success: true,
    count: incidents.length,
    incidents: incidents.map((inc: any) => ({
      id: inc.id,
      title: inc.title,
      description: inc.description,
      type: inc.type,
      severity: inc.severity,
      location: { lat: inc.lat, lon: inc.lon },
      locationName: inc.locationName,
      timestamp: new Date(inc.timestamp),
      source: inc.source,
      livestreamUrl: inc.livestreamUrl,
    })),
  });
});

app.get('/api/health', (req, res) => {
  const sources = Object.entries(sourceHealth).map(([name, health]) => ({
    name,
    status: health.status,
    lastCheck: new Date(health.lastCheck).toISOString(),
    error: health.error,
  }));

  const downSources = sources.filter(s => s.status === 'down');
  const degradedSources = sources.filter(s => s.status === 'degraded');

  res.json({
    success: true,
    overallStatus: downSources.length > 3 ? 'degraded' : downSources.length > 0 ? 'partial' : 'operational',
    sources,
    summary: {
      total: sources.length,
      operational: sources.filter(s => s.status === 'operational').length,
      degraded: degradedSources.length,
      down: downSources.length,
    },
  });
});

// Helper function to scrape price from Investing.com
async function scrapeInvestingPrice(url: string): Promise<{ price: number; change: number; changePercent: number } | null> {
  try {
    const response = await fetchWithTimeout(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
    });
    const html = await response.text();
    const $ = cheerio.load(html);

    const priceText = $('[data-test="instrument-price-last"]').first().text().trim().replace(/,/g, '');
    const changeText = $('[data-test="instrument-price-change"]').first().text().trim();
    const changePercentText = $('[data-test="instrument-price-change-percent"]').first().text().trim().replace(/[()%]/g, '');

    const price = parseFloat(priceText);
    const change = parseFloat(changeText);
    const changePercent = parseFloat(changePercentText);

    if (!isNaN(price)) {
      return {
        price,
        change: !isNaN(change) ? change : 0,
        changePercent: !isNaN(changePercent) ? Math.abs(changePercent) : 0
      };
    }
    return null;
  } catch (error) {
    console.error(`Scrape error for ${url}:`, error);
    return null;
  }
}

// Market data cache
let marketDataCache: any = null;
let marketDataCacheTime = 0;
const MARKET_CACHE_DURATION = 60000; // 1 minute

app.get('/api/markets', async (req, res) => {
  try {
    // Return cached data if still fresh
    if (marketDataCache && Date.now() - marketDataCacheTime < MARKET_CACHE_DURATION) {
      return res.json({
        success: true,
        markets: marketDataCache,
        cached: true,
      });
    }

    const markets = [];

    // Fetch cryptocurrency prices (BTC, ETH) from CoinGecko - REAL API
    try {
      const cryptoResponse = await fetchWithTimeout('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true');
      const cryptoData: any = await cryptoResponse.json();

      if (cryptoData.bitcoin) {
        const btcChange = cryptoData.bitcoin.usd_24h_change || 0;
        markets.push({
          symbol: 'BTC/USD',
          name: 'Bitcoin',
          price: `$${cryptoData.bitcoin.usd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
          change: btcChange.toFixed(2),
          changePercent: Math.abs(btcChange).toFixed(2),
          isUp: btcChange >= 0,
        });
      }

      if (cryptoData.ethereum) {
        const ethChange = cryptoData.ethereum.usd_24h_change || 0;
        markets.push({
          symbol: 'ETH/USD',
          name: 'Ethereum',
          price: `$${cryptoData.ethereum.usd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
          change: ethChange.toFixed(2),
          changePercent: Math.abs(ethChange).toFixed(2),
          isUp: ethChange >= 0,
        });
      }
    } catch (error) {
      console.error('Crypto data fetch error:', error);
    }

    // Scrape real-time prices from Investing.com
    const [gold, silver, platinum, palladium, oil, sp500, dow, nasdaq] = await Promise.all([
      scrapeInvestingPrice('https://www.investing.com/commodities/gold'),
      scrapeInvestingPrice('https://www.investing.com/commodities/silver'),
      scrapeInvestingPrice('https://www.investing.com/commodities/platinum'),
      scrapeInvestingPrice('https://www.investing.com/commodities/palladium'),
      scrapeInvestingPrice('https://www.investing.com/commodities/crude-oil'),
      scrapeInvestingPrice('https://www.investing.com/indices/us-spx-500'),
      scrapeInvestingPrice('https://www.investing.com/indices/us-30'),
      scrapeInvestingPrice('https://www.investing.com/indices/nasdaq-composite'),
    ]);

    if (gold) {
      markets.push({
        symbol: 'GOLD',
        name: 'Gold',
        price: `$${gold.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        change: gold.change.toFixed(2),
        changePercent: gold.changePercent.toFixed(2),
        isUp: gold.change >= 0,
      });
    }

    if (silver) {
      markets.push({
        symbol: 'SILVER',
        name: 'Silver',
        price: `$${silver.price.toFixed(3)}`,
        change: silver.change.toFixed(2),
        changePercent: silver.changePercent.toFixed(2),
        isUp: silver.change >= 0,
      });
    }

    if (platinum) {
      markets.push({
        symbol: 'PLATINUM',
        name: 'Platinum',
        price: `$${platinum.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        change: platinum.change.toFixed(2),
        changePercent: platinum.changePercent.toFixed(2),
        isUp: platinum.change >= 0,
      });
    }

    if (palladium) {
      markets.push({
        symbol: 'PALLADIUM',
        name: 'Palladium',
        price: `$${palladium.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        change: palladium.change.toFixed(2),
        changePercent: palladium.changePercent.toFixed(2),
        isUp: palladium.change >= 0,
      });
    }

    if (sp500) {
      markets.push({
        symbol: 'S&P 500',
        name: 'S&P 500',
        price: sp500.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        change: sp500.change.toFixed(2),
        changePercent: sp500.changePercent.toFixed(2),
        isUp: sp500.change >= 0,
      });
    }

    if (dow) {
      markets.push({
        symbol: 'DOW',
        name: 'Dow Jones',
        price: dow.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        change: dow.change.toFixed(2),
        changePercent: dow.changePercent.toFixed(2),
        isUp: dow.change >= 0,
      });
    }

    if (nasdaq) {
      markets.push({
        symbol: 'NASDAQ',
        name: 'NASDAQ',
        price: nasdaq.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        change: nasdaq.change.toFixed(2),
        changePercent: nasdaq.changePercent.toFixed(2),
        isUp: nasdaq.change >= 0,
      });
    }

    if (oil) {
      markets.push({
        symbol: 'OIL',
        name: 'Crude Oil',
        price: `$${oil.price.toFixed(2)}`,
        change: oil.change.toFixed(2),
        changePercent: oil.changePercent.toFixed(2),
        isUp: oil.change >= 0,
      });
    }

    // Update cache
    marketDataCache = markets;
    marketDataCacheTime = Date.now();

    res.json({
      success: true,
      markets,
      cached: false,
    });
  } catch (error) {
    console.error('Market data error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch market data',
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Ishikawa Backend running on http://localhost:${PORT}`);
  console.log(`📊 API: http://localhost:3000/api/incidents\n`);

  updateIncidents();
  setInterval(updateIncidents, 5 * 60 * 1000);
});
