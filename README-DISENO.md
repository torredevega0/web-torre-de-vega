# Torre de Vega — diseño editorial sobre la exportación de WordPress

Web estática (exportada con Simply Static) con la estética, transiciones y efectos de la
web de referencia, conservando lo que WordPress aportaba de SEO e integraciones.
HTML, CSS y JavaScript nativos, sin dependencias ni paso de compilación.

Se sirve desde la **raíz del dominio** (las rutas son absolutas: `/assets/...`,
`/carta-torre-de-vega/`). Para probar en local:

```bash
python -m http.server 8080
# abrir http://localhost:8080/
```

## Estructura

```
index.html                              Portada
torre-de-vega-sobre-nosotros/index.html Sobre nosotros
carta-torre-de-vega/index.html          Carta
torre-de-vega-resenas/index.html        Reseñas
contacto-torre-de-vega/index.html       Contacto (formulario sin servidor)
aviso-legal/ politica-de-privacidad/ politica-de-cookies/   Legales
author/.../index.html                   Archivo de autor (Rank Math lo incluye en el sitemap)
carta-torre-de-vega-con-imagenes/       Redirección a la carta (era un duplicado)

assets/
  css/
    tdv-core.css          Base del diseño (tokens, tipografía, componentes). Capas en cascada: NO reordenar.
    tdv-home.css          Cristal del hero, carrusel, llamas, reserva, contacto (portada + interiores)
    tdv-pages.css         Componentes de páginas interiores, formulario, legales
    tdv-carta.css         Carta editorial
    tdv-integrations.css  Aspecto de WhatsApp y GTranslate
    tdv-images.css        Miniaturas difuminadas de las fotos (imágenes adaptativas)
  js/
    tdv-motion.js         Motor de scroll compartido (títulos, filas, fotos circulares, equipo, diálogo)
    tdv-home.js           Solo portada: apertura con foto compartida, mosaico 3D, portal circular
    tdv-embers.js         Divisor de llamas en canvas
    tdv-carta.js          Capítulos, recortes, buscador y filtros de la carta
    tdv-contact.js        Formulario → WhatsApp o correo
    tdv-integrations.js   Google Analytics (Site Kit) y ajustes de GTranslate
    tdv-images.js         Carga de fotos según la cobertura (ver "Imágenes adaptativas")
  img/fotos, img/equipo, img/carta   Fotos WebP en tres tamaños (generadas: no editar a mano)
  data/fire-reference.json  Silueta de las llamas

sw-imagenes.js                          Service worker: guarda las fotos y las sirve sin cobertura
_herramientas/                          Generador de imágenes y originales (no hace falta en el servidor)
```

`wp-content/` y `wp-includes/` no se han modificado.

## Qué página usa qué

| Página | CSS | JS |
| --- | --- | --- |
| Portada | core, home | motion, home, embers |
| Sobre nosotros / Reseñas | core, home, pages | motion, embers |
| Contacto | core, home, pages | motion, embers, contact |
| Carta | core, carta, pages | carta |
| Legales / autor | core, pages | — |

Todas cargan además `tdv-integrations.css/js`, el plugin de WhatsApp y GTranslate. Las que tienen
fotos (todas salvo legales y autor) cargan también `tdv-images.css/js`.

## Cómo editar

- **Textos**: directamente en el HTML de cada página.
- **Cabecera y pie**: están repetidos en cada página. Si cambias el menú o los enlaces legales,
  cámbialos en `index.html`, `torre-de-vega-sobre-nosotros`, `torre-de-vega-resenas`,
  `contacto-torre-de-vega`, la carta y las tres páginas legales.
- **Platos de la carta**: edita la lista `<div class="menu-items">` de `carta-torre-de-vega/index.html`
  con el formato `NOMBRE – PRECIO`. La foto de un plato va en los atributos `data-dish-*` de su
  `<article>` (ver "Imágenes adaptativas").
- **Fotos**: ninguna página enlaza un archivo de imagen directamente; ver "Imágenes adaptativas".
- **Caché**: los archivos se enlazan con `?v=20260915`. Tras editar un CSS o JS, cambia ese
  número en las páginas para que los visitantes reciban la versión nueva.

## Imágenes adaptativas (buena o mala cobertura)

Cada foto existe en tres tamaños (ligero, medio y nítido) y con una miniatura difuminada de ~1 KB
incrustada en el propio HTML:

1. La página se pinta al instante con las miniaturas: nunca hay huecos vacíos.
2. `tdv-images.js` estima la velocidad (API de red del navegador cuando existe y, siempre, midiendo
   las descargas reales) y pide el tamaño que necesita cada hueco y que la conexión permite. Con mala
   señal llega primero la versión ligera; con buena señal, directamente la nítida.
