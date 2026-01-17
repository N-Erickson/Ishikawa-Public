import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import fetch from 'node-fetch';

const app = express();
const PORT = 3000;

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

// STATE COORDS for weather alerts
const STATE_COORDS: any = {
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
};

async function fetchEarthquakes() {
  try {
    const response = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson');
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
    const response = await fetch('https://api.weather.gov/alerts/active');
    const data: any = await response.json();
    
    return data.features
      .filter((alert: any) => ['Extreme', 'Severe', 'Moderate'].includes(alert.properties.severity))
      .slice(0, 30)
      .map((alert: any) => {
        const ugc = alert.properties.geocode?.UGC?.[0] || '';
        const stateCode = ugc.substring(0, 2).toUpperCase();
        const coords = STATE_COORDS[stateCode] || { lat: 39.8283, lon: -98.5795 };
        
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

async function fetchGDACS() {
  try {
    const response = await fetch('https://www.gdacs.org/gdacsapi/api/events/geteventlist/ARCHIVE');
    const data: any = await response.json();
    
    if (!data?.features) return [];
    
    return data.features.slice(0, 50).map((event: any) => ({
      id: `gdacs-${event.properties.eventid}`,
      title: `${event.properties.eventtype}: ${event.properties.name || event.properties.country}`,
      description: event.properties.description?.substring(0, 200) || `${event.properties.severity} severity event`,
      type: 'weather',
      severity: event.properties.alertlevel === 'Red' ? 'critical' : event.properties.alertlevel === 'Orange' ? 'high' : 'medium',
      lat: event.geometry.coordinates[1],
      lon: event.geometry.coordinates[0],
      locationName: event.properties.country || 'Unknown',
      timestamp: new Date(event.properties.fromdate).getTime(),
      source: 'GDACS',
      livestreamUrl: event.properties.url,
    }));
  } catch (error) {
    console.error('GDACS fetch error:', error);
    return [];
  }
}

async function fetchVolcanoes() {
  try {
    const response = await fetch('https://www.smithsonianmag.com/volcano-json/');
    const data: any = await response.json();
    
    if (!data?.data) return [];
    
    return data.data.slice(0, 20).map((volcano: any) => ({
      id: `volcano-${volcano.volcano_number}`,
      title: `Volcano Activity: ${volcano.volcano_name}`,
      description: volcano.eruption_details?.substring(0, 200) || 'Active volcanic activity',
      type: 'weather',
      severity: 'high',
      lat: parseFloat(volcano.latitude),
      lon: parseFloat(volcano.longitude),
      locationName: `${volcano.volcano_name}, ${volcano.country}`,
      timestamp: new Date(volcano.start_date || Date.now()).getTime(),
      source: 'Smithsonian',
      livestreamUrl: null,
    })).filter((v: any) => !isNaN(v.lat) && !isNaN(v.lon));
  } catch (error) {
    console.error('Volcano fetch error:', error);
    return [];
  }
}

async function fetchAirQuality() {
  try {
    const cities = [
      { name: 'Beijing', lat: 39.9042, lon: 116.4074 },
      { name: 'Delhi', lat: 28.7041, lon: 77.1025 },
      { name: 'Mumbai', lat: 19.0760, lon: 72.8777 },
      { name: 'Cairo', lat: 30.0444, lon: 31.2357 },
      { name: 'Mexico City', lat: 19.4326, lon: -99.1332 },
    ];
    
    const results = await Promise.all(
      cities.map(async (city) => {
        try {
          const response = await fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${city.lat}&lon=${city.lon}&appid=demo`);
          const data: any = await response.json();
          
          if (data?.list?.[0]?.main?.aqi >= 4) {
            return {
              id: `airquality-${city.name.replace(/\s/g, '-')}`,
              title: `Poor Air Quality in ${city.name}`,
              description: `Air Quality Index: ${data.list[0].main.aqi} (Poor)`,
              type: 'weather',
              severity: 'medium',
              lat: city.lat,
              lon: city.lon,
              locationName: city.name,
              timestamp: Date.now(),
              source: 'OpenWeatherMap',
              livestreamUrl: null,
            };
          }
          return null;
        } catch {
          return null;
        }
      })
    );
    
    return results.filter((r): r is any => r !== null);
  } catch (error) {
    console.error('Air quality fetch error:', error);
    return [];
  }
}

async function fetchNASA() {
  try {
    const response = await fetch('https://eonet.gsfc.nasa.gov/api/v3/events?limit=10&days=7');
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
  
  const [earthquakes, weather, gdacs, volcanoes, airQuality, nasa] = await Promise.allSettled([
    fetchEarthquakes(),
    fetchWeatherAlerts(),
    fetchGDACS(),
    fetchVolcanoes(),
    fetchAirQuality(),
    fetchNASA(),
  ]);
  
  let allIncidents: any[] = [];
  
  if (earthquakes.status === 'fulfilled') {
    allIncidents.push(...earthquakes.value);
    console.log(`✓ Earthquakes: ${earthquakes.value.length}`);
  }
  
  if (weather.status === 'fulfilled') {
    allIncidents.push(...weather.value);
    console.log(`✓ Weather Alerts: ${weather.value.length}`);
  }
  
  if (gdacs.status === 'fulfilled') {
    allIncidents.push(...gdacs.value);
    console.log(`✓ GDACS: ${gdacs.value.length}`);
  }
  
  if (volcanoes.status === 'fulfilled') {
    allIncidents.push(...volcanoes.value);
    console.log(`✓ Volcanoes: ${volcanoes.value.length}`);
  }
  
  if (airQuality.status === 'fulfilled') {
    allIncidents.push(...airQuality.value);
    console.log(`✓ Air Quality: ${airQuality.value.length}`);
  }
  
  if (nasa.status === 'fulfilled') {
    allIncidents.push(...nasa.value);
    console.log(`✓ NASA: ${nasa.value.length}`);
  }
  
  console.log(`📊 Total before dedup: ${allIncidents.length}`);
  allIncidents = deduplicateIncidents(allIncidents);
  console.log(`📊 Total after dedup: ${allIncidents.length}`);
  
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  db.prepare('DELETE FROM incidents WHERE timestamp < ?').run(sevenDaysAgo);
  
  const insert = db.prepare(`
    INSERT OR REPLACE INTO incidents 
    (id, title, description, type, severity, lat, lon, locationName, timestamp, source, livestreamUrl)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  for (const incident of allIncidents) {
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
      incident.livestreamUrl
    );
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
  res.json({ status: 'ok', timestamp: new Date() });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Ishikawa Backend running on http://localhost:${PORT}`);
  console.log(`📊 API: http://localhost:${PORT}/api/incidents\n`);
  
  updateIncidents();
  setInterval(updateIncidents, 5 * 60 * 1000);
});
