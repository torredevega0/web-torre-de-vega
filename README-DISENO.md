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
torre-de-vega-sobre-nosotros/          Redirección a la portada (la página se eliminó)
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
    tdv-reviews.css       Composición de reseñas (platos recortados + opiniones flotantes)
    tdv-integrations.css  Aspecto de WhatsApp y GTranslate
    tdv-images.css        Miniaturas difuminadas de las fotos (imágenes adaptativas)
  js/
    tdv-motion.js         Motor de scroll compartido (títulos, filas, fotos circulares, fotos del local, diálogo)
    tdv-home.js           Solo portada: apertura con foto compartida, mosaico 3D, portal circular
    tdv-embers.js         Divisor de llamas en canvas
    tdv-carousel-3d.js    Solo portada: carrusel 3D de reseñas guiado por el scroll (<carousel-3d>)
    tdv-carta.js          Capítulos, recortes, buscador y filtros de la carta
    tdv-contact.js        Formulario → WhatsApp o correo
    tdv-integrations.js   Google Analytics (Site Kit) y ajustes de GTranslate
    tdv-images.js         Carga de fotos según la cobertura (ver "Imágenes adaptativas")
  img/fotos, img/local, img/carta   Fotos WebP en tres tamaños (generadas: no editar a mano)
  img/og                    Imágenes 1200x630 para compartir en redes (JPG, ver "SEO")
  data/fire-reference.json  Silueta de las llamas

sw-imagenes.js                          Service worker: guarda las fotos y las sirve sin cobertura
vercel.json                             Hosting: redirecciones 301, cabeceras y caché (ver "Hosting")
.vercelignore                           Lo que está en el repositorio pero no se publica
_herramientas/                          Generador de imágenes y originales (no hace falta en el servidor)
```

`wp-content/` y `wp-includes/` no se han modificado.

## Qué página usa qué

| Página | CSS | JS |
| --- | --- | --- |
| Portada | core, home, reviews | motion, carousel-3d, home, embers |
| Reseñas | core, home, pages, reviews | motion, embers |
| Contacto | core, home, pages, reviews | motion, embers, contact |
| Carta | core, carta, pages | carta |
| Legales / autor | core, pages | — |

Todas cargan además `tdv-integrations.css/js`, el plugin de WhatsApp y GTranslate. Las que tienen
fotos (todas salvo legales y autor) cargan también `tdv-images.css/js`.

## Cómo editar

- **Textos**: directamente en el HTML de cada página.
- **Cabecera y pie**: están repetidos en cada página. Si cambias el menú o los enlaces legales,
  cámbialos en `index.html`, `torre-de-vega-resenas`,
  `contacto-torre-de-vega`, la carta y las tres páginas legales.
- **Platos de la carta**: edita la lista `<div class="menu-items">` de `carta-torre-de-vega/index.html`
  con el formato `NOMBRE – PRECIO`. La foto de un plato va en los atributos `data-dish-*` de su
  `<article>` (ver "Imágenes adaptativas").
- **Fotos**: ninguna página enlaza un archivo de imagen directamente; ver "Imágenes adaptativas".
- **Reseñas de la portada**: son un carrusel 3D `<carousel-3d class="review-carousel">` dentro de la
  sección de contacto. Gira con el scroll: `.review-scroll` se queda fijo mientras pasan todas las reseñas
  (unos 55svh de scroll por reseña, en `tdv-home.css`) y después la página continúa. Cada reseña es un `<figure>` hijo (`<blockquote><p>«…»</p></blockquote><figcaption>`);
  para añadir o quitar una, edita esos `<figure>`. El aspecto de las tarjetas está en `tdv-carousel-3d.js`.
- **Sección del local (portada)**: `.kitchen` con 4 fotos de `img/local` y 4 capítulos `.principles article`;
  cada foto sube con su capítulo (mismo orden, máximo 4).
- **Reseñas flotantes** (página de reseñas y contacto): cada composición es un `<div class="review-stage review-stage--trio">` (3 platos,
  hasta 5 tarjetas) o `--duo` (2 platos, hasta 4). Los platos son `.review-dish` con una imagen adaptativa
  y cada opinión un `<figure class="review-card slot-N">`; la posición de cada hueco está en `tdv-reviews.css`.
  Los textos de las tarjetas son fragmentos literales de la reseña (con «…» donde se recorta).
- **Responsive**: las correcciones para móvil y tablet están al final de `tdv-core.css`
  ("Responsive (Torre de Vega)").
- **Caché**: los archivos se enlazan con `?v=20260917-6`. Tras editar un CSS o JS, cambia ese
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

<!-- Imagen (fotos del local) -->
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
- `sitemap_index.xml`, `page-sitemap.xml`, `main-sitemap.xsl`, `robots.txt`, `llms.txt`
  (`author-sitemap.xml` sigue en la carpeta pero ya no se enlaza: ver "SEO").
- Google Site Kit (etiqueta `GT-TWR8KQQL`), favicons, GTranslate y el botón de WhatsApp.

## Corregido al exportar (rompía el SEO en producción)

- URLs relativas o de `http://localhost/restaurante` → `https://restaurantetorredevega.es` en
  canonical, `og:url`, `og:image`, JSON-LD, sitemaps y `robots.txt`.
