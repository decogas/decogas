// ============================================================
// catalog.js — Renderizado del catálogo (calderas y aires)
// Lee window.DECOGAS_DATA (definido en data-*.js).
// - Sanitización XSS: todo dato se escapa antes de insertarse.
// - Delegación de eventos: filtros y botones "Características"
//   funcionan sin re-enganchar listeners tras cada render.
// - Precios dinámicos: aplica overrides de DecogasPrices antes
//   del primer render.
// ============================================================
(function () {
  "use strict";

  var PAGE = document.body.getAttribute("data-page");
  var DATASETS = window.DECOGAS_DATASETS || {};
  var DATA = (PAGE && DATASETS[PAGE]) || window.DECOGAS_DATA;
  var root = document.getElementById("catalogRoot");
  if (!DATA || !root) return;

  var PRODUCTS = DATA.products;
  var INSTALL_NOTE = DATA.installNote;
  var ACCENTS = ["#3AA6D9", "#FF6B35", "#FFB930"];

  // ---------- Sanitización ----------
  var esc = window.DecogasUtil.esc;

  var formatPrice = function (n) { return Number(n).toLocaleString("es-ES"); };

  var waLink = function (p) {
    var msg = "Hola, me interesa " + (DATA.type === "ac" ? "el aire acondicionado " : DATA.type === "termo" ? "el equipo " : DATA.type === "aerotermia" ? "el equipo de aerotermia " : "la caldera ") +
      p.name + " por " + formatPrice(p.price) + "\u20AC que he visto en vuestra web. \u00BFMe pod\u00E9is informar?";
    return "https://wa.me/34651368631?text=" + encodeURIComponent(msg);
  };

  // ---------- Plantillas SVG (ilustración según tipo de producto) ----------
  var visualSVG = function (i) {
    var a = ACCENTS[i % ACCENTS.length];
    var b = ACCENTS[(i + 1) % ACCENTS.length];
    if (DATA.type === "ac") {
      return '<svg viewBox="0 0 220 150" fill="none">' +
        '<rect x="30" y="35" width="160" height="46" rx="12" fill="#0E2238"/>' +
        '<rect x="42" y="70" width="136" height="8" rx="4" fill="' + a + '"/>' +
        '<circle cx="168" cy="47" r="4" fill="' + b + '"/>' +
        '<path class="breeze-line" d="M40 92 Q60 100 80 92" stroke="' + a + '" stroke-width="3" stroke-linecap="round"/>' +
        '<path class="breeze-line d2" d="M90 96 Q110 106 130 96" stroke="' + a + '" stroke-width="3" stroke-linecap="round"/>' +
        '<path class="breeze-line d3" d="M140 92 Q160 100 180 92" stroke="' + a + '" stroke-width="3" stroke-linecap="round"/>' +
        '</svg>';
    }
    if (DATA.type === "termo") {
      return '<svg viewBox="0 0 220 150" fill="none">' +
        '<rect x="82" y="12" width="56" height="112" rx="26" fill="#0E2238"/>' +
        '<rect x="94" y="30" width="32" height="10" rx="5" fill="' + a + '" opacity=".8"/>' +
        '<circle cx="110" cy="60" r="11" fill="none" stroke="' + b + '" stroke-width="2.6"/>' +
        '<path d="M110 54v6l4 3" stroke="' + b + '" stroke-width="2.4" stroke-linecap="round"/>' +
        '<path d="M96 124v10M124 124v10" stroke="' + a + '" stroke-width="4" stroke-linecap="round"/>' +
        '<path class="breeze-line" d="M100 92 Q110 99 120 92" stroke="' + a + '" stroke-width="3" stroke-linecap="round"/>' +
        '</svg>';
    }
    if (DATA.type === "aerotermia") {
      // Unidad exterior de bomba de calor: carcasa con ventilador (aspas) y rejillas.
      return '<svg viewBox="0 0 220 150" fill="none">' +
        '<rect x="34" y="46" width="152" height="66" rx="12" fill="#0E2238"/>' +
        '<circle cx="72" cy="79" r="21" fill="none" stroke="' + a + '" stroke-width="3"/>' +
        '<path d="M72 62v34M55 79h34M60 67l24 24M84 67 60 91" stroke="' + b + '" stroke-width="2.4" stroke-linecap="round"/>' +
        '<rect x="110" y="60" width="62" height="8" rx="4" fill="' + a + '" opacity=".8"/>' +
        '<rect x="110" y="74" width="62" height="8" rx="4" fill="' + b + '" opacity=".8"/>' +
        '<rect x="110" y="88" width="62" height="8" rx="4" fill="' + a + '" opacity=".55"/>' +
        '<path class="breeze-line" d="M96 120 Q108 128 120 120" stroke="' + a + '" stroke-width="3" stroke-linecap="round"/>' +
        '</svg>';
    }
    return '<svg viewBox="0 0 220 150" fill="none">' +
      '<rect x="78" y="15" width="64" height="120" rx="10" fill="#0E2238"/>' +
      '<rect x="90" y="30" width="40" height="26" rx="5" fill="#16324B"/>' +
      '<circle cx="100" cy="43" r="6" fill="none" stroke="' + a + '" stroke-width="2.4"/>' +
      '<circle cx="120" cy="43" r="6" fill="none" stroke="' + b + '" stroke-width="2.4"/>' +
      '<rect x="90" y="64" width="40" height="6" rx="3" fill="' + a + '" opacity=".75"/>' +
      '<rect x="90" y="76" width="40" height="6" rx="3" fill="' + b + '" opacity=".75"/>' +
      '<path class="breeze-line" d="M96 100 Q108 108 120 100" stroke="' + a + '" stroke-width="3" stroke-linecap="round"/>' +
      '<path class="breeze-line d2" d="M92 112 Q108 122 124 112" stroke="' + a + '" stroke-width="3" stroke-linecap="round"/>' +
      '</svg>';
  };

  // ---------- Plantilla de tarjeta (compacta, uniforme, sin desc/características) ----------
  // Vista previa mínima: marca, nombre, specs, "Pensado para", precio y accesos.
  // La descripción y las características completas viven en la ficha de producto.
  var WA_ICON = '<svg viewBox="0 0 24 24"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.87.5 3.62 1.44 5.15L2 22l5.09-1.53a9.87 9.87 0 0 0 4.95 1.31h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm5.79 14.16c-.24.68-1.4 1.3-1.93 1.36-.5.06-1.03.29-3.46-.72-2.91-1.21-4.78-4.15-4.93-4.35-.14-.19-1.17-1.56-1.17-2.98 0-1.41.74-2.1 1-2.39.26-.28.57-.36.77-.36.19 0 .38.001.55.01.18.01.42-.07.65.5.24.58.82 2 .9 2.15.07.14.12.31.02.5-.1.19-.15.31-.29.48-.15.17-.31.38-.44.51-.15.15-.3.31-.13.6.17.29.75 1.24 1.61 2 1.1.98 2.03 1.29 2.32 1.43.29.15.46.12.63-.07.17-.19.72-.84.92-1.13.19-.29.38-.24.65-.14.26.1 1.66.78 1.95.92.28.15.47.22.54.34.07.13.07.72-.17 1.4z"/></svg>';
  var cardHTML = function (p, i) {
    var ficha = "producto/" + encodeURIComponent(p.slug) + ".html";
    return '<div class="p-card' + (p.best ? " best" : "") + '" data-slug="' + esc(p.slug) + '">' +
      '<a class="p-visual" href="' + ficha + '" aria-label="Ver ficha de ' + esc(p.name) + '"><div class="shine"></div>' + visualSVG(i) +
        (p.img ? '<img class="p-photo" src="' + esc(p.img) + '" alt="' + esc(p.name) + '" loading="lazy">' : "") + '</a>' +
      '<div class="p-body">' +
        '<span class="p-brand">' + esc(p.brand) + '</span>' +
        '<a class="p-name" href="' + ficha + '">' + esc(p.name) + '</a>' +
        '<div class="p-specs">' + p.specs.slice(0, 3).map(function (s) { return "<span>" + esc(s) + "</span>"; }).join("") +
          (p.efficiency ? '<span class="p-eff">\u26A1 ' + esc(p.efficiency) + '</span>' : "") + '</div>' +
        (p.idealFor ? '<div class="p-ideal">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 22V12h6v10"/></svg>' +
          '<span>' + esc(p.idealFor) + '</span></div>' : "") +
        '<div class="p-foot">' +
          '<div class="p-price-row">' +
            '<div class="p-price"><span data-price-slug="' + esc(p.slug) + '">' + formatPrice(p.price) + '</span>\u20AC <span class="p-iva">IVA inc.</span></div>' +
            '<div class="p-financing" title="Financiaci\u00F3n sin intereses">Desde <strong>' + formatPrice(Math.ceil((p.price / 36) * 100) / 100) + ' \u20AC/mes</strong></div>' +
          '</div>' +
          '<a class="p-ficha-btn" href="' + ficha + '">Ver ficha completa' +
            ' <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>' +
          '<div class="p-actions">' +
            '<a class="p-wa" href="' + waLink(p) + '" target="_blank" rel="noopener">' + WA_ICON + 'WhatsApp</a>' +
            '<button class="p-compare" type="button" data-slug="' + esc(p.slug) + '"><span class="cmp-plus">+</span> Comparar</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  };

  // ---------- Subfiltro por tipo (aires: 1x1/2x1/3x1/conductos · calderas: baños) ----------
  var TYPEFILTER = null;
  var POWERFILTER = null;
  var productPower = function (p) {
    if (DATA.type === "ac") {
      // Capacidad según los m² de la ficha ("Hasta 35 m²"): dato fiable
      var m = String(p.idealFor || "").match(/(\d{2,3})\s*m/i);
      if (!m) return null; // sin dato (p. ej. multisplits): no entra en el filtro
      var n = Number(m[1]);
      if (n <= 25) return "25";
      if (n <= 35) return "35";
      if (n <= 45) return "40";
      return "50";
    }
    var m2 = String(p.name).match(/(2[4-9]|3[05])\b/);
    if (!m2) return null;
    var n = Number(m2[1]);
    if (n === 25 || n === 26) return "25";
    return String(n);
  };
  var matchesPower = function (p) {
    if (!POWERFILTER) return true;
    return productPower(p) === POWERFILTER; // sin dato = fuera (nada de falsos resultados)
  };

  // Orden natural del catálogo: de menor a mayor capacidad.
  // Aires: 1x1 por tamaño (25→35→40/42→50), después 2x1 (25+25→35+25),
  // después 3x1, después conductos. Calderas/termos: por kW/litros del nombre.
  var POWERSORT = null; // "asc" | "desc" | null
  var capacityKey = function (p) {
    if (DATA.type === "ac") {
      var t = productType(p);
      var rank = { "1x1": 0, "2x1": 1, "3x1": 2, "conductos": 3 }[t] || 0;
      var size = 0;
      if (t === "2x1" || t === "3x1") {
        var ints = String(p.name).match(/(?:CF|HR)(\d{2})/g) || [];
        ints.forEach(function (x) { size += Number(x.replace(/\D/g, "")); });
        if (!size) size = 99;
      } else {
        var m = String(p.idealFor || "").match(/(\d{2,3})\s*m/i);
        size = m ? Number(m[1]) : 99;
      }
      return rank * 1000 + size;
    }
    var km = String(p.name).match(/(2[4-9]|3[05])\b/);
    if (km) return Number(km[1]);
    var lm = String(p.name).match(/(\d{2,3})/);
    return lm ? Number(lm[1]) : 999;
  };
  var byCapacity = function (dir) {
    return function (a, b) {
      return dir === "desc" ? capacityKey(b) - capacityKey(a) : capacityKey(a) - capacityKey(b);
    };
  };
  var productType = function (p) {
    var txt = p.name + " " + (p.idealFor || "");
    if (DATA.type === "ac") {
      if (/conducto/i.test(txt)) return "conductos";
      if (/3\s*x\s*1/i.test(p.name)) return "3x1";
      if (/2\s*x\s*1/i.test(p.name)) return "2x1";
      return "1x1";
    }
    if (DATA.type === "termo") {
      return /calentador/i.test(txt) ? "calentador" : "termo";
    }
    if (DATA.type === "aerotermia") {
      return /bibloc/i.test(txt) ? "bibloc" : /monobloc/i.test(txt) ? "monobloc" : null;
    }
    var m = String(p.idealFor || "").match(/(\d)\s*bañ/i);
    return m ? String(Math.min(Number(m[1]), 2)) : null; // sin dato: no se filtra
  };
  var matchesType = function (p) {
    if (!TYPEFILTER) return true;
    var t = productType(p);
    return t === null || t === TYPEFILTER;
  };

  // ---------- Búsqueda por nombre/marca ----------
  var QUERY = "";
  var norm = window.DecogasUtil.norm;
  var matchesQuery = function (p) {
    if (!QUERY) return true;
    return norm(p.name + " " + p.brand).indexOf(QUERY) !== -1;
  };

  // ---------- Construcción del listado según filtro ----------
  var buildHTML = function (filter) {
    if (!PRODUCTS.length) {
      return '<div class="no-results">Estamos preparando el catálogo de esta sección. ' +
        'Mientras tanto, <a href="tel:+34919930168" style="color:var(--flame-deep); font-weight:600;">llámanos al 919 93 01 68</a> ' +
        'o <a href="index.html#contacto" style="color:var(--flame-deep); font-weight:600;">pide información</a> y te asesoramos con el equipo que necesitas.</div>';
    }
    var POOL = PRODUCTS.filter(matchesQuery).filter(matchesType).filter(matchesPower);
    if (!POOL.length) {
      return '<div class="no-results">No hay resultados para tu búsqueda. Prueba con otro nombre o marca, o <a href="index.html#contacto" style="color:var(--flame-deep); font-weight:600;">pídenos información</a>.</div>';
    }
    if (filter === "brand") {
      var brands = [];
      POOL.forEach(function (p) { if (brands.indexOf(p.brand) === -1) brands.push(p.brand); });
      return brands.map(function (b) {
        var items = POOL.filter(function (p) { return p.brand === b; }).sort(byCapacity(POWERSORT === "desc" ? "desc" : "asc"));
        return '<div class="brand-group">' +
          '<h3 class="brand-title">' + esc(b) + ' <span class="count">' + items.length + " modelo" + (items.length > 1 ? "s" : "") + '</span></h3>' +
          '<div class="product-grid3">' + items.map(cardHTML).join("") + '</div>' +
        '</div>';
      }).join("");
    }
    var items = POOL.slice();
    if (filter === "all") items.sort(byCapacity("asc"));
    if (filter === "pop") items.sort(function (a, b) { return a.pop - b.pop; });
    if (filter === "cheap") items.sort(function (a, b) { return a.price - b.price; });
    if (filter === "expensive") items.sort(function (a, b) { return b.price - a.price; });
    if (POWERSORT) items.sort(byCapacity(POWERSORT));
    return '<div class="product-grid3">' + items.map(cardHTML).join("") + '</div>';
  };

  var currentFilter = "all";
  var renderCatalog = function (filter) {
    currentFilter = filter;
    root.classList.add("fade-out");
    setTimeout(function () {
      root.innerHTML = buildHTML(filter);
      root.classList.remove("fade-out");
      refreshCompareUI();
    }, 180);
  };

  // ---------- Campo de búsqueda del catálogo ----------
  var searchInput = document.getElementById("catalogSearch");
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      QUERY = norm(searchInput.value.trim());
      renderCatalog(currentFilter);
    });
  }

  // ---------- Resaltar producto llegado desde el buscador (#p=slug) ----------
  var highlightFromHash = function () {
    var m = (location.hash || "").match(/^#p=([a-z0-9-]+)$/);
    if (!m) return;
    setTimeout(function () {
      var card = root.querySelector('.p-card[data-slug="' + m[1] + '"]');
      if (!card) return;
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.classList.remove("highlight");
      void card.offsetWidth;
      card.classList.add("highlight");
    }, 420);
  };
  window.addEventListener("hashchange", highlightFromHash);

  // Fotos rotas: retirar la imagen para que quede la ilustración de respaldo
  document.addEventListener("error", function (e) {
    if (e.target && e.target.classList && e.target.classList.contains("p-photo")) {
      e.target.remove();
    }
  }, true);

  // ---------- Conmutador de vista: filas / cuadrícula / cuadrícula ×4 ----------
  (function setupViewToggle() {
    if (!root.parentNode) return;
    var CLS = { rows: "view-rows", grid: "view-grid", grid4: "view-grid4" };
    var ICON = {
      rows: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="5" rx="1.5"/><rect x="3" y="14" width="18" height="5" rx="1.5"/></svg>',
      grid: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>',
      grid4: '<svg viewBox="0 0 24 24"><rect x="2.5" y="2.5" width="6" height="6" rx="1"/><rect x="9.5" y="2.5" width="6" height="6" rx="1"/><rect x="16.5" y="2.5" width="5" height="6" rx="1"/><rect x="2.5" y="9.5" width="6" height="6" rx="1"/><rect x="9.5" y="9.5" width="6" height="6" rx="1"/><rect x="16.5" y="9.5" width="5" height="6" rx="1"/></svg>'
    };
    var saved = "grid";
    try { var v = localStorage.getItem("decogas_view"); if (v && CLS[v]) saved = v; } catch (e) { /* sin storage */ }
    var bar = document.createElement("div");
    bar.className = "view-toggle";
    bar.innerHTML =
      '<span class="vt-label">Ver:</span>' +
      '<button class="vt-btn" data-v="rows" type="button" aria-label="Filas">' + ICON.rows + "</button>" +
      '<button class="vt-btn" data-v="grid" type="button" aria-label="Cuadrícula">' + ICON.grid + "</button>" +
      '<button class="vt-btn" data-v="grid4" type="button" aria-label="Cuadrícula compacta">' + ICON.grid4 + "</button>";
    root.parentNode.insertBefore(bar, root);
    function apply(v) {
      root.classList.remove(CLS.rows, CLS.grid, CLS.grid4);
      root.classList.add(CLS[v]);
      try { localStorage.setItem("decogas_view", v); } catch (e) { /* sin storage */ }
      bar.querySelectorAll(".vt-btn").forEach(function (b) { b.classList.toggle("active", b.dataset.v === v); });
    }
    bar.addEventListener("click", function (e) {
      var b = e.target.closest(".vt-btn");
      if (b) apply(b.dataset.v);
    });
    apply(saved);
  })();

  // ---------- Delegación: filtros ----------
  var filterBar = document.getElementById("filterBar");
  var subBar = document.getElementById("subFilterBar");
  var powerBar = document.getElementById("powerFilterBar");
  if (filterBar) {
    filterBar.addEventListener("click", function (e) {
      var btn = e.target.closest(".filter-btn");
      if (!btn) return;
      if (btn.dataset.filter === "tipo" || btn.dataset.filter === "potencia") {
        var bar = btn.dataset.filter === "tipo" ? subBar : powerBar;
        if (!bar) return;
        btn.classList.toggle("active", !bar.classList.contains("open"));
        bar.classList.toggle("open");
        if (!bar.classList.contains("open")) {
          if (btn.dataset.filter === "tipo") TYPEFILTER = null; else POWERFILTER = null;
          bar.querySelectorAll(".sub-chip").forEach(function (c) { c.classList.remove("active"); });
          renderCatalog(currentFilter);
        }
        return;
      }
      filterBar.querySelectorAll(".filter-btn:not([data-filter=tipo])").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      renderCatalog(btn.dataset.filter);
    });
  }
  var wireChipBar = function (bar, get, set) {
    if (!bar) return;
    bar.addEventListener("click", function (e) {
      var chip = e.target.closest(".sub-chip");
      if (!chip) return;
      var val = chip.dataset.type || chip.dataset.power;
      if (get() === val) {
        set(null);
        chip.classList.remove("active");
      } else {
        set(val);
        bar.querySelectorAll(".sub-chip").forEach(function (c) { c.classList.remove("active"); });
        chip.classList.add("active");
      }
      renderCatalog(currentFilter);
    });
  };
  wireChipBar(subBar, function () { return TYPEFILTER; }, function (v) { TYPEFILTER = v; });
  if (powerBar) {
    powerBar.addEventListener("click", function (e) {
      var chip = e.target.closest(".sub-chip");
      if (!chip) return;
      if (chip.dataset.sort) {
        // Chips de orden (asc/desc): grupo independiente de los de filtro
        var val = chip.dataset.sort;
        var sortChips = powerBar.querySelectorAll(".sub-chip[data-sort]");
        if (POWERSORT === val) { POWERSORT = null; chip.classList.remove("active"); }
        else {
          POWERSORT = val;
          sortChips.forEach(function (c) { c.classList.remove("active"); });
          chip.classList.add("active");
        }
      } else {
        var pval = chip.dataset.power;
        var powerChips = powerBar.querySelectorAll(".sub-chip[data-power]");
        if (POWERFILTER === pval) { POWERFILTER = null; chip.classList.remove("active"); }
        else {
          POWERFILTER = pval;
          powerChips.forEach(function (c) { c.classList.remove("active"); });
          chip.classList.add("active");
        }
      }
      renderCatalog(currentFilter);
    });
  }

  // ---------- Comparador (hasta 3 productos) ----------
  var COMPARE = [];
  var findBySlug = function (slug) {
    for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].slug === slug) return PRODUCTS[i];
    return null;
  };

  // Barra flotante + modal (inyectados una vez)
  var cbar = document.createElement("div");
  cbar.className = "compare-bar";
  cbar.innerHTML = '<span class="cb-label"></span>' +
    '<button class="btn btn-flame" id="cbOpen" type="button" style="padding:10px 20px; font-size:13.5px;">Comparar</button>' +
    '<button class="cb-clear" id="cbClear" type="button">Limpiar</button>';
  document.body.appendChild(cbar);

  var cmodal = document.createElement("div");
  cmodal.className = "compare-modal";
  cmodal.innerHTML = '<div class="compare-sheet">' +
    '<button class="compare-close" type="button" aria-label="Cerrar">\u2715</button>' +
    '<h3 style="font-size:22px;">Comparativa</h3>' +
    '<div class="compare-grid" id="cmpGrid"></div>' +
    '</div>';
  document.body.appendChild(cmodal);

  var refreshCompareUI = function () {
    // marca tarjetas y botones
    root.querySelectorAll(".p-card").forEach(function (card) {
      var slug = card.getAttribute("data-slug");
      var on = COMPARE.indexOf(slug) !== -1;
      card.classList.toggle("comparing", on);
      var btn = card.querySelector(".p-compare");
      if (btn) {
        btn.classList.toggle("selected", on);
        btn.innerHTML = on ? "\u2713 En la comparativa" : '<span class="cmp-plus">+</span> Comparar';
      }
    });
    cbar.querySelector(".cb-label").textContent = "Comparar (" + COMPARE.length + ")";
    cbar.classList.toggle("show", COMPARE.length >= 2);
  };

  var buildCompare = function () {
    var items = COMPARE.map(findBySlug).filter(Boolean);
    if (items.length < 2) return;
    var minPrice = Math.min.apply(null, items.map(function (p) { return p.price; }));
    var grid = cmodal.querySelector("#cmpGrid");
    grid.className = "compare-grid cols-" + items.length;
    grid.innerHTML = items.map(function (p) {
      return '<div class="cmp-col' + (p.price === minPrice ? " best-cmp" : "") + '">' +
        '<div class="cmp-brand">' + esc(p.brand) + "</div>" +
        '<div class="cmp-name">' + esc(p.name) + "</div>" +
        '<div class="cmp-price">' + formatPrice(p.price) + ' \u20AC <span style="font-size:11px; color:var(--muted); font-weight:500;">IVA inc.</span></div>' +
        (p.efficiency ? '<div class="cmp-block"><h6>Eficiencia energ\u00E9tica</h6><p style="font-weight:700; color:#1E9E5A;">' + esc(p.efficiency) + "</p></div>" : "") +
        '<div class="cmp-block"><h6>Pensado para</h6><p>' + esc(p.idealFor) + "</p></div>" +
        '<div class="cmp-block"><h6>Caracter\u00EDsticas</h6><ul>' +
          p.features.map(function (f) { return "<li>" + esc(f) + "</li>"; }).join("") + "</ul></div>" +
        '<div class="cmp-actions">' +
          '<a class="p-wa" style="margin-top:0;" href="' + waLink(p) + '" target="_blank" rel="noopener">' + '<svg viewBox="0 0 24 24"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.87.5 3.62 1.44 5.15L2 22l5.09-1.53a9.87 9.87 0 0 0 4.95 1.31h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm5.79 14.16c-.24.68-1.4 1.3-1.93 1.36-.5.06-1.03.29-3.46-.72-2.91-1.21-4.78-4.15-4.93-4.35-.14-.19-1.17-1.56-1.17-2.98 0-1.41.74-2.1 1-2.39.26-.28.57-.36.77-.36.19 0 .38.001.55.01.18.01.42-.07.65.5.24.58.82 2 .9 2.15.07.14.12.31.02.5-.1.19-.15.31-.29.48-.15.17-.31.38-.44.51-.15.15-.3.31-.13.6.17.29.75 1.24 1.61 2 1.1.98 2.03 1.29 2.32 1.43.29.15.46.12.63-.07.17-.19.72-.84.92-1.13.19-.29.38-.24.65-.14.26.1 1.66.78 1.95.92.28.15.47.22.54.34.07.13.07.72-.17 1.4z"/></svg>' + 'Pedir por WhatsApp</a>' +
        "</div>" +
      "</div>";
    }).join("");
    cmodal.classList.add("open");
    document.body.style.overflow = "hidden";
  };

  var closeCompare = function () {
    cmodal.classList.remove("open");
    document.body.style.overflow = "";
  };

  cbar.querySelector("#cbOpen").addEventListener("click", buildCompare);
  cbar.querySelector("#cbClear").addEventListener("click", function () {
    COMPARE = [];
    refreshCompareUI();
  });
  cmodal.querySelector(".compare-close").addEventListener("click", closeCompare);
  cmodal.addEventListener("click", function (e) { if (e.target === cmodal) closeCompare(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeCompare(); });

  // ---------- Delegación: botón "Características" ----------
  root.addEventListener("click", function (e) {
    var cmp = e.target.closest(".p-compare");
    if (cmp) {
      var slug = cmp.dataset.slug;
      var pos = COMPARE.indexOf(slug);
      if (pos !== -1) COMPARE.splice(pos, 1);
      else if (COMPARE.length < 3) COMPARE.push(slug);
      refreshCompareUI();
      return;
    }
  });

  // ---------- Primer render: catálogo remoto (Supabase/demo) o datos locales ----------
  var start = function (remote) {
    if (remote && remote.length) {
      PRODUCTS = remote.filter(function (p) { return p.visible !== false; });
    }
    renderCatalog("all");
    highlightFromHash();
  };

  if (window.DecogasStore) {
    window.DecogasStore.loadCatalog(DATA.page).then(start).catch(function () { start(null); });
  } else {
    start(null);
  }
})();
