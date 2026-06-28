const COLORS = {
  food: '#f97316', transport: '#3b82f6', utilities: '#8b5cf6',
  shopping: '#ec4899', health: '#22c55e', entertainment: '#eab308', other: '#888888'
};
const CATEGORIES = ['food', 'transport', 'utilities', 'shopping', 'health', 'entertainment', 'other'];
let selectedCategory = 'food';
let chartInstance = null;
let dailyChart = null;
let compareChart = null;
let activeCategory = '';
let allExpenses = [];

let currentRange = 'month';
let customFrom = null;
let customTo = null;

async function checkAuth() {
  const res = await fetch('/api/me');
  if (res.status === 401) { window.location.href = '/login'; return; }
  const data = await res.json();
  if (data.is_admin && document.getElementById('adminLink')) {
    document.getElementById('adminLink').style.display = 'flex';
  }
  if (document.getElementById('sidebarUser')) {
    document.getElementById('sidebarUser').textContent = `👤 ${data.username}`;
  }
}
checkAuth();

// Build category pills if present
const pillsContainer = document.getElementById('categoryPills');
if (pillsContainer) {
  document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
  CATEGORIES.forEach(cat => {
    const pill = document.createElement('span');
    pill.className = 'cat-pill' + (cat === 'food' ? ' selected' : '');
    pill.textContent = cat;
    pill.style.color = COLORS[cat];
    pill.dataset.cat = cat;
    pill.onclick = () => {
      selectedCategory = cat;
      document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('selected'));
      pill.classList.add('selected');
    };
    pillsContainer.appendChild(pill);
  });
}

async function addExpense() {
  const amount = parseFloat(document.getElementById('amount').value);
  const merchant = document.getElementById('merchant').value.trim();
  const note = document.getElementById('note').value.trim();
  const expenseDate = document.getElementById('expenseDate').value;
  const status = document.getElementById('status');

  if (!amount || !merchant || !selectedCategory || !expenseDate) {
    status.className = 'status err';
    status.textContent = '❌ Please fill in amount, merchant and date.';
    return;
  }

  document.getElementById('addBtn').disabled = true;

  try {
    await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, merchant, category: selectedCategory, note, date: expenseDate })
    });
    status.className = 'status ok';
    status.textContent = `✅ ₱${amount} at ${merchant} saved!`;
    document.getElementById('amount').value = '';
    document.getElementById('merchant').value = '';
    document.getElementById('note').value = '';
    const dateEl = document.getElementById('expenseDate');
    if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
    } catch (e) {
    status.className = 'status err';
    status.textContent = '❌ Failed to save. Try again.';
    }

  document.getElementById('addBtn').disabled = false;
}

async function deleteExpense(id) {
  await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
  loadData();
}

async function editNote(id, currentNote) {
  const note = prompt('Edit note:', currentNote);
  if (note === null) return;
  await fetch(`/api/expenses/${id}/note`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note })
  });
  loadData();
}

function selectFilter(el, cat) {
  activeCategory = cat;
  document.querySelectorAll('#filterPills .cat-pill').forEach(p => {
    p.classList.remove('selected');
    p.style.borderColor = '#333';
    p.style.color = p.dataset.cat ? COLORS[p.dataset.cat] : '#aaa';
  });
  el.classList.add('selected');
  el.style.borderColor = cat ? COLORS[cat] : '#fff';
  el.style.color = '#fff';
  renderExpenses();
}

function filterExpenses() {
  renderExpenses();
}

function renderExpenses() {
  const search = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const list = document.getElementById('expenseList');
  if (!list) return;

  let filtered = allExpenses;

  if (activeCategory) {
    filtered = filtered.filter(e => e.category === activeCategory);
  }
  if (search) {
    filtered = filtered.filter(e =>
      (e.merchant || '').toLowerCase().includes(search) ||
      (e.note || '').toLowerCase().includes(search)
    );
  }

  document.getElementById('expenseCount').textContent = `${filtered.length} entries`;

  if (filtered.length === 0) {
    list.innerHTML = '<div class="loading">No matching expenses.</div>';
    return;
  }

  // Group by date
  const grouped = {};
  filtered.forEach(e => {
    const day = e.date;
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(e);
  });

  list.innerHTML = Object.keys(grouped).sort((a,b) => b.localeCompare(a)).map(day => {
    const dayTotal = grouped[day].reduce((sum, e) => sum + parseFloat(e.amount), 0);
    const items = grouped[day].map(e => `
      <div class="expense-item">
        <div class="expense-left">
          <span class="expense-merchant">${e.merchant}</span>
          <span class="expense-meta">${e.note || ''}</span>
        </div>
        <div class="expense-right">
          <span class="badge" style="background:${COLORS[e.category]}22;color:${COLORS[e.category]}">${e.category}</span>
          <span class="expense-amount">₱${Number(e.amount).toLocaleString()}</span>
          <button class="del-btn" onclick="editNote(${e.id}, '${(e.note||'').replace(/'/g, "\\'")}')" title="Edit note">✎</button>
          <button class="del-btn" onclick="deleteExpense(${e.id})">✕</button>
        </div>
      </div>
    `).join('');

    return `
      <div class="date-group">
        <div class="date-header" onclick="toggleDateGroup(this)">
          <span>${formatDate(day)}</span>
          <span style="display:flex;align-items:center;gap:8px">
            <span style="color:#888;font-size:0.85rem">₱${Number(dayTotal).toLocaleString()}</span>
            <span class="toggle-icon">▾</span>
          </span>
        </div>
        <div class="date-items">${items}</div>
      </div>
    `;
  }).join('');
}