- `lang="en-US"`/`og:locale en_US` → español. Nombre del restaurante roto en el JSON-LD
  (`#site_title ...`), país `ES` y teléfono internacional.
- Eliminada la `SearchAction` del JSON-LD (la web estática no tiene buscador).
- Sitemap de páginas con fechas y las imágenes que realmente se muestran.
- Rutas de banderas de GTranslate (`/restaurante/...`).

## SEO (revisado el 17-09-2026)

- **Títulos y descripciones**: de 37 a 58 y de 144 a 156 caracteres, con marca y localidad
  (Alhaurín de la Torre). Se repiten en Open Graph y Twitter. Si cambias uno, cambia los tres.
- **Imagen al compartir**: `assets/img/og/*.jpg` (1200×630) en cada página.
- **JSON-LD**: `Restaurant` con dirección, horario, teléfonos, correo, carta (`hasMenu`), cocina,
  rango de precios, reservas y fotos. Se quitaron los `Article` y el `Person` que Rank Math
  generaba con el correo como autor. No se marca la valoración 4,6/5: Google no admite
  reseñas propias de un negocio sobre sí mismo en datos estructurados.
- **Horario**: está en el JSON-LD de todas las páginas y en `llms.txt`. Si cambia, cámbialo ahí
  y en el Perfil de Empresa de Google (deben coincidir).
- **Página de autor**: `noindex` y fuera del sitemap (solo mostraba el correo).
- **Páginas eliminadas** (`/torre-de-vega-sobre-nosotros/`, `/carta-torre-de-vega-con-imagenes/`):
  301 en `vercel.json`, con `<meta refresh>` y canonical como respaldo.
- **No se publica** (`.vercelignore`): `_herramientas/`, `imagenes-nuevas/`, `README-DISENO.md` y las
  copias `*.backup-*.html` (una copia antigua de una página publicada es contenido duplicado).

## Eliminado (y por qué)

- CSS/JS de Astra y Spectra, jQuery, lazy-load de Smush, emojis de WordPress, OptinMonster/Omnisend:
  maquetaban el diseño anterior y ya no se usan (la portada pasa de 186 KB a 24 KB de HTML).
- `xmlrpc`/`EditURI`, meta `generator` con la versión de WordPress y enlaces a feeds inexistentes:
  revelaban información o apuntaban a 404.
- Formulario de Spectra: enviaba a `admin-ajax.php`, que no existe en una web estática.
  Se sustituye por un formulario que abre WhatsApp o el correo sin guardar datos.

## Hosting: Vercel (`vercel.json`)

La web se publica en Vercel desde el repositorio de GitHub. `vercel.json` (en la raíz) configura:

- **Redirecciones 301** de las páginas eliminadas: `/torre-de-vega-sobre-nosotros/` → portada y
  `/carta-torre-de-vega-con-imagenes/` → carta. Los HTML de esas rutas se mantienen como respaldo
  (redirigen con `<meta refresh>`) por si la redirección del servidor se desactiva.
- **`trailingSlash: true`**: las URL terminan en `/`, igual que los `canonical` y el sitemap.
- **Cabeceras de seguridad**: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`
  y `Permissions-Policy`.
- **Caché de las fotos**: un año e inmutable en `/assets/img/` (el nombre cambia con cada foto) y
  `no-cache` en `/sw-imagenes.js`.

`.vercelignore` excluye de la publicación `_herramientas/`, `imagenes-nuevas/`, `README-DISENO.md`
y las copias `*.backup-*.html`: siguen en el repositorio, pero no se suben a la web.
Tras editar un CSS o JS, cambia el `?v=…` de las páginas (ver "Cómo editar").

La web debe servirse por HTTPS para que funcione el service worker de las fotos (sin él, el resto
de la carga adaptativa sigue funcionando). En otro hosting sin `vercel.json`, aplica lo mismo con la
configuración que use (por ejemplo `.htaccess` en Apache).
