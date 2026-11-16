import { describe, expect, it } from 'vitest';
import { accLevy, calculate, ietc, incomeTax, monthsCovered, type CalcInput, type Payer } from './engine';
import { getYear } from './years';

const y2526 = getYear('2026');
const y2627 = getYear('2027');

let n = 0;
const payer = (p: Partial<Payer>): Payer => ({
  id: `p${n++}`,
  name: '',
  incomeType: 'wages',
  taxCode: 'M',
  startMonth: 0,
  endMonth: 11,
  gross: 0,
  paye: 0,
  levyLiable: true,
  ...p,
});

const input = (p: Partial<CalcInput>): CalcInput => ({
  yearId: '2026',
  payers: [],
  other: { interestGross: 0, interestRwt: 0, dividendGross: 0, dividendImputation: 0, dividendRwt: 0 },
  ietc: { mainBenefit: false, workingForFamilies: false, nzSuper: false, nonResident: false, ineligibleMonths: 12 },
  payeExcludesLevy: false,
  ...p,
});

/** Literal port of the spreadsheet's B16 formula. */
const sheetTax = (b5: number) =>
  Math.round(
    (b5 <= 15600
      ? b5 * 0.105
      : b5 <= 53500
        ? 1638 + (b5 - 15600) * 0.175
        : b5 <= 78100
          ? 8270.5 + (b5 - 53500) * 0.3
          : b5 <= 180000
            ? 15650.5 + (b5 - 78100) * 0.33
            : 49277.5 + (b5 - 180000) * 0.39) * 100,
  ) / 100;

describe('incomeTax', () => {
  it.each([
    [0, 0],
    [15_600, 1_638],
    [53_500, 8_270.5],
    [78_100, 15_650.5],
    [180_000, 49_277.5],
    [200_000, 57_077.5],
  ])('tax on %d is %d', (income, expected) => {
    expect(incomeTax(income, y2526.bands)).toBe(expected);
  });

  it('matches the spreadsheet formula across a range of incomes', () => {
    for (let i = 0; i <= 250_000; i += 1_237.37) {
      const income = Math.round(i * 100) / 100;
      expect(incomeTax(income, y2526.bands)).toBeCloseTo(sheetTax(income), 2);
    }
  });

  it('uses the same bands in 2026/27', () => {
    expect(incomeTax(60_000, y2627.bands)).toBe(10_220.5);
  });
});

describe('ietc', () => {
  it('pays the full $520 between $24k and $66k', () => {
    expect(ietc(24_000, 12, y2526)).toBe(520);
    expect(ietc(66_000, 12, y2526)).toBe(520);
  });
  it('abates 13c per dollar above $66k', () => {
    expect(ietc(68_000, 12, y2526)).toBe(260);
    expect(ietc(70_000, 12, y2526)).toBe(0);
  });
  it('is zero outside the range', () => {
    expect(ietc(23_999, 12, y2526)).toBe(0);
    expect(ietc(70_001, 12, y2526)).toBe(0);
  });
  it('pro-rates by eligible months', () => {
    expect(ietc(50_000, 6, y2526)).toBe(260);
  });
});

describe('accLevy', () => {
  it('applies the year rate', () => {
    expect(accLevy(60_000, y2526)).toBe(1_002);
    expect(accLevy(60_000, y2627)).toBe(1_050);
  });
  it('caps at maximum liable earnings', () => {
    expect(accLevy(500_000, y2526)).toBe(2_551.59);
    expect(accLevy(500_000, y2627)).toBe(2_741.22);
  });
});

describe('monthsCovered', () => {
  it('counts overlapping jobs once', () => {
    expect(monthsCovered([{ startMonth: 0, endMonth: 5 }, { startMonth: 3, endMonth: 8 }])).toBe(9);
  });
  it('handles a gap between jobs', () => {
    expect(monthsCovered([{ startMonth: 0, endMonth: 2 }, { startMonth: 9, endMonth: 11 }])).toBe(6);
  });
});

