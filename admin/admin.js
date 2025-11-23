// ================================
// CONFIG
// ================================
const API_BASE = "https://waecghcardsonline-backend.onrender.com";

// ================================
// LOGIN
// ================================
async function doLogin() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!username || !password) {
    alert("Enter username and password");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (!data.success) {
      alert("Invalid login");
      return;
    }

    document.getElementById("loginSection").style.display = "none";
    document.getElementById("dashboard").style.display = "block";

    loadVouchers();
    loadSales();
  } catch (err) {
    console.error(err);
    alert("Login failed.");
  }
}

// ================================
// LOAD VOUCHERS
// ================================
async function loadVouchers() {
  try {
    const res = await fetch(`${API_BASE}/admin/vouchers`);
    const data = await res.json();

    const table = document.getElementById("voucherTable");
    table.innerHTML = "";

    if (!data.success) {
      table.innerHTML = "<tr><td colspan='6'>Error loading</td></tr>";
      return;
    }

  data.data.forEach((v, i) => {
  table.innerHTML += `
    <tr>
      <td>${i + 1}</td>
      <td>${v.serial}</td>
      <td>${v.pin}</td>
      <td>${v.type}</td>
      <td>${v.used ? "Used" : "Unused"}</td>
      <td>
        ${v.used ? "" : `<button onclick="markAsUsed('${v.serial}')">Mark Used</button>`}
      </td>
    </tr>
  `;
});

  } catch (err) {
    console.error("loadVouchers error:", err);
    alert("Failed to load vouchers");
  }
}

// ================================
// MARK USED
// ================================
async function markAsUsed(serial) {
  if (!confirm(`Mark ${serial} as used?`)) return;

  const res = await fetch(`${API_BASE}/admin/mark-used`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ serial })
  });

  const data = await res.json();
  alert(data.message);

  if (data.status) loadVouchers();
}


// ================================
// LOAD SALES
// ================================
async function loadSales() {
  try {
    const res = await fetch(`${API_BASE}/admin/sales`);
    const data = await res.json();

    const table = document.getElementById("salesTable");
    table.innerHTML = "";

    if (!data.success) {
      table.innerHTML = "<tr><td colspan='7'>Error loading</td></tr>";
      return;
    }

    data.data.forEach((s, i) => {
      table.innerHTML += `
        <tr>
          <td>${i + 1}</td>
          <td>${s.name}</td>
          <td>${s.phone}</td>
          <td>${s.email}</td>
          <td>${s.voucher_serial}</td>
          <td>${s.voucher_pin}</td>
          <td>${s.date}</td>
        </tr>
      `;
    });
  } catch (err) {
    console.error("loadSales error:", err);
    alert("Failed to load sales");
  }
}

// ================================
// UPLOAD VOUCHERS
// ================================
async function addVoucherHandler() {
  const serial = document.getElementById("newSerial").value.trim();
  const pin = document.getElementById("newPin").value.trim();
  const type = document.getElementById("newType").value.trim().toUpperCase();

  if (!serial || !pin) {
    alert("Enter serial and pin");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/admin/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vouchers: [
          { serial, pin, type: type || "WASSCE" }
        ]
      })
    });

    const data = await res.json();

    if (!data.success) {
      alert("Upload failed");
      return;
    }

    alert("Voucher uploaded!");
    loadVouchers();

    document.getElementById("newSerial").value = "";
    document.getElementById("newPin").value = "";
  } catch (err) {
    console.error("Upload error:", err);
    alert("Failed to upload voucher");
  }
}

window.doLogin = doLogin;
window.addVoucherHandler = addVoucherHandler;
window.markUsed = markUsed;
