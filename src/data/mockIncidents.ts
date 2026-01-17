import { Incident, IncidentSeverity, IncidentType } from '../types';

// Mock incident data - in production, this would come from real APIs
export const mockIncidents: Incident[] = [
  {
    id: '1',
    title: 'Major Traffic Incident on I-405',
    description: 'Multi-vehicle collision blocking 3 lanes. Expect delays of 45+ minutes.',
    type: IncidentType.TRAFFIC,
    severity: IncidentSeverity.HIGH,
    location: { lat: 34.0522, lon: -118.2437 },
    locationName: 'Los Angeles, CA, USA',
    timestamp: new Date(),
    source: 'CHP Traffic Incidents'
  },
  {
    id: '2',
    title: 'Severe Thunderstorm Warning',
    description: 'Tornado watch in effect. Severe thunderstorms with large hail and damaging winds expected.',
    type: IncidentType.WEATHER,
    severity: IncidentSeverity.CRITICAL,
    location: { lat: 35.4676, lon: -97.5164 },
    locationName: 'Oklahoma City, OK, USA',
    timestamp: new Date(Date.now() - 300000),
    source: 'NOAA Weather Service'
  },
  {
    id: '3',
    title: 'Flight Delays at Heathrow',
    description: 'Heavy fog causing significant delays. Average delay time: 2 hours.',
    type: IncidentType.AIRLINE,
    severity: IncidentSeverity.MEDIUM,
    location: { lat: 51.4700, lon: -0.4543 },
    locationName: 'London, UK',
    timestamp: new Date(Date.now() - 600000),
    source: 'Aviation Weather Center'
  },
  {
    id: '4',
    title: 'Earthquake Detected',
    description: 'Magnitude 5.2 earthquake detected. No tsunami warning issued.',
    type: IncidentType.EMERGENCY,
    severity: IncidentSeverity.HIGH,
    location: { lat: 35.6762, lon: 139.6503 },
    locationName: 'Tokyo, Japan',
    timestamp: new Date(Date.now() - 900000),
    source: 'USGS Earthquake Hazards'
  },
  {
    id: '5',
    title: 'Wildfire Alert',
    description: 'Fast-moving wildfire threatening residential areas. Evacuation orders in effect.',
    type: IncidentType.EMERGENCY,
    severity: IncidentSeverity.CRITICAL,
    location: { lat: -33.8688, lon: 151.2093 },
    locationName: 'Sydney, Australia',
    timestamp: new Date(Date.now() - 1200000),
    source: 'NSW Fire Service'
  },
  {
    id: '6',
    title: 'Highway Closure',
    description: 'Bridge maintenance causing complete closure of northbound lanes.',
    type: IncidentType.TRAFFIC,
    severity: IncidentSeverity.MEDIUM,
    location: { lat: 40.7128, lon: -74.0060 },
    locationName: 'New York, NY, USA',
    timestamp: new Date(Date.now() - 1800000),
    source: 'NYC DOT'
  },
  {
    id: '7',
    title: 'Blizzard Conditions',
    description: 'Heavy snowfall with wind gusts up to 60 mph. Visibility near zero.',
    type: IncidentType.WEATHER,
    severity: IncidentSeverity.HIGH,
    location: { lat: 64.2008, lon: -149.4937 },
    locationName: 'Fairbanks, AK, USA',
    timestamp: new Date(Date.now() - 2400000),
    source: 'NOAA Weather Service'
  },
  {
    id: '8',
    title: 'Airport Security Incident',
    description: 'Terminal B evacuated due to security concerns. Passengers advised to check flight status.',
    type: IncidentType.AIRLINE,
    severity: IncidentSeverity.HIGH,
    location: { lat: 48.8566, lon: 2.3522 },
    locationName: 'Paris, France',
    timestamp: new Date(Date.now() - 3000000),
    source: 'ADP Airport Authority'
  }
];
