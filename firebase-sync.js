const FirebaseSync = {
  db: null,
  docRef: null,

  init(config) {
    try {
      firebase.initializeApp(config);
      this.db = firebase.firestore();
      this.docRef = this.db.collection('apps').doc('spending-tracker');

      // Load cloud data first, then start live listener
      this.loadFromFirestore();
    } catch (e) {
      console.warn('Firebase init failed — running offline only', e);
    }
  },

  // ── Pull from Firestore on startup ────────────────────
  async loadFromFirestore() {
    if (!this.docRef) return;
    try {
      const snap = await this.docRef.get();
      if (snap.exists) {
        this.applyData(snap.data());
        // Re-render whatever screen is active
        App.navigate(App.currentScreen);
        App.showToast('☁️ Data loaded');
      } else {
        // First time using cloud — push current local data up
        this.pushToFirestore();
      }
    } catch (e) {
      console.warn('Firebase load failed — using local data', e);
    }
    // Start real-time listener regardless
    this.startListener();
  },

  // ── Write local storage data into the DOM fields from Firestore ──
  applyData(data) {
    if (data.transactions   != null) localStorage.setItem('spt_transactions',    JSON.stringify(data.transactions));
    if (data.categories     != null) localStorage.setItem('spt_categories',      JSON.stringify(data.categories));
    if (data.period_budgets != null) localStorage.setItem('spt_period_budgets',  JSON.stringify(data.period_budgets));
    if (data.income         != null) localStorage.setItem('spt_income',          JSON.stringify(data.income));
    if (data.settings       != null) localStorage.setItem('spt_settings',        JSON.stringify(data.settings));
  },

  // ── Real-time listener — updates this device when another saves ──
  startListener() {
    if (!this.docRef) return;
    this.docRef.onSnapshot({ includeMetadataChanges: true }, snap => {
      // hasPendingWrites = true means WE wrote this — skip to avoid re-render loop
      if (snap.metadata.hasPendingWrites) return;
      if (!snap.exists) return;

      this.applyData(snap.data());
      App.navigate(App.currentScreen);
    });
  },

  // ── Push all local data up to Firestore ───────────────
  pushToFirestore() {
    if (!this.docRef) return;
    this.docRef.set({
      transactions:   Store.getTransactions(),
      categories:     Store.getCategories(),
      period_budgets: Store.getAllPeriodBudgets(),
      income:         Store.getAllIncome(),
      settings:       Store.getSettings(),
      lastUpdated:    firebase.firestore.FieldValue.serverTimestamp(),
    }).catch(e => console.warn('Firebase save failed', e));
  },
};
