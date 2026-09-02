export function initializeContactForm() {
  const form = document.querySelector('#contactForm');
  if (!form) return;

  const submitButton = form.querySelector('[type="submit"]');
  const loader = document.querySelector('#image-loader');
  const warning = document.querySelector('#message-warning');
  const success = document.querySelector('#message-success');
  const originalButtonLabel = submitButton.value;

  function hideMessages() {
    warning.classList.remove('is-visible');
    success.classList.remove('is-visible');
  }

  function getErrorMessage(payload) {
    if (Array.isArray(payload?.errors) && payload.errors.length) {
      return payload.errors.map((error) => error.message).filter(Boolean).join(' ');
    }
    return 'Your message could not be sent. Please try again or email me directly.';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideMessages();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    submitButton.disabled = true;
    submitButton.value = 'Sending...';
    loader.classList.add('is-visible');

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
      });

      let payload = {};
      try {
        payload = await response.json();
      } catch {
        // Some endpoint failures return HTML rather than JSON.
      }

      if (!response.ok) {
        throw new Error(getErrorMessage(payload));
      }

      form.reset();
      success.classList.add('is-visible');
    } catch (error) {
      warning.textContent = error.message || getErrorMessage();
      warning.classList.add('is-visible');
    } finally {
      loader.classList.remove('is-visible');
      submitButton.disabled = false;
      submitButton.value = originalButtonLabel;
    }
  });
}