describe('calculate', () => {
  it('reproduces the spreadsheet when the levy is excluded (single payer)', () => {
    const r = calculate(input({ payers: [payer({ gross: 60_000, paye: 10_000 })], payeExcludesLevy: true }));
    expect(r.incomeTax).toBe(10_220.5);
    expect(r.ietc.amount).toBe(520);
    // Sheet: B18 + B19 = (10000 − 10220.5) + 520
    expect(r.result).toBe(299.5);
  });

  it('is square when PAYE was exactly right, including ACC levy and IETC', () => {
    const exact = 10_220.5 + 1_002 - 520;
    const r = calculate(input({ payers: [payer({ gross: 60_000, paye: exact })] }));
    expect(r.levy.owed).toBe(1_002);
    expect(r.result).toBe(0);
  });

  it('disqualifies IETC for Working for Families for the whole year', () => {
    const r = calculate(
      input({
        payers: [payer({ gross: 50_000, paye: 9_000 })],
        ietc: { mainBenefit: false, workingForFamilies: true, nzSuper: false, nonResident: false, ineligibleMonths: 12 },
      }),
    );
    expect(r.ietc.amount).toBe(0);
    expect(r.ietc.reason).toBe('disqualified');
  });

  it('pro-rates IETC when ineligible for part of the year', () => {
    const r = calculate(
      input({
        payers: [payer({ gross: 50_000, paye: 9_000 })],
        ietc: { mainBenefit: true, workingForFamilies: false, nzSuper: false, nonResident: false, ineligibleMonths: 3 },
      }),
    );
    expect(r.ietc.eligibleMonths).toBe(9);
    expect(r.ietc.amount).toBe(390);
  });

  it('sums two overlapping employers and flags a secondary-code shortfall', () => {
    const main = payer({ name: 'Main job', taxCode: 'M', gross: 50_000, paye: 7_658 + 835 });
    const second = payer({ name: 'Side job', taxCode: 'SB', startMonth: 3, endMonth: 11, gross: 20_000, paye: 20_000 * (0.105 + 0.0167) });
    const r = calculate(input({ payers: [main, second] }));
    expect(r.taxableIncome).toBe(70_000);
    expect(r.incomeTax).toBe(13_220.5);
    expect(r.levy.owed).toBe(1_169);
    expect(r.ietc.amount).toBe(0);
    expect(r.ietc.reason).toBe('income-too-high');
    expect(r.result).toBe(-3_462.5);
    expect(r.insights.some((i) => i.kind === 'warn' && i.text.includes('Side job'))).toBe(true);
  });

  it('refunds ACC levy deducted above the cap across three employers', () => {
    const payers = [0, 1, 2].map((i) => payer({ name: `Job ${i}`, gross: 80_000, paye: 0, taxCode: i ? 'SH' : 'M' }));
    const r = calculate(input({ payers }));
    expect(r.levy.owed).toBe(2_551.59);
    expect(r.levy.estimatedDeducted).toBe(4_008);
    expect(r.levy.overCapRefund).toBe(1_456.41);
  });

  it('adds interest and dividends to taxable income and credits RWT and imputation', () => {
    const r = calculate(
      input({
        payers: [payer({ gross: 40_000, paye: 6_000 })],
        other: { interestGross: 1_000, interestRwt: 175, dividendGross: 1_000, dividendImputation: 280, dividendRwt: 50 },
      }),
    );
    expect(r.taxableIncome).toBe(42_000);
    expect(r.credits.rwt).toBe(225);
    expect(r.credits.imputationUsed).toBe(280);
    expect(r.totalCredits).toBe(6_505);
  });

  it('ignores empty payer rows', () => {
    const r = calculate(input({ payers: [payer({}), payer({ gross: 30_000, paye: 4_000 })] }));
    expect(r.payers).toHaveLength(1);
  });
});
