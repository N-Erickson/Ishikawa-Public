import { Incident, IncidentSeverity, IncidentType } from '../types';

// UN OCHA ReliefWeb - Humanitarian crises and disasters
// Free API, no authentication required

interface ReliefWebReport {
  id: string;
  fields: {
    title: string;
    date: {
      created: string;
    };
    primary_country: {
      name: string;
      location?: {
        lat: number;
        lon: number;
      };
    }[];
    disaster?: {
      name: string;
      type: {
        name: string;
      };
    }[];
    theme?: {
      name: string;
    }[];
    format?: {
      name: string;
    }[];
    url?: string;
    body?: string;
  };
}

// Country coordinates for major humanitarian crisis locations
const COUNTRY_COORDS: { [key: string]: { lat: number; lon: number } } = {
  'Sudan': { lat: 15.5007, lon: 32.5599 },
  'Ukraine': { lat: 48.3794, lon: 31.1656 },
  'Gaza Strip': { lat: 31.3547, lon: 34.3088 },
  'occupied Palestinian territory': { lat: 31.9522, lon: 35.2332 },
  'Haiti': { lat: 18.9712, lon: -72.2852 },
  'Yemen': { lat: 15.5527, lon: 48.5164 },
  'Syria': { lat: 34.8021, lon: 38.9968 },
  'Afghanistan': { lat: 33.9391, lon: 67.7100 },
  'Democratic Republic of the Congo': { lat: -4.0383, lon: 21.7587 },
  'Ethiopia': { lat: 9.1450, lon: 40.4897 },
  'Somalia': { lat: 5.1521, lon: 46.1996 },
  'South Sudan': { lat: 6.8770, lon: 31.3070 },
  'Myanmar': { lat: 21.9162, lon: 95.9560 },
  'Bangladesh': { lat: 23.6850, lon: 90.3563 },
  'Venezuela': { lat: 6.4238, lon: -66.5897 },
  'Chad': { lat: 15.4542, lon: 18.7322 },
  'Mali': { lat: 17.5707, lon: -3.9962 },
  'Burkina Faso': { lat: 12.2383, lon: -1.5616 },
  'Niger': { lat: 17.6078, lon: 8.0817 },
  'Nigeria': { lat: 9.0820, lon: 8.6753 },
  'Central African Republic': { lat: 6.6111, lon: 20.9394 },
  'Lebanon': { lat: 33.8547, lon: 35.8623 },
  'Iraq': { lat: 33.2232, lon: 43.6793 },
};

export async function fetchHumanitarianCrises(): Promise<Incident[]> {
  try {
    // ReliefWeb API - fetch recent crisis reports
    const response = await fetch(
      'https://api.reliefweb.int/v1/reports?appname=ishikawa&profile=list&preset=latest&slim=1&limit=50&filter[field]=disaster.status&filter[value]=current'
    );

    if (!response.ok) {
      console.warn('ReliefWeb API returned status:', response.status);
      return [];
    }

    const data = await response.json();
    const incidents: Incident[] = [];

    if (!data.data || data.data.length === 0) {
      console.log('🆘 Humanitarian Crises: No active reports');
      return [];
    }

    const seen = new Set<string>();

    data.data.forEach((report: ReliefWebReport) => {
      const fields = report.fields;

      // Get country info
      if (!fields.primary_country || fields.primary_country.length === 0) return;

      const country = fields.primary_country[0];
      const countryName = country.name;

      // Avoid duplicates
      const key = `${countryName}-${fields.title.substring(0, 30)}`;
      if (seen.has(key)) return;
      seen.add(key);

      // Get coordinates
      let coords = country.location ?
        { lat: country.location.lat, lon: country.location.lon } :
        COUNTRY_COORDS[countryName] || { lat: 0, lon: 0 };

      // Determine type and severity from disaster/theme info
      let type = IncidentType.EMERGENCY;
      let severity = IncidentSeverity.HIGH;

      if (fields.disaster && fields.disaster.length > 0) {
        const disasterType = fields.disaster[0].type?.name?.toLowerCase() || '';

        if (disasterType.includes('conflict') || disasterType.includes('war')) {
          type = IncidentType.MILITARY;
          severity = IncidentSeverity.CRITICAL;
        } else if (disasterType.includes('flood')) {
          type = IncidentType.FLOOD;
        } else if (disasterType.includes('drought')) {
          type = IncidentType.ENVIRONMENTAL;
        } else if (disasterType.includes('cyclone') || disasterType.includes('hurricane')) {
          type = IncidentType.HURRICANE;
        }
      }

      incidents.push({
        id: `reliefweb-${report.id}`,
        title: `Humanitarian Crisis: ${fields.title.substring(0, 60)}`,
        description: fields.disaster ?
          `${fields.disaster[0].name} in ${countryName}` :
          `Crisis in ${countryName}`,
        type,
        severity,
        location: coords,
        locationName: countryName,
        timestamp: new Date(fields.date.created),
        source: 'UN OCHA ReliefWeb',
      });
    });

    console.log(`🆘 Humanitarian Crises: ${incidents.length} active situations`);
    return incidents.slice(0, 30); // Limit to 30 most critical
  } catch (error) {
    console.error('Error fetching humanitarian crises:', error);
    return [];
  }
}
