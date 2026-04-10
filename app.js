const App = {
  currentScreen: 'dashboard',
  toastTimer: null,

  init() {
    Store.migrate();    // migrate old spt_budgets to per-period format
    Store.seedIfEmpty(); // seed defaults on first run

    // Wire up tab bar
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => App.navigate(tab.dataset.screen));
    });

    Dashboard.init();
    ImportManager.init();
    this.navigate('dashboard');

    // Firebase sync — starts in background, updates app when cloud data loads
    FirebaseSync.init({
      apiKey:            "AIzaSyBmh6oEWJR7amhFOzmte1PDYyqBnIubHs0",
      authDomain:        "my-apps-203da.firebaseapp.com",
      projectId:         "my-apps-203da",
      storageBucket:     "my-apps-203da.firebasestorage.app",
      messagingSenderId: "374810934428",
      appId:             "1:374810934428:web:a333322c6a426be53fc159",
    });
  },

  navigate(screen) {
    document.querySelectorAll('.screen').forEach(s => s.hidden = true);
    document.getElementById(`screen-${screen}`).hidden = false;

    document.querySelectorAll('.tab').forEach(t => {
      t.classList.toggle('active', t.dataset.screen === screen);
    });

    this.currentScreen = screen;

    if (screen === 'dashboard') Dashboard.render();
    if (screen === 'add')       Transactions.initAddForm();
    if (screen === 'budgets')   Budgets.render();
  },

  showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
