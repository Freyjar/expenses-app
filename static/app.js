const COLORS = {
  food: '#f97316', transport: '#3b82f6', utilities: '#8b5cf6',
  shopping: '#ec4899', health: '#22c55e', entertainment: '#eab308', other: '#888888'
};
const CATEGORIES = ['food', 'transport', 'utilities', 'shopping', 'health', 'entertainment', 'other'];
let selectedCategory = 'food';
let chartInstance = null;
let dailyChart = null;
let compareChart = null;

async function checkAuth() {
  const res = await fetch('/api/me');
  if (res.status === 401) window.location.href = '/login';
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
    document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
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

async function loadData() {
  const [expenses, summary, stats] = await Promise.all([
    fetch('/api/expenses').then(r => r.json()),
    fetch('/api/summary').then(r => r.json()),
    fetch('/api/stats').then(r => r.json())
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
  const list = document.getElementById('expenseList');
  if (!list) return;
  if (expenses.length === 0) {
    list.innerHTML = '<div class="loading">No expenses yet.</div>';
    return;
  }
  list.innerHTML = expenses.map(e => `
    <div class="expense-item">
      <div class="expense-left">
        <span class="expense-merchant">${e.merchant}</span>
        <span class="expense-meta">${e.date}${e.note ? ' · ' + e.note : ''}</span>
      </div>
      <div class="expense-right">
        <span class="badge" style="background:${COLORS[e.category]}22;color:${COLORS[e.category]}">${e.category}</span>
        <span class="expense-amount">₱${Number(e.amount).toLocaleString()}</span>
        <button class="del-btn" onclick="editNote(${e.id}, '${(e.note||'').replace(/'/g, "\\'")}')" title="Edit note">✎</button>
        <button class="del-btn" onclick="deleteExpense(${e.id})">✕</button>
      </div>
    </div>
  `).join('');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('addBtn')) addExpense();
});