3. Si la cobertura mejora (aviso del navegador, vuelta a estar en línea o una prueba cada 15–120 s),
   las fotos visibles se sustituyen por las nítidas. Nunca se baja la calidad de una foto ya mostrada.
4. Las descargas fallidas se reintentan con espera creciente. `sw-imagenes.js` guarda cada foto: en
   visitas siguientes sale al instante y, sin cobertura, se muestra la mejor copia guardada.
5. Con "ahorro de datos" activado se usan siempre los tamaños ligeros. Sin JavaScript se cargan las
   fotos completas. Las fotos lejanas no se descargan hasta acercarse a ellas.

### Añadir o cambiar una foto

1. Deja el original en `wp-content/uploads/...` o en `_herramientas/originales/`.
2. Añade o edita su entrada en `_herramientas/imagenes.json` (`clave` = carpeta/nombre dentro de
   `assets/img`; `"recorte_alfa": true` recorta el margen transparente de un recorte).
3. Ejecuta `python _herramientas/imagenes_adaptativas.py --limpiar` (requiere `pip install Pillow`).
   Solo procesa lo que ha cambiado; generar todo desde cero tarda varios minutos.
4. Copia los valores de `_herramientas/imagenes-generadas.json` (`src`, `anchos`, `ratio`, `lqip`) en el HTML:

```html
<!-- Fondo (hero, tarjetas del mosaico) -->
<div class="card-art tdv-bg" style="background-image:url('SRC-ANCHO_MAYOR.webp');--tdv-img:url('LQIP')"
     data-tdv-src="SRC" data-tdv-w="ANCHOS" data-tdv-ratio="RATIO" role="img" aria-label="…"></div>

<!-- Imagen (equipo, galería de contacto) -->
<img class="tdv-img" src="LQIP" data-tdv-src="SRC" data-tdv-w="ANCHOS" data-tdv-ratio="RATIO" alt="…">
<noscript><img src="SRC-ANCHO_MAYOR.webp" alt="…"></noscript>

<!-- Plato de la carta -->
<article data-category="c3" data-dish-src="SRC" data-dish-w="ANCHOS" data-dish-ratio="RATIO" data-dish-lqip="LQIP">…</article>
```

Los archivos llevan un código que cambia con la foto (`torre-de-vega-44.1a2b3c4d-1080.webp`), así
nadie verá nunca una versión antigua guardada.

### Desactivar el service worker

Sustituye el contenido de `sw-imagenes.js` por lo siguiente y súbelo; los navegadores lo retirarán solos:

```js
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(caches.delete('tdv-imagenes-v1').then(() => self.registration.unregister())));
```

## Conservado de WordPress

- Rank Math: `<title>`, descripción, robots, canonical, Open Graph, Twitter y el JSON-LD de cada página.
- `sitemap_index.xml`, `page-sitemap.xml`, `author-sitemap.xml`, `main-sitemap.xsl`, `robots.txt`, `llms.txt`.
- Google Site Kit (etiqueta `GT-TWR8KQQL`), favicons, GTranslate y el botón de WhatsApp.

## Corregido al exportar (rompía el SEO en producción)

- URLs relativas o de `http://localhost/restaurante` → `https://restaurantetorredevega.es` en
  canonical, `og:url`, `og:image`, JSON-LD, sitemaps y `robots.txt`.
- `lang="en-US"`/`og:locale en_US` → español. Nombre del restaurante roto en el JSON-LD
  (`#site_title ...`), país `ES` y teléfono internacional.
- Eliminada la `SearchAction` del JSON-LD (la web estática no tiene buscador).
- Sitemap de páginas con fechas y las imágenes que realmente se muestran.
- Rutas de banderas de GTranslate (`/restaurante/...`).

## Eliminado (y por qué)

- CSS/JS de Astra y Spectra, jQuery, lazy-load de Smush, emojis de WordPress, OptinMonster/Omnisend:
  maquetaban el diseño anterior y ya no se usan (la portada pasa de 186 KB a 24 KB de HTML).
- `xmlrpc`/`EditURI`, meta `generator` con la versión de WordPress y enlaces a feeds inexistentes:
  revelaban información o apuntaban a 404.
- Formulario de Spectra: enviaba a `admin-ajax.php`, que no existe en una web estática.
  Se sustituye por un formulario que abre WhatsApp o el correo sin guardar datos.

## Recomendado en el hosting (no incluido)

Añadir cabeceras `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
`X-Frame-Options: SAMEORIGIN` y `Permissions-Policy`. No se incluye `.htaccess` para no pisar
la configuración del servidor si la web se sube sobre una instalación existente.

Para las fotos: `Cache-Control: public, max-age=31536000, immutable` en `/assets/img/` (los nombres
cambian con cada foto) y `Cache-Control: no-cache` en `/sw-imagenes.js`. La web debe servirse por
HTTPS para que funcione el service worker (sin él, el resto de la carga adaptativa sigue funcionando).
