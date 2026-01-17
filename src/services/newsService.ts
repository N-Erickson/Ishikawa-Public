import { Incident, IncidentSeverity, IncidentType } from '../types';

interface RSSItem {
  title: string;
  description: string;
  pubDate: string;
  link: string;
}

// Major cities as fallback coordinates for country mentions
const COUNTRY_CAPITALS: { [key: string]: { lat: number; lon: number } } = {
  'yemen': { lat: 15.5527, lon: 48.5164 },
  'syria': { lat: 33.5138, lon: 36.2765 },
  'ukraine': { lat: 50.4501, lon: 30.5234 },
  'russia': { lat: 55.7558, lon: 37.6173 },
  'iran': { lat: 35.6892, lon: 51.3890 },
  'iraq': { lat: 33.3152, lon: 44.3661 },
  'israel': { lat: 31.7683, lon: 35.2137 },
  'palestine': { lat: 31.9522, lon: 35.2332 },
  'gaza': { lat: 31.5, lon: 34.4668 },
  'lebanon': { lat: 33.8886, lon: 35.4955 },
  'afghanistan': { lat: 34.5553, lon: 69.2075 },
  'pakistan': { lat: 33.6844, lon: 73.0479 },
  'india': { lat: 28.6139, lon: 77.2090 },
  'china': { lat: 39.9042, lon: 116.4074 },
  'sudan': { lat: 15.5007, lon: 32.5599 },
  'somalia': { lat: 2.0469, lon: 45.3182 },
  'nigeria': { lat: 9.0765, lon: 7.3986 },
  'ethiopia': { lat: 9.145, lon: 40.4897 },
  'myanmar': { lat: 16.8661, lon: 96.1951 },
  'venezuela': { lat: 10.4806, lon: -66.9036 },
  'colombia': { lat: 4.7110, lon: -74.0721 },
  'mexico': { lat: 19.4326, lon: -99.1332 },
  'haiti': { lat: 18.5944, lon: -72.3074 },
  'united states': { lat: 38.9072, lon: -77.0369 }, // Washington, D.C.
};

// Cache for geocoded locations to avoid repeated API calls
const geocodeCache: { [key: string]: { lat: number; lon: number } | null } = {};

