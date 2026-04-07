(function () {
  const form = document.querySelector("[data-registration-form]");
  const status = document.querySelector("[data-form-status]");
  const submitButton = document.querySelector("[data-submit-button]");

  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      status.textContent = "";
      status.dataset.state = "";

      const formData = new FormData(form);
      const payload = {
        email: String(formData.get("email") || ""),
        amazonOrderId: String(formData.get("amazonOrderId") || ""),
        acceptTerms: formData.get("acceptTerms") === "on",
        acceptPrivacy: formData.get("acceptPrivacy") === "on",
        website: String(formData.get("website") || "")
      };

      submitButton.disabled = true;
      submitButton.textContent = "Activating...";

      try {
        const response = await fetch("/api/registrations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Something went wrong. Please try again.");
        }

        sessionStorage.setItem(
          "katbuu-warranty",
          JSON.stringify({
            email: payload.email,
            orderId: payload.amazonOrderId
          })
        );

        window.location.href = data.duplicate ? "/success?duplicate=1" : "/success";
      } catch (error) {
        status.textContent = error.message;
        status.dataset.state = "error";
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Activate Warranty";
      }
    });
  }

  const successEmail = document.querySelector("[data-success-email]");
  const successOrderId = document.querySelector("[data-success-order-id]");
  const duplicateNote = document.querySelector("[data-duplicate-note]");

  if (successEmail || successOrderId || duplicateNote) {
    try {
      const stored = JSON.parse(sessionStorage.getItem("katbuu-warranty") || "{}");
      if (successEmail) successEmail.textContent = stored.email || "your email address";
      if (successOrderId) successOrderId.textContent = stored.orderId || "your Amazon order ID";
    } catch {
      if (successEmail) successEmail.textContent = "your email address";
      if (successOrderId) successOrderId.textContent = "your Amazon order ID";
    }

    if (duplicateNote) {
      duplicateNote.hidden = new URLSearchParams(window.location.search).get("duplicate") !== "1";
    }
  }
})();
