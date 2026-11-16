import './styles.css';
import { INCOME_TYPES, calculate, payerMonths, type CalcInput, type IncomeType, type Payer } from './tax/engine';
import { renderForm } from './ui/form';
import { renderInfo } from './ui/info';
import { renderResults } from './ui/results';
import { clearState, defaultState, formatMoneyInput, loadState, newPayer, parseMoney, saveState } from './ui/state';

const formEl = document.getElementById('form')!;
const resultsEl = document.getElementById('results')!;
const infoEl = document.getElementById('info')!;
const mobileBar = document.getElementById('mobile-summary')!;

let state: CalcInput = loadState();

function renderAll(): void {
  const focusedId = (document.activeElement as HTMLElement | null)?.id;
  formEl.innerHTML = renderForm(state);
  infoEl.innerHTML = renderInfo(state.yearId);
  renderOutput();
  if (focusedId) document.getElementById(focusedId)?.focus();
}

function renderOutput(): void {
  const r = calculate(state);
  resultsEl.innerHTML = renderResults(r);
  if (r.taxableIncome > 0) {
    const label = r.result > 0 ? 'Refund' : r.result < 0 ? 'To pay' : 'All square';
    const cls = r.result > 0 ? 'refund' : r.result < 0 ? 'owe' : 'neutral';
    mobileBar.className = `mobile-summary ${cls}`;
    mobileBar.innerHTML = `<span>${label}</span><strong>${new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(Math.abs(r.result))}</strong><a href="#results">Details ↓</a>`;
    mobileBar.hidden = false;
  } else {
    mobileBar.hidden = true;
  }
  saveState(state);
}

function findPayer(id: string): Payer | undefined {
  return state.payers.find((p) => p.id === id);
}

/** Keep IETC answers in step with benefit / NZ Super rows. */
function syncIetcFromPayer(p: Payer): void {
  if (p.incomeType === 'benefit') {
    if (!state.ietc.mainBenefit) state.ietc.ineligibleMonths = payerMonths(p);
    state.ietc.mainBenefit = true;
  } else if (p.incomeType === 'super') {
    if (!state.ietc.nzSuper) state.ietc.ineligibleMonths = payerMonths(p);
    state.ietc.nzSuper = true;
  }
}

function handleChange(target: HTMLInputElement | HTMLSelectElement, isCommit: boolean): void {
  const d = target.dataset;
  const isCheckbox = target instanceof HTMLInputElement && target.type === 'checkbox';
  let structural = false;

  if (d.field === 'yearId') {
    state.yearId = target.value;
    structural = true;
  } else if (d.payer && d.key) {
    const p = findPayer(d.payer);
    if (!p) return;
    switch (d.key) {
      case 'name':
        p.name = target.value;
        break;
      case 'gross':
      case 'paye':
        p[d.key] = parseMoney(target.value);
        break;
      case 'startMonth':
      case 'endMonth':
        p[d.key] = Number(target.value);
        if (p.startMonth > p.endMonth) {
          if (d.key === 'startMonth') p.endMonth = p.startMonth;
          else p.startMonth = p.endMonth;
          structural = true;
        }
        break;
      case 'incomeType': {
        p.incomeType = target.value as IncomeType;
        p.levyLiable = INCOME_TYPES.find((t) => t.value === p.incomeType)?.levyDefault ?? p.levyLiable;
        syncIetcFromPayer(p);
        structural = true;
        break;
      }
      case 'taxCode':
        p.taxCode = target.value as Payer['taxCode'];
        break;
      case 'levyLiable':
        p.levyLiable = (target as HTMLInputElement).checked;
        break;
    }
  } else if (d.other) {
    const key = d.other as keyof CalcInput['other'];
    state.other[key] = parseMoney(target.value);
  } else if (d.ietc) {
    if (d.ietc === 'ineligibleMonths') {
      const v = Math.round(Number(target.value));
      state.ietc.ineligibleMonths = Number.isFinite(v) ? Math.min(12, Math.max(0, v)) : 12;
      if (isCommit) target.value = String(state.ietc.ineligibleMonths);
    } else {
      const key = d.ietc as 'mainBenefit' | 'workingForFamilies' | 'nzSuper' | 'nonResident';
      const wasAny = state.ietc.mainBenefit || state.ietc.workingForFamilies || state.ietc.nzSuper || state.ietc.nonResident;
      state.ietc[key] = (target as HTMLInputElement).checked;
      if (!wasAny && state.ietc[key]) state.ietc.ineligibleMonths = 12;
      structural = true;
    }
  } else if (d.flag === 'payeExcludesLevy' && isCheckbox) {
    state.payeExcludesLevy = (target as HTMLInputElement).checked;
    structural = true;
  } else {
    return;
  }

  if (structural) renderAll();
  else renderOutput();
}

formEl.addEventListener('input', (e) => {
  const t = e.target as HTMLInputElement;
  if (t.type === 'checkbox' || t.type === 'radio' || t.tagName === 'SELECT') return;
  handleChange(t, false);
});

formEl.addEventListener('change', (e) => {
  const t = e.target as HTMLInputElement | HTMLSelectElement;
  handleChange(t, true);
  // Tidy money formatting once the user leaves the field.
  if (t instanceof HTMLInputElement && 'money' in t.dataset) t.value = formatMoneyInput(parseMoney(t.value));
});

document.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
  if (!btn) return;
  switch (btn.dataset.action) {
    case 'add-payer': {
      if (state.payers.length >= 20) return;
      const p = newPayer(state.payers.length);
      state.payers.push(p);
      renderAll();
      const input = document.getElementById(`payer-${p.id}-name`) as HTMLInputElement | null;
      input?.focus();
      input?.select();
      break;
    }
    case 'remove-payer':
      state.payers = state.payers.filter((p) => p.id !== btn.dataset.id);
      renderAll();
      break;
    case 'print':
      window.print();
      break;
    case 'reset':
      if (confirm('Clear all your entries?')) {
        clearState();
        state = defaultState();
        renderAll();
      }
      break;
  }
});

renderAll();
