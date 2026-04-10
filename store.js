const Store = {

  // ── Transactions ──────────────────────────────────────
  getTransactions() {
    return JSON.parse(localStorage.getItem('spt_transactions') || '[]');
  },
  saveTransactions(txs) {
    localStorage.setItem('spt_transactions', JSON.stringify(txs));
    this._sync();
  },
  addTransaction(tx) {
    const txs = this.getTransactions();
    txs.push(tx);
    this.saveTransactions(txs);
  },
  deleteTransaction(id) {
    this.saveTransactions(this.getTransactions().filter(t => t.id !== id));
  },
  getTransactionsForPeriod(startISO, endISO) {
    return this.getTransactions().filter(t => t.date >= startISO && t.date <= endISO);
  },

  // ── Categories ────────────────────────────────────────
  getCategories() {
    return JSON.parse(localStorage.getItem('spt_categories') || '[]');
  },
  addCategory(name) {
    const cats = this.getCategories();
    if (!cats.includes(name)) {
      cats.push(name);
      localStorage.setItem('spt_categories', JSON.stringify(cats));
      this._sync();
    }
  },
  removeCategory(name) {
    const cats = this.getCategories().filter(c => c !== name);
    localStorage.setItem('spt_categories', JSON.stringify(cats));
    this._sync();
  },
  saveCategories(cats) {
    localStorage.setItem('spt_categories', JSON.stringify(cats));
    this._sync();
  },

  // ── Per-period Budgets ────────────────────────────────
  // spt_period_budgets: { "default": {cat:amt}, "2026-03": {cat:amt}, ... }
  getAllPeriodBudgets() {
    return JSON.parse(localStorage.getItem('spt_period_budgets') || '{}');
  },
  getPeriodBudgets(periodKey) {
    const all = this.getAllPeriodBudgets();
    if (all[periodKey]) return { ...all[periodKey] };
    // Inherit from the most recent prior period
    const keys = Object.keys(all)
      .filter(k => k !== 'default' && k <= periodKey)
      .sort();
    if (keys.length > 0) return { ...all[keys[keys.length - 1]] };
    // Fall back to default
    return all['default'] ? { ...all['default'] } : {};
  },
  setPeriodBudget(periodKey, category, amount) {
    const all = this.getAllPeriodBudgets();
    if (!all[periodKey]) all[periodKey] = { ...this.getPeriodBudgets(periodKey) };
    if (amount == null || isNaN(amount) || amount < 0) {
      delete all[periodKey][category];
    } else {
      all[periodKey][category] = Number(amount);
    }
    localStorage.setItem('spt_period_budgets', JSON.stringify(all));
    this._sync();
  },

  // ── Settings (payDay) ─────────────────────────────────
  getSettings() {
    return JSON.parse(localStorage.getItem('spt_settings') || '{"payDay":15}');
  },
  setPayDay(day) {
    const s = this.getSettings();
    s.payDay = Math.max(1, Math.min(28, parseInt(day, 10) || 15));
    localStorage.setItem('spt_settings', JSON.stringify(s));
    this._sync();
  },
  getPayDay() {
    return this.getSettings().payDay;
  },

  // ── Income (per-period) ───────────────────────────────
  getAllIncome() {
    return JSON.parse(localStorage.getItem('spt_income') || '{}');
  },
  getPeriodIncome(periodKey) {
    const all = this.getAllIncome();
    return all[periodKey] ?? null;
  },
  setPeriodIncome(periodKey, amount) {
    const all = this.getAllIncome();
    if (amount == null || isNaN(amount) || amount <= 0) {
      delete all[periodKey];
    } else {
      all[periodKey] = Number(amount);
    }
    localStorage.setItem('spt_income', JSON.stringify(all));
    this._sync();
  },

  // ── Firebase Sync Hook ────────────────────────────────
  _sync() {
    if (typeof FirebaseSync !== 'undefined' && FirebaseSync.docRef) {
      FirebaseSync.pushToFirestore();
    }
  },

  // ── Migration & Seed ──────────────────────────────────

  // Runs every init — migrates old flat spt_budgets into per-period format
  migrate() {
    const oldBudgets = localStorage.getItem('spt_budgets');
    if (!oldBudgets) return;
    try {
      const parsed = JSON.parse(oldBudgets);
      const all = this.getAllPeriodBudgets();
      if (!all['default']) {
        all['default'] = parsed;
        localStorage.setItem('spt_period_budgets', JSON.stringify(all));
      }
      localStorage.removeItem('spt_budgets');
    } catch(e) {}
  },

  seedIfEmpty() {
    if (this.getCategories().length > 0) return;

    const defaultCategories = [
      'Rent', 'Phone', 'Electrical', 'Cats', 'Car',
      'Groceries', 'Eating Out', 'Booze', 'Weed',
      'Subscriptions', 'Bank Fees', 'Tournament Meals', 'Other'
    ];
    const defaultBudgets = {
      'Rent': 1100, 'Phone': 160, 'Electrical': 80, 'Cats': 100, 'Car': 400,
      'Groceries': 150, 'Eating Out': 150, 'Booze': 150, 'Weed': 100,
      'Subscriptions': 30, 'Bank Fees': 15, 'Tournament Meals': 250, 'Other': 200
    };

    localStorage.setItem('spt_categories', JSON.stringify(defaultCategories));

    const all = this.getAllPeriodBudgets();
    if (!all['default']) {
      all['default'] = defaultBudgets;
      localStorage.setItem('spt_period_budgets', JSON.stringify(all));
    }
  }
};
