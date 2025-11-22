/* Admin dashboard client — fixed version
   Works with:
   - POST /admin/login  -> { success: true, token?: "..." } OR { success:false, message }
   - POST /admin/upload -> { success: true, message: "" }
   - GET  /admin/vouchers -> { success:true, data: [...] } OR { vouchers: [...] }
   - GET  /admin/sales -> { success:true, data: [...] } OR { sales: [...] }
*/

const API_BASE = "https://waecghcardsonline-backend.onrender.com";
const state = {
  token: localStorage.getItem("admin_token") || null,
  pwRemember: localStorage.getItem("admin_remember") === "1"
};

function setAuthToken(token, remember){
  state.token = token || null;
  if(remember && token){
    localStorage.setItem("admin_token", token);
    localStorage.setItem("admin_remember", "1");
  } else {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_remember");
  }
}

// Attach listeners after DOM is ready
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("loginBtn").addEventListener("click", doLogin);
  document.getElementById("logoutBtn").addEventListener("click", doLogout);
  document.getElementById("uploadCsvBtn").addEventListener("click", uploadCsvHandler);
  document.getElementById("addVoucherBtn").addEventListener("click", addVoucherHandler);
  document.getElementById("refreshVouchersBtn").addEventListener("click", loadVouchers);
  document.getElementById("refreshSalesBtn").addEventListener("click", loadSales);
  document.getElementById("applyFilterBtn").addEventListener("click", loadVouchers);
  document.getElementById("exportVouchersBtn").addEventListener("click", exportVouchersCsv);
  document.getElementById("exportSalesBtn").addEventListener("click", exportSalesCsv);

  if(state.token){
    showDashboard();
    loadVouchers();
    loadSales();
  } else {
    showLogin();
  }
});

// ---------- LOGIN ----------
async function doLogin(){
  const username = (document.getElementById("adminUsername").value || "").trim();
  const pw = (document.getElementById("adminPassword").value || "").trim();
  const remember = document.getElementById("remember").checked;
  if(!username || !pw) return showLoginMsg("Enter username and password");

  showLoginMsg("Signing in...");
  try{
    const res = await fetch(API_BASE + "/admin/login", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ username, password: pw })
    });
    const data = await safeJson(res);

    if(data && data.success){
      setAuthToken(data.token || "local", remember);
      document.getElementById("adminUser").innerText = username;
      showDashboard();
      loadVouchers();
      loadSales();
      showLoginMsg("");
    } else {
      showLoginMsg((data && data.message) ? data.message : "Invalid credentials");
    }
  }catch(e){
    showLoginMsg("Login error — check console");
    console.error(e);
  }
}

function showLoginMsg(m){ document.getElementById("loginMsg").innerText = m || ""; }
function showLogin(){ document.getElementById("loginPanel").classList.remove("hidden"); document.getElementById("dash").classList.add("hidden"); }
function showDashboard(){ document.getElementById("loginPanel").classList.add("hidden"); document.getElementById("dash").classList.remove("hidden"); }

// ---------------- LOGOUT ----------------
function doLogout(){
  setAuthToken(null,false);
  location.reload();
}

// ---------------- HELPERS ----------------
function authHeaders(){
  const h = {"Content-Type":"application/json"};
  if(state.token) h["Authorization"] = "Bearer " + state.token;
  return h;
}
async function safeJson(res){
  try { return await res.json(); } catch(e){ return null; }
}

// ---------------- CSV UPLOAD ----------------
async function uploadCsvHandler(){
  const f = document.getElementById("csvFile").files[0];
  if(!f) return document.getElementById("uploadCsvMsg").innerText = "Choose a CSV file";

  document.getElementById("uploadCsvMsg").innerText = "Parsing CSV...";
  const text = await f.text();
  const rows = csvToObjects(text);
  if(rows.length === 0) return document.getElementById("uploadCsvMsg").innerText = "No rows found";

  const payload = rows.map(r => ({
    serial: (r.serial||r.Serial||"").trim(),
    pin: (r.pin||r.Pin||"").trim(),
    type: (r.type||r.Type||"WASSCE").toUpperCase()
  })).filter(r => r.serial && r.pin);

  document.getElementById("uploadCsvMsg").innerText = `Uploading ${payload.length} vouchers...`;
  try{
    const res = await fetch(API_BASE + "/admin/upload", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ vouchers: payload })
    });
    const data = await safeJson(res);
    document.getElementById("uploadCsvMsg").innerText = (data && data.message) ? data.message : (data && data.success ? "Upload complete" : "Upload failed");
    await loadVouchers();
  }catch(e){
    document.getElementById("uploadCsvMsg").innerText = "Upload error";
    console.error(e);
  }
}
function csvToObjects(text){
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if(lines.length === 0) return [];
  const headers = lines[0].split(",").map(h=>h.trim());
  return lines.slice(1).map(line => {
    const cols = line.split(",");
    const obj = {};
    headers.forEach((h,i) => obj[h] = (cols[i]||"").trim());
    return obj;
  });
}

