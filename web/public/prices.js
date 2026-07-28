// ============================================================
// prices.js — Almacén de datos del catálogo (v2)
// ------------------------------------------------------------
// Fuente de verdad del catálogo (fichas completas + precios):
//   1. Supabase (si config.js está relleno)  → visible para TODOS.
//   2. localStorage (modo demo)              → solo este navegador.
//   3. Datos por defecto de data-*.js        → si el backend falla.
//
// Expone:
//   window.DecogasStore.loadCatalog(category) → Promise<products[]|null>
//   window.DecogasStore.isValidPrice(v)
//   window.DecogasPrices (compatibilidad: precios/visibilidad en index)
// ============================================================
(function () {
  "use strict";

  var TIMEOUT_MS = 2500;
  var LS_KEY = "decogas_products_v2";

  var isValidPrice = window.DecogasUtil.isValidPrice;

  // Fila de BD / almacén → objeto de producto del front
  function normalize(row) {
    if (!row || typeof row.slug !== "string" || !row.name || !isValidPrice(row.price)) return null;
    return {
      slug: row.slug,
      name: String(row.name),
      brand: String(row.brand || ""),
      category: String(row.category || ""),
      price: Number(row.price),
      specs: Array.isArray(row.specs) ? row.specs.map(String) : [],
      features: Array.isArray(row.features) ? row.features.map(String) : [],
      description: String(row.description || ""),
      idealFor: String(row.ideal_for != null ? row.ideal_for : (row.idealFor || "")),
      efficiency: String(row.efficiency || ""),
      img: String(row.img || ""),
      pop: Number.isFinite(Number(row.pop)) ? Number(row.pop) : 999,
      best: row.best === true,
      visible: row.visible !== false
    };
  }

  function fetchRows(cfg, query) {
    var url = cfg.supabaseUrl.replace(/\/+$/, "") + "/rest/v1/products?" + query;
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);
    return fetch(url, {
      headers: { apikey: cfg.supabaseAnonKey, Authorization: "Bearer " + cfg.supabaseAnonKey },
      signal: controller.signal
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .finally(function () { clearTimeout(timer); });
  }

  function readDemoStorage() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "null"); }
    catch (e) { return null; }
  }

  function config() {
    var cfg = window.DECOGAS_CONFIG || {};
    return (cfg.supabaseUrl && cfg.supabaseAnonKey) ? cfg : null;
  }

  // Catálogo completo de una categoría, o null si hay que usar los
  // datos por defecto (backend sin migrar, sin conexión, demo vacío…)
  function loadCatalog(category) {
    var cfg = config();
    if (cfg) {
      return fetchRows(cfg, "select=*&category=eq." + encodeURIComponent(category) + "&order=pop.asc").then(function (rows) {
        if (!rows || !rows.length) return null;
        var products = rows.map(normalize).filter(Boolean);
        return products.length ? products : null;
      });
    }
    var demo = readDemoStorage();
    if (demo && Array.isArray(demo[category]) && demo[category].length) {
      var products = demo[category].map(normalize).filter(Boolean);
      return Promise.resolve(products.length ? products : null);
    }
    return Promise.resolve(null);
  }

  // ---- Compatibilidad con app.js (index): precios + visibilidad ----
  function loadOverrides() {
    var cfg = config();
    var toMap = function (list) {
      var map = {};
      (list || []).forEach(function (row) {
        var p = normalize(row);
        if (p) map[p.slug] = { price: p.price, visible: p.visible, img: p.img };
      });
      return map;
    };
    if (cfg) {
      return fetchRows(cfg, "select=slug,price,name,visible,img").then(toMap);
    }
    var demo = readDemoStorage();
    return Promise.resolve(toMap(demo ? [].concat(demo.calderas || [], demo.aires || [], demo.termos || [], demo.aerotermia || []) : []));
  }

  function applyToDom(overrides) {
    document.querySelectorAll("[data-price-slug]").forEach(function (el) {
      var o = overrides[el.getAttribute("data-price-slug")];
      if (!o) return;
      el.textContent = o.price.toLocaleString("es-ES");
      var card = el.closest(".p-card");
      if (!card) return;
      if (o.visible === false) card.style.display = "none";
      // Foto real del producto sobre la ilustración SVG de la tarjeta
      // (la portada trae dibujos de fábrica; si hay foto en la BD, se muestra).
      if (o.img && /^https?:\/\//.test(o.img) && !card.querySelector(".p-photo")) {
        var vis = card.querySelector(".p-visual");
        if (vis) {
          var ph = document.createElement("img");
          ph.className = "p-photo";
          ph.alt = "";
          ph.loading = "lazy";
          ph.src = o.img;
          vis.appendChild(ph);
        }
      }
    });
  }

  window.DecogasStore = {
    loadCatalog: loadCatalog,
    isValidPrice: isValidPrice,
    normalize: normalize,
    LS_KEY: LS_KEY
  };
  window.DecogasPrices = { load: loadOverrides, applyToDom: applyToDom, isValidPrice: isValidPrice };
})();
