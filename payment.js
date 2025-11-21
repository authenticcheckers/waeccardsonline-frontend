// -----------------------------
// CONFIGURATION
// -----------------------------
const BACKEND_URL = "https://waecghcardsonline-backend.onrender.com";
const PAYSTACK_PUBLIC_KEY = "pk_test_bee2ecea00aef3aa6df3aa70d6accfe16e94e167";

// -----------------------------
// TRIGGER PAYMENT
// -----------------------------
function startPayment() {
    const name = document.getElementById("name").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const type = document.getElementById("voucherType").value; // WASSCE or BECE

    if (!phone) {
        alert("Please enter your phone number.");
        return;
    }

    // Auto-generate email for Paystack requirement
    const email = `${phone}@autovoucher.com`;

    let handler = PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email: email,
        amount: 25 * 100, // GHS 25.00
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
// VERIFY PAYMENT WITH BACKEND
// -----------------------------
function verifyPayment(reference, name, phone, email, type) {
    fetch(`${BACKEND_URL}/verify-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({
            reference: reference,
            name,
            phone,
            email,
            type
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
