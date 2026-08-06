// Datos de productos — termos y calentadores.
// El catálogo se gestiona desde el panel de administración (admin.html):
// los productos que añadas ahí aparecen automáticamente en esta página.
// Si prefieres tenerlos también aquí como respaldo sin conexión, sigue
// el mismo formato que data-calderas.js.
window.DECOGAS_DATA = {
  page: "termos",
  type: "termo",
  installNote: "Instalación estándar con conexiones incluidas. Consulta condiciones para sustituciones especiales.",
  products: [
    { brand:"Cabel", slug:"termo-electrico-cabel-100l-vertical", name:"Termo eléctrico Cabel 100l Vertical", specs:[], price:460, pop:100,
      description:"El Termo eléctrico Cabel 100l Vertical combina fiabilidad y eficiencia, asegurando un suministro constante de agua caliente gracias a su diseño avanzado y controles de calidad rigurosos. Capacidad: 100 litros, ideal para hogares medianos Protección: Estanqueidad IP25 y aislamiento térmico superior Calidad: Vitrificado y soldadura de alta precisión para máxima durabilidad",
      features:[],
      idealFor:"", efficiency:"", img:"https://ygailcynbblqvugunleq.supabase.co/storage/v1/object/public/productos/termo-electrico-cabel-100l-vertical.jpg" }
  ]
};

// Registro para páginas que cargan varios catálogos (admin.html)
window.DECOGAS_DATASETS = window.DECOGAS_DATASETS || {};
window.DECOGAS_DATASETS["termos"] = window.DECOGAS_DATA;
