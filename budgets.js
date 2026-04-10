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

      periods.push({ key, year: y, month: m, label });
      m++;
      if (m > 12) { m = 1; y++; }
    }
    return periods;
  },

  // ── Table ─────────────────────────────────────────────

  renderTable() {
    const container = document.getElementById('budget-table-container');
    const periods   = this.generatePeriods();
    const cats      = Store.getCategories();
    const curKey    = `${Dashboard.year}-${String(Dashboard.month).padStart(2, '0')}`;

    let html = '<table class="budget-table"><thead><tr>';
    html += '<th class="tbl-sticky tbl-cat-head">Category</th>';
    periods.forEach(p => {
      const isCur = p.key === curKey;
      html += `<th class="tbl-period-head${isCur ? ' tbl-current' : ''}" data-key="${p.key}">`;
      html += p.label.replace(/\n/g, '<br>');
      html += '</th>';
    });
    html += '</tr></thead><tbody>';

    // ── Income row (editable) ──
    html += '<tr class="tbl-income-row">';
    html += '<td class="tbl-sticky tbl-row-label">💰 Income</td>';
    periods.forEach(p => {
      const isCur = p.key === curKey;
      const val   = Store.getPeriodIncome(p.key);
      html += `<td class="tbl-cell tbl-income-cell${isCur ? ' tbl-current' : ''}" data-key="${p.key}" data-type="income">`;
      html += `<span class="cell-display">${val != null ? '$' + val.toLocaleString('en-US', {maximumFractionDigits: 0}) : '—'}</span>`;
      html += `<input class="cell-input" type="number" inputmode="decimal" min="0" step="1" value="${val != null ? val : ''}">`;
      html += '</td>';
    });
    html += '</tr>';

    // ── Savings Target row (read-only, calculated) ──
    html += '<tr class="tbl-savings-row">';
    html += '<td class="tbl-sticky tbl-row-label">🎯 Savings Target</td>';
    periods.forEach(p => {
      const isCur    = p.key === curKey;
      const income   = Store.getPeriodIncome(p.key);
      const budgets  = Store.getPeriodBudgets(p.key);
      const total    = cats.reduce((s, c) => s + (budgets[c] || 0), 0);
      const saving   = income != null ? income - total : null;
      html += `<td class="tbl-cell tbl-savings-cell tbl-readonly${isCur ? ' tbl-current' : ''}" data-key="${p.key}">`;
      html += saving != null ? '$' + saving.toLocaleString('en-US', {maximumFractionDigits: 0}) : '—';
      html += '</td>';
    });
    html += '</tr>';

    // ── Divider ──
    html += '<tr class="tbl-divider-row"><td class="tbl-sticky"></td>';
    periods.forEach(() => html += '<td></td>');
    html += '</tr>';

    // ── Category rows (editable) ──
    cats.forEach((cat, rowIdx) => {
      html += `<tr class="${rowIdx % 2 === 0 ? 'tbl-row-even' : 'tbl-row-odd'}">`;
      html += `<td class="tbl-sticky tbl-row-label">${escapeHtml(cat)}</td>`;
      periods.forEach(p => {
        const isCur   = p.key === curKey;
        const budgets = Store.getPeriodBudgets(p.key);
        const val     = budgets[cat];
        html += `<td class="tbl-cell${isCur ? ' tbl-current' : ''}" data-key="${p.key}" data-cat="${escapeHtml(cat)}">`;
        html += `<span class="cell-display">${val != null ? '$' + val.toFixed(0) : '—'}</span>`;
        html += `<input class="cell-input" type="number" inputmode="decimal" min="0" step="1" value="${val != null ? val : ''}">`;
        html += '</td>';
      });
      html += '</tr>';
    });

    // ── Total Budget row (read-only) ──
    html += '<tr class="tbl-totals-row">';
    html += '<td class="tbl-sticky tbl-row-label">Total Budget</td>';
    periods.forEach(p => {
      const isCur   = p.key === curKey;
      const budgets = Store.getPeriodBudgets(p.key);
      const total   = cats.reduce((s, c) => s + (budgets[c] || 0), 0);
      html += `<td class="tbl-cell tbl-readonly tbl-total-cell${isCur ? ' tbl-current' : ''}" data-key="${p.key}">$${total.toFixed(0)}</td>`;
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
    const budgets = Store.getPeriodBudgets(periodKey);
    const total   = cats.reduce((s, c) => s + (budgets[c] || 0), 0);
    const el = container.querySelector(`.tbl-total-cell[data-key="${periodKey}"]`);
    if (el) el.textContent = '$' + total.toFixed(0);
  },

  updateSavingsTargetCell(container, periodKey, cats) {
    const income  = Store.getPeriodIncome(periodKey);
    const budgets = Store.getPeriodBudgets(periodKey);
    const total   = cats.reduce((s, c) => s + (budgets[c] || 0), 0);
    const el      = container.querySelector(`.tbl-savings-cell[data-key="${periodKey}"]`);
    if (!el) return;
    const saving = income != null ? income - total : null;
    el.textContent = saving != null
      ? '$' + saving.toLocaleString('en-US', {maximumFractionDigits: 0})
      : '—';
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