async function geocodeLocation(locationName: string): Promise<{ lat: number; lon: number } | null> {
  // Check cache first
  const cacheKey = locationName.toLowerCase();
  if (geocodeCache[cacheKey] !== undefined) {
    return geocodeCache[cacheKey];
  }

  try {
    // Use Nominatim (OpenStreetMap) - NO API KEY REQUIRED
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationName)}&format=json&limit=1`,
      {
        headers: {
          'User-Agent': 'Ishikawa-OSINT/1.0',
        },
      }
    );

    if (!response.ok) {
      geocodeCache[cacheKey] = null;
      return null;
    }

    const data = await response.json();
    if (data && data.length > 0) {
      const result = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      geocodeCache[cacheKey] = result;
      return result;
    }

    geocodeCache[cacheKey] = null;
    return null;
  } catch (error) {
    console.error(`Geocoding failed for "${locationName}":`, error);
    geocodeCache[cacheKey] = null;
    return null;
  }
}

function extractLocation(text: string): string | null {
  const lowerText = text.toLowerCase();

  // Extract location from common patterns
  const patterns = [
    /in ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?(?:,\s*[A-Z][a-z]+)?)/g, // "in Baghdad", "in New York"
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:fighting|protest|attack|strike|explosion)/gi, // "Yemen fighting"
    /from\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g, // "from Yemen"
  ];

  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        return match[1].trim();
      }
    }
  }

  // Check for country mentions
  for (const country of Object.keys(COUNTRY_CAPITALS)) {
    if (lowerText.includes(country)) {
      return country;
    }
  }

  // For cyber incidents without specific location, default to global/US (cybersecurity hub)
  if (/\b(cyber|hack|breach|malware|ransomware|vulnerability|exploit)\b/i.test(text)) {
    return 'United States'; // Default for cyber incidents
  }

  return null;
}

function classifyIncidentType(text: string): IncidentType {
  // Cyber security indicators
  if (
    /\b(cyber|hack|breach|malware|ransomware|phishing|vulnerability|exploit|zero-day|apt|threat actor|botnet|ddos|data leak)\b/i.test(
      text
    )
  ) {
    return IncidentType.CYBER;
  }

  // Conflict indicators
  if (
    /\b(war|battle|fighting|combat|military|strike|bombing|attack|killed|casualties|troops|soldiers|army)\b/i.test(
      text
    )
  ) {
    return IncidentType.CONFLICT;
  }

  // Protest indicators
  if (/\b(protest|demonstration|rally|march|riot|unrest|uprising|activist|dissent)\b/i.test(text)) {
    return IncidentType.PROTEST;
  }

  // Weather indicators
  if (
    /\b(hurricane|typhoon|cyclone|storm|flood|tornado|earthquake|tsunami|drought|wildfire)\b/i.test(text)
  ) {
    return IncidentType.WEATHER;
  }

  // Emergency indicators
  if (/\b(explosion|fire|collapse|disaster|emergency|evacuation|rescue)\b/i.test(text)) {
    return IncidentType.EMERGENCY;
  }

  return IncidentType.OTHER;
}

function assessSeverity(text: string): IncidentSeverity {
  // Critical indicators
  if (
    /\b(mass|massacre|hundreds|thousands|major|catastrophic|critical|severe|deadly|war crime|zero-day|widespread breach|nation-state|apt)\b/i.test(
      text
    ) ||
    /\b(\d+)\s+(killed|dead|deaths)\b/i.test(text) ||
    /\b(millions|critical infrastructure)\b/i.test(text)
  ) {
    const deathMatch = text.match(/\b(\d+)\s+(killed|dead|deaths)\b/i);
    if (deathMatch && parseInt(deathMatch[1]) >= 10) {
      return IncidentSeverity.CRITICAL;
    }
    return IncidentSeverity.HIGH;
  }

  // High severity indicators
  if (/\b(serious|significant|heavy|violent|intense|ongoing|escalat|exploit|ransomware|data breach)\b/i.test(text)) {
    return IncidentSeverity.HIGH;
  }

  // Medium severity
  if (/\b(minor|moderate|limited|local|small|patch available)\b/i.test(text)) {
    return IncidentSeverity.MEDIUM;
  }

  return IncidentSeverity.MEDIUM;
}

function parseRSS(xmlText: string): RSSItem[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
  const items = xmlDoc.querySelectorAll('item');

  const rssItems: RSSItem[] = [];
  items.forEach((item) => {
    const title = item.querySelector('title')?.textContent || '';
    const description = item.querySelector('description')?.textContent || '';
    const pubDate = item.querySelector('pubDate')?.textContent || '';
    const link = item.querySelector('link')?.textContent || '';

    rssItems.push({ title, description, pubDate, link });
  });

  return rssItems;
}

export async function fetchNewsIncidents(): Promise<Incident[]> {
  const incidents: Incident[] = [];

  const RSS_FEEDS = [
    { url: 'https://www.aljazeera.com/xml/rss/all.xml', source: 'Al Jazeera' },
    { url: 'https://www.darkreading.com/rss.xml', source: 'Dark Reading' },
    // Add more feeds later: Reuters, BBC, AP, etc.
  ];

  try {
    for (const feed of RSS_FEEDS) {
      try {
        const response = await fetch(feed.url, {
          headers: {
            'Accept': 'application/rss+xml, application/xml, text/xml',
          },
        });
        if (!response.ok) continue;

        const xmlText = await response.text();
        const items = parseRSS(xmlText);

        // Process only recent news (last 24 hours)
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

        for (const item of items.slice(0, 20)) {
          // Limit to 20 items per feed
          const pubDate = new Date(item.pubDate);
          if (pubDate.getTime() < oneDayAgo) continue;

          const fullText = `${item.title} ${item.description}`;
          const type = classifyIncidentType(fullText);

          // Only include relevant incident types
          if (type === IncidentType.OTHER) continue;

          const locationStr = extractLocation(fullText);
          if (!locationStr) continue;

          // Try geocoding with delay to respect rate limits
          await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay
          let coords = await geocodeLocation(locationStr);

          // Fallback to country capitals if geocoding fails
          if (!coords && COUNTRY_CAPITALS[locationStr.toLowerCase()]) {
            coords = COUNTRY_CAPITALS[locationStr.toLowerCase()];
          }

          if (!coords) continue;

          const severity = assessSeverity(fullText);

          incidents.push({
            id: `news-${item.link.split('/').pop() || Date.now()}`,
            title: item.title,
            description: item.description.substring(0, 200),
            type,
            severity,
            location: coords,
            locationName: locationStr,
            timestamp: pubDate,
            source: feed.source,
            livestreamUrl: item.link,
          });
        }
      } catch (error) {
        console.error(`Error fetching RSS feed ${feed.url}:`, error);
      }
    }

    console.log(`📰 News Incidents: ${incidents.length} incidents from RSS feeds`);
    return incidents;
  } catch (error) {
    console.error('Error fetching news incidents:', error);
    return [];
  }
}
