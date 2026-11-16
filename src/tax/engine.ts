import { getYear, type TaxBand, type TaxYear } from './years';

export type IncomeType = 'wages' | 'acc' | 'benefit' | 'super' | 'other';

export const INCOME_TYPES: { value: IncomeType; label: string; levyDefault: boolean }[] = [
  { value: 'wages', label: 'Salary / wages', levyDefault: true },
  { value: 'acc', label: 'ACC weekly compensation', levyDefault: true },
  { value: 'benefit', label: 'Main benefit (e.g. Jobseeker)', levyDefault: false },
  { value: 'super', label: 'NZ Super / Veteran’s Pension', levyDefault: false },
  { value: 'other', label: 'Other taxed income (e.g. paid parental leave, student allowance)', levyDefault: false },
];

export const TAX_CODES = ['', 'M', 'ME', 'M SL', 'ME SL', 'SB', 'S', 'SH', 'ST', 'SA', 'SB SL', 'S SL', 'SH SL', 'ST SL', 'SA SL', 'STC', 'ND', 'WT'] as const;
export type TaxCode = (typeof TAX_CODES)[number];

/** Flat income-tax rate used by each secondary tax code (excluding ACC levy and student loan). */
export const SECONDARY_CODE_RATES: Record<string, number> = {
  SB: 0.105,
  S: 0.175,
  SH: 0.3,
  ST: 0.33,
  SA: 0.39,
};

export interface Payer {
  id: string;
  name: string;
  incomeType: IncomeType;
  taxCode: TaxCode;
  /** 0 = April … 11 = March. */
  startMonth: number;
  endMonth: number;
  gross: number;
  paye: number;
  levyLiable: boolean;
}

export interface OtherIncome {
  interestGross: number;
  interestRwt: number;
  dividendGross: number;
  dividendImputation: number;
  dividendRwt: number;
}

export interface IetcInput {
  mainBenefit: boolean;
  workingForFamilies: boolean;
  nzSuper: boolean;
  nonResident: boolean;
  /** Months (0–12) in which any of the above applied. Only used when one of them is true. */
  ineligibleMonths: number;
}

export interface CalcInput {
  yearId: string;
  payers: Payer[];
  other: OtherIncome;
  ietc: IetcInput;
  /** Set when the "tax deducted" figures entered do NOT include the ACC earners' levy. */
  payeExcludesLevy: boolean;
}

export interface PayerResult {
  id: string;
  name: string;
  gross: number;
  paye: number;
  effectiveRate: number;
  months: number;
  levyEstimated: number;
}

export interface Insight {
  kind: 'info' | 'good' | 'warn';
  text: string;
}

export interface CalcResult {
  year: TaxYear;
  payers: PayerResult[];
  employmentIncome: number;
  interestIncome: number;
  dividendIncome: number;
  taxableIncome: number;
  incomeTax: number;
  marginalRate: number;
  levy: {
    included: boolean;
    liableEarnings: number;
    owed: number;
    /** What the payers would have deducted between them, each up to the cap. */
    estimatedDeducted: number;
    overCapRefund: number;
  };
  ietc: {
    amount: number;
    fullYearAmount: number;
    eligibleMonths: number;
    reason: 'applied' | 'disqualified' | 'income-too-low' | 'income-too-high' | 'no-eligible-months';
  };
  credits: {
    paye: number;
    rwt: number;
    imputationUsed: number;
    imputationUnused: number;
  };
  totalLiability: number;
  totalCredits: number;
  /** Positive = refund, negative = tax to pay. */
  result: number;
  monthsWithIncome: number;
  insights: Insight[];
}

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

const clampMonth = (m: number): number => Math.min(11, Math.max(0, Math.trunc(Number.isFinite(m) ? m : 0)));
const nonNeg = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0);

/** Progressive income tax, rounded to cents. Matches the spreadsheet formula exactly. */
export function incomeTax(income: number, bands: TaxBand[]): number {
  let remaining = nonNeg(income);
  let lower = 0;
  let tax = 0;
  for (const band of bands) {
    if (remaining <= 0) break;
    const width = band.upTo - lower;
    const portion = Math.min(remaining, width);
    tax += portion * band.rate;
    remaining -= portion;
    lower = band.upTo;
  }
  return round2(tax);
}

export function marginalRate(income: number, bands: TaxBand[]): number {
  const i = nonNeg(income);
  for (const band of bands) if (i <= band.upTo) return band.rate;
  return bands[bands.length - 1].rate;
}

/** ACC earners' levy on liable earnings, capped at the maximum liable earnings. */
export function accLevy(liableEarnings: number, year: TaxYear): number {
  return round2(Math.min(nonNeg(liableEarnings), year.acc.maxLiableEarnings) * year.acc.rate);
}

/** Full-year IETC entitlement for an income (before pro-rating). */
export function ietcFullYear(income: number, year: TaxYear): number {
  const { max, minIncome, abateFrom, abateRate, maxIncome } = year.ietc;
  if (income < minIncome || income > maxIncome) return 0;
  if (income <= abateFrom) return max;
  return Math.max(max - abateRate * (income - abateFrom), 0);
}

