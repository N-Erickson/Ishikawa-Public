export interface Coordinates {
  lat: number;
  lon: number;
}

export enum IncidentSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum IncidentType {
  TRAFFIC = 'traffic',
  WEATHER = 'weather',
  MILITARY = 'military',
  AIRLINE = 'airline',
  EMERGENCY = 'emergency',
  CONFLICT = 'conflict',
  PROTEST = 'protest',
  MARITIME = 'maritime',
  POLITICAL = 'political',
  ADVISORY = 'advisory',
  CYBER = 'cyber',
  EARTHQUAKE = 'earthquake',
  HURRICANE = 'hurricane',
  FLOOD = 'flood',
  VOLCANIC = 'volcanic',
  ENVIRONMENTAL = 'environmental',
  TSUNAMI = 'tsunami',
  FIRE = 'fire',
  NATURAL = 'natural',
  OTHER = 'other'
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  type: IncidentType;
  severity: IncidentSeverity;
  location: Coordinates;
  locationName: string;
  timestamp: Date;
  livestreamUrl?: string;
  source?: string;
}
