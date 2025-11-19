// admin.js — complete admin client (A-F)
(() => {
  const API_BASE = window.BACKEND || "https://waecghcardsonline-backend.onrender.com";
  const app = document.getElementById("app");

  /* ------------------ HTML TEMPLATES ------------------ */
  const loginScreenHtml = `
  <div id="loginScreen" class="panel center">
    <div style="width:100%">
      <h1 style="margin:0 0 12px 0">Admin Login</h1>
      <form id="loginForm" class="form">
        <input id="username" placeholder="username" autocomplete="username" />
        <input id="password" placeholder="password" type="password" autocomplete="current-password" />
        <button type="submit" class="btn primary">Log in</button>
      </form>
      <div class="muted">Use ADMIN_USERNAME / ADMIN_PASSWORD set on Render</div>
      <div id="loginMsg" class="muted error" role="status" aria-live="polite"></div>
    </div>
  </div>`.trim();

  const dashboardHtml = `
  <div id="dashboard" class="hidden">
    <header class="topbar">
      <div class="brand">waecghcardsonline — Admin</div>
      <div>
        <button id="btnLogout" class="btn">Logout</button>
      </div>
    </header>

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

      <section class="card full">
        <h2>Recent Purchases</h2>
        <div id="purchasesTable" class="tableWrap" role="region" aria-live="polite"></div>
        <div style="margin-top:8px"><button id="refreshPurchases" class="btn">Refresh Purchases</button></div>
      </section>
    </main>
  </div>`.trim();

  app.innerHTML = loginScreenHtml + dashboardHtml;

  /* ------------------ UTILITIES ------------------ */
  function el(q) { return document.querySelector(q); }
  function byId(id) { return document.getElementById(id); }

  function tokenHeader() {
    const t = localStorage.getItem("admin_token");
    return t ? { Authorization: "Bearer " + t } : {};
  }

  async function api(path, opts = {}) {
    opts.headers = opts.headers || {};
    if (opts.body && !(opts.body instanceof FormData)) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(opts.body);
    }
    Object.assign(opts.headers, tokenHeader());
    const res = await fetch(API_BASE + path, opts);
    if (res.status === 401) { // token invalid/expired
      logout();
      throw new Error("Unauthorized");
    }
    const text = await res.text();
    try { return JSON.parse(text); } catch (e) { return text; }
  }

  function showMsg(id, text, isError=false) {
    const el = byId(id);
    if (!el) return;
    el.textContent = text;
    el.style.color = isError ? "#ff6b6b" : "";
  }

  /* ------------------ AUTH ------------------ */
  const loginForm = byId("loginForm");
  const loginMsg = byId("loginMsg");
  loginForm.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    loginMsg.textContent = "";
    const username = byId("username").value.trim();
    const password = byId("password").value.trim();
    if (!username || !password) { loginMsg.textContent = "Provide credentials"; return; }
    try {
      const res = await fetch(API_BASE + "/admin/api/login", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) {
        const j = await res.json().catch(()=>({message:"Login failed"}));
        loginMsg.textContent = j.message || "Login failed";
        return;
      }
      const j = await res.json();
      localStorage.setItem("admin_token", j.token);
      showDashboard();
    } catch (err) {
      loginMsg.textContent = err.message || "Login error";
    }
  });

  function logout() {
    localStorage.removeItem("admin_token");
    byId("dashboard").classList.add("hidden");
    byId("loginScreen").classList.remove("hidden");
  }
  byId("btnLogout").addEventListener("click", logout);

  /* ------------------ DASHBOARD ACTIONS ------------------ */
  function showDashboard() {
    byId("loginScreen").classList.add("hidden");
    byId("dashboard").classList.remove("hidden");
    loadStats();
    loadVouchers(); // default
    loadPurchases();
  }

  /* ------------------ ADD VOUCHER ------------------ */
  byId("addBtn").addEventListener("click", async () => {
    const serial = byId("serial").value.trim();
    const pin = byId("pin").value.trim();
    const msgId = "addMsg";
    showMsg(msgId, "");
    if (!serial || !pin) { showMsg(msgId, "serial & pin required", true); return; }
    try {
      const r = await api("/admin/api/vouchers", { method: "POST", body: { serial, pin } });
      if (r && r.success) { showMsg(msgId, "Added"); byId("serial").value=""; byId("pin").value=""; loadVouchers(); loadStats(); }
      else showMsg(msgId, (r && r.message) ? r.message : "Error", true);
    } catch (err) { showMsg(msgId, err.message || "Server error", true); }
  });

  /* ------------------ BULK CSV UPLOAD ------------------ */
  byId("bulkBtn").addEventListener("click", async () => {
    const f = byId("csvfile").files[0];
    const msgId = "bulkMsg";
    showMsg(msgId, "");
    if (!f) { showMsg(msgId, "Choose CSV file", true); return; }
    const fd = new FormData(); fd.append("file", f);
    try {
      const r = await fetch(API_BASE + "/admin/api/vouchers/bulk", { method: "POST", headers: tokenHeader(), body: fd });
      const j = await r.json().catch(()=>({success:false,message:"Upload failed"}));
      if (j && j.success) { showMsg(msgId, "Inserted: " + (j.inserted||0)); loadVouchers(); loadStats(); }
      else showMsg(msgId, j.message || "Upload failed", true);
    } catch (err) { showMsg(msgId, err.message || "Upload error", true); }
  });

  /* ------------------ STATS ------------------ */
  async function loadStats() {
    try {
      const s = await api("/admin/api/stats");
      byId("statTotal").textContent = s.total ?? "—";
      byId("statUnused").textContent = s.unused ?? "—";
      byId("statUsed").textContent = s.used ?? "—";
    } catch (e) { /* ignore */ }
  }

  /* ------------------ VOUCHERS TABLE (search/filter/pagination simple) ------------------ */
  const voucherTable = byId("voucherTable");
  byId("refresh").addEventListener("click", loadVouchers);
  byId("filter").addEventListener("change", loadVouchers);
  byId("search").addEventListener("keyup", (e) => { if (e.key === "Enter") loadVouchers(); });

  async function loadVouchers() {
    voucherTable.innerHTML = "Loading...";
    try {
      // API expected to return { vouchers: [...] } or an array
      const res = await api("/admin/api/vouchers");
      const list = Array.isArray(res) ? res : (res.vouchers || []);
      const search = byId("search").value.trim().toLowerCase();
      const filter = byId("filter").value;

      let filtered = list.slice();

      if (search) {
        filtered = filtered.filter(v => (v.serial||"").toLowerCase().includes(search) || (v.pin||"").toLowerCase().includes(search));
      }
      if (filter === "used") filtered = filtered.filter(v => v.used || v.status === "used");
      if (filter === "unused") filtered = filtered.filter(v => !(v.used || v.status === "used"));

      if (!filtered.length) { voucherTable.innerHTML = "<div class='muted'>No vouchers found.</div>"; return; }

      // render table rows
      const rows = filtered.map(v => {
        const id = v.id || v._id || v.serial;
        const used = v.used || v.status === "used";
        return `
          <div class="vrow" data-id="${id}">
            <div class="vleft">
              <div><strong>${escapeHtml(v.serial)}</strong><div class="small">${escapeHtml(v.pin)}</div></div>
              <div class="small">${used ? "Used" : "Unused"} ${v.date_used ? " • " + new Date(v.date_used).toLocaleString() : ""}</div>
            </div>
            <div>
              <button class="actionBtn success" data-id="${id}" data-action="mark-used">Mark used</button>
              <button class="actionBtn info" data-id="${id}" data-action="resend">Resend</button>
              <button class="actionBtn danger" data-id="${id}" data-action="delete">Delete</button>
            </div>
          </div>
        `;
      }).join("");

      voucherTable.innerHTML = rows;

      // attach event listeners (delegation)
      voucherTable.querySelectorAll("[data-action]").forEach(btn => {
        btn.removeEventListener("click", voucherActionHandler);
        btn.addEventListener("click", voucherActionHandler);
      });

    } catch (err) {
      voucherTable.innerHTML = "<div class='muted'>Error loading vouchers</div>";
    }
  }

  function voucherActionHandler(e) {
    const btn = e.currentTarget;
    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");
    if (!action || !id) return;
    if (action === "mark-used") return markUsedById(id);
    if (action === "resend") return resendById(id);
    if (action === "delete") return deleteById(id);
  }

  async function markUsedById(id) {
    const buyer = prompt("Buyer phone or email (optional)");
    if (buyer === null) return;
    try {
      const r = await api(`/admin/api/vouchers/${encodeURIComponent(id)}/mark-used`, { method: "POST", body: { buyer } });
      if (r && r.success) { loadVouchers(); loadStats(); alert("Marked used"); }
      else alert(r && r.message ? r.message : "Failed");
    } catch (err) { alert(err.message || "Server error"); }
  }

  async function deleteById(id) {
    if (!confirm("Delete voucher? This cannot be undone.")) return;
    try {
      const r = await api(`/admin/api/vouchers/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (r && r.success) { loadVouchers(); loadStats(); alert("Deleted"); }
      else alert(r && r.message ? r.message : "Delete failed");
    } catch (err) { alert(err.message || "Server error"); }
  }

  async function resendById(id) {
    if (!confirm("Resend SMS for voucher " + id + "?")) return;
    try {
      const r = await api("/admin/api/resend-sms", { method: "POST", body: { id } });
      if (r && r.success) alert("Resent");
      else alert(r && r.message ? r.message : "Resend failed");
    } catch (err) { alert(err.message || "Server error"); }
  }

  /* ------------------ PURCHASES (recent) ------------------ */
  const purchasesTable = byId("purchasesTable");
  byId("refreshPurchases").addEventListener("click", loadPurchases);

  async function loadPurchases() {
    purchasesTable.innerHTML = "Loading...";
    try {
      const res = await api("/admin/api/purchases");
      const list = Array.isArray(res) ? res : (res.purchases || []);
      if (!list.length) { purchasesTable.innerHTML = "<div class='muted'>No purchases yet.</div>"; return; }

      const rows = list.map(p => `
        <div class="vrow">
          <div class="vleft" style="flex:1">
            <div><strong>${escapeHtml(p.phone || p.buyer || p.customer || "Unknown")}</strong>
              <div class="small">${escapeHtml(p.email || "")} • ${new Date(p.created_at || p.date || p.ts || Date.now()).toLocaleString()}</div>
            </div>
          </div>
          <div style="min-width:220px;text-align:right">
            <div class="small">Voucher: ${escapeHtml(p.voucher || p.voucher_code || "")}</div>
            <div class="small">Status: ${escapeHtml(p.status || p.result || "")}</div>
          </div>
        </div>
      `).join("");
      purchasesTable.innerHTML = rows;
    } catch (err) {
      purchasesTable.innerHTML = "<div class='muted'>Error loading purchases</div>";
    }
  }

  /* ------------------ HELPERS ------------------ */
  function escapeHtml(s) {
    if (s === null || s === undefined) return "";
    return String(s).replace(/[&<>"']/g, function (m) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m];
    });
  }

  /* ------------------ AUTO-LOGIN (if token exists) ------------------ */
  (function init() {
    const t = localStorage.getItem("admin_token");
    if (t) {
      // try to show dashboard; if token invalid, API calls will logout
      showDashboard();
    }
  })();

  // expose a manual refresh in case the page needs it
  window.adminReloadVouchers = loadVouchers;
  window.adminReloadPurchases = loadPurchases;
})();
