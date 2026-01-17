import { useState, useEffect } from 'react';
import './MarketTicker.css';

interface MarketData {
  symbol: string;
  name: string;
  price: string;
  change: string;
  changePercent: string;
  isUp: boolean;
}

export function MarketTicker() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch market data from backend
  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/markets');
        const data = await response.json();

        if (data.success) {
          setMarkets(data.markets);
          setLoading(false);
        }
      } catch (error) {
        console.error('Market data fetch error:', error);
        // Use fallback data if API fails
        setMarkets([
          { symbol: 'BTC/USD', name: 'Bitcoin', price: '---', change: '0.00', changePercent: '0.00', isUp: true },
          { symbol: 'ETH/USD', name: 'Ethereum', price: '---', change: '0.00', changePercent: '0.00', isUp: true },
        ]);
        setLoading(false);
      }
    };

    fetchMarketData();
    // Refresh market data every 60 seconds
    const interval = setInterval(fetchMarketData, 60000);
    return () => clearInterval(interval);
  }, []);

  // Rotate through markets every 3 seconds
  useEffect(() => {
    if (markets.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % markets.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [markets.length]);

  if (loading || markets.length === 0) {
    return (
      <div className="market-ticker">
        <div className="market-item">
          <span className="market-symbol">LOADING MARKETS...</span>
        </div>
      </div>
    );
  }

  const current = markets[currentIndex];

  return (
    <div className="market-ticker">
      <div className="market-item" key={currentIndex}>
        <span className="market-symbol">{current.symbol}</span>
        <span className="market-price">{current.price}</span>
        <span className={`market-change ${current.isUp ? 'up' : 'down'}`}>
          {current.isUp ? '▲' : '▼'} {current.changePercent}%
        </span>
      </div>
    </div>
  );
}
