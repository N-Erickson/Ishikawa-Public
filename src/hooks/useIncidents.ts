import { useState, useEffect, useRef } from 'react';
import { Incident } from '../types';

export function useIncidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const isFirstFetch = useRef(true);

  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        // Only show loading screen on initial fetch, not refreshes
        if (isFirstFetch.current) {
          setLoading(true);
        }
        console.log('Fetching incidents from backend...');

        const response = await fetch('http://localhost:3000/api/incidents');
        const data = await response.json();

        if (data.success) {
          console.log(`✓ Backend returned ${data.count} incidents`);

          // Filter to only show incidents from last 24 hours on frontend
          const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
          const recentIncidents = data.incidents.filter((inc: Incident) => {
            const timestamp = new Date(inc.timestamp).getTime();
            return timestamp >= twentyFourHoursAgo;
          });

          console.log(`✓ Filtered to ${recentIncidents.length} incidents (last 24h)`);
          setIncidents(recentIncidents);
          setLastUpdate(new Date());
          setError(null);
          isFirstFetch.current = false; // Mark initial fetch complete
        } else {
          throw new Error('Backend returned unsuccessful response');
        }
      } catch (err) {
        const errorMessage = 'Failed to fetch incidents from backend';
        setError(errorMessage);
        console.error(errorMessage, err);
      } finally {
        setLoading(false);
      }
    };

    fetchIncidents();

    // Poll every 15 minutes for updated data
    const interval = setInterval(fetchIncidents, 900000);
    return () => clearInterval(interval);
  }, []);

  return { incidents, loading, error, lastUpdate };
}
