const Budgets = {

  render() {
    this.renderSettings();
    this.renderTable();
    this.renderAddCategoryForm();
  },

  // ── Settings ──────────────────────────────────────────

  renderSettings() {
    const el = document.getElementById('setting-payday');
    el.value = Store.getPayDay();
    const newEl = el.cloneNode(true);
    el.replaceWith(newEl);
    newEl.addEventListener('change', () => {
      const val = parseInt(newEl.value, 10);
      const day = (!isNaN(val) && val >= 1 && val <= 28) ? val : 15;
      newEl.value = day;
      Store.setPayDay(day);
      Dashboard.initCurrentPeriod();
      this.renderTable();
      App.showToast('Pay period updated');
    });
  },

  // ── Period helpers ────────────────────────────────────

  generatePeriods() {
    const payDay = Store.getPayDay();
    const cur = Dashboard;
    const periods = [];

    let m = cur.month - 3;
    let y = cur.year;
    while (m < 1) { m += 12; y--; }

    for (let i = 0; i < 13; i++) {
      const key = `${y}-${String(m).padStart(2, '0')}`;
      let endM = m + 1, endY = y;
      if (endM > 12) { endM = 1; endY++; }
      const endDay   = payDay === 1 ? new Date(y, m, 0).getDate() : payDay - 1;
      const startDay = payDay === 1 ? 1 : payDay;

      const startDate = new Date(y, m - 1, startDay);
      const endDate   = new Date(endY, endM - 1, endDay);
      const fmt = { month: 'short', day: 'numeric' };

      const label = payDay === 1
        ? startDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
        : startDate.toLocaleDateString('en-US', fmt) + '\n–\n' + endDate.toLocaleDateString('en-US', fmt);

      const pad = n => String(n).padStart(2, '0');
      const start = `${y}-${pad(m)}-${pad(startDay)}`;
      const end   = `${endY}-${pad(endM)}-${pad(endDay)}`;
      periods.push({ key, year: y, month: m, label, start, end });
      m++;
      if (m > 12) { m = 1; y++; }
    }
    return periods;
  },

  // ── Table ─────────────────────────────────────────────

  fmt(n) { return n == null ? '—' : '$' + Math.abs(n).toFixed(0); },

  renderTable() {
    const container = document.getElementById('budget-table-container');
    const periods   = this.generatePeriods();
    const cats      = Store.getCategories();
    const curKey    = `${Dashboard.year}-${String(Dashboard.month).padStart(2, '0')}`;

    // Pre-compute spent per category per period
    const spentByPeriod = {};
    periods.forEach(p => {
      const txs = Store.getTransactionsForPeriod(p.start, p.end);
      const map = {};
      txs.forEach(tx => { map[tx.category] = (map[tx.category] || 0) + tx.amount; });
      spentByPeriod[p.key] = map;
    });

    // ── Header row 1: period labels spanning 3 columns each ──
    let html = '<table class="budget-table"><thead>';
    html += '<tr>';
    html += '<th class="tbl-sticky tbl-cat-head" rowspan="2">Category</th>';
    periods.forEach(p => {
      const isCur = p.key === curKey;
      html += `<th class="tbl-period-head tbl-span3${isCur ? ' tbl-current' : ''}" colspan="3" data-key="${p.key}">`;
      html += p.label.replace(/\n/g, '<br>');
      html += '</th>';
    });
    html += '</tr>';

    // ── Header row 2: sub-column labels ──
    html += '<tr>';
    periods.forEach(p => {
      const isCur = p.key === curKey;
      const cls = isCur ? ' tbl-current' : '';
      html += `<th class="tbl-sub-head tbl-sub-proj${cls}">Budget</th>`;
      html += `<th class="tbl-sub-head tbl-sub-actual${cls}">Actual</th>`;
      html += `<th class="tbl-sub-head tbl-sub-diff${cls}">Diff</th>`;
    });
    html += '</tr></thead><tbody>';

    // ── Income row (editable) ──
    html += '<tr class="tbl-income-row">';
    html += '<td class="tbl-sticky tbl-row-label">💰 Income</td>';
    periods.forEach(p => {
      const isCur = p.key === curKey;
      const val   = Store.getPeriodIncome(p.key);
      const cls   = isCur ? ' tbl-current' : '';
      html += `<td class="tbl-cell tbl-income-cell${cls}" colspan="3" data-key="${p.key}" data-type="income">`;
      html += `<span class="cell-display">${val != null ? '$' + val.toLocaleString('en-US', {maximumFractionDigits: 0}) : '—'}</span>`;
      html += `<input class="cell-input" type="number" inputmode="decimal" min="0" step="1" value="${val != null ? val : ''}">`;
      html += '</td>';
    });
    html += '</tr>';

    // ── Savings Target row (read-only) ──
    html += '<tr class="tbl-savings-row">';
    html += '<td class="tbl-sticky tbl-row-label">🎯 Savings Target</td>';
    periods.forEach(p => {
      const isCur   = p.key === curKey;
      const income  = Store.getPeriodIncome(p.key);
      const budgets = Store.getPeriodBudgets(p.key);
      const total   = cats.reduce((s, c) => s + (budgets[c] || 0), 0);
      const saving  = income != null ? income - total : null;
      const cls     = isCur ? ' tbl-current' : '';
      html += `<td class="tbl-cell tbl-savings-cell tbl-readonly${cls}" colspan="3" data-key="${p.key}">`;
      html += saving != null ? '$' + saving.toLocaleString('en-US', {maximumFractionDigits: 0}) : '—';
      html += '</td>';
    });
    html += '</tr>';

    // ── Divider ──
    html += '<tr class="tbl-divider-row"><td class="tbl-sticky"></td>';
    periods.forEach(() => html += '<td colspan="3"></td>');
    html += '</tr>';

    // ── Category rows ──
    cats.forEach((cat, rowIdx) => {
      html += `<tr class="${rowIdx % 2 === 0 ? 'tbl-row-even' : 'tbl-row-odd'}">`;
      html += `<td class="tbl-sticky tbl-row-label">${escapeHtml(cat)}</td>`;
      periods.forEach(p => {
        const isCur   = p.key === curKey;
        const budgets = Store.getPeriodBudgets(p.key);
        const proj    = budgets[cat] ?? null;
        const actual  = spentByPeriod[p.key][cat] || 0;
        const diff    = proj != null ? proj - actual : null;
        const over    = diff != null && diff < 0;
        const cls     = isCur ? ' tbl-current' : '';

        // Projection cell (editable)
        html += `<td class="tbl-cell tbl-cell-proj${cls}" data-key="${p.key}" data-cat="${escapeHtml(cat)}">`;
        html += `<span class="cell-display">${proj != null ? '$' + proj.toFixed(0) : '—'}</span>`;
        html += `<input class="cell-input" type="number" inputmode="decimal" min="0" step="1" value="${proj != null ? proj : ''}">`;
        html += '</td>';

        // Actual cell (read-only)
        html += `<td class="tbl-cell tbl-cell-actual tbl-readonly${cls}">`;
        html += actual > 0 ? `$${actual.toFixed(0)}` : '—';
        html += '</td>';

        // Difference cell (read-only)
        html += `<td class="tbl-cell tbl-cell-diff tbl-readonly${cls} ${over ? 'tbl-diff-over' : diff != null && diff === 0 ? '' : 'tbl-diff-ok'}">`;
        html += diff != null ? `${over ? '-' : '+'}$${Math.abs(diff).toFixed(0)}` : '—';
        html += '</td>';
      });
      html += '</tr>';
    });

    // ── Totals row ──
    html += '<tr class="tbl-totals-row">';
    html += '<td class="tbl-sticky tbl-row-label">Total</td>';
    periods.forEach(p => {
      const isCur      = p.key === curKey;
      const budgets    = Store.getPeriodBudgets(p.key);
      const totalProj  = cats.reduce((s, c) => s + (budgets[c] || 0), 0);
      const totalAct   = cats.reduce((s, c) => s + (spentByPeriod[p.key][c] || 0), 0);
      const totalDiff  = totalProj - totalAct;
      const over       = totalDiff < 0;
      const cls        = isCur ? ' tbl-current' : '';

      html += `<td class="tbl-cell tbl-readonly tbl-total-cell${cls}" data-key="${p.key}">$${totalProj.toFixed(0)}</td>`;
      html += `<td class="tbl-cell tbl-readonly tbl-cell-actual${cls}">$${totalAct.toFixed(0)}</td>`;
      html += `<td class="tbl-cell tbl-readonly tbl-cell-diff${cls} ${over ? 'tbl-diff-over' : 'tbl-diff-ok'}">${over ? '-' : '+'}$${Math.abs(totalDiff).toFixed(0)}</td>`;
    });
    html += '</tr>';

    html += '</tbody></table>';
    container.innerHTML = html;

    // Scroll to current period
    requestAnimationFrame(() => {
      const curHead = container.querySelector('.tbl-current');
      if (curHead) container.scrollLeft = Math.max(0, curHead.offsetLeft - 140);
    });

    this.setupCellEditing(container, cats, periods);
  },

  // ── Cell Editing ──────────────────────────────────────

  setupCellEditing(container, cats, periods) {
    // Only attach to editable cells (not .tbl-readonly)
    container.querySelectorAll('.tbl-cell:not(.tbl-readonly)').forEach(cell => {
      const display = cell.querySelector('.cell-display');
      const input   = cell.querySelector('.cell-input');
      if (!display || !input) return;

      const periodKey = cell.dataset.key;
      const cat       = cell.dataset.cat;
      const isIncome  = cell.dataset.type === 'income';

      cell.addEventListener('click', () => {
        if (cell.classList.contains('editing')) return;
        container.querySelectorAll('.tbl-cell.editing').forEach(c => this.commitCell(c));
        cell.classList.add('editing');
        input.focus();
        input.select();
      });

      const commit = () => {
        if (!cell.classList.contains('editing')) return;
        const raw = parseFloat(input.value);
        const val = isNaN(raw) || raw < 0 ? null : raw;

        if (isIncome) {
          Store.setPeriodIncome(periodKey, val);
          display.textContent = val != null
            ? '$' + val.toLocaleString('en-US', {maximumFractionDigits: 0})
            : '—';
          this.updateSavingsTargetCell(container, periodKey, cats);
        } else {
          Store.setPeriodBudget(periodKey, cat, val);
          display.textContent = val != null ? '$' + val.toFixed(0) : '—';
          this.updateTotalsCell(container, periodKey, cats);
          this.updateSavingsTargetCell(container, periodKey, cats);
        }

        cell.classList.remove('editing');
      };

      input.addEventListener('blur', commit);
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter')  { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { cell.classList.remove('editing'); }
        if (e.key === 'Tab') {
          e.preventDefault();
          input.blur();
          const cells = [...container.querySelectorAll('.tbl-cell:not(.tbl-readonly)')];
          const idx   = cells.indexOf(cell);
          const next  = cells[e.shiftKey ? idx - 1 : idx + 1];
          if (next) next.click();
        }
      });
    });
  },

  commitCell(cell) {
    const input = cell.querySelector('.cell-input');
    if (input) input.blur();
  },

  updateTotalsCell(container, periodKey, cats) {
    // Full re-render is simpler given 3-column layout
    this.renderTable();
  },

  updateSavingsTargetCell(container, periodKey, cats) {
    // Full re-render handles all derived cells in 3-column layout
    this.renderTable();
  },

  // ── Add Category Form ─────────────────────────────────

  renderAddCategoryForm() {
    const form    = document.getElementById('add-category-form');
    const newForm = form.cloneNode(true);
    form.replaceWith(newForm);

    newForm.addEventListener('submit', e => {
      e.preventDefault();
      const nameEl  = newForm.querySelector('#cat-name');
      const limitEl = newForm.querySelector('#cat-limit');
      const name    = nameEl.value.trim();

      if (!name) { nameEl.classList.add('invalid'); return; }
      nameEl.classList.remove('invalid');

      if (Store.getCategories().includes(name)) {
        App.showToast(`"${name}" already exists`);
        return;
      }

      Store.addCategory(name);

      const limit = parseFloat(limitEl.value);
      if (!isNaN(limit) && limit > 0) {
        this.generatePeriods().forEach(p => Store.setPeriodBudget(p.key, name, limit));
      }

      newForm.reset();
      this.renderTable();
      App.showToast(`"${name}" added`);
    });
  }
};
