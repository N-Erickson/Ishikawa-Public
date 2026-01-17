import { Incident, IncidentSeverity, IncidentType } from '../types';

// Smithsonian Institution Global Volcanism Program
// Provides data on currently erupting volcanoes

interface VolcanoData {
  volcano: {
    name: string;
    latitude: number;
    longitude: number;
    country: string;
    region: string;
    type: string;
  };
  eruption: {
    start_date: string;
    vei: number | null;
    evidence: string;
  };
}

// Known active volcanoes with recent activity (manual curated list since GVP API is limited)
const ACTIVE_VOLCANOES = [
  { name: 'Kilauea', lat: 19.4069, lon: -155.2834, country: 'United States', region: 'Hawaii' },
  { name: 'Etna', lat: 37.7510, lon: 14.9934, country: 'Italy', region: 'Sicily' },
  { name: 'Stromboli', lat: 38.7893, lon: 15.2134, country: 'Italy', region: 'Sicily' },
  { name: 'Popocatépetl', lat: 19.0225, lon: -98.6278, country: 'Mexico', region: 'Central Mexico' },
  { name: 'Sakurajima', lat: 31.5804, lon: 130.6573, country: 'Japan', region: 'Kyushu' },
  { name: 'Merapi', lat: -7.5407, lon: 110.4453, country: 'Indonesia', region: 'Java' },
  { name: 'Semeru', lat: -8.1082, lon: 112.9222, country: 'Indonesia', region: 'Java' },
  { name: 'Krakatau', lat: -6.1020, lon: 105.4230, country: 'Indonesia', region: 'Sunda Strait' },
  { name: 'Fuego', lat: 14.4730, lon: -90.8806, country: 'Guatemala', region: 'Central America' },
  { name: 'Pacaya', lat: 14.3813, lon: -90.6011, country: 'Guatemala', region: 'Central America' },
  { name: 'Villarrica', lat: -39.4200, lon: -71.9317, country: 'Chile', region: 'South America' },
  { name: 'Nevado del Ruiz', lat: 4.8925, lon: -75.3243, country: 'Colombia', region: 'South America' },
  { name: 'Reventador', lat: -0.0772, lon: -77.6561, country: 'Ecuador', region: 'South America' },
  { name: 'Sangay', lat: -2.0053, lon: -78.3409, country: 'Ecuador', region: 'South America' },
  { name: 'Karymsky', lat: 54.0489, lon: 159.4430, country: 'Russia', region: 'Kamchatka' },
  { name: 'Sheveluch', lat: 56.6531, lon: 161.3606, country: 'Russia', region: 'Kamchatka' },
  { name: 'Ebeko', lat: 50.6858, lon: 156.0144, country: 'Russia', region: 'Kuril Islands' },
  { name: 'Ibu', lat: 1.4880, lon: 127.6300, country: 'Indonesia', region: 'Halmahera' },
  { name: 'Dukono', lat: 1.6920, lon: 127.8940, country: 'Indonesia', region: 'Halmahera' },
  { name: 'Ruang', lat: 2.2990, lon: 125.3690, country: 'Indonesia', region: 'Sangihe Islands' },
];

export async function fetchVolcanicActivity(): Promise<Incident[]> {
  // Since the Smithsonian GVP API requires authentication and complex parsing,
  // we'll use a simpler approach: return known active volcanoes with ongoing activity
  // In a production app, you could scrape https://volcano.si.edu/reports_weekly.cfm
  // or use a paid API service

  const incidents: Incident[] = [];

  // For demonstration, we'll mark continuously active volcanoes
  // These are volcanoes known to have persistent activity in 2025/2026
  const persistentlyActive = [
    'Kilauea', 'Etna', 'Stromboli', 'Sakurajima', 'Merapi',
    'Semeru', 'Fuego', 'Karymsky', 'Sheveluch', 'Dukono', 'Ibu'
  ];

  ACTIVE_VOLCANOES.forEach((volcano) => {
    if (persistentlyActive.includes(volcano.name)) {
      incidents.push({
        id: `volcano-${volcano.name.toLowerCase().replace(/\s/g, '-')}`,
        title: `Active Volcano: ${volcano.name}`,
        description: `Ongoing volcanic activity at ${volcano.name}, ${volcano.country}. Monitor for ash, lava flows, and seismic activity.`,
        type: IncidentType.VOLCANIC,
        severity: IncidentSeverity.HIGH,
        location: {
          lat: volcano.lat,
          lon: volcano.lon,
        },
        locationName: `${volcano.name}, ${volcano.region}, ${volcano.country}`,
        timestamp: new Date(), // Active now
        source: 'Global Volcanism Program',
      });
    }
  });

  console.log(`🌋 Volcanic Activity: ${incidents.length} active volcanoes`);
  return incidents;
}
