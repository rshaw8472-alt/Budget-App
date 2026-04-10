const Dashboard = {
  year: null,
  month: null,

  // ── Initialization ────────────────────────────────────

  init() {
    this.initCurrentPeriod();

    document.getElementById('prev-month').addEventListener('click', () => {
      this.month--;
      if (this.month < 1) { this.month = 12; this.year--; }
      this.render();
    });
    document.getElementById('next-month').addEventListener('click', () => {
      this.month++;
      if (this.month > 12) { this.month = 1; this.year++; }
      this.render();
    });

    this.initIncomeEdit();
  },

  initCurrentPeriod() {
    const today = new Date();
    const payDay = Store.getPayDay();
    const todayDay   = today.getDate();
    const todayMonth = today.getMonth() + 1;
    const todayYear  = today.getFullYear();

    if (payDay === 1 || todayDay >= payDay) {
      this.year  = todayYear;
      this.month = todayMonth;
    } else {
      // Period started last month
      this.month = todayMonth - 1;
      this.year  = todayYear;
      if (this.month < 1) { this.month = 12; this.year--; }
    }
  },

  initIncomeEdit() {
    const incomeDisplay = document.getElementById('hero-income');
    const incomeInput   = document.getElementById('hero-income-input');
    const incomeBlock   = document.getElementById('hero-income-block');

    const openEdit = () => {
      const current = Store.getPeriodIncome(this.getPeriodKey());
      incomeInput.value = current != null ? current : '';
      incomeBlock.classList.add('editing');
      incomeInput.focus();
      incomeInput.select();
    };

    const saveEdit = () => {
      const val = parseFloat(incomeInput.value);
      Store.setPeriodIncome(this.getPeriodKey(), isNaN(val) || val <= 0 ? null : val);
      incomeBlock.classList.remove('editing');
      this.render();
    };

    incomeDisplay.addEventListener('click', openEdit);
    incomeInput.addEventListener('blur', saveEdit);
    incomeInput.addEventListener('keydown', e => { if (e.key === 'Enter') incomeInput.blur(); });

    // "Set income" prompt click when no income is set
    const setIncomeLink = document.getElementById('set-income-link');
    if (setIncomeLink) setIncomeLink.addEventListener('click', openEdit);
  },

  // ── Period Calculation ────────────────────────────────

  getPeriodKey() {
    return `${this.year}-${String(this.month).padStart(2, '0')}`;
  },

  getPeriodDates() {
    const payDay = Store.getPayDay();
    const pad = n => String(n).padStart(2, '0');

    if (payDay === 1) {
      const lastDay = new Date(this.year, this.month, 0).getDate();
      const start = `${this.year}-${pad(this.month)}-01`;
      const end   = `${this.year}-${pad(this.month)}-${pad(lastDay)}`;
      const label = new Date(this.year, this.month - 1, 1)
        .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      return { start, end, label };
    }

    // Custom: payDay of this month → (payDay-1) of next month
    let endMonth = this.month + 1;
    let endYear  = this.year;
    if (endMonth > 12) { endMonth = 1; endYear++; }
    const endDay = payDay - 1;

    const start = `${this.year}-${pad(this.month)}-${pad(payDay)}`;
    const end   = `${endYear}-${pad(endMonth)}-${pad(endDay)}`;

    const startDate = new Date(this.year, this.month - 1, payDay);
    const endDate   = new Date(endYear, endMonth - 1, endDay);
    const fmt = { month: 'short', day: 'numeric' };
    const label = `${startDate.toLocaleDateString('en-US', fmt)} – ${endDate.toLocaleDateString('en-US', fmt)}`;

    return { start, end, label };
  },

  // ── Render ────────────────────────────────────────────

  render() {
    const { start, end, label } = this.getPeriodDates();
    const txs          = Store.getTransactionsForPeriod(start, end);
    const budgets      = Store.getPeriodBudgets(this.getPeriodKey());
    const categories   = Store.getCategories();
    const income       = Store.getPeriodIncome(this.getPeriodKey());
    const totalSpent   = txs.reduce((s, t) => s + t.amount, 0);

    // Savings target = income minus total of all category budgets (auto-calculated)
    const catsWithLimits = categories.filter(c => budgets[c] != null && budgets[c] > 0);
    const totalBudgeted  = catsWithLimits.reduce((s, c) => s + budgets[c], 0);
    const savingsTarget  = income != null && totalBudgeted > 0 ? income - totalBudgeted : null;

    document.getElementById('month-label').textContent = label;

    this.renderHero(totalSpent, income, savingsTarget);
    this.renderBudgetSummary(categories, budgets, txs, savingsTarget, income, totalSpent);
    this.renderBudgetCards(categories, budgets, txs);
    this.renderTransactionList(txs);
  },

  renderHero(totalSpent, income, savingsTarget) {
    const spentEl    = document.getElementById('hero-spent');
    const incomeEl   = document.getElementById('hero-income');
    const leftEl     = document.getElementById('hero-left');
    const leftLabel  = document.getElementById('hero-left-label');
    const noIncome   = document.getElementById('hero-no-income');
    const heroStats  = document.querySelector('.hero-stats');

    spentEl.textContent = `$${totalSpent.toFixed(2)}`;

    if (income != null) {
      const left = income - totalSpent;
      incomeEl.textContent  = `$${income.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
      leftEl.textContent    = `$${Math.abs(left).toFixed(2)}`;
      leftLabel.textContent = left < 0 ? 'Over' : 'Left';
      leftEl.classList.toggle('hero-deficit', left < 0);
      if (noIncome) noIncome.hidden = true;
      heroStats.classList.remove('hero-stats-solo');
    } else {
      incomeEl.textContent  = 'Tap to set';
      leftEl.textContent    = '—';
      leftLabel.textContent = 'Left';
      leftEl.classList.remove('hero-deficit');
      if (noIncome) noIncome.hidden = true; // hint is redundant now
      heroStats.classList.add('hero-stats-solo');
    }
  },

  renderBudgetSummary(categories, budgets, txs, savingsTarget, income, totalSpent) {
    const card = document.getElementById('budget-summary-card');
    const catsWithLimits = categories.filter(c => budgets[c] != null && budgets[c] > 0);

    if (catsWithLimits.length === 0 && savingsTarget == null) {
      card.hidden = true;
      return;
    }
    card.hidden = false;

    const totalBudgeted    = catsWithLimits.reduce((s, c) => s + budgets[c], 0);
    const spentMap         = {};
    txs.forEach(tx => { spentMap[tx.category] = (spentMap[tx.category] || 0) + tx.amount; });
    const budgetSpent      = catsWithLimits.reduce((s, c) => s + (spentMap[c] || 0), 0);
    const totalLeft        = totalBudgeted - budgetSpent;

    const incomeRow = document.getElementById('summary-income-row');
    if (income != null) {
      incomeRow.hidden = false;
      document.getElementById('summary-income').textContent = `$${income.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    } else {
      incomeRow.hidden = true;
    }

    document.getElementById('summary-budgeted').textContent = `$${totalBudgeted.toFixed(2)}`;
    document.getElementById('summary-spent').textContent    = `$${budgetSpent.toFixed(2)}`;

    const leftEl    = document.getElementById('summary-left');
    const leftLabel = document.getElementById('summary-left-label');
    leftEl.textContent    = `$${Math.abs(totalLeft).toFixed(2)}`;
    leftLabel.textContent = totalLeft < 0 ? 'Over Budget' : 'Left in Budget';
    leftEl.classList.toggle('amount-negative', totalLeft < 0);
    leftEl.classList.toggle('amount-positive', totalLeft >= 0);

    // Savings target block
    const savingsRow  = document.getElementById('summary-savings-row');
    const actualRow   = document.getElementById('summary-actual-row');

    if (savingsTarget != null) {
      savingsRow.hidden = false;
      document.getElementById('summary-savings-target').textContent = `$${savingsTarget.toFixed(2)}`;

      if (income != null) {
        actualRow.hidden = false;
        const actualSavings = income - totalSpent;
        const onTrack = actualSavings >= savingsTarget;
        const actualEl = document.getElementById('summary-actual-savings');
        actualEl.textContent = `$${Math.abs(actualSavings).toFixed(2)} ${onTrack ? '✓' : '↓'}`;
        actualEl.className   = 'budget-summary-value ' + (onTrack ? 'amount-positive' : 'amount-negative');
      } else {
        actualRow.hidden = true;
      }
    } else {
      savingsRow.hidden = true;
      actualRow.hidden  = true;
    }
  },

  renderBudgetCards(categories, budgets, txs) {
    const container = document.getElementById('budget-cards');

    const spentMap = {};
    txs.forEach(tx => { spentMap[tx.category] = (spentMap[tx.category] || 0) + tx.amount; });

    container.innerHTML = '';

    if (categories.length === 0) {
      container.innerHTML = '<p class="empty-state" style="padding:1rem 0">Set up your categories and budgets in the Budgets tab.</p>';
      return;
    }

    categories.forEach(cat => {
      const spentAmt = spentMap[cat] || 0;
      const limit    = budgets[cat];
      const hasLimit = limit != null && limit > 0;
      const pct      = hasLimit ? Math.min((spentAmt / limit) * 100, 100) : 0;
      const barClass = pct >= 100 ? 'over' : pct >= 75 ? 'warn' : '';

      let leftHtml = '';
      if (hasLimit) {
        const left = limit - spentAmt;
        const leftClass = left < 0 ? 'amount-negative' : 'amount-positive';
        const leftWord  = left < 0 ? 'over' : 'left';
        leftHtml = ` · <span class="${leftClass}">$${Math.abs(left).toFixed(2)} ${leftWord}</span>`;
      }

      const card = document.createElement('div');
      card.className = 'budget-card' + (hasLimit ? '' : ' no-limit');
      card.innerHTML = `
        <div class="budget-card-header">
          <span class="budget-card-name">${escapeHtml(cat)}</span>
          <span class="budget-card-amounts">
            <span class="spent">$${spentAmt.toFixed(2)} spent</span>${leftHtml}
          </span>
        </div>
        ${hasLimit ? `
        <div class="progress-track">
          <div class="progress-bar ${barClass}" style="--pct:${pct.toFixed(1)}"></div>
        </div>` : ''}
      `;
      container.appendChild(card);
    });

    // Uncategorized
    const knownCats = new Set(categories);
    const uncatSpent = txs
      .filter(tx => !knownCats.has(tx.category))
      .reduce((s, tx) => s + tx.amount, 0);

    if (uncatSpent > 0) {
      const card = document.createElement('div');
      card.className = 'budget-card no-limit';
      card.innerHTML = `
        <div class="budget-card-header">
          <span class="budget-card-name" style="color:var(--text-2)">Uncategorized</span>
          <span class="budget-card-amounts"><span class="spent">$${uncatSpent.toFixed(2)} spent</span></span>
        </div>
      `;
      container.appendChild(card);
    }
  },

  renderTransactionList(txs) {
    const list  = document.getElementById('transaction-list');
    const empty = document.getElementById('no-transactions');
    const sorted = txs.slice().sort((a, b) =>
      b.date.localeCompare(a.date) || b.id.localeCompare(a.id)
    );

    list.innerHTML = '';

    if (sorted.length === 0) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    sorted.forEach(tx => {
      const li = document.createElement('li');
      li.className = 'tx-item';

      const dateFormatted = new Date(tx.date + 'T00:00:00')
        .toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const meta = [dateFormatted, tx.notes].filter(Boolean).join(' · ');

      li.innerHTML = `
        <div class="tx-main">
          <div class="tx-icon">${escapeHtml(tx.category.charAt(0).toUpperCase())}</div>
          <div class="tx-info">
            <div class="tx-category">${escapeHtml(tx.category)}</div>
            <div class="tx-meta">${escapeHtml(meta)}</div>
          </div>
          <div class="tx-amount">$${tx.amount.toFixed(2)}</div>
        </div>
        <div class="tx-actions">
          <button class="btn-delete" data-id="${tx.id}">Delete</button>
        </div>
      `;

      li.querySelector('.tx-main').addEventListener('click', () => {
        li.classList.toggle('expanded');
      });

      li.querySelector('.btn-delete').addEventListener('click', e => {
        e.stopPropagation();
        Store.deleteTransaction(tx.id);
        this.render();
        App.showToast('Transaction deleted');
      });

      list.appendChild(li);
    });
  }
};

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
