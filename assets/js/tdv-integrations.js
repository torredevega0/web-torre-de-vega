/*
 * Torre de Vega — integraciones heredadas de WordPress (se cargan en todas las páginas).
 *
 *   - Google Analytics mediante la etiqueta de Google configurada por Site Kit
 *     (GT-TWR8KQQL). El script gtag.js se carga con <script async> en el <head>.
 *   - GTranslate: selector flotante de idioma (español / inglés). Su script
 *     /wp-content/plugins/gtranslate/js/float.js lee esta configuración.
 *
 * Mantener este archivo ANTES de float.js en el HTML.
 */
window.dataLayer = window.dataLayer || [];
function gtag() {
  window.dataLayer.push(arguments);
}
gtag('set', 'linker', { domains: ['restaurantetorredevega.com'] });
gtag('js', new Date());
gtag('set', 'developer_id.dZTNiMT', true);
gtag('config', 'GT-TWR8KQQL', { googlesitekit_post_type: 'page' });

window.gtranslateSettings = window.gtranslateSettings || {};
window.gtranslateSettings['31704145'] = {
  default_language: 'es',
  languages: ['en', 'es'],
  url_structure: 'none',
  flag_style: '2d',
  wrapper_selector: '#gt-wrapper-31704145',
  alt_flags: { en: 'usa' },
  // Bottom-left, so the switcher never covers the logo in the hero header.
  float_switcher_open_direction: 'top',
  switcher_horizontal_position: 'left',
  switcher_vertical_position: 'bottom',
  flags_location: '/wp-content/plugins/gtranslate/flags/'
};
