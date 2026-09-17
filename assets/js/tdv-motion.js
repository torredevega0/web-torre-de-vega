/*
 * Torre de Vega — motor de movimiento compartido.
 *
 * Un único reloj de scroll (requestAnimationFrame, sin temporizadores ni bloqueo del
 * scroll) para las transiciones editoriales de todas las páginas:
 *   - títulos que emergen desde abajo (.editorial h2)
 *   - filas que se revelan de izquierda a derecha (.principles article, [data-reveal-row])
 *   - fotografías con apertura circular (.depth-card .card-art fuera del mosaico)
 *   - retratos del equipo que se apilan con cada capítulo (.kitchen .team-cards)
 *   - inclinación de tarjetas con el puntero y diálogo de reserva
 *
 * Otras páginas añaden efectos propios con TDV.onRender(fn), p. ej. tdv-home.js.
 */
(() => {
  'use strict';

  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = v => {
    const t = clamp(v);
    return t * t * (3 - 2 * t);
  };

  const renderers = [];
  let pending = false;

  function render() {
    pending = false;
    root.classList.toggle('scroll-ready', !reduced.matches);
    const h = innerHeight;
    for (const fn of renderers) fn(h);
  }

  function requestRender() {
    if (!pending) {
      pending = true;
      requestAnimationFrame(render);
    }
  }

  window.TDV = {
    clamp,
    smooth,
    reduced,
    requestRender,
    /** Registers a scroll renderer and repaints every renderer immediately. */
    onRender(fn) {
      renderers.push(fn);
      render();
    }
  };

  /* ---- Editorial transitions ------------------------------------------------ */

  root.classList.add('editorial-motion');

  const TEAM_TILT = [-4, 2, -2, 3];
  const stories = [...document.querySelectorAll('.kitchen')]
    .map(section => ({
      cards: [...section.querySelectorAll('.team-cards figure')],
      blocks: [...section.querySelectorAll('.principles article')]
    }))
    .filter(story => story.cards.length && story.blocks.length);
  const images = [...document.querySelectorAll('.card-art:not(.collection .card-art)')];
  const headings = [...document.querySelectorAll('.editorial h2')];
  const rows = [...document.querySelectorAll('.principles article, [data-reveal-row]')];

  function renderEditorial(h) {
    // Each portrait rises as its chapter reaches the reading line.
    for (const { cards, blocks } of stories) {
      cards.forEach((card, i) => {
        const block = blocks[Math.min(i, blocks.length - 1)];
        const t = smooth((h * 0.88 - block.getBoundingClientRect().top) / (h * 0.4));
        card.style.zIndex = String(i + 1);
        card.style.transform = `perspective(1000px) translateY(${(1 - t) * 150}px) rotateX(${(1 - t) * 18}deg) rotateZ(${TEAM_TILT[i % TEAM_TILT.length]}deg)`;
        card.style.opacity = String(t);
      });
    }
    images.forEach((art, index) => {
      const rect = art.getBoundingClientRect();
      const entry = smooth((h - rect.top) / Math.min(h * 0.65, rect.height + 100));
      art.style.clipPath = `circle(${8 + entry * 100}% at 50% 50%)`;
      art.style.backgroundSize = `auto ${145 - entry * 25}%`;
      art.style.setProperty('--entry-rotation', `${(1 - entry) * (index % 2 ? 6 : -6)}deg`);
    });
    headings.forEach(heading => {
      const rect = heading.parentElement.getBoundingClientRect();
      const entry = smooth((h - rect.top) / (h * 0.6));
      heading.style.setProperty('--heading-offset', `${(1 - entry) * 65}px`);
      heading.style.clipPath = `inset(0 0 ${(1 - entry) * 100}% 0)`;
    });
    rows.forEach(row => {
      if (row.hidden) return;
      const rect = row.getBoundingClientRect();
      const entry = smooth((h - rect.top) / (h * 0.32));
      row.style.clipPath = `inset(0 ${(1 - entry) * 100}% 0 0)`;
    });
  }

  renderers.push(renderEditorial);

  /* ---- Review compositions: dishes float, opinions drift in around them ------------- */

  const narrow = matchMedia('(max-width: 900px)');
  const reviewStages = [...document.querySelectorAll('.review-stage')].map(stage => ({
    stage,
    dishes: [...stage.querySelectorAll('.review-dish')],
    cards: [...stage.querySelectorAll('.review-card')]
  }));

  function renderReviewStages(h) {
    for (const { stage, dishes, cards } of reviewStages) {
      const rect = stage.getBoundingClientRect();
      if (rect.bottom < -h || rect.top > h * 2) continue;
      const still = reduced.matches;
      // 0 while the stage enters from below, 1 when it leaves through the top.
      const p = clamp((h - rect.top) / (h + rect.height));
      dishes.forEach((dish, i) => {
        dish.style.setProperty('--float', still ? '0px' : `${(0.5 - p) * (50 + i * 25)}px`);
      });
      cards.forEach((card, i) => {
        if (still) {
          ['--enter-x', '--float', '--enter-o'].forEach(name => card.style.removeProperty(name));
          return;
        }
        // Layout offsets, not transformed rects, so the animation never feeds back into itself.
        const entry = smooth((h * 0.95 - (rect.top + card.offsetTop)) / (h * 0.35));
        const side = card.offsetLeft + card.offsetWidth / 2 < stage.clientWidth / 2 ? -1 : 1;
        card.style.setProperty('--enter-x', narrow.matches ? '0px' : `${(1 - entry) * side * 48}px`);
        card.style.setProperty('--float', `${(1 - entry) * 36 + (0.5 - p) * (i % 2 ? -22 : 22)}px`);
        card.style.setProperty('--enter-o', String(entry));
      });
    }
  }

  if (reviewStages.length) renderers.push(renderReviewStages);

  /* ---- Fade-in blocks outside editorial sections ---------------------------- */

  const observer = new IntersectionObserver(
    entries => entries.forEach(entry => entry.target.classList.toggle('visible', entry.isIntersecting)),
    { threshold: 0.15 }
  );
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

  /* ---- Reservation dialog ---------------------------------------------------- */

  const dialog = document.getElementById('reservation');
  if (dialog && typeof dialog.showModal === 'function') {
    document.querySelectorAll('[data-open-booking]').forEach(trigger =>
      trigger.addEventListener('click', event => {
        event.preventDefault();
        dialog.showModal();
      })
    );
    dialog.querySelector('.close')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      const outside = event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom;
      if (outside) dialog.close();
    });
  }

  /* ---- Pointer tilt on photographic cards (precise pointers only) ------------ */

  document.querySelectorAll('.depth-card').forEach(card => {
    let frame;
    card.addEventListener('pointermove', event => {
      if (card.closest('.mosaic-stage') || reduced.matches || !finePointer.matches) return;
      const rect = card.getBoundingClientRect();
      const x = clamp((event.clientX - rect.left) / rect.width) - 0.5;
      const y = clamp((event.clientY - rect.top) / rect.height) - 0.5;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        card.style.transform = `perspective(1000px) rotateX(${-y * 9}deg) rotateY(${x * 12}deg) translateY(-5px)`;
      });
    });
    card.addEventListener('pointerleave', () => {
      cancelAnimationFrame(frame);
      card.style.transform = '';
    });
  });

  addEventListener('scroll', requestRender, { passive: true });
  addEventListener('resize', requestRender);
  addEventListener('load', requestRender, { once: true });
  reduced.addEventListener('change', requestRender);
  render();
})();