function toggleDateGroup(header) {
  const items = header.nextElementSibling;
  const icon = header.querySelector('.toggle-icon');
  if (items.style.display === 'none') {
    items.style.display = 'block';
    icon.textContent = '▾';
  } else {
    items.style.display = 'none';
    icon.textContent = '▸';
  }
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-PH', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

function setRange(el, range) {
  currentRange = range;
  customFrom = null;
  customTo = null;
  document.querySelectorAll('.range-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  loadData();
}

function applyCustomRange() {
  const from = document.getElementById('dateFrom')?.value;
  const to = document.getElementById('dateTo')?.value;
  if (!from || !to) return;
  customFrom = from;
  customTo = to;
  currentRange = 'custom';
  document.querySelectorAll('.range-pill').forEach(p => p.classList.remove('active'));
  loadData();
}

function buildRangeParams() {
  if (customFrom && customTo) {
    return `date_from=${customFrom}&date_to=${customTo}`;
  }
  return `range=${currentRange}`;
}

async function loadData() {
  const rp = buildRangeParams();
  const [expenses, summary, stats] = await Promise.all([
    fetch(`/api/expenses?${rp}`).then(r => r.json()),
    fetch(`/api/summary?${rp}`).then(r => r.json()),
    fetch(`/api/stats?${rp}`).then(r => r.json())
  ]);

  // Cards
  if (document.getElementById('monthTotal'))
    document.getElementById('monthTotal').textContent = '₱' + Number(summary.monthly_total).toLocaleString('en-PH', { minimumFractionDigits: 2 });
  if (document.getElementById('lastMonth'))
    document.getElementById('lastMonth').textContent = '₱' + Number(stats.last_month).toLocaleString('en-PH', { minimumFractionDigits: 2 });
  if (document.getElementById('weeklyAvg'))
    document.getElementById('weeklyAvg').textContent = '₱' + Number(stats.weekly_avg).toLocaleString('en-PH', { minimumFractionDigits: 2 });
  if (document.getElementById('txCount'))
    document.getElementById('txCount').textContent = expenses.length;
  if (document.getElementById('topCategory') && summary.by_category.length > 0)
    document.getElementById('topCategory').textContent = summary.by_category[0].category;

  // Category doughnut
  if (document.getElementById('categoryChart')) {
    const labels = summary.by_category.map(c => c.category);
    const values = summary.by_category.map(c => parseFloat(c.total));
    const colors = labels.map(l => COLORS[l] || '#888');
    if (chartInstance) chartInstance.destroy();
    if (labels.length > 0) {
      chartInstance = new Chart(document.getElementById('categoryChart'), {
        type: 'doughnut',
        data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }] },
        options: {
          plugins: { legend: { position: 'right', labels: { color: '#aaa', font: { size: 12 } } } },
          cutout: '65%'
        }
      });
    }
  }

  // Daily bar chart
  if (document.getElementById('dailyChart') && stats.daily.length > 0) {
    if (dailyChart) dailyChart.destroy();
    dailyChart = new Chart(document.getElementById('dailyChart'), {
      type: 'bar',
      data: {
        labels: stats.daily.map(d => d.day),
        datasets: [{ label: 'Daily spend', data: stats.daily.map(d => parseFloat(d.total)), backgroundColor: '#3b82f6', borderRadius: 4 }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          y: { ticks: { callback: v => '₱' + v.toLocaleString(), color: '#aaa' }, grid: { color: '#222' } },
          x: { ticks: { color: '#aaa' }, grid: { display: false } }
        }
      }
    });
  }

  // Monthly comparison
  if (document.getElementById('compareChart')) {
    if (compareChart) compareChart.destroy();
    compareChart = new Chart(document.getElementById('compareChart'), {
      type: 'bar',
      data: {
        labels: ['Last month', 'This month'],
        datasets: [{ data: [stats.last_month, stats.this_month], backgroundColor: ['#555', '#f97316'], borderRadius: 6 }]
      },
      options: {
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { callback: v => '₱' + v.toLocaleString(), color: '#aaa' }, grid: { color: '#222' } },
          y: { ticks: { color: '#aaa' }, grid: { display: false } }
        }
      }
    });
  }

  // Expense list
if (document.getElementById('expenseList')) {
    allExpenses = expenses;
    renderExpenses();
  }}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('addBtn')) addExpense();
});
