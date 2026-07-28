// Datos de productos — aerotermia (bombas de calor aire-agua).
// Categoría nueva sin catálogo todavía: se irán añadiendo equipos desde el
// panel de administración (admin.html), igual que en calderas/aires/termos.
// Los productos que se creen aquí salen OCULTOS por defecto (visible=false)
// hasta que se revisen y se activen manualmente desde el panel.
window.DECOGAS_DATA = {
  page: "aerotermia",
  type: "aerotermia",
  installNote: "Instalación estándar con conexiones incluidas. El técnico confirma el dimensionado exacto en la visita.",
  products: []
};

// Registro para páginas que cargan varios catálogos (admin.html)
window.DECOGAS_DATASETS = window.DECOGAS_DATASETS || {};
window.DECOGAS_DATASETS["aerotermia"] = window.DECOGAS_DATA;
