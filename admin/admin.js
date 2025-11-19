// admin.js — connects admin UI to backend
// Backend URL is injected in admin.html: window.BACKEND
const BACKEND = window.BACKEND || (location.origin);
const loginScreen = document.getElementById('loginScreen');
const loginForm = document.getElementById('loginForm');
const loginMsg = document.getElementById('loginMsg');
const dashboard = document.getElementById('dashboard');

function tokenHeader() {
  const token = localStorage.getItem('admin_token');
  return token ? { 'Authorization': 'Bearer ' + token } : {};
}

async function api(path, opts = {}) {
  opts.headers = opts.headers || {};
  // JSON by default when body present
  if (opts.body && !(opts.body instanceof FormData)) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  Object.assign(opts.headers, tokenHeader());
  const res = await fetch(BACKEND + path, opts);
  if (res.status === 401) {
    // token invalid or expired
    logout();
    throw new Error('Unauthorized');
  }
  return res.json();
}

// LOGIN
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginMsg.textContent = '';
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  if (!username || !password) { loginMsg.textContent = 'Provide credentials'; return; }
  try {
    const res = await fetch(BACKEND + '/admin/api/login', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
      const j = await res.json().catch(()=>({message:'Login failed'}));
      loginMsg.textContent = j.message || 'Login failed';
      return;
    }
    const data = await res.json();
    localStorage.setItem('admin_token', data.token);
    showDashboard();
  } catch (err) {
    loginMsg.textContent = err.message || 'Login error';
  }
});

// SHOW / HIDE
function showDashboard() {
  loginScreen.classList.add('hidden');
  dashboard.classList.remove('hidden');
  loadStats();
  loadVouchers();
}

// LOGOUT
document.getElementById('btnLogout').addEventListener('click', logout);
function logout() {
  localStorage.removeItem('admin_token');
  dashboard.classList.add('hidden');
  loginScreen.classList.remove('hidden');
}

// ADD single voucher
document.getElementById('addForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const serial = document.getElementById('serial').value.trim();
  const pin = document.getElementById('pin').value.trim();
  const msg = document.getElementById('addMsg'); msg.textContent = '';
  if (!serial || !pin) { msg.textContent = 'serial & pin required'; return; }
  try {
    const r = await api('/admin/api/vouchers', { method: 'POST', body: { serial, pin } });
    if (r.success) { msg.textContent = 'Added'; document.getElementById('serial').value=''; document.getElementById('pin').value=''; loadVouchers(); loadStats(); }
    else msg.textContent = r.message || 'Error';
  } catch (err) { msg.textContent = err.message || 'Server error'; }
});

// BULK upload CSV
document.getElementById('bulkForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = document.getElementById('csvfile').files[0];
  const msg = document.getElementById('bulkMsg'); msg.textContent = '';
  if (!f) { msg.textContent = 'Choose CSV file'; return; }
  const fd = new FormData(); fd.append('file', f);
  try {
    const res = await fetch(BACKEND + '/admin/api/vouchers/bulk', { method: 'POST', headers: tokenHeader(), body: fd });
    const j = await res.json();
    if (j.success) { msg.textContent = 'Inserted: ' + (j.inserted || 0); loadVouchers(); loadStats(); }
    else msg.textContent = j.message || 'Upload failed';
  } catch (err) { msg.textContent = err.message || 'Server error'; }
});

// STATS
async function loadStats() {
  try {
    const s = await api('/admin/api/stats');
    document.getElementById('statTotal').innerText = s.total ?? '—';
    document.getElementById('statUnused').innerText = s.unused ?? '—';
    document.getElementById('statUsed').innerText = s.used ?? '—';
  } catch (err) { /* ignore */ }
}

// VOUCHER TABLE
document.getElementById('refresh').addEventListener('click', loadVouchers);
document.getElementById('filter').addEventListener('change', loadVouchers);
document.getElementById('search').addEventListener('keyup', (e) => { if (e.key === 'Enter') loadVouchers(); });

async function loadVouchers() {
  const filter = document.getElementById('filter').value;
  const search = document.getElementById('search').value.trim();
  try {
    const res = await api(`/admin/api/vouchers?status=${encodeURIComponent(filter)}&search=${encodeURIComponent(search)}`);
    const wrap = document.getElementById('voucherTable'); wrap.innerHTML = '';
    for (const v of res.vouchers) {
      const row = document.createElement('div'); row.className = 'vrow';
      const left = document.createElement('div'); left.className = 'vleft';
      left.innerHTML = `<div><strong>${escapeHtml(v.serial)}</strong><div class="small">${escapeHtml(v.pin)}</div></div><div class="small">${escapeHtml(v.status)} ${v.date_used ? ' • ' + new Date(v.date_used).toLocaleString() : ''}</div>`;
      const right = document.createElement('div');
      right.innerHTML = `
        <button class="actionBtn success" data-id="${v.id}" onclick="markUsed(${v.id})">Mark used</button>
        <button class="actionBtn info" data-id="${v.id}" onclick="resend(${v.id})">Resend</button>
        <button class="actionBtn danger" data-id="${v.id}" onclick="del(${v.id})">Delete</button>
      `;
      row.appendChild(left); row.appendChild(right);
      wrap.appendChild(row);
    }
  } catch (err) {
    const wrap = document.getElementById('voucherTable'); wrap.innerHTML = '<div class="muted">Error loading vouchers</div>';
  }
}

// helpers for actions (these are global to be callable from inline onclick)
window.markUsed = async function(id) {
  const buyer = prompt('Buyer phone or email (optional)');
  if (buyer === null) return;
  try {
    await api(`/admin/api/vouchers/${id}/mark-used`, { method: 'POST', body: { buyer } });
    loadVouchers(); loadStats();
  } catch (err) { alert('Failed'); }
};

window.del = async function(id) {
  if (!confirm('Delete voucher?')) return;
  try { await api(`/admin/api/vouchers/${id}`, { method: 'DELETE' }); loadVouchers(); loadStats(); } catch(e){ alert('Failed'); }
};

window.resend = async function(id) {
  if (!confirm('Resend SMS for voucher ' + id + '?')) return;
  try {
    const r = await api('/admin/api/resend-sms', { method: 'POST', body: { id } });
    if (r.success) alert('Resent'); else alert(r.message || 'Failed');
  } catch (err) { alert('Failed'); }
};

function escapeHtml(s){ if(s==null) return ''; return String(s).replace(/[&<>"']/g, function(m){return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[m]; }); }

// If we have a valid token already, show dashboard on load
(function(){
  const t = localStorage.getItem('admin_token');
  if (t) showDashboard();
})();
