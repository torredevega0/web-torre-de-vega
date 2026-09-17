/**
 * Torre de Vega — carrusel 3D de reseñas guiado por el scroll, sin dependencias.
 *
 *   <div class="review-scroll">          recorrido: su altura es el scroll que dura el carrusel
 *     <div class="review-pin">           se queda fijo en pantalla (sticky) durante el recorrido
 *       <h2>…</h2>
 *       <carousel-3d>
 *         <figure><blockquote><p>«…»</p></blockquote><figcaption>Nombre</figcaption></figure>
 *       </carousel-3d>
 *
 * Al bajar, el anillo gira y cada reseña se detiene un momento delante; cuando ha pasado la
 * última, la página continúa. El componente marca el recorrido con .is-pinned y --reviews
 * (número de reseñas) y la altura se calcula en tdv-home.css. Sin JavaScript, las reseñas
 * se ven como una rejilla normal y no hay recorrido.
 *
 * Tamaño: las tarjetas se calculan con el ancho y el alto disponibles (layout), así que el texto
 * crece en pantallas grandes y cabe entero en móvil.
 */
class Carousel3D extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.angle = 0;
    this.shadowRoot.innerHTML = `
      <style>
        :host{display:block;position:relative;width:100%;height:600px;contain:layout paint;--card-width:420px;--card-height:230px;--review-font:18px;--gold:#ccad60}
        *{box-sizing:border-box}
        .viewport{position:absolute;inset:0;overflow:hidden;perspective:1600px}
        .world,.ring{position:absolute;left:50%;top:50%;width:0;height:0;transform-style:preserve-3d}
        .world{transform:rotateZ(-4deg) rotateY(-14deg)}
        .card{position:absolute;width:var(--card-width);height:var(--card-height);left:calc(var(--card-width) / -2);top:calc(var(--card-height) / -2);transform-style:preserve-3d}
        .face{position:absolute;inset:0;overflow:hidden;border-radius:11px;backface-visibility:hidden;background:linear-gradient(135deg,#1f2020,#111212);border:1px solid #ffffff26;border-left:2px solid var(--gold);box-shadow:0 14px 30px #0006}
        .back{transform:rotateX(180deg)}
        figure{margin:0;height:100%;display:flex;flex-direction:column;justify-content:space-between;gap:.6em;padding:1.5em 1.6em 1.3em;color:#fff;font-size:var(--review-font);user-select:none}
        blockquote,p{margin:0}
        p{font:400 1em/1.5 "Open Sans",sans-serif}
        figcaption{color:var(--gold);font:700 .68em Raleway,sans-serif;letter-spacing:.12em;text-transform:uppercase}
        figcaption::before{content:"— "}
        .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
      </style>
      <div class="viewport" aria-hidden="true">
        <div class="world"><div class="ring"></div></div>
      </div>
      <ul class="sr" aria-label="Opiniones de clientes"></ul>`;
    this.ring = this.shadowRoot.querySelector('.ring');
    this.world = this.shadowRoot.querySelector('.world');
    this.schedule = () => {
      if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.update(); });
    };
  }
  connectedCallback() {
    if (!this.cards) this.build();
    this.runway = this.closest('.review-scroll');
    if (this.runway) {
      this.runway.style.setProperty('--reviews', String(this.cards.length));
      this.runway.classList.add('is-pinned');
    }
    this.resize = new ResizeObserver(() => { this.layout(); this.schedule(); });
    this.resize.observe(this);
    addEventListener('scroll', this.schedule, { passive: true });
    addEventListener('resize', this.schedule);
    this.schedule();
  }
  disconnectedCallback() {
    cancelAnimationFrame(this.frame); this.frame = 0; this.resize?.disconnect();
    removeEventListener('scroll', this.schedule); removeEventListener('resize', this.schedule);
    this.runway?.classList.remove('is-pinned');
  }
  build() {
    const items = [...this.children].filter(el => el.matches('figure'));
    const list = this.shadowRoot.querySelector('ul'); list.replaceChildren();
    this.ring.replaceChildren();
    this.cards = items.map(item => {
      const card = document.createElement('div'); card.className = 'card';
      for (const back of [false,true]) {
        const face = document.createElement('div'); face.className = `face${back?' back':''}`;
        face.append(item.cloneNode(true)); card.append(face);
      }
      const quote = item.querySelector('blockquote')?.textContent.trim() || '';
      const author = item.querySelector('figcaption')?.lastChild?.textContent.trim() || '';
      const li = document.createElement('li'); li.textContent = author ? `${quote} — ${author}` : quote; list.append(li);
      this.ring.append(card); return card;
    });
    this.layout();
  }
  layout() {
    const width = this.clientWidth, height = this.clientHeight;
    if (!width || !height) return;
    const count = Math.max((this.cards || []).length,3);
    const perspective = 1600;
    // Cards as wide as the space allows (up to 560px); tall enough for the longest review.
    let cardW = Math.min(560,width*0.8);
    let cardH = Math.max(cardW*0.52,190);
    let radius = (cardH+18)/(2*Math.tan(Math.PI/count));
    // The top and bottom cards may be cropped: they lean away from the reader.
    const fitH = height/(1.55*radius+cardH+24);
    // Less tilt on narrow screens; the tilt shifts the front card sideways by about r·sin(tilt).
    const tilt = width < 600 ? 6 : 14;
    this.world.style.transform = `rotateZ(${-tilt*0.3}deg) rotateY(${-tilt}deg)`;
    const spread = cardW + 2*radius*Math.sin(tilt*Math.PI/180);
    const fitW = width*0.94/(spread*perspective/(perspective-radius));
    const fit = Math.min(fitH,fitW,1);
    cardW *= fit; cardH *= fit; radius *= fit;
    this.radius = radius;
    this.style.setProperty('--card-width',`${cardW}px`);
    this.style.setProperty('--card-height',`${cardH}px`);
    this.style.setProperty('--review-font',`${Math.min(Math.max(cardW/25,13),22)}px`);
    this.draw();
  }
  update() {
    const count = (this.cards || []).length;
    if (!count) return;
    let position = 0;
    if (this.runway) {
      const rect = this.runway.getBoundingClientRect();
      const distance = rect.height - innerHeight;
      const progress = distance > 0 ? Math.min(Math.max(-rect.top/distance,0),1) : 0;
      // Every review rests in front for a moment, then the ring turns to the next one.
      const steps = count - 1;
      const x = progress*steps;
      const index = Math.min(Math.floor(x),steps-1);
      const t = Math.min(Math.max((x-index-0.18)/0.64,0),1);
      position = steps > 0 ? index + t*t*(3-2*t) : 0;
    }
    this.angle = position*360/count;
    this.draw();
  }
  draw() {
    (this.cards || []).forEach((card,index) => {
      const angle = this.angle - index*360/this.cards.length;
      card.style.transform = `rotateX(${angle}deg) translateZ(${this.radius}px)`;
      const depth = Math.cos(angle*Math.PI/180);
      for (const face of card.children) {
        face.style.filter = `blur(${Math.max(0,-depth)*1.6}px) brightness(${0.7+Math.max(0,depth)*0.3})`;
      }
    });
  }
}
if (!customElements.get('carousel-3d')) customElements.define('carousel-3d',Carousel3D);
