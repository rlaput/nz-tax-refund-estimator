import { INCOME_TYPES, type CalcInput, type IncomeType, type Payer } from '../tax/engine';
import { DEFAULT_YEAR_ID, TAX_YEARS } from '../tax/years';

const STORAGE_KEY = 'nz-tax-refund-estimator.v1';

let counter = 0;
export const newId = (): string => `p${Date.now().toString(36)}${(counter++).toString(36)}`;

export function newPayer(index: number, type: IncomeType = 'wages'): Payer {
  return {
    id: newId(),
    name: index === 0 ? 'Main employer' : `Employer ${index + 1}`,
    incomeType: type,
    taxCode: index === 0 ? 'M' : '',
    startMonth: 0,
    endMonth: 11,
    gross: 0,
    paye: 0,
    levyLiable: INCOME_TYPES.find((t) => t.value === type)?.levyDefault ?? true,
  };
}

export function defaultState(): CalcInput {
  return {
    yearId: DEFAULT_YEAR_ID,
    payers: [newPayer(0)],
    other: { interestGross: 0, interestRwt: 0, dividendGross: 0, dividendImputation: 0, dividendRwt: 0 },
    ietc: { mainBenefit: false, workingForFamilies: false, nzSuper: false, nonResident: false, ineligibleMonths: 12 },
    payeExcludesLevy: false,
  };
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const bool = (v: unknown): boolean => v === true;

/** Validate and fill anything missing from stored state so old/corrupt data can't break the app. */
function sanitize(raw: unknown): CalcInput {
  const d = defaultState();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, any>;
  const yearId = TAX_YEARS.some((y) => y.id === r.yearId) ? (r.yearId as string) : d.yearId;
  const payers: Payer[] = Array.isArray(r.payers)
    ? r.payers.slice(0, 20).map((p: any, i: number) => {
        const base = newPayer(i);
        const type = INCOME_TYPES.some((t) => t.value === p?.incomeType) ? p.incomeType : base.incomeType;
        return {
          id: typeof p?.id === 'string' ? p.id : base.id,
          name: typeof p?.name === 'string' ? p.name.slice(0, 80) : base.name,
          incomeType: type,
          taxCode: typeof p?.taxCode === 'string' ? p.taxCode : base.taxCode,
          startMonth: num(p?.startMonth, 0),
          endMonth: num(p?.endMonth, 11),
          gross: num(p?.gross),
          paye: num(p?.paye),
          levyLiable: typeof p?.levyLiable === 'boolean' ? p.levyLiable : base.levyLiable,
        };
      })
    : d.payers;
  const o = r.other ?? {};
  const ie = r.ietc ?? {};
  return {
    yearId,
    payers: payers.length ? payers : d.payers,
    other: {
      interestGross: num(o.interestGross),
      interestRwt: num(o.interestRwt),
      dividendGross: num(o.dividendGross),
      dividendImputation: num(o.dividendImputation),
      dividendRwt: num(o.dividendRwt),
    },
    ietc: {
      mainBenefit: bool(ie.mainBenefit),
      workingForFamilies: bool(ie.workingForFamilies),
      nzSuper: bool(ie.nzSuper),
      nonResident: bool(ie.nonResident),
      ineligibleMonths: num(ie.ineligibleMonths, 12),
    },
    payeExcludesLevy: bool(r.payeExcludesLevy),
  };
}

export function loadState(): CalcInput {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitize(JSON.parse(raw)) : defaultState();
  } catch {
    return defaultState();
  }
}

export function saveState(state: CalcInput): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable (private mode etc.) — the app still works without it */
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Parse a money string as typed or pasted from myIR, e.g. "$12,345.67" or "12 345". */
export function parseMoney(text: string): number {
  const cleaned = text.replace(/[^0-9.\-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

export function formatMoneyInput(n: number): string {
  return n ? n.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
}
