import { fmt } from '../tax/engine';
import { getYear } from '../tax/years';

const money = (n: number) => fmt(n).replace(/\.00$/, '');

export function renderInfo(yearId: string): string {
  const y = getYear(yearId);
  let lower = 0;
  const bandRows = y.bands
    .map((b) => {
      const from = lower === 0 ? '$0' : money(lower + 1);
      const label = b.upTo === Infinity ? `${from} and over` : `${from} – ${money(b.upTo)}`;
      lower = b.upTo;
      return `<tr><td>${label}</td><td>${(b.rate * 100).toFixed(1)}%</td></tr>`;
    })
    .join('');

  return `
  <section class="card info" aria-labelledby="h-bands">
    <h2 id="h-bands">📋 NZ income tax bands, ${y.label}</h2>
    <p>NZ taxes income progressively: each band’s rate applies only to the part of your income inside that band.</p>
    <table class="bands">
      <thead><tr><th scope="col">Income band</th><th scope="col">Tax rate</th></tr></thead>
      <tbody>${bandRows}</tbody>
    </table>
    <p class="hint">ACC earners’ levy: ${(y.acc.rate * 100).toFixed(2)}% of liable earnings up to ${money(y.acc.maxLiableEarnings)}. IETC: up to ${money(y.ietc.max)} for income ${money(y.ietc.minIncome)}–${money(y.ietc.maxIncome)}.</p>
  </section>

  <section class="card info">
    <details>
      <summary><h2>💡 Independent Earner Tax Credit (IETC)</h2></summary>
      <p>If you’re a NZ tax resident earning between ${money(y.ietc.minIncome)} and ${money(y.ietc.maxIncome)}, you may be eligible for the IETC, worth up to ${money(y.ietc.max)} a year.</p>
      <ul>
        <li>Full credit: ${money(y.ietc.minIncome)} – ${money(y.ietc.abateFrom)}</li>
        <li>Reduces by ${Math.round(y.ietc.abateRate * 100)}c for every dollar over ${money(y.ietc.abateFrom)}</li>
        <li>Over ${money(y.ietc.maxIncome)}: not eligible</li>
      </ul>
      <p><strong>You’re not eligible for any month in which</strong> you received a main benefit, NZ Super or a Veteran’s Pension, or you or your partner received Working for Families, or you weren’t a NZ tax resident. The credit drops by 1/12 for each such month. For example, 6 eligible months gives up to $260.</p>
      <p><strong>ME tax code:</strong> your employer may already have paid your IETC across your pay cycles (about $10 a week). That reduces or wipes out the part of your year-end refund that comes from the IETC.</p>
    </details>
  </section>

  <section class="card info">
    <details>
      <summary><h2>⚙ How this calculator works</h2></summary>
      <ol class="how">
        <li><strong>Total income:</strong> adds up gross earnings from every employer and payer, plus any interest and dividends, for the year (1 April – 31 March).</li>
        <li><strong>Tax owed:</strong> income tax is worked out on the combined total using the progressive bands. Each employer only knows its own pay, so this is where multiple jobs get evened out.</li>
        <li><strong>ACC earners’ levy:</strong> added on liable earnings, up to the yearly maximum. PAYE figures include the levy, so it has to be counted on both sides. If several employers together took levy on more than the maximum, the excess comes back to you.</li>
        <li><strong>IETC:</strong> subtracted if you’re eligible, pro-rated by eligible months.</li>
        <li><strong>Tax already paid:</strong> PAYE from every payer, plus RWT and imputation credits.</li>
        <li><strong>Result:</strong> paid minus owed. A positive number is a refund; a negative number is tax to pay.</li>
      </ol>
    </details>
  </section>

  <section class="card info">
    <details>
      <summary><h2>❓ What else can affect your result?</h2></summary>
      <p>Your final IRD assessment may differ from this estimate because of:</p>
      <ul>
        <li>Income not covered here: self-employment, rental, overseas income, or PIE income at the wrong rate</li>
        <li>Student loan repayments (squared up separately)</li>
        <li>KiwiSaver contributions (these don’t change income tax)</li>
        <li>Working for Families tax credits</li>
        <li>Donation tax credits (claimed separately)</li>
        <li>Amounts carried over from earlier years, or debts IRD offsets against a refund</li>
      </ul>
    </details>
  </section>

  <section class="card info disclaimer-card">
    <h2>⚠ Disclaimer</h2>
    <p>This is an estimate only. IRD calculates your final result. Refer to your official IRD income tax assessment for the final figures. Rates are current for ${y.label}; see <a href="https://www.ird.govt.nz/income-tax/income-tax-for-individuals/tax-codes-and-tax-rates-for-individuals/tax-rates-for-individuals" target="_blank" rel="noopener">ird.govt.nz</a>.</p>
    <p class="hint">Your entries are saved only in this browser (local storage) and never leave your device.</p>
  </section>`;
}
