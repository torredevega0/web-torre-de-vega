/*
 * Torre de Vega — carta editorial.
 *
 * El HTML de /carta-torre-de-vega/ es la fuente de verdad: una lista sencilla de
 * platos (<article data-category> con "NOMBRE – PRECIO") y botones de categoría.
 * Este script la convierte en capítulos con composiciones de 4 platos, recortes
 * fotográficos, buscador y filtros. Para añadir o cambiar un plato basta con editar
 * el HTML. La foto de cada plato llega en los atributos data-dish-* de su <article>
 * (valores en _herramientas/imagenes-generadas.json) y se carga con tdv-images.js.
 */
(() => {
  'use strict';
  const menu = document.querySelector('.sample-menu');
  if (!menu) return;
  document.body.classList.add('designed-menu');

  const norm = s => s.normalize('NFD').replace(/[̀-ͯ​]/g, '').toLowerCase();

  // Accompaniments are shown beside the chapter they describe.
  const CHAPTER_NOTES = [
    ['c3', 'Todas nuestras carnes van acompañadas de patatas fritas y pimiento de padrón.'],
    ['c6', 'Todos nuestros pescados van acompañados de patatas a lo pobre.']
  ];
  const DARK_CHAPTERS = [3, 6];
  const sentence = text => text.toLocaleLowerCase('es').replace(/^./, c => c.toUpperCase());

  const rows = [...menu.querySelectorAll('.menu-items > article')];
  const filters = menu.querySelector('.menu-filters');
  const buttons = [...filters.querySelectorAll('button')];
  const heading = menu.querySelector('.section-heading');

  /* ---- Toolbar: filters + search ---------------------------------------------- */

  const tools = document.createElement('div');
  tools.className = 'menu-tools';
  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'menu-search';
  search.placeholder = '¿Qué te apetece?';
  search.setAttribute('aria-label', 'Buscar un plato en la carta');
  const label = document.createElement('label');
  label.className = 'menu-search-label';
  label.append(search);
  tools.append(filters, label);
  heading.after(tools);

  /* ---- Chapters ---------------------------------------------------------------- */

  const sections = buttons
    .filter(button => button.dataset.filter !== 'all')
    .map((button, i) => {
      const section = document.createElement('section');
      section.className = 'menu-chapter' + (DARK_CHAPTERS.includes(i) ? ' chapter-dark' : '');
      section.dataset.category = button.dataset.filter;
      section.id = 'carta-' + button.dataset.filter;
      const h2 = document.createElement('h2');
      h2.textContent = sentence(button.textContent);
      h2.id = section.id + '-title';
      section.setAttribute('aria-labelledby', h2.id);
      const list = document.createElement('div');
      list.className = 'chapter-dishes';
      section.append(h2, list);
      return section;
    });
  const catalogue = document.createElement('div');
  catalogue.className = 'menu-catalogue';
  catalogue.append(...sections);
  menu.querySelector('.menu-items').before(catalogue);

  rows.forEach(row => {
    const title = row.querySelector('h3');
    const original = title.textContent.replace(/​/g, '');
    row.dataset.search = norm(original);
    const match = original.match(/^(.*?)[–-]\s*(\d[\s\S]*)$/);
    if (match) {
      title.textContent = sentence(match[1].trim());
      const price = document.createElement('strong');
      price.className = 'dish-price';
      price.textContent = match[2].trim().replace(/(\d)\.\s*(\d{1,2})/g, '$1,$2') + ' €';
      row.querySelector('div').append(price);
    }
    row.querySelector(':scope > span')?.remove();
    row.querySelector('small')?.remove();

    // Only the photograph assigned to this dish in the HTML; never a neighbour's.
    const { dishSrc, dishW, dishRatio, dishLqip } = row.dataset;
    if (dishSrc && dishW) {
      const img = document.createElement('img');
      img.className = 'tdv-img';
      img.src = dishLqip || `${dishSrc}-${dishW.split(',')[0]}.webp`;
      img.dataset.tdvSrc = dishSrc;
      img.dataset.tdvW = dishW;
      if (dishRatio) img.dataset.tdvRatio = dishRatio;
      img.alt = title.textContent;
      img.decoding = 'async';
      img.width = 320;
      img.height = 320;
      const visual = document.createElement('div');
      visual.className = 'dish-visual';
      visual.append(img);
      row.prepend(visual);
      row.classList.add('dish-illustrated');
    }
    row.classList.add('menu-dish');
    sections.find(section => section.dataset.category === row.dataset.category)?.querySelector('.chapter-dishes').append(row);
  });
  menu.querySelector('.menu-items').remove();

  // Alternate composed spreads throughout each category, instead of a separate gallery.
  sections.forEach(section => {
    const list = section.querySelector('.chapter-dishes');
    const dishes = [...list.children];
    for (let i = 0; i < dishes.length; i += 4) {
      const group = dishes.slice(i, i + 4);
      const spread = document.createElement('div');
      spread.className = 'menu-spread';
      spread.dataset.side = (i / 4) % 2 ? 'right' : 'left';
      const featured = group.find(row => row.classList.contains('dish-illustrated'));
      if (featured) {
        featured.classList.add('spread-feature');
        spread.append(featured);
      } else {
        spread.classList.add('spread-text-only');
      }
      const companions = document.createElement('div');
      companions.className = 'spread-companions';
      group.filter(row => row !== featured).forEach(row => companions.append(row));
      if (companions.children.length) spread.append(companions);
      list.append(spread);
    }
  });

  CHAPTER_NOTES.forEach(([id, text]) => {
    const note = document.createElement('p');
    note.className = 'chapter-note';
    note.textContent = text;
    sections.find(section => section.dataset.category === id)?.append(note);
  });
  menu.querySelectorAll(':scope > p:not(.menu-status)').forEach(p => p.remove());
  const status = menu.querySelector('.menu-status');
  tools.after(status);

  /* ---- Filtering ---------------------------------------------------------------- */

  let selected = 'all';
  function applyFilter() {
    const query = norm(search.value.trim());
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === selected)));
    rows.forEach(row => {
      row.hidden = (selected !== 'all' && row.dataset.category !== selected) || !row.dataset.search.includes(query);
    });
    sections.forEach(section => {
      section.querySelectorAll('.menu-spread').forEach(spread => {
        spread.hidden = ![...spread.querySelectorAll('.menu-dish')].some(row => !row.hidden);
        spread.classList.toggle('feature-hidden', !!spread.querySelector('.spread-feature[hidden]'));
        const companions = spread.querySelector('.spread-companions');
        if (companions) companions.hidden = ![...companions.querySelectorAll('.menu-dish')].some(row => !row.hidden);
      });
      section.hidden = ![...section.querySelectorAll('.menu-dish')].some(row => !row.hidden);
    });
    const count = rows.filter(row => !row.hidden).length;
    status.textContent = count
      ? count === 1 ? '1 resultado' : count + ' platos y complementos'
      : 'No encontramos ese plato. Prueba otro nombre o categoría.';
    status.classList.toggle('is-empty', count === 0);
  }

  buttons.forEach(button =>
    button.addEventListener('click', () => {
      selected = button.dataset.filter;
      applyFilter();
      tools.scrollIntoView({ block: 'start', behavior: 'instant' });
    })
  );
  search.addEventListener('input', applyFilter);
  applyFilter();
})();
