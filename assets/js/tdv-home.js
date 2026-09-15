/*
 * Torre de Vega — transiciones exclusivas de la portada. Requiere tdv-motion.js.
 *
 *   1. Apertura: el hero se disuelve y su fotografía viaja hasta el bloque
 *      "Carnes a la brasa" (.opening).
 *   2. Mosaico: las seis fotografías caen en 3D y se asientan en retícula (.collection).
 *   3. Portal: anillos tipográficos giran y un iris negro se abre hasta revelar la
 *      reserva (.ritual + .booking).
 *
 * Cada bloque es independiente: si falta su HTML, simplemente no se activa.
 */
(() => {
  'use strict';
  if (!window.TDV) return;
  const { clamp, smooth, reduced, onRender, requestRender } = window.TDV;
  const scrollBehavior = () => (reduced.matches ? 'instant' : 'smooth');

  /* ---- 1. Opening: shared photograph from cover to introduction ------------- */

  function initOpening() {
    const opening = document.querySelector('.opening');
    if (!opening) return null;
    const pin = opening.querySelector('.opening-pin');
    const stage = opening.querySelector('.stage');
    const hero = opening.querySelector('.hero');
    const about = opening.querySelector('.about');
    const target = about.querySelector('.food-image');
    const track = about.querySelector('.ingredient-track');

    opening.classList.add('opening-portal');
    const heroPhoto = hero.querySelector('.hero-photo');
    const sharedPhoto = document.createElement('div');
    sharedPhoto.className = 'shared-food-photo';
    sharedPhoto.setAttribute('aria-hidden', 'true');
    // Mirrors whatever version of the cover photograph tdv-images.js is showing, so the
    // travelling photo never triggers a download of its own.
    if (heroPhoto?.dataset.tdvSrc) {
      sharedPhoto.classList.add('tdv-bg');
      const mirror = () => sharedPhoto.style.setProperty('--tdv-img', heroPhoto.style.getPropertyValue('--tdv-img'));
      mirror();
      new MutationObserver(mirror).observe(heroPhoto, { attributes: true, attributeFilter: ['style'] });
    }
    stage.append(sharedPhoto);

    document.querySelectorAll('a[href="#about"]').forEach(link =>
      link.addEventListener('click', event => {
        event.preventDefault();
        scrollTo({ top: opening.offsetTop + (opening.offsetHeight - pin.offsetHeight) * 0.85, behavior: scrollBehavior() });
      })
    );

    return () => {
      const box = opening.getBoundingClientRect();
      const pinTop = parseFloat(getComputedStyle(pin).top) || 0;
      const p = clamp((pinTop - box.top) / Math.max(1, opening.offsetHeight - pin.offsetHeight));
      const dissolve = smooth((p - 0.08) / 0.24);
      const reframe = smooth((p - 0.24) / 0.48);
      const copyArrival = smooth((p - 0.58) / 0.22);

      about.style.clipPath = 'none';
      about.style.setProperty('--panel-opacity', String(smooth((p - 0.2) / 0.2)));
      about.style.setProperty('--panel-blur', '0px');
      about.style.setProperty('--copy-arrival', '1');
      about.style.setProperty('--copy-offset', '0px');
      hero.style.setProperty('--panel-opacity', String(1 - dissolve));
      hero.style.setProperty('--panel-blur', '0px');

      const targetBox = target.getBoundingClientRect();
      const stageBox = stage.getBoundingClientRect();
      sharedPhoto.style.opacity = String(dissolve);
      sharedPhoto.style.left = `${(targetBox.left - stageBox.left - stage.clientLeft) * reframe}px`;
      sharedPhoto.style.top = `${(targetBox.top - stageBox.top - stage.clientTop) * reframe}px`;
      sharedPhoto.style.width = `${stage.clientWidth + (targetBox.width - stage.clientWidth) * reframe}px`;
      sharedPhoto.style.height = `${stage.clientHeight + (targetBox.height - stage.clientHeight) * reframe}px`;
      sharedPhoto.style.filter = `brightness(${0.55 + 0.45 * reframe})`;
      sharedPhoto.style.borderRadius = `${reframe * 6}px`;

      about.inert = copyArrival < 0.8;
      hero.inert = dissolve >= 0.6;
      if (track) track.style.transform = `translateX(${-clamp((p - 0.6) / 0.4) * 120}px)`;
    };
  }

  /* ---- 2. Mosaic: photographs fall into a tilted grid ------------------------ */

  function initMosaic() {
    const mosaic = document.querySelector('.collection .experience-grid');
    if (!mosaic) return null;
    const cards = [...mosaic.children];
    const runway = document.createElement('div');
    runway.className = 'mosaic-runway';
    mosaic.before(runway);
    runway.append(mosaic);
    mosaic.classList.add('mosaic-stage');
    cards.forEach((card, i) => {
      card.style.zIndex = String(i + 1);
    });
    const ANGLES = [-4, 3, -2, 3, -3, 4];

    return h => {
      // Begin before pinning, so the first photograph accompanies the introduction.
      const progress = clamp(
        (h * 0.85 - runway.getBoundingClientRect().top) /
          Math.max(1, runway.offsetHeight - mosaic.offsetHeight + h * 0.85 - 24)
      );
      cards.forEach((card, i) => {
        const enter = smooth((progress - i * 0.125) / 0.26);
        const side = i % 2 ? 1 : -1;
        card.style.setProperty('--card-y', `${(1 - enter) * (h + 120)}px`);
        card.style.setProperty('--card-angle', `${ANGLES[i % ANGLES.length] + (1 - enter) * 14 * side}deg`);
        card.style.setProperty('--card-scale', String(0.85 + 0.15 * enter));
        card.style.setProperty('--card-tilt', `${(1 - enter) * 24}deg`);
        card.style.setProperty('--card-yaw', `${(1 - enter) * 12 * side}deg`);
        card.style.setProperty('--card-depth', `${(1 - enter) * -180}px`);
        card.inert = enter < 0.85;
      });
    };
  }

  /* ---- 3. Portal: typographic rings and black iris into the booking panel ---- */

  function initPortal() {
    const ritual = document.querySelector('.ritual');
    const booking = document.querySelector('.booking');
    if (!ritual || !booking) return null;
    const pin = ritual.querySelector('.ritual-pin');
    const iris = ritual.querySelector('.iris');
    const rings = [...ritual.querySelectorAll('.text-ring')];
    const orbits = [...ritual.querySelectorAll('.orbit')];
    const RING_TEXT = 'TORRE DE VEGA · COCINA CASERA · '.repeat(3);
    const RING_ROTATION = [-18, 24, -8];
    const RING_TRAVEL = [280, -220, 180];

    ritual.querySelector('.booking-preview')?.remove();
    pin.append(booking);
    ritual.classList.add('portal-ready', 'portal-motion');

    // Continuous type on a circular baseline (circumference of r=182 is 1143.54).
    rings.forEach((ring, index) => {
      ring.innerHTML = `<svg viewBox="0 0 400 400" aria-hidden="true"><defs><path id="type-orbit-${index}" d="M200,18 a182,182 0 1,1 0,364 a182,182 0 1,1 0,-364"/></defs><text><textPath href="#type-orbit-${index}" textLength="1143.54" lengthAdjust="spacing"></textPath></text></svg>`;
      ring.querySelector('textPath').textContent = RING_TEXT;
    });

    const bookingTop = () => ritual.offsetTop + ritual.offsetHeight - pin.offsetHeight - (parseFloat(getComputedStyle(pin).top) || 0);
    document.querySelectorAll('a[href="#book"]').forEach(link =>
      link.addEventListener('click', event => {
        event.preventDefault();
        scrollTo({ top: bookingTop(), behavior: scrollBehavior() });
      })
    );
    if (location.hash === '#book') requestAnimationFrame(() => scrollTo({ top: bookingTop(), behavior: 'instant' }));

    // Resolve deep links after the sticky layout and fonts have settled.
    const alignPortalLink = () => {
      if (location.hash !== '#ingredients') return;
      const top = parseFloat(getComputedStyle(pin).top) || 0;
      scrollTo({ top: ritual.getBoundingClientRect().top + scrollY - top, behavior: 'instant' });
      requestRender();
    };
    addEventListener('load', alignPortalLink, { once: true });
    document.fonts?.ready.then(alignPortalLink);

    return () => {
      const box = ritual.getBoundingClientRect();
      const pinTop = parseFloat(getComputedStyle(pin).top) || 0;
      const q = clamp((pinTop - box.top) / Math.max(1, ritual.offsetHeight - pin.offsetHeight));
      const zoom = 0.85 + 3.2 * q;

      rings.forEach((ring, i) => {
        ring.style.setProperty('--portal-transform', `rotate(${RING_ROTATION[i] + q * RING_TRAVEL[i]}deg) scale(${zoom})`);
        ring.style.opacity = '1';
      });
      orbits.forEach((orbit, i) => {
        orbit.style.transform = `scale(${0.45 + smooth(q / 0.58) * 3.8}) rotate(${q * 65 * (i ? -1 : 1)}deg)`;
        orbit.style.opacity = String(1 - smooth((q - 0.4) / 0.18));
      });

      // Hold the small central dot before it opens rapidly to cover every corner.
      const dot = 12 + 28 * smooth(q / 0.4);
      const cover = Math.hypot(pin.clientWidth, pin.clientHeight) + 8;
      const diameter = dot + (cover - dot) * Math.pow(smooth((q - 0.4) / 0.47), 2);
      iris.style.setProperty('--portal-transform', `scale(${diameter / 100})`);
      booking.style.clipPath = `circle(${diameter / 2}px at 50% 50%)`;
      booking.inert = q < 0.82;
    };
  }

  [initOpening(), initMosaic(), initPortal()].filter(Boolean).forEach(onRender);
})();