/** IETC pro-rated by whole months of eligibility (same approach as the spreadsheet). */
export function ietc(income: number, eligibleMonths: number, year: TaxYear): number {
  const months = Math.min(12, Math.max(0, eligibleMonths));
  return round2(ietcFullYear(income, year) * (months / 12));
}

/** Number of distinct months covered by the payers' date ranges (overlaps counted once). */
export function monthsCovered(payers: Pick<Payer, 'startMonth' | 'endMonth'>[]): number {
  let mask = 0;
  for (const p of payers) {
    const s = clampMonth(p.startMonth);
    const e = clampMonth(p.endMonth);
    const [from, to] = s <= e ? [s, e] : [e, s];
    for (let m = from; m <= to; m++) mask |= 1 << m;
  }
  let count = 0;
  for (let m = 0; m < 12; m++) if (mask & (1 << m)) count++;
  return count;
}

export function payerMonths(p: Pick<Payer, 'startMonth' | 'endMonth'>): number {
  return Math.abs(clampMonth(p.endMonth) - clampMonth(p.startMonth)) + 1;
}

const pct = (r: number): string => `${(r * 100).toFixed(r * 100 % 1 === 0 ? 0 : 1)}%`;

export function calculate(input: CalcInput): CalcResult {
  const year = getYear(input.yearId);
  const payers = input.payers.filter((p) => nonNeg(p.gross) > 0 || nonNeg(p.paye) > 0);

  const employmentIncome = round2(payers.reduce((s, p) => s + nonNeg(p.gross), 0));
  const interestIncome = round2(nonNeg(input.other.interestGross));
  const dividendIncome = round2(nonNeg(input.other.dividendGross));
  const taxableIncome = round2(employmentIncome + interestIncome + dividendIncome);

  const tax = incomeTax(taxableIncome, year.bands);
  const topRate = marginalRate(taxableIncome, year.bands);

  // ACC earners' levy
  const levyIncluded = !input.payeExcludesLevy;
  const levyPayers = payers.filter((p) => p.levyLiable);
  const liableEarnings = round2(levyPayers.reduce((s, p) => s + nonNeg(p.gross), 0));
  const levyOwed = levyIncluded ? accLevy(liableEarnings, year) : 0;
  const levyEstimatedDeducted = levyIncluded
    ? round2(levyPayers.reduce((s, p) => s + accLevy(p.gross, year), 0))
    : 0;
  const overCapRefund = levyIncluded ? round2(Math.max(0, levyEstimatedDeducted - levyOwed)) : 0;

  // IETC
  const autoDisqualified = payers.some((p) => p.incomeType === 'benefit' || p.incomeType === 'super');
  const anyIneligible =
    input.ietc.mainBenefit || input.ietc.workingForFamilies || input.ietc.nzSuper || input.ietc.nonResident || autoDisqualified;
  const ineligibleMonths = anyIneligible ? Math.min(12, Math.max(0, Math.round(input.ietc.ineligibleMonths))) : 0;
  const eligibleMonths = 12 - ineligibleMonths;
  const ietcFull = round2(ietcFullYear(taxableIncome, year));
  let ietcAmount = 0;
  let ietcReason: CalcResult['ietc']['reason'];
  if (taxableIncome < year.ietc.minIncome) ietcReason = 'income-too-low';
  else if (taxableIncome > year.ietc.maxIncome) ietcReason = 'income-too-high';
  else if (eligibleMonths <= 0) ietcReason = anyIneligible ? 'disqualified' : 'no-eligible-months';
  else {
    ietcAmount = ietc(taxableIncome, eligibleMonths, year);
    // At the top of the abatement range the credit is fully phased out.
    ietcReason = ietcAmount > 0 ? 'applied' : 'income-too-high';
  }
  // IETC can’t take income tax below zero.
  ietcAmount = Math.min(ietcAmount, tax);

  // Credits
  const paye = round2(payers.reduce((s, p) => s + nonNeg(p.paye), 0));
  const rwt = round2(nonNeg(input.other.interestRwt) + nonNeg(input.other.dividendRwt));
  const imputation = round2(nonNeg(input.other.dividendImputation));
  // Imputation credits are not refundable: they can only reduce income tax to zero.
  const imputationUsed = round2(Math.min(imputation, Math.max(0, tax - ietcAmount)));
  const imputationUnused = round2(imputation - imputationUsed);

  const totalLiability = round2(tax + levyOwed - ietcAmount);
  const totalCredits = round2(paye + rwt + imputationUsed);
  const result = round2(totalCredits - totalLiability);

  const payerResults: PayerResult[] = payers.map((p) => ({
    id: p.id,
    name: p.name,
    gross: round2(nonNeg(p.gross)),
    paye: round2(nonNeg(p.paye)),
    effectiveRate: nonNeg(p.gross) > 0 ? nonNeg(p.paye) / nonNeg(p.gross) : 0,
    months: payerMonths(p),
    levyEstimated: levyIncluded && p.levyLiable ? accLevy(p.gross, year) : 0,
  }));

  const months = monthsCovered(payers);
  const insights = buildInsights({
    input,
    year,
    payers,
    taxableIncome,
    topRate,
    months,
    overCapRefund,
    imputationUnused,
    ietcReason,
    ietcAmount,
    eligibleMonths,
    levyIncluded,
  });

  return {
    year,
    payers: payerResults,
    employmentIncome,
    interestIncome,
    dividendIncome,
    taxableIncome,
    incomeTax: tax,
    marginalRate: topRate,
    levy: {
      included: levyIncluded,
      liableEarnings,
      owed: levyOwed,
      estimatedDeducted: levyEstimatedDeducted,
      overCapRefund,
    },
    ietc: { amount: ietcAmount, fullYearAmount: ietcFull, eligibleMonths, reason: ietcReason },
    credits: { paye, rwt, imputationUsed, imputationUnused },
    totalLiability,
    totalCredits,
    result,
    monthsWithIncome: months,
    insights,
  };
}