// ---------------- ADD MANUAL VOUCHER ----------------
async function addVoucherHandler(){
  const serial = document.getElementById("mSerial").value.trim();
  const pin = document.getElementById("mPin").value.trim();
  const type = document.getElementById("mType").value;
  if(!serial || !pin) { document.getElementById("addVoucherMsg").innerText = "Serial and pin required"; return; }
  document.getElementById("addVoucherMsg").innerText = "Adding...";

  try{
    const res = await fetch(API_BASE + "/admin/upload", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ vouchers: [{ serial, pin, type }] })
    });
    const data = await safeJson(res);
    document.getElementById("addVoucherMsg").innerText = (data && data.message) ? data.message : (data && data.success ? "Added" : "Failed");
    document.getElementById("mSerial").value = "";
    document.getElementById("mPin").value = "";
    await loadVouchers();
  }catch(e){
    document.getElementById("addVoucherMsg").innerText = "Error";
    console.error(e);
  }
}

// ---------------- VOUCHERS ----------------
let cachedVouchers = [];
async function loadVouchers(){
  setTableMsg("vouchersMsg","Loading vouchers...");
  try{
    const res = await fetch(API_BASE + "/admin/vouchers", { headers: authHeaders() });
    const data = await safeJson(res);
    // tolerate multiple response shapes
    cachedVouchers = data?.vouchers || data?.data || [];
    renderVouchers();
    setTableMsg("vouchersMsg","");
  }catch(e){
    setTableMsg("vouchersMsg","Error loading vouchers");
    console.error(e);
  }
}

function renderVouchers(){
  const tbody = document.querySelector("#vouchersTable tbody");
  tbody.innerHTML = "";
  const q = (document.getElementById("searchInput").value || "").toLowerCase();
  const filter = document.getElementById("filterUsed").value;

  const rows = cachedVouchers.filter(v => {
    if(filter !== "all" && String(v.used) !== filter) return false;
    if(!q) return true;
    return (v.serial||"").toLowerCase().includes(q) ||
           (v.pin||"").toLowerCase().includes(q) ||
           (v.phone||"").toLowerCase().includes(q) ||
           (v.email||"").toLowerCase().includes(q);
  });

  rows.forEach(v => {
    const tr = document.createElement("tr");
    const usedText = v.used ? "Yes" : "No";
    const actions = v.used ? "" : `<button class="action-small" onclick="markUsed(${v.id}, '${escapeHtml(v.serial)}')">Mark used</button>`;
    tr.innerHTML = `<td>${v.id}</td>
                    <td>${escapeHtml(v.serial)}</td>
                    <td>${escapeHtml(v.pin)}</td>
                    <td>${escapeHtml(v.type)}</td>
                    <td>${usedText}</td>
                    <td>${escapeHtml(v.reference || "")}</td>
                    <td>${actions}</td>`;
    tbody.appendChild(tr);
  });
}

// ---------------- MARK USED ----------------
async function markUsed(id, serial){
  if(!confirm("Mark voucher " + serial + " as used?")) return;
  try{
    const res = await fetch(API_BASE + "/admin/mark-used", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ id })
    });
    if(res.ok){
      await loadVouchers();
      alert("Marked used");
      return;
    }
  }catch(e){
    console.warn("mark-used failed, falling back to refresh");
  }
  await loadVouchers();
}

// ---------------- SALES ----------------
let cachedSales = [];
async function loadSales(){
  setTableMsg("salesMsg","Loading sales...");
  try{
    const res = await fetch(API_BASE + "/admin/sales", { headers: authHeaders() });
    const data = await safeJson(res);
    cachedSales = data?.sales || data?.data || [];
    renderSales();
    setTableMsg("salesMsg","");
  }catch(e){
    setTableMsg("salesMsg","Error loading sales");
    console.error(e);
  }
}

function renderSales(){
  const tbody = document.querySelector("#salesTable tbody");
  tbody.innerHTML = "";
  cachedSales.forEach(s => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${s.id}</td>
                    <td>${escapeHtml(s.name)}</td>
                    <td>${escapeHtml(s.phone)}</td>
                    <td>${escapeHtml(s.email)}</td>
                    <td>${escapeHtml(s.voucher_serial ? s.voucher_serial + " | " + s.voucher_pin : s.voucher)}</td>
                    <td>${escapeHtml(s.reference)}</td>
                    <td>${escapeHtml(s.date || s.time || "")}</td>`;
    tbody.appendChild(tr);
  });
}

// ---------------- EXPORT CSV ----------------
function exportCsv(rows, headers){
  const lines = [headers.join(",")].concat(rows.map(r => headers.map(h=> `"${String(r[h]||"").replace(/"/g,'""')}"`).join(",")));
  const blob = new Blob([lines.join("\n")], {type:"text/csv"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "export.csv"; document.body.appendChild(a); a.click(); a.remove();
}
function exportVouchersCsv(){
  exportCsv(cachedVouchers, ["id","serial","pin","type","used","reference"]);
}
function exportSalesCsv(){
  exportCsv(cachedSales, ["id","name","phone","email","voucher_serial","voucher_pin","reference","date"]);
}

// ---------------- UTIL ----------------
function setTableMsg(id, txt){ const el=document.getElementById(id); if(el) el.innerText = txt; }
function escapeHtml(s){ return String(s||"").replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
