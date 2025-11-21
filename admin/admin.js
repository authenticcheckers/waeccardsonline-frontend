// admin/admin.js — admin client that works with Postgres backend
(function(){
  const API = window.BACKEND || location.origin;
  const el = id => document.getElementById(id);

  function setMsg(id, text){ const e=el(id); if(e) e.textContent=text; }
  function token(){ return localStorage.getItem('admin_token'); }
  function authHeaders(){ const t=token(); return t? {'Authorization':'Bearer '+t} : {}; }

  async function api(path, opts={}) {
    opts.headers = Object.assign(opts.headers || {}, authHeaders());
    if (opts.body && !(opts.body instanceof FormData)) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }
    const res = await fetch(API + path, opts);
    if (res.status === 401) { logout(); throw new Error('Unauthorized'); }
    return res.json();
  }

  // login
  el('btnLogin').addEventListener('click', async ()=>{
    setMsg('loginMsg','');
    const username = el('username').value.trim();
    const password = el('password').value.trim();
    if(!username||!password){ setMsg('loginMsg','provide credentials'); return; }
    try{
      const r = await fetch(API + '/admin/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username,password})});
      if(!r.ok){ const j=await r.json().catch(()=>({message:'login failed'})); setMsg('loginMsg', j.message||'login failed'); return; }
      const j = await r.json();
      localStorage.setItem('admin_token', j.token);
      setMsg('loginMsg','Logged in');
      loadStats(); loadVouchers(); loadSales();
    }catch(e){ setMsg('loginMsg', e.message||'error'); }
  });

  function logout(){ localStorage.removeItem('admin_token'); setMsg('loginMsg','Logged out'); }

  el('btnLogout').addEventListener('click', ()=>{ logout(); });

  // add single
  el('addBtn').addEventListener('click', async ()=>{
    setMsg('addMsg','');
    const serial = el('serial').value.trim(), pin = el('pin').value.trim();
    if(!serial||!pin){ setMsg('addMsg','serial & pin required'); return; }
    try {
      const r = await api('/admin/api/vouchers', { method:'POST', body:{ serial, pin } });
      if(r && r.success){ setMsg('addMsg','Added'); el('serial').value=''; el('pin').value=''; loadVouchers(); loadStats(); }
      else setMsg('addMsg', r.message||'Error');
    } catch(e){ setMsg('addMsg', e.message||'Server error'); }
  });

  // bulk
  el('bulkBtn').addEventListener('click', async ()=>{
    setMsg('bulkMsg','');
    const f = el('csvfile').files[0];
    if(!f){ setMsg('bulkMsg','Choose CSV'); return; }
    const fd = new FormData(); fd.append('file', f);
    try {
      const res = await fetch(API + '/admin/api/vouchers/bulk', { method:'POST', headers: authHeaders(), body: fd });
      const j = await res.json();
      if(j && j.success){ setMsg('bulkMsg','Inserted: '+ (j.inserted||0)); loadVouchers(); loadStats(); }
      else setMsg('bulkMsg', j.message||'Upload failed');
    } catch(e){ setMsg('bulkMsg', e.message||'Upload error'); }
  });

  // stats
  async function loadStats(){
    try { const s = await api('/admin/api/stats'); el('statTotal').textContent = s.total; el('statUnused').textContent = s.unused; el('statUsed').textContent = s.used; } catch(e){ /*ignore*/ }
  }

  // vouchers
  el('refresh').addEventListener('click', loadVouchers);
  el('filter').addEventListener('change', loadVouchers);
  el('search').addEventListener('keyup', (e)=>{ if(e.key==='Enter') loadVouchers(); });

  async function loadVouchers(){
    const wrap = el('voucherTable'); wrap.innerHTML = 'Loading...';
    try {
      const res = await api('/admin/api/vouchers');
      const list = res.vouchers||[];
      const search = el('search').value.trim().toLowerCase();
      const filter = el('filter').value;
      let items = list.slice();
      if(search) items = items.filter(v => (v.serial||'').toLowerCase().includes(search) || (v.pin||'').toLowerCase().includes(search));
      if(filter==='used') items = items.filter(v => v.status==='used');
      if(filter==='unused') items = items.filter(v => v.status!=='used');
      if(!items.length){ wrap.innerHTML = '<div class="muted">No vouchers</div>'; return; }
      wrap.innerHTML = items.map(v=> {
        return `<div class="vrow"><div><strong>${escapeHtml(v.serial)}</strong><div class="muted">${escapeHtml(v.pin)}</div></div>
          <div class="actions">
            <button data-id="${v.id}" data-action="mark">Mark used</button>
            <button data-id="${v.id}" data-action="resend">Resend</button>
            <button data-id="${v.id}" data-action="del">Delete</button>
          </div></div>`;
      }).join('');
      wrap.querySelectorAll('button[data-action]').forEach(b=>{
        b.addEventListener('click', async (ev)=>{
          const id = b.getAttribute('data-id'), a = b.getAttribute('data-action');
          if(a==='mark'){ const buyer = prompt('Buyer phone/email (optional)'); if(buyer===null) return; await api(`/admin/api/vouchers/${encodeURIComponent(id)}/mark-used`, { method:'POST', body:{ buyer } }); loadVouchers(); loadStats(); }
          if(a==='resend'){ if(!confirm('Resend SMS?')) return; await api('/admin/api/resend-sms',{ method:'POST', body:{ id } }); alert('Sent'); }
          if(a==='del'){ if(!confirm('Delete voucher?')) return; await api(`/admin/api/vouchers/${encodeURIComponent(id)}`, { method:'DELETE' }); loadVouchers(); loadStats(); }
        });
      });
    } catch(e){ wrap.innerHTML = '<div class="muted">Error loading vouchers</div>'; }
  }

  // sales
  el('refreshSales').addEventListener('click', loadSales);
  async function loadSales(){
    const wrap = el('salesTable'); wrap.innerHTML = 'Loading...';
    try {
      const r = await api('/admin/api/sales');
      const list = r.sales || [];
      if(!list.length){ wrap.innerHTML = '<div class="muted">No sales</div>'; return; }
      wrap.innerHTML = list.map(s => `<div class="vrow"><div><strong>${escapeHtml(s.phone||s.email||'Unknown')}</strong><div class="muted">${escapeHtml(s.voucher_serial||'')}</div></div><div>${new Date(s.timestamp).toLocaleString()}</div></div>`).join('');
    } catch(e){ wrap.innerHTML = '<div class="muted">Error loading sales</div>'; }
  }

  // helper escape
  function escapeHtml(s){ if(s===null||s===undefined) return ''; return String(s).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  // auto load if token present
  (function init(){ if(token()){ loadStats(); loadVouchers(); loadSales(); } })();

  // expose for debugging
  window.adminReload = loadVouchers;
})();

