import { INCOME_TYPES, TAX_CODES, type CalcInput, type Payer } from '../tax/engine';
import { TAX_YEARS, getYear, monthLabel, yearRangeLabel, type TaxYear } from '../tax/years';
import { labelWithHelp, openHelp, helpText, type HelpKey } from './help';
import { formatMoneyInput } from './state';

export const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function moneyField(id: string, label: string, value: number, attrs: string, help: HelpKey, y: TaxYear, hint = ''): string {
  return `
    <div class="field">
      ${labelWithHelp(id, label, help, y)}
      <div class="money">
        <span aria-hidden="true">$</span>
        <input id="${id}" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00"
          value="${esc(formatMoneyInput(value))}" ${attrs} data-money />
      </div>
      ${hint ? `<p class="hint">${hint}</p>` : ''}
    </div>`;
}

function monthOptions(yearId: string, selected: number): string {
  const year = getYear(yearId);
  return Array.from({ length: 12 }, (_, i) => `<option value="${i}" ${i === selected ? 'selected' : ''}>${monthLabel(year, i)}</option>`).join('');
}

function payerCard(p: Payer, index: number, state: CalcInput): string {
  const a = (key: string) => `data-payer="${esc(p.id)}" data-key="${key}"`;
  const idp = `payer-${esc(p.id)}`;
  const canRemove = state.payers.length > 1;
  const y = getYear(state.yearId);
  const nameHelp = `${idp}-name-help`;
  const levyHelp = `${idp}-levy-help`;
  return `
  <fieldset class="payer card-inner" aria-label="Payer ${index + 1}">
    <div class="payer-head">
      <span class="payer-num" aria-hidden="true">${index + 1}</span>
      <input id="${idp}-name" class="payer-name" type="text" value="${esc(p.name)}" ${a('name')}
        aria-label="Payer ${index + 1} name" placeholder="Employer name" maxlength="80" />
      <button type="button" class="help-btn" data-action="toggle-help" data-help="${nameHelp}" aria-expanded="${openHelp.has(nameHelp)}"
        aria-controls="${nameHelp}" aria-label="About the payer name" title="About the payer name">ⓘ</button>
      ${canRemove ? `<button type="button" class="btn-icon" data-action="remove-payer" data-id="${esc(p.id)}" aria-label="Remove payer ${index + 1}" title="Remove">✕</button>` : ''}
    </div>
    <div id="${nameHelp}" class="help help-block" ${openHelp.has(nameHelp) ? '' : 'hidden'}>${helpText('name', y)}</div>
    <div class="grid">
      <div class="field">
        ${labelWithHelp(`${idp}-type`, 'Income type', 'incomeType', y)}
        <select id="${idp}-type" ${a('incomeType')}>
          ${INCOME_TYPES.map((t) => `<option value="${t.value}" ${t.value === p.incomeType ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        ${labelWithHelp(`${idp}-code`, 'Tax code <span class="opt">(optional)</span>', 'taxCode', y)}
        <select id="${idp}-code" ${a('taxCode')}>
          ${TAX_CODES.map((c) => `<option value="${c}" ${c === p.taxCode ? 'selected' : ''}>${c || 'Not sure'}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        ${labelWithHelp(`${idp}-start`, 'From', 'months', y)}
        <select id="${idp}-start" ${a('startMonth')}>${monthOptions(state.yearId, p.startMonth)}</select>
      </div>
      <div class="field">
        ${labelWithHelp(`${idp}-end`, 'To', 'months', y)}
        <select id="${idp}-end" ${a('endMonth')}>${monthOptions(state.yearId, p.endMonth)}</select>
      </div>
      ${moneyField(`${idp}-gross`, 'Gross earnings', p.gross, a('gross'), 'gross', y)}
      ${moneyField(`${idp}-paye`, 'PAYE / tax deducted', p.paye, a('paye'), 'paye', y)}
    </div>
    <div class="check-row">
      <label class="check">
        <input type="checkbox" ${a('levyLiable')} ${p.levyLiable ? 'checked' : ''} />
        <span>ACC earners’ levy was deducted from this income <span class="hint-inline">(it is for wages and ACC compensation)</span></span>
      </label>
      <button type="button" class="help-btn" data-action="toggle-help" data-help="${levyHelp}" aria-expanded="${openHelp.has(levyHelp)}"
        aria-controls="${levyHelp}" aria-label="About the ACC earners’ levy" title="About the ACC earners’ levy">ⓘ</button>
    </div>
    <div id="${levyHelp}" class="help help-block" ${openHelp.has(levyHelp) ? '' : 'hidden'}>${helpText('levy', y)}</div>
  </fieldset>`;
}

export function renderForm(state: CalcInput): string {
  const year = getYear(state.yearId);
  const ie = state.ietc;
  const showMonths = ie.mainBenefit || ie.workingForFamilies || ie.nzSuper || ie.nonResident;
  const o = state.other;
  const hasOther = o.interestGross || o.interestRwt || o.dividendGross || o.dividendImputation || o.dividendRwt;

  return `
  <section class="card" aria-labelledby="h-year">
    <h2 id="h-year"><span class="step">1</span> Tax year</h2>
    <div class="segmented" role="radiogroup" aria-label="Tax year">
      ${TAX_YEARS.map(
        (y) => `
        <label class="seg ${y.id === state.yearId ? 'on' : ''}">
          <input type="radio" name="year" value="${y.id}" data-field="yearId" ${y.id === state.yearId ? 'checked' : ''} />
          <span class="seg-title">${y.label}</span>
          <span class="seg-sub">${y.status === 'completed' ? 'Completed year' : 'Year in progress'}</span>
        </label>`,
      ).join('')}
    </div>
    <p class="hint">${yearRangeLabel(year)}${
      year.status === 'current'
        ? ' · This year isn’t finished, so use year-to-date figures from myIR or your latest payslip. The result shows where you stand so far, not your final refund.'
        : ''
    }</p>
  </section>

  <section class="card" aria-labelledby="h-payers">
    <h2 id="h-payers"><span class="step">2</span> Employers &amp; other payers</h2>
    <p class="lead">Add a row for <strong>each employer</strong> (or benefit / ACC payer) you had during the year.</p>
    <details class="tip">
      <summary>Where do I find these numbers in myIR?</summary>
      <ol>
        <li>Log in to <a href="https://myir.ird.govt.nz" target="_blank" rel="noopener">myIR</a>.</li>
        <li>Open the <strong>My income</strong> tab and choose the tax year (it ends 31 March ${year.startYear + 1}).</li>
        <li>The <strong>Income summary</strong> lists each employer or payer with its <em>gross earnings</em> and <em>PAYE</em>. Copy those totals into one row here per payer. Pasting “$12,345.67” works.</li>
        <li>Enter only PAYE. Leave out student loan, KiwiSaver and child support deductions; they are shown separately.</li>
      </ol>
    </details>
    <div class="payers">
      ${state.payers.map((p, i) => payerCard(p, i, state)).join('')}
    </div>
    <button type="button" class="btn btn-secondary" data-action="add-payer">＋ Add another employer or payer</button>
  </section>

  <section class="card" aria-labelledby="h-other">
    <h2 id="h-other"><span class="step">3</span> Interest &amp; dividends <span class="opt">(optional)</span></h2>
    <details ${hasOther ? 'open' : ''}>
      <summary>I earned bank interest or dividends</summary>
      <p class="hint">These are also in myIR under <strong>My income</strong>. They count toward your total income, and the tax already taken off (RWT and imputation credits) is credited back.</p>
      <div class="grid">
        ${moneyField('o-int', 'Gross interest', o.interestGross, 'data-other="interestGross"', 'interestGross', year)}
        ${moneyField('o-int-rwt', 'RWT on interest', o.interestRwt, 'data-other="interestRwt"', 'interestRwt', year)}
        ${moneyField('o-div', 'Gross dividends', o.dividendGross, 'data-other="dividendGross"', 'dividendGross', year, 'Includes imputation credits and RWT.')}
        ${moneyField('o-div-ic', 'Imputation credits', o.dividendImputation, 'data-other="dividendImputation"', 'dividendImputation', year)}
        ${moneyField('o-div-rwt', 'RWT on dividends', o.dividendRwt, 'data-other="dividendRwt"', 'dividendRwt', year)}
      </div>
    </details>
  </section>

  <section class="card" aria-labelledby="h-ietc">
    <h2 id="h-ietc"><span class="step">4</span> IETC eligibility</h2>
    <p class="lead">The Independent Earner Tax Credit is worth up to <strong>$${year.ietc.max}</strong> if your income is between $${year.ietc.minIncome.toLocaleString('en-NZ')} and $${year.ietc.maxIncome.toLocaleString('en-NZ')}. Tick anything that applied to you during the year:</p>
    <div class="checks">
      <label class="check"><input type="checkbox" data-ietc="mainBenefit" ${ie.mainBenefit ? 'checked' : ''} /><span>I received a main benefit (e.g. Jobseeker, Supported Living)</span></label>
      <label class="check"><input type="checkbox" data-ietc="workingForFamilies" ${ie.workingForFamilies ? 'checked' : ''} /><span>I or my partner received Working for Families tax credits</span></label>
      <label class="check"><input type="checkbox" data-ietc="nzSuper" ${ie.nzSuper ? 'checked' : ''} /><span>I received NZ Super or a Veteran’s Pension</span></label>
      <label class="check"><input type="checkbox" data-ietc="nonResident" ${ie.nonResident ? 'checked' : ''} /><span>I was not a NZ tax resident for part of the year</span></label>
    </div>
    ${
      showMonths
        ? `<div class="field narrow">
            ${labelWithHelp('ietc-months', 'For how many months did any of these apply?', 'ietcMonths', year)}
            <input id="ietc-months" type="number" min="0" max="12" step="1" inputmode="numeric" value="${ie.ineligibleMonths}" data-ietc="ineligibleMonths" />
            <p class="hint">IETC is reduced by 1/12 for each of these months. Choose 12 if it applied all year.</p>
          </div>`
        : ''
    }
    <p class="hint">Not sure? See <a href="https://www.ird.govt.nz/ietc" target="_blank" rel="noopener">ird.govt.nz/ietc</a>. If you used the <strong>ME</strong> tax code, you’ve already received IETC through your pay (about $10 a week), and the estimate takes that into account.</p>
  </section>

  <section class="card" aria-labelledby="h-adv">
    <h2 id="h-adv"><span class="step">5</span> Settings</h2>
    <label class="check">
      <input type="checkbox" data-flag="payeExcludesLevy" ${state.payeExcludesLevy ? 'checked' : ''} />
      <span>My “tax deducted” figures do <strong>not</strong> include the ACC earners’ levy
        <span class="hint-inline">Leave this unticked for figures from myIR or a payslip PAYE total; they include the levy (${(year.acc.rate * 100).toFixed(2)}% in ${year.label}).</span></span>
    </label>
  </section>`;
}
