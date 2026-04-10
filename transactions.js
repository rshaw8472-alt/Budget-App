const Transactions = {
  selectedCategory: null,

  initAddForm() {
    this.selectedCategory = null;

    const form = document.getElementById('add-form');
    const amountEl   = document.getElementById('tx-amount');
    const dateEl     = document.getElementById('tx-date');

    form.reset();
    amountEl.classList.remove('invalid');

    // Default to today (local date)
    const now = new Date();
    dateEl.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

    setTimeout(() => amountEl.focus(), 50);

    // Clone form to remove old listeners
    const newForm = form.cloneNode(true);
    form.replaceWith(newForm);
    newForm.addEventListener('submit', e => {
      e.preventDefault();
      this.submitTransaction(newForm);
    });

    this.renderCategoryPills();
  },

  renderCategoryPills() {
    const container = document.getElementById('category-pills');
    const noMsg     = document.getElementById('no-categories-msg');
    if (!container) return;

    const cats = Store.getCategories();
    container.innerHTML = '';

    if (cats.length === 0) {
      if (noMsg) noMsg.hidden = false;
      return;
    }
    if (noMsg) noMsg.hidden = true;

    cats.forEach(cat => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pill' + (cat === this.selectedCategory ? ' selected' : '');
      btn.textContent = cat;
      btn.addEventListener('click', () => {
        this.selectedCategory = cat;
        container.querySelectorAll('.pill').forEach(p => p.classList.remove('selected'));
        btn.classList.add('selected');
      });
      container.appendChild(btn);
    });
  },

  submitTransaction(form) {
    const amountEl   = form.querySelector('#tx-amount');
    const merchantEl = form.querySelector('#tx-merchant');
    const dateEl     = form.querySelector('#tx-date');
    const notesEl    = form.querySelector('#tx-notes');

    const amount   = parseFloat(amountEl.value);
    const merchant = merchantEl ? merchantEl.value.trim() : '';
    const date     = dateEl.value;
    const notes    = notesEl ? notesEl.value.trim() : '';

    let valid = true;

    if (!amount || amount <= 0) {
      amountEl.classList.add('invalid');
      valid = false;
    } else {
      amountEl.classList.remove('invalid');
    }

    if (!this.selectedCategory) {
      App.showToast('Please select a category');
      valid = false;
    }

    if (!valid) return;

    // Combine merchant + notes for display in transaction list
    const displayNotes = [merchant, notes].filter(Boolean).join(' · ');

    Store.addTransaction({
      id: Date.now().toString(),
      date,
      amount,
      category: this.selectedCategory,
      merchant,
      notes: displayNotes
    });

    App.showToast('Transaction added');
    App.navigate('dashboard');
  }
};
