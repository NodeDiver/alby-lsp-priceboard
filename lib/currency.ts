import * as fiat from "@getalby/lightning-tools/fiat";

// Common currencies for UI dropdown (let Alby handle the full list)
export const COMMON_CURRENCIES = [
  { code: 'usd', name: 'US Dollar', symbol: '$' },
  { code: 'eur', name: 'Euro', symbol: '€' },
  { code: 'gbp', name: 'British Pound', symbol: '£' },
  { code: 'jpy', name: 'Japanese Yen', symbol: '¥' },
  { code: 'cad', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'aud', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'chf', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'cny', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'inr', name: 'Indian Rupee', symbol: '₹' },
  { code: 'brl', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'mxn', name: 'Mexican Peso', symbol: '$' },
  { code: 'krw', name: 'South Korean Won', symbol: '₩' },
  { code: 'sgd', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'hkd', name: 'Hong Kong Dollar', symbol: 'HK$' },
  { code: 'nzd', name: 'New Zealand Dollar', symbol: 'NZ$' }
];

// Currency map for O(1) lookups
const CURRENCY_MAP = Object.fromEntries(COMMON_CURRENCIES.map(c => [c.code.toLowerCase(), c]));

export interface CurrencyConversion {
  amount: number;
  formatted: string;
  currency: string;
  symbol: string;
  lastUpdated?: string;
  error?: string;
}

export interface CurrencyCache {
  [currency: string]: {
    rate: number;
    lastUpdated: string;
  };
}

// Cache for currency rates to avoid excessive API calls
const currencyCache: CurrencyCache = {};

// Cache duration: 10 minutes
const CACHE_DURATION = 10 * 60 * 1000;

export async function convertSatsToCurrency(
  sats: number, 
  currency: string = 'usd'
): Promise<CurrencyConversion> {
  try {
    // Input validation
    if (!Number.isFinite(sats) || sats <= 0) {
      return { 
        amount: 0, 
        formatted: 'N/A', 
        currency: currency.toLowerCase(), 
        symbol: getCurrencyInfo(currency).symbol, 
        error: 'Invalid sats' 
      };
    }

    const code = currency.toLowerCase();
    const currencyInfo = getCurrencyInfo(code);
    const now = new Date().toISOString();
    
    // Check if we have a recent cached rate
    const cached = currencyCache[code];
    
    if (cached && (Date.now() - new Date(cached.lastUpdated).getTime()) < CACHE_DURATION) {
      const amount = sats * cached.rate;
      
      return {
        amount: Math.round(amount * 100) / 100, // Round to 2 decimals
        formatted: formatCurrency(amount, code, currencyInfo.symbol),
        currency: code,
        symbol: currencyInfo.symbol,
        lastUpdated: cached.lastUpdated
      };
    }

    // Fetch fresh rate from Alby Lightning Tools
    const fiatValue = await fiat.getFiatValue({ 
      satoshi: sats, 
      currency: code 
    });

    // Update cache
    currencyCache[code] = {
      rate: fiatValue / sats,
      lastUpdated: now
    };
    
    return {
      amount: Math.round(fiatValue * 100) / 100, // Round to 2 decimals
      formatted: formatCurrency(fiatValue, code, currencyInfo.symbol),
      currency: code,
      symbol: currencyInfo.symbol,
      lastUpdated: now
    };

  } catch (error) {
    console.error('Currency conversion error:', error);
    
    // Return fallback with last known rate if available
    const code = currency.toLowerCase();
    const cached = currencyCache[code];
    if (cached) {
      const amount = sats * cached.rate;
      const currencyInfo = getCurrencyInfo(code);
      
      return {
        amount: Math.round(amount * 100) / 100,
        formatted: formatCurrency(amount, code, currencyInfo.symbol),
        currency: code,
        symbol: currencyInfo.symbol,
        lastUpdated: cached.lastUpdated,
        error: 'Using cached rate'
      };
    }

    // Complete fallback
    const currencyInfo = getCurrencyInfo(code);
    return {
      amount: 0,
      formatted: 'N/A',
      currency: code,
      symbol: currencyInfo.symbol,
      error: 'Conversion unavailable'
    };
  }
}

function formatCurrency(amount: number, code: string, fallbackSymbol: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code.toUpperCase(),
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Fallback for non-ISO or unsupported codes
    return `${fallbackSymbol}${amount.toFixed(2)}`;
  }
}

function getCurrencyInfo(code: string) {
  return CURRENCY_MAP[code.toLowerCase()] || CURRENCY_MAP['usd'];
}

export function getCurrencyByCode(code: string) {
  return getCurrencyInfo(code);
}
