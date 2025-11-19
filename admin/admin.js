// admin.js — full admin client for waecghcardsonline
const API_BASE = "https://waecghcardsonline-backend.onrender.com"; // <-- YOUR BACKEND URL
const app = document.getElementById('app');

// ---------------- LOGIN SCREEN ----------------
const loginScreenHtml = `
<div id="loginScreen" class="panel center">
  <div style="width:100%">
    <h1 style="margin:0 0 12px 0">Admin Login</h1>
    <form id="loginForm" class="form">
      <input id="username" placeholder="username" autocomplete="username" />
      <input id="password" placeholder="password" type="password" autocomplete="current-password" />
      <button type="submit" class="btn primary">Log in</button>
    </form>
    <div class="muted">Use the ADMIN_USERNAME / ADMIN_PASSWORD set in Render</div>
    <div id="loginMsg" class="muted error" role="status" aria-live="polite"></div>
  </div>
</div>
`;

// ---------------- DASHBOARD SCREEN ----------------
const dashboardHtml = `
<div id="dashboard" class="hidden">
  <header class="topbar">
    <div class="brand">waecghcardsonline — Admin</div>
    <div><button id="btnLogout" class="btn">Logout</button></div>
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
        <select id="filter">
          <option value="all">All</option>
          <option value="unused">Unused</option>
          <option value="used">Used</option>
        </select>
        <button id="refresh" class="btn">Refresh</button>
      </div>
      <div id="voucherTable" class="tableWrap" role="region" aria-live="polite"></div>
    </section>

  </main>
</div>
`;

app.innerHTML = loginScreenHtml + dashboardHtml;

// ---------------- API HELPERS ----------------
function tokenHeader() {
  const token = localStorage.getItem("admin_token");
  return token ? { Authorization: "Bearer " + token } : {};
}

async function api(path, opts = {}) {
  opts.headers = opts.headers || {};

  if (opts.body && !(opts.body instanceof FormData)) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(opts.body);
  }

  Object.assign(opts.headers, tokenHeader());

  const res = await fetch(API_BASE + path, opts);

  if (res.status === 401) {
    logout();
    throw new Error("Unauthorized");
  }

  return res.json();
}

// ---------------- LOGIN ----------------
const loginForm = document.getElementById("loginForm");
const loginMsg = document.getElementById("loginMsg");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginMsg.textContent = "";

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!username || !password) {
    loginMsg.textContent = "Provide credentials";
    return;
  }

  try {
    const res = await fetch(API_BASE + "/admin/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    if (!res.ok) {
      const j = await res.json().catch(() => ({ message: "Login failed" }));
      loginMsg.textContent = j.message || "Login failed";
      return;
    }

    const data = await res.json();
    localStorage.setItem("admin_token", data.token);
    showDashboard();

  } catch (err) {
    loginMsg.textContent = err.message || "Login error";
  }
});

// ---------------- DASHBOARD ----------------
function showDashboard() {
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("dashboard").classList.remove("hidden");
  loadStats();
  loadVouchers();
}

document.getElementById("btnLogout").addEventListener("click", logout);

function logout() {
  localStorage.removeItem("admin_token");
  document.getElementById("dashboard").classList.add("hidden");
  document.getElementById("loginScreen").classList.remove("hidden");
}

// ---------------- ADD VOUCHER ----------------
document.getElementById("addBtn").addEventListener("click", async () => {
  const serial = document.getElementById("serial").value.trim();
  const pin = document.getElementById("pin").value.trim();
  const msg = document.getElementById("addMsg");
  msg.textContent = "";

  if (!serial || !pin) {
    msg.textContent = "serial & pin required";
    return;
  }

  try {
    const r = await api("/admin/api/vouchers", {
      method: "POST",
      body: { serial, pin }
    });

    if (r.success) {
      msg.textContent = "Added";
      document.getElementById("serial").value = "";
      document.getElementById("pin").value = "";
      loadVouchers();
      loadStats();
    } else {
      msg.textContent = r.message || "Error";
    }
  } catch (err) {
    msg.textContent = err.message || "Server error";
  }
});

// ---------------- LOAD STATS ----------------
async function loadStats() {
  try {
    const s = await api("/admin/api/stats");
    document.getElementById("statTotal").textContent = s.total;
    document.getElementById("statUnused").textContent = s.unused;
    document.getElementById("statUsed").textContent = s.used;
  } catch {
    // fail silently
  }
}

// ---------------- LOAD VOUCHERS ----------------
async function loadVouchers() {
  const table = document.getElementById("voucherTable");
  table.innerHTML = "Loading...";

  try {
    const vouchers = await api("/admin/api/vouchers");

    const search = document.getElementById("search").value.toLowerCase();
    const filter = document.getElementById("filter").value;

    let filtered = vouchers;

    if (search) {
      filtered = filtered.filter(
        (v) =>
          v.serial.toLowerCase().includes(search) ||
          v.pin.toLowerCase().includes(search)
      );
    }

    if (filter === "used") filtered = filtered.filter((v) => v.used);
    if (filter === "unused") filtered = filtered.filter((v) => !v.used);

    table.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Serial</th>
            <th>PIN</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${filtered
            .map(
              (v) => `
            <tr>
              <td>${v.serial}</td>
              <td>${v.pin}</td>
              <td>${v.used ? "Used" : "Unused"}</td>
            </tr>
        `
            )
            .join("")}
        </tbody>
      </table>
    `;
  } catch (err) {
    table.textContent = "Error loading vouchers";
  }
}

// ---------------- EVENTS ----------------
document.getElementById("search").addEventListener("input", loadVouchers);
document.getElementById("filter").addEventListener("change", loadVouchers);
document.getElementById("refresh").addEventListener("click", loadVouchers);
