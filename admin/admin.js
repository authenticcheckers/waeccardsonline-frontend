// -------------------------------
// CONFIG
// -------------------------------
const API_BASE = "https://your-postgres-backend.onrender.com"; 
// Change to your actual backend URL

// -------------------------------
// Utility — get saved JWT token
// -------------------------------
function getToken() {
    return localStorage.getItem("authToken");
}

// -------------------------------
// Admin Login
// -------------------------------
async function adminLogin(event) {
    event.preventDefault();

    const username = document.getElementById("admin-username").value.trim();
    const password = document.getElementById("admin-password").value.trim();

    if (!username || !password) {
        alert("Enter username & password.");
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/admin/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();
        if (!res.ok) {
            alert(data.message || "Login failed");
            return;
        }

        localStorage.setItem("authToken", data.token);
        window.location.href = "dashboard.html";

    } catch (err) {
        console.error(err);
        alert("Network error. Try again.");
    }
}

// -------------------------------
// Fetch Vouchers from PostgreSQL
// -------------------------------
async function loadVouchers() {
    const token = getToken();
    if (!token) {
        alert("Not logged in");
        window.location.href = "index.html";
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/admin/vouchers`, {
            headers: { 
                Authorization: `Bearer ${token}` 
            }
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data.message || "Cannot load vouchers");
            return;
        }

        const table = document.getElementById("voucher-table-body");
        table.innerHTML = "";

        data.vouchers.forEach((v, i) => {
            const row = `
                <tr>
                    <td>${i + 1}</td>
                    <td>${v.serial}</td>
                    <td>${v.pin}</td>
                    <td>${v.created_at}</td>
                    <td>${v.sold ? "YES" : "NO"}</td>
                </tr>
            `;
            table.innerHTML += row;
        });

    } catch (err) {
        console.error(err);
        alert("Server error.");
    }
}

// -------------------------------
// Upload CSV/TXT Voucher File
// -------------------------------
async function uploadVoucherFile(event) {
    event.preventDefault();

    const token = getToken();
    if (!token) {
        alert("Not logged in");
        window.location.href = "index.html";
        return;
    }

    const fileInput = document.getElementById("voucher-file");
    if (!fileInput.files.length) {
        alert("Choose a file first.");
        return;
    }

    const formData = new FormData();
    formData.append("file", fileInput.files[0]);

    try {
        const res = await fetch(`${API_BASE}/admin/upload-vouchers`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`
            },
            body: formData
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data.message || "Upload failed");
            return;
        }

        alert(`Upload complete! ${data.inserted} vouchers added.`);
        loadVouchers();

    } catch (err) {
        console.error(err);
        alert("Upload error.");
    }
}

// -------------------------------
// Logout
// -------------------------------
function adminLogout() {
    localStorage.removeItem("authToken");
    window.location.href = "index.html";
}
