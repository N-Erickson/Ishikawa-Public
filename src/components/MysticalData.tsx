import { useEffect, useState } from 'react';

// Elder Futhark runes
const RUNES = [
  { symbol: 'ᚠ', name: 'Fehu', meaning: 'Wealth, Abundance' },
  { symbol: 'ᚢ', name: 'Uruz', meaning: 'Strength, Vitality' },
  { symbol: 'ᚦ', name: 'Thurisaz', meaning: 'Gateway, Challenge' },
  { symbol: 'ᚨ', name: 'Ansuz', meaning: 'Signals, Wisdom' },
  { symbol: 'ᚱ', name: 'Raidho', meaning: 'Journey, Evolution' },
  { symbol: 'ᚲ', name: 'Kenaz', meaning: 'Vision, Knowledge' },
  { symbol: 'ᚷ', name: 'Gebo', meaning: 'Partnership, Gift' },
  { symbol: 'ᚹ', name: 'Wunjo', meaning: 'Joy, Success' },
  { symbol: 'ᚺ', name: 'Hagalaz', meaning: 'Disruption, Change' },
  { symbol: 'ᚾ', name: 'Nauthiz', meaning: 'Need, Resistance' },
  { symbol: 'ᛁ', name: 'Isa', meaning: 'Stillness, Clarity' },
  { symbol: 'ᛃ', name: 'Jera', meaning: 'Harvest, Cycles' },
  { symbol: 'ᛇ', name: 'Eihwaz', meaning: 'Defense, Protection' },
  { symbol: 'ᛈ', name: 'Perthro', meaning: 'Mystery, Fate' },
  { symbol: 'ᛉ', name: 'Algiz', meaning: 'Protection, Shield' },
  { symbol: 'ᛊ', name: 'Sowilo', meaning: 'Victory, Success' },
  { symbol: 'ᛏ', name: 'Tiwaz', meaning: 'Honor, Justice' },
  { symbol: 'ᛒ', name: 'Berkano', meaning: 'Growth, Renewal' },
  { symbol: 'ᛖ', name: 'Ehwaz', meaning: 'Movement, Progress' },
  { symbol: 'ᛗ', name: 'Mannaz', meaning: 'Humanity, Self' },
  { symbol: 'ᛚ', name: 'Laguz', meaning: 'Flow, Intuition' },
  { symbol: 'ᛜ', name: 'Ingwaz', meaning: 'Completion, Focus' },
  { symbol: 'ᛞ', name: 'Dagaz', meaning: 'Breakthrough, Dawn' },
  { symbol: 'ᛟ', name: 'Othala', meaning: 'Heritage, Home' },
];

const ZODIAC_SIGNS = [
  { name: 'Capricorn', symbol: '♑', start: [12, 22], end: [1, 19] },
  { name: 'Aquarius', symbol: '♒', start: [1, 20], end: [2, 18] },
  { name: 'Pisces', symbol: '♓', start: [2, 19], end: [3, 20] },
  { name: 'Aries', symbol: '♈', start: [3, 21], end: [4, 19] },
  { name: 'Taurus', symbol: '♉', start: [4, 20], end: [5, 20] },
  { name: 'Gemini', symbol: '♊', start: [5, 21], end: [6, 20] },
  { name: 'Cancer', symbol: '♋', start: [6, 21], end: [7, 22] },
  { name: 'Leo', symbol: '♌', start: [7, 23], end: [8, 22] },
  { name: 'Virgo', symbol: '♍', start: [8, 23], end: [9, 22] },
  { name: 'Libra', symbol: '♎', start: [9, 23], end: [10, 22] },
  { name: 'Scorpio', symbol: '♏', start: [10, 23], end: [11, 21] },
  { name: 'Sagittarius', symbol: '♐', start: [11, 22], end: [12, 21] },
];

const MOON_PHASES = [
  { name: 'New Moon', symbol: '🌑', emoji: '🌑' },
  { name: 'Waxing Crescent', symbol: '🌒', emoji: '🌒' },
  { name: 'First Quarter', symbol: '🌓', emoji: '🌓' },
  { name: 'Waxing Gibbous', symbol: '🌔', emoji: '🌔' },
  { name: 'Full Moon', symbol: '🌕', emoji: '🌕' },
  { name: 'Waning Gibbous', symbol: '🌖', emoji: '🌖' },
  { name: 'Last Quarter', symbol: '🌗', emoji: '🌗' },
  { name: 'Waning Crescent', symbol: '🌘', emoji: '🌘' },
];

