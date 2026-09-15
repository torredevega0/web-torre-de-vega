/*
 * Torre de Vega — divisor de llamas (.ember-divider > canvas.ember-canvas).
 *
 * Dibuja la silueta de fuego de assets/data/fire-reference.json deformada por ondas
 * que suben; las raíces quedan unidas a la sección blanca inferior y las puntas se
 * curvan con libertad. Solo anima mientras el lienzo es visible y la pestaña activa.
 */
(() => {
  'use strict';
  const canvas = document.querySelector('.ember-canvas');
  const ctx = canvas?.getContext('2d', { alpha: false });
  if (!ctx) return;

  const scriptUrl = document.currentScript?.src || location.href;
  const DATA_URL = new URL('../data/fire-reference.json', scriptUrl);
  const TOP = '#080808';
  const FLAME = '#fff';

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let points = [];
  let sparks = [];
  let frame = 0;
  let visible = false;
  let last = 0;
  let elapsed = 0;
  let width = 1;
  let height = 1;
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

  function draw() {
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    ctx.fillStyle = TOP;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = FLAME;
    // Keep the original proportions; overlapping neighbouring roots close seams.
    const scaleY = height / 493;
    const tiles = Math.max(1, Math.round(width / (height * 2.35)));
    const tileWidth = width / tiles;
    for (let tile = -1; tile <= tiles; tile++) {
      const scaleX = tileWidth / 960;
      const phase = tile * 2.719;
      const t = elapsed + phase;
      const warped = points.map(([x, y]) => {
        const freedom = Math.pow(clamp((435 - y) / 390), 1.5);
        // Two upward-travelling bends, with slower local height changes.
        const bend = Math.sin(x * 0.012 + y * 0.013 + t * 1.75) * 14 + Math.sin(x * 0.028 + y * 0.021 + t * 2.53) * 5;
        const lift = Math.sin(x * 0.016 + t * 1.27) * 14 + Math.sin(x * 0.034 + y * 0.009 + t * 2.11) * 5;
        return [tile * tileWidth + (x - 28 + bend * freedom) * scaleX, (y + lift * freedom) * scaleY];
      });
      // Dense samples with midpoint curves retain the supplied cartoon contours.
      ctx.beginPath();
      const end = warped[warped.length - 1];
      const first = warped[0];
      ctx.moveTo((end[0] + first[0]) / 2, (end[1] + first[1]) / 2);
      for (let i = 0; i < warped.length; i++) {
        const p = warped[i];
        const next = warped[(i + 1) % warped.length];
        ctx.quadraticCurveTo(p[0], p[1], (p[0] + next[0]) / 2, (p[1] + next[1]) / 2);
      }
      ctx.closePath();
      ctx.fill();
      // Sparse, curved fragments from the same reference drift up and dissolve.
      for (let i = 0; i < sparks.length; i++) {
        const s = sparks[i];
        const life = (((elapsed * 0.23 + i * 0.173 + tile * 0.291) % 1) + 1) % 1;
        ctx.save();
        ctx.globalAlpha = Math.sin(Math.PI * life) * 0.65;
        ctx.translate(tile * tileWidth + (s.x - 28 + Math.sin(t + i) * 10) * scaleX, (s.y - life * 48) * scaleY);
        const shrink = 1 - life * 0.38;
        ctx.scale(scaleX * shrink, scaleY * shrink);
        ctx.translate(-s.x, -s.y);
        ctx.fill(s.path);
        ctx.restore();
      }
    }
    ctx.fillRect(0, height * 0.875, width, height * 0.125 + 1);
  }

  function animate(now) {
    frame = 0;
    if (last) elapsed += Math.min(60, now - last) * 0.001 * (reduce.matches ? 0.38 : 1);
    last = now;
    draw();
    if (visible && !document.hidden) frame = requestAnimationFrame(animate);
  }

  function start() {
    cancelAnimationFrame(frame);
    last = 0;
    if (!points.length) return;
    draw();
    if (visible && !document.hidden) frame = requestAnimationFrame(animate);
  }

  new ResizeObserver(() => {
    width = Math.max(1, canvas.clientWidth);
    height = Math.max(1, canvas.clientHeight);
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    start();
  }).observe(canvas);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    start();
  }, { rootMargin: '80px' }).observe(canvas);
  reduce.addEventListener('change', start);
  document.addEventListener('visibilitychange', start);

  fetch(DATA_URL)
    .then(response => {
      if (!response.ok) throw new Error('Fire reference unavailable');
      return response.json();
    })
    .then(reference => {
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      const path = document.createElementNS(ns, 'path');
      svg.setAttribute('aria-hidden', 'true');
      svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
      path.setAttribute('d', reference.silhouette);
      svg.append(path);
      document.body.append(svg);
      try {
        const length = path.getTotalLength();
        const count = Math.ceil(length / 2.5);
        points = Array.from({ length: count }, (_, i) => {
          const p = path.getPointAtLength((i * length) / count);
          return [p.x, p.y];
        });
        sparks = reference.sparks
          .filter((_, i) => i === 0 || i === 6 || i === 8)
          .map(d => {
            path.setAttribute('d', d);
            const box = path.getBBox();
            return { path: new Path2D(d), x: box.x + box.width / 2, y: box.y + box.height / 2 };
          });
      } finally {
        svg.remove();
      }
      start();
    })
    .catch(() => {
      // Without the silhouette, keep a clean dark-to-white boundary.
      ctx.fillStyle = TOP;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = FLAME;
      ctx.fillRect(0, canvas.height * 0.8, canvas.width, canvas.height * 0.2);
    });
})();
