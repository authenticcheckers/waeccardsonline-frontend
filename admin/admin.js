// admin.js — full admin client for waecghcardsonline
const BACKEND = window.BACKEND || location.origin;
const app = document.getElementById('app');

const loginScreenHtml = `
<div id="loginScreen" class="panel center">
  <div style="width:100%">
    <h1 style="margin:0 0 12px 0">Admin Login</h1>
    <form id="loginForm" class="form">
      <input id="username" placeholder="username" value="admin" autocomplete="username" />
      <input id="password" placeholder="password" type="password" autocomplete="current-password" />
      <button type="submit" class="btn primary">Log in</button>
    </form>
    <div class="muted">Use the ADMIN_USERNAME / ADMIN_PASSWORD you set on Render</div>
    <div id="loginMsg" class="muted error" role="status" aria-live="polite"></div>
  </div>
</div>
`;

const dashboardHtml = `
<div id="dashboard" class="hidden">
  <header class="topbar"><div class="brand">waecghcardsonline — Admin</div><div><button id="btnLogout" class="btn">Logout</button></div></header>
  <main class="main">
    <section class="card">
      <h2>Quick Stats</h2>
      <div class="stats">
        <div class="stat"><div id="statTotal">—</div><div class="label">Total</div></div>
        <div class="stat"><div id="statUnused">—</div><div class="label">Unused</div></div>
        <div class="stat"><div id="statUsed">—</div><div class="label">Used</div></div>
      </div>
    </section>
    <section class="card">
      <h2>Add Voucher</h2>
      <form id="addForm" class="form-inline" onsubmit="return false;">
        <input id="serial" placeholder="Serial" />
        <input id="pin" placeholder="PIN" />
        <button id="addBtn" class="btn primary">Add</button>
      </form>
      <div id="addMsg" class="muted"></div>
    </section>
    <section class="card">
      <h2>Bulk Upload (CSV)</h2>
      <form id="bulkForm" enctype="multipart/form-data" class="form-inline" onsubmit="return false;">
        <input id="csvfile" type="file" accept=".csv" />
        <button id="bulkBtn" class="btn">Upload</button>
      </form>
      <div id="bulkMsg" class="muted"></div>
    </section>
    <section class="card full">
      <h2>Vouchers</h2>
      <div class="controls" style="margin-bottom:12px;display:flex;gap:8px;align-items:center">
        <input id="search" placeholder="Search serial or pin" class="input" style="flex:1" />
        <select id="filter"><option value="all">All</option><option value="unused">Unused</option><option value="used">Used</option></select>
        <button id="refresh" class="btn">Refresh</button>
      </div>
      <div id="voucherTable" class="tableWrap" role="region" aria-live="polite"></div>
    </section>
  </main>
</div>
`;

app.innerHTML = loginScreenHtml + dashboardHtml;

function tokenHeader(){ const token = localStorage.getItem('admin_token'); return token ? {'Authorization':'Bearer '+token} : {}; }
async function api(path, opts={}){
  opts.headers = opts.headers || {};
  if(opts.body && !(opts.body instanceof FormData)){ opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(opts.body); }
  Object.assign(opts.headers, tokenHeader());
  const res = await fetch(BACKEND + path, opts);
  if(res.status === 401){ logout(); throw new Error('Unauthorized'); }
  return res.json();
}

// Login flow
const loginForm = document.getElementById('loginForm');
const loginMsg = document.getElementById('loginMsg');
loginForm.addEventListener('submit', async (e)=>{
  e.preventDefault(); loginMsg.textContent = '';
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  if(!username || !password){ loginMsg.textContent = 'Provide credentials'; return; }
  try{
    const res = await fetch(BACKEND + '/admin/api/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username, password }) });
    if(!res.ok){ const j = await res.json().catch(()=>({message:'Login failed'})); loginMsg.textContent = j.message || 'Login failed'; return; }
    const data = await res.json(); localStorage.setItem('admin_token', data.token); showDashboard();
  } catch(err){ loginMsg.textContent = err.message || 'Login error'; }
});

function showDashboard(){ document.getElementById('loginScreen').classList.add('hidden'); document.getElementById('dashboard').classList.remove('hidden'); loadStats(); loadVouchers(); }
document.getElementById('btnLogout').addEventListener('click', ()=>{ localStorage.removeItem('admin_token'); document.getElementById('dashboard').classList.add('hidden'); document.getElementById('loginScreen').classList.remove('hidden'); });

// Add voucher
document.getElementById('addBtn').addEventListener('click', async ()=>{
  const serial = document.getElementById('serial').value.trim();
  const pin = document.getElementById('pin').value.trim();
  const msg = document.getElementById('addMsg'); msg.textContent = '';
  if(!serial || !pin){ msg.textContent = 'serial & pin required'; return; }
  try{
    const r = await api('/admin/api/vouchers', { method: 'POST', body: { serial, pin } });
    if(r.success){ msg.textContent = 'Added'; document.getElementById('serial').value = ''; document.getElementById('pin').value = ''; loadVouchers(); loadStats(); }
    else msg.textContent = r.message || 'Error';
  } catch(err){ msg.textContent = err.message || 'Server error'; }
});

# continue JS...

// end of admin.js
