/*
 * Torre de Vega — formulario de contacto sin servidor.
 *
 * La web es estática: no guarda ni envía datos a ningún servidor propio. El
 * formulario compone el mensaje y lo abre en WhatsApp (por defecto) o en la
 * aplicación de correo del visitante. Sin JavaScript, el formulario envía el
 * campo "text" directamente a wa.me.
 */
(() => {
  'use strict';
  const form = document.querySelector('[data-contact-form]');
  if (!form) return;

  const PHONE = form.dataset.whatsapp;
  const EMAIL = form.dataset.email;
  const status = form.querySelector('[data-form-status]');
  const value = (id, max) => (form.querySelector('#' + id)?.value || '').trim().slice(0, max);

  // Email is only offered when the script can compose it properly.
  form.querySelectorAll('[data-requires-js]').forEach(el => {
    el.hidden = false;
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const name = value('contact-name', 80);
    const email = value('contact-email', 120);
    const message = value('contact-message', 1500);
    const body = `Hola, soy ${name}${email ? ` (${email})` : ''}.\n\n${message}`;

    if (event.submitter?.value === 'email') {
      const subject = encodeURIComponent('Consulta desde la web de Torre de Vega');
      location.href = `mailto:${EMAIL}?subject=${subject}&body=${encodeURIComponent(body)}`;
      status.textContent = 'Abriendo tu aplicación de correo…';
    } else {
      window.open(`https://wa.me/${PHONE}?text=${encodeURIComponent(body)}`, '_blank', 'noopener');
      status.textContent = 'Abriendo WhatsApp con tu mensaje…';
    }
  });
})();
