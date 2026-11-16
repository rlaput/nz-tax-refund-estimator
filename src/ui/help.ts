import type { TaxYear } from '../tax/years';

/**
 * Per-field help: where to find each value in myIR (or on a payslip or statement).
 * Shown behind an ⓘ toggle next to the field label.
 */
export type HelpKey =
  | 'name'
  | 'incomeType'
  | 'taxCode'
  | 'months'
  | 'gross'
  | 'paye'
  | 'levy'
  | 'interestGross'
  | 'interestRwt'
  | 'dividendGross'
  | 'dividendImputation'
  | 'dividendRwt'
  | 'ietcMonths';

const yearEnd = (y: TaxYear) => `31 March ${y.startYear + 1}`;

const MYIR = '<a href="https://myir.ird.govt.nz" target="_blank" rel="noopener">myIR</a>';

export function helpText(key: HelpKey, y: TaxYear): string {
  switch (key) {
    case 'name':
      return 'Only a label for you. Use the employer or payer name as it appears in your myIR <strong>Income summary</strong>.';
    case 'incomeType':
      return `Choose <strong>Salary / wages</strong> for employers. If the payer listed in ${MYIR} is <em>Accident Compensation Corporation</em>, choose ACC weekly compensation. If it is <em>Ministry of Social Development</em>, choose main benefit or NZ Super, whichever you received.`;
    case 'taxCode':
      return 'Printed on your payslips, and on the tax code declaration (IR330) you gave this employer. <strong>M/ME</strong> = main job (ME also pays the IETC through your pay). <strong>SB, S, SH, ST, SA</strong> = secondary jobs. <strong>SL</strong> = you have a student loan. Optional: it’s used only to explain your result.';
    case 'months':
      return `The first and last month this payer paid you between 1 April ${y.startYear} and ${yearEnd(y)}. In ${MYIR}, open the payer in your <strong>Income summary</strong> to see each pay period. Overlapping jobs are fine.`;
    case 'gross':
      return `${MYIR} → <strong>My income</strong> → <strong>Income summary</strong> for the year ending ${yearEnd(y)}. Use the <strong>Gross earnings</strong> total on this payer’s row. It’s your pay before tax, KiwiSaver and other deductions, including holiday pay and bonuses. Alternative: the year-to-date gross on your last payslip before ${yearEnd(y)}.`;
    case 'paye':
      return `Same row in ${MYIR}: the <strong>PAYE</strong> total (it already includes the ACC earners’ levy). Don’t add student loan, KiwiSaver or child support deductions; they appear in separate columns. Alternative: the year-to-date PAYE or tax on your last payslip of the year.`;
    case 'levy':
      return `Wages and ACC weekly compensation have the levy (${(y.acc.rate * 100).toFixed(2)}% in ${y.label}) taken out. NZ Super and main benefits don’t. If this payer’s <strong>Earnings not liable for ACC earners’ levy</strong> figure in myIR equals its gross earnings, untick this.`;
    case 'interestGross':
      return `${MYIR} → <strong>My income</strong> → <strong>Income summary</strong> lists interest by bank or provider. Add up the <strong>gross interest</strong>, the amount before RWT was taken. It also appears on each bank’s annual interest or RWT certificate.`;
    case 'interestRwt':
      return 'The <strong>RWT</strong> (resident withholding tax) deducted from that interest, shown next to the gross interest in myIR or on the bank’s RWT certificate. Add up all your banks.';
    case 'dividendGross':
      return 'Shown under dividends in your myIR <strong>Income summary</strong>, or on each dividend statement. Use the <strong>gross dividend</strong>, which is the cash paid plus imputation credits plus RWT. If only the cash amount is shown, add the imputation credits and RWT to it.';
    case 'dividendImputation':
      return 'On each dividend statement, and in the dividend details in myIR. This is company tax already paid on the dividend. It reduces your income tax but can’t be refunded as cash.';
    case 'dividendRwt':
      return 'The <strong>RWT deducted</strong> on each dividend statement or in myIR. Many NZ dividends have none if they are fully imputed.';
    case 'ietcMonths':
      return 'Count the months in which any ticked item applied, counting a month only once even if several items applied. For benefit or NZ Super, these are the months MSD paid you. Choose 12 if it applied all year.';
  }
}

/** Ids of help panels the user has opened (kept across re-renders). */
export const openHelp = new Set<string>();

/** Label with an ⓘ toggle and a collapsible help panel. */
export function labelWithHelp(forId: string, labelHtml: string, key: HelpKey, y: TaxYear): string {
  const helpId = `${forId}-help`;
  const open = openHelp.has(helpId);
  return `
    <div class="label-row">
      <label for="${forId}">${labelHtml}</label>
      <button type="button" class="help-btn" data-action="toggle-help" data-help="${helpId}"
        aria-expanded="${open}" aria-controls="${helpId}" aria-label="Where do I find this?" title="Where do I find this?">ⓘ</button>
    </div>
    <div id="${helpId}" class="help" ${open ? '' : 'hidden'}>${helpText(key, y)}</div>`;
}
