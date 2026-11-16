import { fmt, type CalcResult } from '../tax/engine';
import { esc } from './form';

const pct = (r: number): string => `${(r * 100).toFixed(1)}%`;

function headline(r: CalcResult): string {
  if (r.taxableIncome <= 0) {
    return `
    <div class="headline neutral">
      <p class="headline-label">Your estimated result</p>
      <p class="headline-amount">—</p>
      <p class="headline-msg">Enter your gross earnings and PAYE to see your estimate.</p>
    </div>`;
  }
  const cls = r.result > 0 ? 'refund' : r.result < 0 ? 'owe' : 'neutral';
  const label = r.result > 0 ? 'Estimated refund' : r.result < 0 ? 'Estimated tax to pay' : 'All square';
  const msg =
    r.result > 0
      ? '✅ IRD pays refunds automatically into the bank account linked to your myIR account.'
      : r.result < 0
        ? '❌ IRD will tell you how much you owe and how to pay it.'
        : '✓ No refund and no tax to pay.';
  return `
  <div class="headline ${cls}" role="status" aria-live="polite">
    <p class="headline-label">${label}</p>
    <p class="headline-amount">${fmt(Math.abs(r.result))}</p>
    <p class="headline-msg">${msg}</p>
  </div>`;
}

function ietcNote(r: CalcResult): string {
  switch (r.ietc.reason) {
    case 'applied':
      return r.ietc.eligibleMonths < 12
        ? `Includes ${fmt(r.ietc.amount)} IETC (pro-rated for ${r.ietc.eligibleMonths} months).`
        : `Includes ${fmt(r.ietc.amount)} IETC (full year).`;
    case 'disqualified':
    case 'no-eligible-months':
      return 'IETC not applied: you weren’t eligible in any month, based on your answers.';
    case 'income-too-low':
      return `IETC not applicable: income is below ${fmt(r.year.ietc.minIncome)}.`;
    case 'income-too-high':
      return `IETC not applicable: income is above ${fmt(r.year.ietc.maxIncome)}.`;
  }
}

const row = (label: string, value: number, opts: { sign?: '+' | '−'; strong?: boolean; sub?: string } = {}) => `
  <tr class="${opts.strong ? 'strong' : ''}">
    <th scope="row">${label}${opts.sub ? `<span class="sub">${opts.sub}</span>` : ''}</th>
    <td>${opts.sign ? `<span class="sign">${opts.sign}</span>` : ''}${fmt(value)}</td>
  </tr>`;

export function renderResults(r: CalcResult): string {
  const hasIncome = r.taxableIncome > 0;
  const showOther = r.interestIncome > 0 || r.dividendIncome > 0;

  return `
  ${headline(r)}
  ${
    hasIncome
      ? `
  <p class="ietc-note">ℹ ${ietcNote(r)}</p>

  <h3>How it adds up</h3>
  <table class="breakdown">
    <tbody>
      ${showOther ? row('Employment & payer income', r.employmentIncome) : ''}
      ${r.interestIncome ? row('Interest', r.interestIncome) : ''}
      ${r.dividendIncome ? row('Dividends', r.dividendIncome) : ''}
      ${row('Total taxable income', r.taxableIncome, { strong: true, sub: `Top tax rate ${pct(r.marginalRate)}` })}
    </tbody>
    <tbody class="group">
      ${row('Income tax on your income', r.incomeTax)}
      ${
        r.levy.included
          ? row('ACC earners’ levy', r.levy.owed, {
              sign: '+',
              sub: `${(r.year.acc.rate * 100).toFixed(2)}% of ${fmt(Math.min(r.levy.liableEarnings, r.year.acc.maxLiableEarnings))}${r.levy.liableEarnings > r.year.acc.maxLiableEarnings ? ' (capped)' : ''}`,
            })
          : ''
      }
      ${r.ietc.amount ? row('Independent earner tax credit', r.ietc.amount, { sign: '−' }) : ''}
      ${row('Total you should have paid', r.totalLiability, { strong: true })}
    </tbody>
    <tbody class="group">
      ${row('PAYE deducted', r.credits.paye)}
      ${r.credits.rwt ? row('RWT deducted', r.credits.rwt, { sign: '+' }) : ''}
      ${r.credits.imputationUsed ? row('Imputation credits', r.credits.imputationUsed, { sign: '+' }) : ''}
      ${row('Total already paid', r.totalCredits, { strong: true })}
    </tbody>
    <tbody class="group total">
      ${row(r.result >= 0 ? 'Refund (paid − owed)' : 'To pay (owed − paid)', Math.abs(r.result), { strong: true })}
    </tbody>
  </table>

  ${
    r.payers.length
      ? `
  <h3>By payer</h3>
  <div class="table-scroll">
    <table class="payer-table">
      <thead><tr><th scope="col">Payer</th><th scope="col">Gross</th><th scope="col">PAYE</th><th scope="col" title="PAYE as a share of gross earnings">Rate</th></tr></thead>
      <tbody>
        ${r.payers
          .map(
            (p) => `<tr><th scope="row">${esc(p.name || 'Unnamed')}<span class="sub">${p.months} mo</span></th><td>${fmt(p.gross)}</td><td>${fmt(p.paye)}</td><td>${pct(p.effectiveRate)}</td></tr>`,
          )
          .join('')}
      </tbody>
    </table>
  </div>
  <p class="hint">“Rate” is PAYE divided by gross for that payer, including the ACC levy. Compare it with your top rate of ${pct(r.marginalRate)} plus levy.</p>`
      : ''
  }

  ${
    r.insights.length
      ? `<h3>What’s driving your result</h3>
  <ul class="insights">
    ${r.insights.map((i) => `<li class="${i.kind}">${esc(i.text)}</li>`).join('')}
  </ul>`
      : ''
  }`
      : ''
  }
  <p class="disclaimer">This is an estimate only. IRD confirms the final amount in its assessment.</p>
  <div class="actions">
    <button type="button" class="btn btn-secondary" data-action="print">Print / save PDF</button>
    <button type="button" class="btn btn-ghost" data-action="reset">Clear all</button>
  </div>`;
}