function getMoonPhase(): { name: string; symbol: string; illumination: number } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  // Calculate moon phase using a simplified algorithm
  let c = 0;
  let e = 0;
  let jd = 0;
  let b = 0;

  if (month < 3) {
    const yearTemp = year - 1;
    const monthTemp = month + 12;
    c = yearTemp / 100;
    jd = Math.floor(365.25 * yearTemp) + Math.floor(30.6001 * (monthTemp + 1)) + day + 1720994.5;
  } else {
    c = year / 100;
    jd = Math.floor(365.25 * year) + Math.floor(30.6001 * (month + 1)) + day + 1720994.5;
  }

  b = 2 - c + Math.floor(c / 4);
  jd = jd + b;

  // Calculate days since known new moon
  const daysSinceNew = jd - 2451549.5;
  const newMoons = daysSinceNew / 29.53058867;
  const phase = (newMoons - Math.floor(newMoons));

  // Calculate illumination percentage
  const illumination = Math.round((1 - Math.cos(phase * 2 * Math.PI)) / 2 * 100);

  // Determine phase
  let phaseIndex = 0;
  if (phase < 0.0625) phaseIndex = 0; // New Moon
  else if (phase < 0.1875) phaseIndex = 1; // Waxing Crescent
  else if (phase < 0.3125) phaseIndex = 2; // First Quarter
  else if (phase < 0.4375) phaseIndex = 3; // Waxing Gibbous
  else if (phase < 0.5625) phaseIndex = 4; // Full Moon
  else if (phase < 0.6875) phaseIndex = 5; // Waning Gibbous
  else if (phase < 0.8125) phaseIndex = 6; // Last Quarter
  else if (phase < 0.9375) phaseIndex = 7; // Waning Crescent
  else phaseIndex = 0; // New Moon

  return {
    name: MOON_PHASES[phaseIndex].name,
    symbol: MOON_PHASES[phaseIndex].emoji,
    illumination,
  };
}

function getZodiacSign(): { name: string; symbol: string } {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  for (const sign of ZODIAC_SIGNS) {
    const [startMonth, startDay] = sign.start;
    const [endMonth, endDay] = sign.end;

    if (
      (month === startMonth && day >= startDay) ||
      (month === endMonth && day <= endDay) ||
      (startMonth > endMonth && (month === startMonth || month === endMonth))
    ) {
      return { name: sign.name, symbol: sign.symbol };
    }
  }

  return ZODIAC_SIGNS[0];
}

function getDailyRune(): { symbol: string; name: string; meaning: string } {
  // Use date as seed for consistent daily rune
  const now = new Date();
  const seed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  const index = seed % RUNES.length;
  return RUNES[index];
}

export function MysticalData() {
  const [moonPhase, setMoonPhase] = useState(getMoonPhase());
  const [zodiac, setZodiac] = useState(getZodiacSign());
  const [rune, setRune] = useState(getDailyRune());

  useEffect(() => {
    // Update every hour
    const interval = setInterval(() => {
      setMoonPhase(getMoonPhase());
      setZodiac(getZodiacSign());
      setRune(getDailyRune());
    }, 3600000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: '95px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: '40px',
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#00ff00',
        opacity: 0.7,
        zIndex: 100,
        textShadow: '0 0 5px rgba(0, 255, 0, 0.5)',
      }}
    >
      {/* Moon Phase */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '16px' }}>{moonPhase.symbol}</span>
        <span>{moonPhase.name}</span>
        <span style={{ opacity: 0.5 }}>({moonPhase.illumination}%)</span>
      </div>

      <div style={{ color: '#00ff00', opacity: 0.3 }}>|</div>

      {/* Zodiac Sign */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '16px' }}>{zodiac.symbol}</span>
        <span>{zodiac.name}</span>
      </div>

      <div style={{ color: '#00ff00', opacity: 0.3 }}>|</div>

      {/* Rune of the Day */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '18px' }}>{rune.symbol}</span>
        <span>Rune: {rune.name}</span>
        <span style={{ opacity: 0.5 }}>({rune.meaning})</span>
      </div>
    </div>
  );
}
