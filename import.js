const ImportManager = {
  rows: [],
  headers: [],
  mapping: { date: -1, amount: -1, category: -1, notes: -1 },

  init() {
    document.getElementById('import-close').addEventListener('click', () => this.hide());
    document.getElementById('import-modal').addEventListener('click', e => {
      if (e.target.id === 'import-modal') this.hide();
    });
    document.getElementById('import-file').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        document.getElementById('import-paste').value = ev.target.result;
        this.parseInput();
      };
      reader.readAsText(file);
    });
    document.getElementById('import-parse-btn').addEventListener('click', () => this.parseInput());
    document.getElementById('import-back-btn').addEventListener('click', () => {
      document.getElementById('import-step-upload').hidden = false;
      document.getElementById('import-step-map').hidden = true;
    });
    document.getElementById('open-import-btn').addEventListener('click', () => this.show());
  },

  show() {
    document.getElementById('import-modal').hidden = false;
    this.reset();
  },

  hide() {
    document.getElementById('import-modal').hidden = true;
  },

  reset() {
    document.getElementById('import-step-upload').hidden = false;
    document.getElementById('import-step-map').hidden = true;
    document.getElementById('import-file').value = '';
    document.getElementById('import-paste').value = '';
    this.rows = [];
    this.headers = [];
  },

  // ── CSV Parser ─────────────────────────────────────────
  // Handles quoted fields, commas inside quotes, escaped quotes ("")
  parseCSV(text) {
    const lines = text.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const result = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      const row = [];
      let inQuote = false;
      let field = '';
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuote && line[i + 1] === '"') { field += '"'; i++; }
          else inQuote = !inQuote;
        } else if (ch === ',' && !inQuote) {
          row.push(field.trim());
          field = '';
        } else {
          field += ch;
        }
      }
      row.push(field.trim());
      result.push(row);
    }
    return result;
  },

  parseInput() {
    const text = document.getElementById('import-paste').value.trim();
    if (!text) { App.showToast('Paste or upload a CSV file first'); return; }

    const rows = this.parseCSV(text);
    if (rows.length < 2) { App.showToast('Need at least a header row and one data row'); return; }

    this.headers = rows[0];
    this.rows = rows.slice(1).filter(r => r.some(f => f.trim()));
    if (this.rows.length === 0) { App.showToast('No data rows found'); return; }

    this.detectMapping();
    this.showMapStep();
  },

  // ── Column Auto-Detection ──────────────────────────────
  detectMapping() {
    const h = this.headers.map(s => s.toLowerCase().trim());
    const find = (...terms) => {
      for (const t of terms) {
        const i = h.findIndex(s => s.includes(t));
        if (i >= 0) return i;
      }
      return -1;
    };
    this.mapping = {
      date:     find('date'),
      amount:   find('amount', 'cost', 'price', 'total', 'debit', 'spend', 'value'),
      category: find('category', 'cat', 'type'),
      notes:    find('note', 'description', 'desc', 'merchant', 'memo', 'detail', 'payee', 'name', 'vendor'),
    };
  },

  // ── Mapping Step ───────────────────────────────────────
  showMapStep() {
    document.getElementById('import-step-upload').hidden = true;
    document.getElementById('import-step-map').hidden = false;

    const mapDiv = document.getElementById('import-mapping');
    const fields = [
      { key: 'date',     label: 'Date',             required: true  },
      { key: 'amount',   label: 'Amount',            required: true  },
      { key: 'category', label: 'Category',          required: false },
      { key: 'notes',    label: 'Notes / Merchant',  required: false },
    ];

    mapDiv.innerHTML = fields.map(f => `
      <div class="import-map-row">
        <span class="import-map-label">${f.label}${f.required ? ' <span class="import-req">*</span>' : ''}</span>
        <select class="import-map-sel" data-field="${f.key}">
          <option value="-1">${f.required ? '— select column —' : '— skip —'}</option>
          ${this.headers.map((h, i) =>
            `<option value="${i}" ${this.mapping[f.key] === i ? 'selected' : ''}>${escapeHtml(h)}</option>`
          ).join('')}
        </select>
      </div>
    `).join('');

    mapDiv.querySelectorAll('select').forEach(sel => {
      sel.addEventListener('change', () => {
        this.mapping[sel.dataset.field] = parseInt(sel.value);
        this.renderPreview();
        this.updateImportBtn();
      });
    });

    // Auto-detect date format from first data row
    let detectedFmt = 'mdy';
    if (this.mapping.date >= 0 && this.rows[0]) {
      const sample = (this.rows[0][this.mapping.date] || '').trim();
      if (/^\d{4}[-\/]/.test(sample)) detectedFmt = 'iso';
    }

    document.getElementById('import-date-format').innerHTML = `
      <div class="import-map-row">
        <span class="import-map-label">Date format</span>
        <select id="import-date-fmt-sel" class="import-map-sel">
          <option value="mdy" ${detectedFmt === 'mdy' ? 'selected' : ''}>MM/DD/YYYY (US Excel)</option>
          <option value="iso" ${detectedFmt === 'iso' ? 'selected' : ''}>YYYY-MM-DD (ISO)</option>
          <option value="dmy">DD/MM/YYYY</option>
        </select>
      </div>
    `;
    document.getElementById('import-date-fmt-sel').addEventListener('change', () => this.renderPreview());

    document.getElementById('import-confirm-btn').onclick = () => this.doImport();

    this.renderPreview();
    this.updateImportBtn();
  },

  // ── Date / Amount Parsing ─────────────────────────────
  parseDate(str, fmt) {
    if (!str) return null;
    str = str.trim();
    // Already ISO
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
    const parts = str.split(/[\/\-\.]/);
    if (parts.length < 3) return null;
    let y, m, d;
    if (fmt === 'mdy') { [m, d, y] = parts; }
    else if (fmt === 'dmy') { [d, m, y] = parts; }
    else { [y, m, d] = parts; }
    if (String(y).length === 2) y = '20' + y;
    if (!y || !m || !d) return null;
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return isNaN(new Date(iso + 'T00:00:00').getTime()) ? null : iso;
  },

  parseAmount(str) {
    if (!str) return NaN;
    // Handle accounting notation: (100.00) = -100
    const cleaned = str.replace(/[$,\s]/g, '').replace(/^\((.+)\)$/, '-$1');
    const n = parseFloat(cleaned);
    return isNaN(n) ? NaN : Math.abs(n); // always positive — we track expenses
  },

  // ── Preview Table ─────────────────────────────────────
  renderPreview() {
    const fmt = document.getElementById('import-date-fmt-sel')?.value || 'mdy';

    document.getElementById('import-preview-body').innerHTML = this.rows.slice(0, 5).map(row => {
      const rawDate = this.mapping.date >= 0 ? (row[this.mapping.date] || '') : '';
      const rawAmt  = this.mapping.amount >= 0 ? (row[this.mapping.amount] || '') : '';
      const dateStr = this.parseDate(rawDate, fmt);
      const amt     = this.parseAmount(rawAmt);
      const cat     = this.mapping.category >= 0 ? (row[this.mapping.category] || '').trim() : '';
      const notes   = this.mapping.notes >= 0 ? (row[this.mapping.notes] || '').trim() : '';

      const dateCell = dateStr
        ? escapeHtml(dateStr)
        : `<span class="import-err">${escapeHtml(rawDate || '—')}</span>`;
      const amtCell = !isNaN(amt)
        ? `$${amt.toFixed(2)}`
        : `<span class="import-err">${escapeHtml(rawAmt || '—')}</span>`;

      return `<tr>
        <td>${dateCell}</td>
        <td>${amtCell}</td>
        <td>${cat ? escapeHtml(cat) : '<span class="import-dim">—</span>'}</td>
        <td>${notes ? escapeHtml(notes) : '<span class="import-dim">—</span>'}</td>
      </tr>`;
    }).join('');
  },

  updateImportBtn() {
    const btn = document.getElementById('import-confirm-btn');
    const ready = this.mapping.date >= 0 && this.mapping.amount >= 0;
    btn.disabled = !ready;
    btn.textContent = ready
      ? `Import ${this.rows.length} Transactions`
      : 'Select Date & Amount columns';
  },

  // ── Do Import ─────────────────────────────────────────
  doImport() {
    const fmt  = document.getElementById('import-date-fmt-sel').value;
    const cats = Store.getCategories();
    let imported = 0, skipped = 0;

    this.rows.forEach((row, idx) => {
      const dateStr = this.mapping.date >= 0 ? this.parseDate(row[this.mapping.date], fmt) : null;
      const amount  = this.mapping.amount >= 0 ? this.parseAmount(row[this.mapping.amount]) : NaN;

      if (!dateStr || isNaN(amount) || amount <= 0) { skipped++; return; }

      let category = this.mapping.category >= 0 ? (row[this.mapping.category] || '').trim() : '';
      if (!category) category = 'Other';

      // Auto-add any new categories from the import
      if (!cats.includes(category)) {
        Store.addCategory(category);
        cats.push(category);
      }

      const notes = this.mapping.notes >= 0 ? (row[this.mapping.notes] || '').trim() : '';

      Store.addTransaction({
        id: `imp_${Date.now()}_${idx}`,
        date: dateStr,
        amount,
        category,
        notes,
      });
      imported++;
    });

    this.hide();
    if (App.currentScreen === 'dashboard') Dashboard.render();
    if (App.currentScreen === 'budgets')   Budgets.render();

    const msg = skipped > 0
      ? `Imported ${imported} transactions · ${skipped} skipped`
      : `Imported ${imported} transactions ✓`;
    App.showToast(msg);
  },
};
