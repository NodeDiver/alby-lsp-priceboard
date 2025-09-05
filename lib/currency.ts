import * as fiat from "@getalby/lightning-tools/fiat";

// Available currencies supported by Alby Lightning Tools
export const SUPPORTED_CURRENCIES = [
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
  { code: 'nzd', name: 'New Zealand Dollar', symbol: 'NZ$' },
  { code: 'sek', name: 'Swedish Krona', symbol: 'kr' },
  { code: 'nok', name: 'Norwegian Krone', symbol: 'kr' },
  { code: 'dkk', name: 'Danish Krone', symbol: 'kr' },
  { code: 'pln', name: 'Polish Zloty', symbol: 'zł' },
  { code: 'czk', name: 'Czech Koruna', symbol: 'Kč' },
  { code: 'huf', name: 'Hungarian Forint', symbol: 'Ft' },
  { code: 'rub', name: 'Russian Ruble', symbol: '₽' },
  { code: 'try', name: 'Turkish Lira', symbol: '₺' },
  { code: 'zar', name: 'South African Rand', symbol: 'R' },
  { code: 'thb', name: 'Thai Baht', symbol: '฿' },
  { code: 'myr', name: 'Malaysian Ringgit', symbol: 'RM' },
  { code: 'php', name: 'Philippine Peso', symbol: '₱' },
  { code: 'idr', name: 'Indonesian Rupiah', symbol: 'Rp' },
  { code: 'vnd', name: 'Vietnamese Dong', symbol: '₫' },
  { code: 'ars', name: 'Argentine Peso', symbol: '$' },
  { code: 'clp', name: 'Chilean Peso', symbol: '$' },
  { code: 'cop', name: 'Colombian Peso', symbol: '$' },
  { code: 'pen', name: 'Peruvian Sol', symbol: 'S/' },
  { code: 'uah', name: 'Ukrainian Hryvnia', symbol: '₴' },
  { code: 'ils', name: 'Israeli Shekel', symbol: '₪' },
  { code: 'aed', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'sar', name: 'Saudi Riyal', symbol: 'ر.س' },
  { code: 'egp', name: 'Egyptian Pound', symbol: '£' },
  { code: 'ngn', name: 'Nigerian Naira', symbol: '₦' },
  { code: 'kes', name: 'Kenyan Shilling', symbol: 'KSh' },
  { code: 'ghs', name: 'Ghanaian Cedi', symbol: '₵' },
  { code: 'mad', name: 'Moroccan Dirham', symbol: 'د.م.' },
  { code: 'tnd', name: 'Tunisian Dinar', symbol: 'د.ت' },
  { code: 'dzd', name: 'Algerian Dinar', symbol: 'د.ج' },
  { code: 'etb', name: 'Ethiopian Birr', symbol: 'Br' },
  { code: 'ugx', name: 'Ugandan Shilling', symbol: 'USh' },
  { code: 'tzs', name: 'Tanzanian Shilling', symbol: 'TSh' },
  { code: 'zmw', name: 'Zambian Kwacha', symbol: 'ZK' },
  { code: 'bwp', name: 'Botswana Pula', symbol: 'P' },
  { code: 'szl', name: 'Swazi Lilangeni', symbol: 'L' },
  { code: 'lsl', name: 'Lesotho Loti', symbol: 'L' },
  { code: 'nad', name: 'Namibian Dollar', symbol: 'N$' },
  { code: 'mwk', name: 'Malawian Kwacha', symbol: 'MK' },
  { code: 'bdt', name: 'Bangladeshi Taka', symbol: '৳' },
  { code: 'lkr', name: 'Sri Lankan Rupee', symbol: 'Rs' },
  { code: 'npr', name: 'Nepalese Rupee', symbol: 'Rs' },
  { code: 'pkr', name: 'Pakistani Rupee', symbol: 'Rs' },
  { code: 'afn', name: 'Afghan Afghani', symbol: '؋' },
  { code: 'iqd', name: 'Iraqi Dinar', symbol: 'د.ع' },
  { code: 'irr', name: 'Iranian Rial', symbol: '﷼' },
  { code: 'kwd', name: 'Kuwaiti Dinar', symbol: 'د.ك' },
  { code: 'bhd', name: 'Bahraini Dinar', symbol: 'د.ب' },
  { code: 'qar', name: 'Qatari Riyal', symbol: 'ر.ق' },
  { code: 'omr', name: 'Omani Rial', symbol: 'ر.ع.' },
  { code: 'jod', name: 'Jordanian Dinar', symbol: 'د.ا' },
  { code: 'lbp', name: 'Lebanese Pound', symbol: 'ل.ل' },
  { code: 'syp', name: 'Syrian Pound', symbol: 'ل.س' },
  { code: 'lyd', name: 'Libyan Dinar', symbol: 'ل.د' },
  { code: 'sdg', name: 'Sudanese Pound', symbol: 'ج.س.' },
  { code: 'ssp', name: 'South Sudanese Pound', symbol: '£' },
  { code: 'ern', name: 'Eritrean Nakfa', symbol: 'Nfk' },
  { code: 'djf', name: 'Djiboutian Franc', symbol: 'Fdj' },
  { code: 'sos', name: 'Somali Shilling', symbol: 'S' },
  { code: 'com', name: 'Comorian Franc', symbol: 'CF' },
  { code: 'mru', name: 'Mauritanian Ouguiya', symbol: 'UM' },
  { code: 'mga', name: 'Malagasy Ariary', symbol: 'Ar' },
  { code: 'mvr', name: 'Maldivian Rufiyaa', symbol: 'Rf' },
  { code: 'scr', name: 'Seychellois Rupee', symbol: '₨' },
  { code: 'mur', name: 'Mauritian Rupee', symbol: '₨' },
  { code: 'mop', name: 'Macanese Pataca', symbol: 'MOP$' },
  { code: 'twd', name: 'Taiwan Dollar', symbol: 'NT$' },
  { code: 'khr', name: 'Cambodian Riel', symbol: '៛' },
  { code: 'lak', name: 'Lao Kip', symbol: '₭' },
  { code: 'mmk', name: 'Myanmar Kyat', symbol: 'K' },
  { code: 'bnd', name: 'Brunei Dollar', symbol: 'B$' },
  { code: 'fjd', name: 'Fijian Dollar', symbol: 'FJ$' },
  { code: 'pgk', name: 'Papua New Guinean Kina', symbol: 'K' },
  { code: 'sbd', name: 'Solomon Islands Dollar', symbol: 'SI$' },
  { code: 'vuv', name: 'Vanuatu Vatu', symbol: 'Vt' },
  { code: 'wst', name: 'Samoan Tala', symbol: 'WS$' },
  { code: 'top', name: 'Tongan Paʻanga', symbol: 'T$' },
  { code: 'xpf', name: 'CFP Franc', symbol: '₣' },
  { code: 'nzd', name: 'New Zealand Dollar', symbol: 'NZ$' },
  { code: 'aud', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'usd', name: 'US Dollar', symbol: '$' }
];

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
let currencyCache: CurrencyCache = {};

