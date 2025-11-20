// -----------------------------
// CONFIGURATION
// -----------------------------
const BACKEND_URL = "https://YOUR-BACKEND-URL.onrender.com"; // <-- change this
const PAYSTACK_PUBLIC_KEY = "YOUR-PAYSTACK-PUBLIC-KEY";      // <-- change this

// -----------------------------
// TRIGGER PAYMENT
// -----------------------------
function startPayment() {
    const name = document.getElementById("name").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const email = document.getElementById("email").value.trim();

    if (!phone || !email) {
        alert("Please enter your phone and email.");
        return;
    }

    let handler = PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email: email,
        amount: 2500 * 100, // GHS 25.00
        currency: "GHS",
        metadata: {
            name: name,
            phone: phone,
            email: email,
        },

        callback: function (response) {
            verifyPayment(response.reference, name, phone, email);
        },

        onClose: function () {
            alert("Payment cancelled.");
        }
    });

    handler.openIframe();
}

// -----------------------------
// VERIFY PAYMENT WITH BACKEND
// -----------------------------
function verifyPayment(reference, name, phone, email) {
    fetch(`${BACKEND_URL}/verify-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            reference: reference,
            name: name,
            phone: phone,
            email: email
        })
    })
        .then(res => res.json())
        .then(data => {
            if (!data.success) {
                alert("Verification failed: " + data.message);
                return;
            }

            // Extract serial and pin
            const voucherText = data.voucher; // "serial | pin"
            const [serial, pin] = voucherText.split("|").map(x => x.trim());

            // Redirect to success page
            window.location.href =
                `/success.html?serial=${encodeURIComponent(serial)}&pin=${encodeURIComponent(pin)}`;
        })
        .catch((err) => {
            console.error("Verification error:", err);
            alert("Error verifying payment. Please contact support.");
        });
}
