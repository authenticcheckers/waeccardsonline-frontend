// -----------------------------
// CONFIGURATION
// -----------------------------
const BACKEND_URL = "https://waecghcardsonline-backend.onrender.com"; 
const PAYSTACK_PUBLIC_KEY = "pk_live_35ae3de1d58c5051f8a2666fe8ce7a5076d47e65";

// -----------------------------
// START PAYMENT
// -----------------------------
function startPayment() {
    const name = document.getElementById("name").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const email = document.getElementById("email").value.trim();
    const type = document.getElementById("voucherType").value;

    if (!phone || !email) {
        alert("Please enter your phone and email.");
        return;
    }

    let handler = PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email: email,
        amount: 25 * 100,
        currency: "GHS",

        metadata: {
            custom_fields: [
                { display_name: "name", variable_name: "name", value: name },
                { display_name: "phone", variable_name: "phone", value: phone },
                { display_name: "voucher_type", variable_name: "voucher_type", value: type }
            ]
        },

        callback: function (response) {
            verifyPayment(response.reference, name, phone, email, type);
        },

        onClose: function () {
            alert("Payment cancelled.");
        }
    });

    handler.openIframe();
}

// -----------------------------
// VERIFY PAYMENT
// -----------------------------
function verifyPayment(reference, name, phone, email, type) {
    fetch(`${BACKEND_URL}/verify-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference, name, phone, email, type })
    })
        .then(res => res.json())
        .then(data => {
            if (!data.success) {
                alert("Verification failed: " + data.message);
                return;
            }

            const [serial, pin] = data.voucher.split("|").map(x => x.trim());

            window.location.href = `/success.html?serial=${encodeURIComponent(serial)}&pin=${encodeURIComponent(pin)}`;
        })
        .catch(err => {
            console.error("Verification error:", err);
            alert("Error verifying payment. Please contact support.");
        });
}
