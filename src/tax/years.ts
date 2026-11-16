/**
 * Tax-year parameters for NZ individual income tax square-ups.
 *
 * Sources (checked November 2026):
 *  - Income tax bands: ird.govt.nz "Tax rates for individuals". Bands changed 31 July 2024
 *    (Budget 2024) and are unchanged for 2025/26 and 2026/27.
 *  - IETC: ird.govt.nz/ietc — $520 max, $24,000–$66,000 full, abates 13c/$ to $70,000.
 *  - ACC earners' levy: IRD Payroll Calculations & Business Rules Specification 2026 and
 *    MBIE levy consultation — 2025/26 1.67% to $152,790; 2026/27 1.75% to $156,641.
 *
 * To add a year, append a new entry to TAX_YEARS. Everything else is derived from this file.
 */

export interface TaxBand {
  /** Upper limit of the band (inclusive). `Infinity` for the top band. */
  upTo: number;
  rate: number;
}

export interface TaxYear {
  id: string;
  /** Display label, e.g. "2025/26". */
  label: string;
  /** Calendar year the tax year starts (1 April). */
  startYear: number;
  bands: TaxBand[];
  ietc: {
    max: number;
    minIncome: number;
    abateFrom: number;
    abateRate: number;
    maxIncome: number;
  };
  acc: {
    /** Earners' levy rate incl. GST. */
    rate: number;
    maxLiableEarnings: number;
  };
  /** Status shown in the UI. */
  status: 'completed' | 'current';
}

const BANDS_FROM_JULY_2024: TaxBand[] = [
  { upTo: 15_600, rate: 0.105 },
  { upTo: 53_500, rate: 0.175 },
  { upTo: 78_100, rate: 0.3 },
  { upTo: 180_000, rate: 0.33 },
  { upTo: Infinity, rate: 0.39 },
];

const IETC_FROM_JULY_2024 = {
  max: 520,
  minIncome: 24_000,
  abateFrom: 66_000,
  abateRate: 0.13,
  maxIncome: 70_000,
};

export const TAX_YEARS: TaxYear[] = [
  {
    id: '2026',
    label: '2025/26',
    startYear: 2025,
    bands: BANDS_FROM_JULY_2024,
    ietc: IETC_FROM_JULY_2024,
    acc: { rate: 0.0167, maxLiableEarnings: 152_790 },
    status: 'completed',
  },
  {
    id: '2027',
    label: '2026/27',
    startYear: 2026,
    bands: BANDS_FROM_JULY_2024,
    ietc: IETC_FROM_JULY_2024,
    acc: { rate: 0.0175, maxLiableEarnings: 156_641 },
    status: 'current',
  },
];

/** The most recent completed year is the sensible default for a refund estimate. */
export const DEFAULT_YEAR_ID = '2026';

export function getYear(id: string): TaxYear {
  return TAX_YEARS.find((y) => y.id === id) ?? TAX_YEARS.find((y) => y.id === DEFAULT_YEAR_ID)!;
}

const MONTH_NAMES = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

/** Month index 0 = April … 11 = March of the following calendar year. */
export function monthLabel(year: TaxYear, index: number): string {
  const calendarYear = index < 9 ? year.startYear : year.startYear + 1;
  return `${MONTH_NAMES[index]} ${calendarYear}`;
}

export function yearRangeLabel(year: TaxYear): string {
  return `1 April ${year.startYear} – 31 March ${year.startYear + 1}`;
}