function buildInsights(ctx: {
  input: CalcInput;
  year: TaxYear;
  payers: Payer[];
  taxableIncome: number;
  topRate: number;
  months: number;
  overCapRefund: number;
  imputationUnused: number;
  ietcReason: CalcResult['ietc']['reason'];
  ietcAmount: number;
  eligibleMonths: number;
  levyIncluded: boolean;
}): Insight[] {
  const out: Insight[] = [];
  const { payers, topRate, year } = ctx;
  if (payers.length === 0) return out;

  if (payers.length > 1) {
    out.push({
      kind: 'info',
      text: `You had ${payers.length} payers this year. Each one only sees its own pay, so PAYE is rarely exact across several jobs. This is the most common reason for a refund or a bill.`,
    });
  }

  for (const p of payers) {
    const base = p.taxCode.replace(' SL', '');
    const codeRate = SECONDARY_CODE_RATES[base];
    if (codeRate === undefined) continue;
    const label = p.name || 'A payer';
    if (codeRate < topRate) {
      out.push({
        kind: 'warn',
        text: `${label} used secondary code ${p.taxCode} (${pct(codeRate)} income tax), but some of your income falls in the ${pct(topRate)} band. This job probably didn’t have enough tax taken, so you may owe tax. Try IRD’s secondary tax code calculator.`,
      });
    } else if (codeRate > topRate) {
      out.push({
        kind: 'good',
        text: `${label} used secondary code ${p.taxCode} (${pct(codeRate)} income tax), which is higher than your top rate of ${pct(topRate)}. Too much tax was probably taken, so it comes back as a refund.`,
      });
    }
  }

  const primaryCount = payers.filter((p) => /^ME?( SL)?$/.test(p.taxCode)).length;
  if (primaryCount > 1) {
    out.push({
      kind: 'warn',
      text: 'More than one payer is on a main tax code (M/ME). That’s fine if the jobs were back to back, but if they overlapped, one should have used a secondary code. Otherwise too little tax may have been taken.',
    });
  }

  if (payers.some((p) => p.taxCode.startsWith('ME'))) {
    out.push({
      kind: 'info',
      text: 'You used the ME tax code, so your employer has already paid some or all of your IETC through lower PAYE (about $10 a week). That lowers your refund by the same amount, and the estimate above already reflects it.',
    });
  }

  if (ctx.months > 0 && ctx.months < 12 && payers.some((p) => /^ME?( SL)?$/.test(p.taxCode) || p.taxCode === '')) {
    out.push({
      kind: 'good',
      text: `You had income in only ${ctx.months} of 12 months. PAYE on a main code assumes you earn that pay all year, so part-year earners often get a refund.`,
    });
  }

  if (ctx.overCapRefund > 0) {
    out.push({
      kind: 'good',
      text: `Your payers between them probably deducted about ${fmt(ctx.overCapRefund)} more ACC earners’ levy than the maximum for ${year.label} (levy stops at ${fmt(year.acc.maxLiableEarnings)} of earnings). IRD refunds this, and it is included above.`,
    });
  }

  if (ctx.imputationUnused > 0) {
    out.push({
      kind: 'info',
      text: `${fmt(ctx.imputationUnused)} of imputation credits can’t be refunded. IRD converts unused imputation credits into a loss carried forward to future years.`,
    });
  }

  if (ctx.ietcReason === 'applied' && ctx.eligibleMonths < 12) {
    out.push({
      kind: 'info',
      text: `IETC pro-rated to ${ctx.eligibleMonths} eligible months: ${fmt(ctx.ietcAmount)}.`,
    });
  }

  if (!ctx.levyIncluded) {
    out.push({
      kind: 'warn',
      text: 'ACC earners’ levy left out. Use this only if your "tax deducted" figures already exclude it. The PAYE figure in myIR includes it.',
    });
  }

  if (payers.some((p) => p.taxCode.includes('SL'))) {
    out.push({
      kind: 'info',
      text: 'Student loan repayments are squared up separately and are not part of this estimate. Leave them out of the PAYE figures.',
    });
  }

  return out;
}

const fmtNzd = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' });
export const fmt = (n: number): string => fmtNzd.format(n);