// Cache duration: 10 minutes
const CACHE_DURATION = 10 * 60 * 1000;

export async function convertSatsToCurrency(
  sats: number, 
  currency: string = 'usd'
): Promise<CurrencyConversion> {
  try {
    // Check if we have a recent cached rate
    const cached = currencyCache[currency];
    const now = new Date().toISOString();
    
    if (cached && (Date.now() - new Date(cached.lastUpdated).getTime()) < CACHE_DURATION) {
      const amount = sats * cached.rate;
      const currencyInfo = SUPPORTED_CURRENCIES.find(c => c.code === currency) || SUPPORTED_CURRENCIES[0];
      
      return {
        amount: Math.round(amount * 100) / 100, // Round to 2 decimals
        formatted: formatCurrency(amount, currencyInfo.symbol),
        currency,
        symbol: currencyInfo.symbol,
        lastUpdated: cached.lastUpdated
      };
    }

    // Fetch fresh rate from Alby Lightning Tools
    const fiatValue = await fiat.getFiatValue({ 
      satoshi: sats, 
      currency: currency 
    });

    // Update cache
    currencyCache[currency] = {
      rate: fiatValue / sats,
      lastUpdated: now
    };

    const currencyInfo = SUPPORTED_CURRENCIES.find(c => c.code === currency) || SUPPORTED_CURRENCIES[0];
    
    return {
      amount: Math.round(fiatValue * 100) / 100, // Round to 2 decimals
      formatted: formatCurrency(fiatValue, currencyInfo.symbol),
      currency,
      symbol: currencyInfo.symbol,
      lastUpdated: now
    };

  } catch (error) {
    console.error('Currency conversion error:', error);
    
    // Return fallback with last known rate if available
    const cached = currencyCache[currency];
    if (cached) {
      const amount = sats * cached.rate;
      const currencyInfo = SUPPORTED_CURRENCIES.find(c => c.code === currency) || SUPPORTED_CURRENCIES[0];
      
      return {
        amount: Math.round(amount * 100) / 100,
        formatted: formatCurrency(amount, currencyInfo.symbol),
        currency,
        symbol: currencyInfo.symbol,
        lastUpdated: cached.lastUpdated,
        error: 'Using cached rate'
      };
    }

    // Complete fallback
    const currencyInfo = SUPPORTED_CURRENCIES.find(c => c.code === currency) || SUPPORTED_CURRENCIES[0];
    return {
      amount: 0,
      formatted: 'N/A',
      currency,
      symbol: currencyInfo.symbol,
      error: 'Conversion unavailable'
    };
  }
}

function formatCurrency(amount: number, symbol: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD', // We'll use USD formatting as base, but display with the correct symbol
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount).replace('$', symbol);
}

export function getCurrencyByCode(code: string) {
  return SUPPORTED_CURRENCIES.find(c => c.code === code) || SUPPORTED_CURRENCIES[0];
}
