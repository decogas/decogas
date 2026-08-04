// ============================================================
// admin.js — Panel de administración del catálogo (v2)
// ------------------------------------------------------------
// CRUD completo: precios, fichas, alta/baja y visibilidad.
//  · LIVE (Supabase): login real, cambios visibles para todos.
//    La seguridad la imponen las políticas RLS del servidor.
//  · DEMO (sin backend): cambios solo en este navegador.
// ============================================================
(function () {
  "use strict";

  var cfg = window.DECOGAS_CONFIG || {};
  var LIVE = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  var sb = LIVE ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
  var LS_KEY = (window.DecogasStore && window.DecogasStore.LS_KEY) || "decogas_products_v2";

  var $ = function (id) { return document.getElementById(id); };
  var esc = window.DecogasUtil.esc;
  var norm = window.DecogasUtil.norm;
  var isValidPrice = window.DecogasUtil.isValidPrice;
  var slugify = function (s) {
    return String(s).normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "producto";
  };

  // ---------- Estado ----------
  var STATE = { calderas: [], aires: [], termos: [], aerotermia: [] };

  var DATASETS = window.DECOGAS_DATASETS || {};
  var CATS = ["calderas", "aires", "termos", "aerotermia"];
  var LIST_IDS = { calderas: "listCalderas", aires: "listAires", termos: "listTermos", aerotermia: "listAerotermia" };
  var COUNT_IDS = { calderas: "countCalderas", aires: "countAires", termos: "countTermos", aerotermia: "countAerotermia" };
  function defaults(category) {
    var d = DATASETS[category];
    return (d ? d.products : []).map(function (p) {
      return {
        slug: p.slug, name: p.name, brand: p.brand, category: category, price: p.price,
        specs: p.specs.slice(), features: p.features.slice(), description: p.description,
        ideal_for: p.idealFor, efficiency: p.efficiency || "", img: p.img || "", pop: p.pop, best: p.best === true, visible: true
      };
    });
  }

  // ---------- Modo / textos ----------
  function setModeBadges() {
    ["", "2"].forEach(function (n) {
      var pill = $("modeBadge" + n), txt = $("modeText" + n);
      if (!pill || !txt) return;
      pill.className = "mode-pill " + (LIVE ? "live" : "demo");
      txt.textContent = LIVE ? "CONECTADO — SUPABASE" : "MODO DEMO — LOCAL";
    });
  }
  setModeBadges();
  // Diagnóstico: mostrar a qué proyecto está conectado el panel
  if (LIVE) {
    var ref = (cfg.supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1] || cfg.supabaseUrl;
    var sub = document.querySelector(".admin-sub");
    if (sub) sub.innerHTML += ' <span style="font-family:\'IBM Plex Mono\'; font-size:11px; opacity:.7;">Proyecto conectado: ' + ref + "</span>";
  }
  $("loginNote").innerHTML = LIVE
    ? "Acceso mediante <strong>Supabase Auth</strong> con el usuario creado en Authentication → Users."
    : "El backend no está configurado (ver <code>config.js</code>): entra con cualquier email y contraseña. Los cambios solo se guardarán en este navegador.";

  // ---------- Toast ----------
  var toastTimer;
  function toast(text, isErr) {
    var t = $("toast");
    t.textContent = text;
    t.className = isErr ? "err show" : "show";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 3200);
  }

  // ---------- Registro de auditoría (best-effort) ----------
  // Inserta una fila en change_log con quién hizo qué. Si algo de esto falla
  // (tabla no migrada, sin red, sesión rara) NUNCA debe romper la operación
  // principal: todo va envuelto y sin esperar su resultado.
  function currentEmail() {
    if (!LIVE) return Promise.resolve("");
    return sb.auth.getUser().then(function (r) {
      return (r && r.data && r.data.user && r.data.user.email) || "";
    }).catch(function () { return ""; });
  }
  function logChange(entry) {
    if (!LIVE) return;
    try {
      currentEmail().then(function (email) {
        entry.user_email = email;
        return sb.from("change_log").insert([entry]);
      }).catch(function () { /* best-effort: no interrumpe la operación principal */ });
    } catch (e) { /* best-effort: no interrumpe la operación principal */ }
  }
  function snapshotRow(p) {
    return {
      slug: p.slug, name: p.name, brand: p.brand, category: p.category, price: p.price,
      specs: (p.specs || []).slice(), features: (p.features || []).slice(), description: p.description,
      ideal_for: p.ideal_for, efficiency: p.efficiency, img: p.img, pop: p.pop, best: p.best, visible: p.visible
    };
  }

  // ---------- Sesión compartida entre paneles ----------
  // Si ya iniciaste sesión en el otro panel, entras directamente sin
  // volver a escribir la contraseña (la sesión se guarda en el navegador).
  if (LIVE) {
    sb.auth.getSession().then(function (res) {
      if (res.data && res.data.session) {
        $("loginScreen").classList.add("hidden");
        $("panel").style.display = "block";
        loadAll();
      }
    }).catch(function () {
      // Sin red no podemos recuperar la sesión: dejamos la pantalla de login.
    });
  }

  // ---------- Login ----------
  $("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var msg = $("loginMsg");
    msg.classList.remove("show");
    $("loginBtn").disabled = true;

    var enter = function () {
      $("loginScreen").classList.add("hidden");
      $("panel").style.display = "block";
      loadAll();
    };

    if (!LIVE) { enter(); $("loginBtn").disabled = false; return; }

    sb.auth.signInWithPassword({ email: $("adminEmail").value.trim(), password: $("adminPass").value })
      .then(function (res) {
        $("loginBtn").disabled = false;
        if (res.error) {
          msg.textContent = "Credenciales incorrectas o usuario no autorizado.";
          msg.classList.add("show");
          return;
        }
        enter();
      })
      .catch(function () {
        // Fallo de red: rehabilitamos el botón y avisamos en lugar de dejarlo colgado.
        $("loginBtn").disabled = false;
        msg.textContent = "No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.";
        msg.classList.add("show");
      });
  });

  $("logoutBtn").addEventListener("click", function () {
    if (LIVE && sb) sb.auth.signOut();
    location.reload();
  });

  // ---------- Carga ----------
  function normalizeRow(r) {
    return {
      slug: String(r.slug), name: String(r.name || ""), brand: String(r.brand || ""),
      category: String(r.category || ""), price: Number(r.price),
      specs: Array.isArray(r.specs) ? r.specs.map(String) : [],
      features: Array.isArray(r.features) ? r.features.map(String) : [],
      description: String(r.description || ""), ideal_for: String(r.ideal_for || ""),
      efficiency: String(r.efficiency || ""),
      img: String(r.img || ""),
      pop: Number.isFinite(Number(r.pop)) ? Number(r.pop) : 999,
      best: r.best === true, visible: r.visible !== false
    };
  }

  function showDbWarn(msg) {
    var w = $("dbWarn");
    if (w) { w.textContent = msg; w.style.display = "block"; }
  }

  function loadAll() {
    if (LIVE) {
      sb.from("products").select("*").then(function (res) {
        if (res.error) {
          showDbWarn("ERROR de lectura: [" + (res.error.code || "?") + "] " + res.error.message + " \u2014 haz una captura de este mensaje.");
          CATS.forEach(function (cat) { STATE[cat] = defaults(cat); });
          renderAll();
          return;
        }
        var rows = (res.data || []).map(normalizeRow);
        rows.sort(function (a, b) { return (a.pop || 999) - (b.pop || 999); });
        var sub = document.querySelector(".admin-sub");
        if (sub && !document.getElementById("dbStatus")) {
          var st = document.createElement("div");
          st.id = "dbStatus";
          st.style.cssText = "margin-top:8px; font-family:'IBM Plex Mono'; font-size:11px; color:rgba(255,255,255,.65);";
          sub.parentNode.insertBefore(st, sub.nextSibling);
        }
        var stEl = document.getElementById("dbStatus");
        if (stEl) {
          stEl.textContent = "BD: " + rows.length + " filas le\u00EDdas (calderas " +
            rows.filter(function (r) { return r.category === "calderas"; }).length + " \u00B7 aires " +
            rows.filter(function (r) { return r.category === "aires"; }).length + " \u00B7 termos " +
            rows.filter(function (r) { return r.category === "termos"; }).length + ")";
        }
        CATS.forEach(function (cat) {
          STATE[cat] = rows.filter(function (r) { return r.category === cat; });
        });
        // Tabla sin migrar (v1: filas sin categoría ni nombre): usar los datos
        // del código con los precios de la BD, y avisar de forma persistente.
        if (!STATE.calderas.length && !STATE.aires.length && !STATE.termos.length && rows.length) {
          var priceMap = {};
          rows.forEach(function (r) { if (r.slug && r.price) priceMap[r.slug] = r.price; });
          CATS.forEach(function (cat) {
            STATE[cat] = defaults(cat).map(function (p) {
              if (priceMap[p.slug]) p.price = priceMap[p.slug];
              return p;
            });
          });
          showDbWarn("Tu base de datos usa el formato antiguo: se muestran las fichas del código con los precios guardados. Para poder editar fichas completas, ejecuta setup-supabase-v3.sql en Supabase → SQL Editor y recarga esta página.");
        }
        if (!rows.length) {
          CATS.forEach(function (cat) { STATE[cat] = defaults(cat); });
          showDbWarn("Conectado, pero la tabla de productos est\u00E1 VAC\u00CDA en este proyecto de Supabase. Comprueba que ejecutaste setup-supabase-v3.sql en el MISMO proyecto que aparece arriba como \u00ABProyecto conectado\u00BB (Supabase \u2192 Table Editor \u2192 products deber\u00EDa mostrar 27 filas). Mientras tanto se muestran las fichas del c\u00F3digo, pero los cambios no se guardar\u00E1n hasta arreglarlo.");
        }
        renderAll();
      });
    } else {
      var stored = null;
      try { stored = JSON.parse(localStorage.getItem(LS_KEY) || "null"); } catch (e) {}
      CATS.forEach(function (cat) {
        STATE[cat] = (stored && stored[cat] ? stored[cat].map(normalizeRow) : defaults(cat));
      });
      renderAll();
    }
  }

  function persistDemo() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(STATE)); }
    catch (e) { toast("No se pudo guardar en localStorage.", true); }
  }

  // ---------- Render ----------
  function fieldHTML(label, id, value, hint, type) {
    return '<div class="field"><label for="' + id + '">' + label + '</label>' +
      (type === "textarea"
        ? '<textarea id="' + id + '">' + esc(value) + '</textarea>'
        : '<input type="' + (type || "text") + '" id="' + id + '" value="' + esc(value) + '">') +
      (hint ? '<p class="form-hint">' + hint + '</p>' : "") + "</div>";
  }

  function prodHTML(p, category, idx) {
    var uid = category + "-" + idx;
    return '<div class="prod' + (p.visible ? "" : " hidden-prod") + '" data-cat="' + category + '" data-idx="' + idx + '">' +
      '<div class="prod-row">' +
        '<label class="switch" title="' + (p.visible ? "Visible en la web" : "Oculto en la web") + '">' +
          '<input type="checkbox" class="vis-switch"' + (p.visible ? " checked" : "") + ">" +
          '<span class="track"></span>' +
        "</label>" +
        '<div class="prod-info">' +
          '<div class="prod-name">' + (p.best ? '<span class="best-star" title="Más vendido">★</span>' : "") + esc(p.name) + "</div>" +
          '<div class="prod-meta">' + esc(p.brand) + " · " + esc(p.slug) + "</div>" +
        "</div>" +
        '<div class="prod-price">' + Number(p.price).toLocaleString("es-ES") + " €</div>" +
        '<div class="prod-actions">' +
          '<button class="icon-btn edit-btn" type="button" title="Editar ficha">' +
            '<svg viewBox="0 0 24 24"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>' +
          "</button>" +
          '<button class="icon-btn del del-btn" type="button" title="Eliminar">' +
            '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>' +
          "</button>" +
        "</div>" +
      "</div>" +
      '<div class="prod-form"><div class="prod-form-inner">' +
        '<div class="form-grid">' +
          fieldHTML("Nombre del producto", "f-name-" + uid, p.name) +
          fieldHTML("Marca", "f-brand-" + uid, p.brand) +
          fieldHTML("Precio (€, IVA incluido)", "f-price-" + uid, p.price, null, "number") +
          fieldHTML("Orden de popularidad", "f-pop-" + uid, p.pop, "1 = el más vendido. Ordena el filtro \u201cMás vendido\u201d.", "number") +
          '<div class="full">' + fieldHTML("Etiquetas cortas (una por línea, se muestran bajo el nombre)", "f-specs-" + uid, p.specs.join("\n"), null, "textarea") + "</div>" +
          '<div class="full">' + fieldHTML("Descripción", "f-desc-" + uid, p.description, null, "textarea") + "</div>" +
          '<div class="full">' + fieldHTML("Características (una por línea, lista con ✓)", "f-feat-" + uid, p.features.join("\n"), null, "textarea") + "</div>" +
          '<div class="full">' + fieldHTML("Pensado para", "f-ideal-" + uid, p.ideal_for, "Ej.: Hasta 35 m² \u00B7 o \u00B7 Hasta 100 m² con 1 ba\u00F1o. Los filtros y la calculadora leen los m\u00B2 y ba\u00F1os de aqu\u00ED.") + "</div>" +
          fieldHTML("Eficiencia energ\u00E9tica", "f-eff-" + uid, p.efficiency, "Ej.: A++, A+++, A") +
          '<div class="full"><div class="field"><label>Foto del producto</label>' +
            '<div class="photo-row">' +
              (p.img ? '<img class="photo-thumb" src="' + esc(p.img) + '" alt="">' : '<span class="photo-thumb empty">Sin foto</span>') +
              '<input type="text" id="f-img-' + uid + '" value="' + esc(p.img || "") + '" placeholder="URL de la imagen (o s\u00FAbela con el bot\u00F3n)">' +
              (LIVE ? '<label class="btn ghost small upload-btn">Subir foto<input type="file" class="photo-file" accept="image/*" hidden></label>' : "") +
            '</div>' +
            '<p class="form-hint">Recomendado: foto del producto sobre fondo blanco, para que el cat\u00E1logo quede homog\u00E9neo.</p>' +
          '</div></div>' +
        "</div>" +
        '<label class="check-row"><input type="checkbox" id="f-best-' + uid + '"' + (p.best ? " checked" : "") + "> Marcar como \u201cMás vendido\u201d (insignia destacada)</label>" +
        '<div class="form-foot">' +
          '<button class="btn ghost small cancel-btn" type="button">Cancelar</button>' +
          '<button class="btn small save-btn" type="button">Guardar ficha</button>' +
        "</div>" +
      "</div></div>" +
    "</div>";
  }

  function renderList(category) {
    var list = $(LIST_IDS[category]);
    if (!list) return;
    // Se renderizan solo los que pasan el filtro de búsqueda, pero SIEMPRE
    // con su índice real en STATE (data-idx), para que editar/borrar/guardar
    // sigan apuntando al producto correcto.
    var rows = [];
    STATE[category].forEach(function (p, i) {
      if (matchesFilter(p)) rows.push(prodHTML(p, category, i));
    });
    list.innerHTML = rows.length
      ? rows.join("")
      : (FILTER
          ? '<p class="note" style="padding:6px 2px;">Ningún producto coincide con la búsqueda.</p>'
          : '<p class="note" style="padding:6px 2px;">Sin productos todavía. Usa el botón de abajo para añadir el primero.</p>');
    var total = STATE[category].length;
    var visibles = STATE[category].filter(function (p) { return p.visible; }).length;
    $(COUNT_IDS[category]).textContent = (FILTER ? rows.length + " de " + total : total) + " productos · " + visibles + " visibles";
    // Con búsqueda activa: se expande la sección si hay resultados y se pliega si no
    if (FILTER) {
      var card = list.closest(".section-card");
      if (card) card.classList.toggle("collapsed", rows.length === 0);
    }
  }
  function renderAll() { CATS.forEach(renderList); }

  // ---------- Guardado de una fila ----------
  function saveRow(p, onDone) {
    if (LIVE) {
      sb.from("products").upsert([p], { onConflict: "slug" }).then(function (res) {
        if (res.error) { toast("Error al guardar: " + res.error.message, true); onDone(false); }
        else onDone(true);
      });
    } else { persistDemo(); onDone(true); }
  }

  function deleteRow(slug, onDone) {
    if (LIVE) {
      sb.from("products").delete().eq("slug", slug).then(function (res) {
        if (res.error) { toast("Error al eliminar: " + res.error.message, true); onDone(false); }
        else onDone(true);
      });
    } else { persistDemo(); onDone(true); }
  }

  // ---------- Delegación de eventos del panel ----------
  document.addEventListener("click", function (e) {
    // Añadir producto
    var addBtn = e.target.closest("[data-add]");
    if (addBtn) {
      var cat = addBtn.dataset.add;
      var nuevo = {
        slug: "", name: "", brand: "", category: cat, price: 0,
        specs: [], features: [], description: "", ideal_for: "", efficiency: "", img: "",
        // La categoría aerotermia es nueva (sin catálogo publicado todavía): sus
        // productos nacen OCULTOS por defecto, a diferencia del resto de categorías.
        pop: STATE[cat].length + 1, best: false, visible: cat !== "aerotermia", _isNew: true
      };
      STATE[cat].push(nuevo);
      renderList(cat);
      var prods = $(LIST_IDS[cat]).querySelectorAll(".prod");
      var last = prods[prods.length - 1];
      openForm(last);
      last.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    var prod = e.target.closest(".prod");
    if (!prod) return;
    var cat = prod.dataset.cat, idx = Number(prod.dataset.idx);
    var p = STATE[cat][idx];

    if (e.target.closest(".edit-btn")) { toggleForm(prod); return; }

    if (e.target.closest(".cancel-btn")) {
      if (p._isNew) { STATE[cat].splice(idx, 1); renderList(cat); }
      else closeForm(prod);
      return;
    }

    if (e.target.closest(".del-btn")) {
      var ok = window.confirm('¿Eliminar definitivamente "' + (p.name || "este producto") + '"?\n\nSi solo quieres que no se vea en la web, usa el interruptor de visibilidad.');
      if (!ok) return;
      var slug = p.slug;
      var beforeDelete = snapshotRow(p);
      deleteRow(slug, function (saved) {
        // Solo mutamos el estado local si el DELETE se confirmó; si falla,
        // la ficha permanece en la lista (sin borrado optimista que mienta).
        if (saved) {
          STATE[cat].splice(idx, 1);
          renderList(cat);
          toast("Producto eliminado.");
          logChange({
            action: "borrar", entity: "producto", entity_id: slug,
            label: 'Eliminó el producto "' + (beforeDelete.name || slug) + '".',
            before_data: beforeDelete, after_data: null
          });
        }
      });
      return;
    }

    if (e.target.closest(".save-btn")) {
      var uid = cat + "-" + idx;
      var val = function (id) { var el = $(id); return el ? el.value.trim() : ""; };
      var lines = function (id) { return val(id).split("\n").map(function (s) { return s.trim(); }).filter(Boolean); };

      var name = val("f-name-" + uid);
      var price = Number(val("f-price-" + uid));
      if (name.length < 2) { toast("El nombre es obligatorio.", true); return; }
      if (!isValidPrice(price)) { toast("El precio debe ser un número entre 1 y 99.999.", true); return; }

      // Para el registro de auditoría: la ficha ANTES de aplicar los cambios
      // del formulario (null si el producto es nuevo, no hay "antes").
      var wasNew = !!p._isNew;
      var beforeSave = wasNew ? null : snapshotRow(p);

      p.name = name;
      p.brand = val("f-brand-" + uid);
      p.price = price;
      p.pop = Number(val("f-pop-" + uid)) || 999;
      p.specs = lines("f-specs-" + uid);
      p.description = val("f-desc-" + uid);
      p.features = lines("f-feat-" + uid);
      p.ideal_for = val("f-ideal-" + uid);
      p.efficiency = val("f-eff-" + uid);
      p.img = val("f-img-" + uid);
      p.best = $("f-best-" + uid).checked;

      if (p._isNew) {
        var base = slugify(p.brand + " " + p.name), slug = base, n = 2;
        var taken = function (s) {
          return CATS.reduce(function (acc, c) { return acc.concat(STATE[c]); }, [])
            .some(function (x) { return x !== p && x.slug === s; });
        };
        while (taken(slug)) slug = base + "-" + (n++);
        p.slug = slug;
        delete p._isNew;
      }

      var row = {
        slug: p.slug, name: p.name, brand: p.brand, category: p.category, price: p.price,
        specs: p.specs, features: p.features, description: p.description,
        ideal_for: p.ideal_for, efficiency: p.efficiency, img: p.img, pop: p.pop, best: p.best, visible: p.visible
      };
      saveRow(row, function (saved) {
        if (saved) {
          renderList(cat);
          toast("Ficha guardada" + (LIVE ? " y publicada." : " (modo demo)."));
          logChange(wasNew
            ? {
                action: "crear", entity: "producto", entity_id: row.slug,
                label: 'Creó el producto "' + row.name + '".',
                before_data: null, after_data: row
              }
            : {
                action: "editar", entity: "producto", entity_id: row.slug,
                label: 'Editó el producto "' + row.name + '".',
                before_data: beforeSave, after_data: row
              });
        }
      });
      return;
    }
  });

  // ---------- Subida de fotos a Supabase Storage ----------
  document.addEventListener("change", function (e) {
    var fileInput = e.target.closest(".photo-file");
    if (!fileInput || !LIVE) return;
    var file = fileInput.files && fileInput.files[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { toast("La foto no puede superar 4 MB.", true); return; }
    var prod = fileInput.closest(".prod");
    var cat = prod.dataset.cat, idx = Number(prod.dataset.idx);
    var p = STATE[cat][idx];
    var ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    var base = p.slug || ("producto-" + Date.now());
    var path = base + "-" + Date.now() + "." + ext;
    toast("Subiendo foto\u2026");
    sb.storage.from("productos").upload(path, file, { upsert: true, cacheControl: "31536000" }).then(function (res) {
      if (res.error) { toast("Error al subir: " + res.error.message + " (\u00BFejecutaste setup-supabase-v5.sql?)", true); return; }
      var pub = sb.storage.from("productos").getPublicUrl(path);
      var url = pub && pub.data ? pub.data.publicUrl : "";
      if (!url) { toast("No se pudo obtener la URL p\u00FAblica.", true); return; }
      var uid = cat + "-" + idx;
      var input = $("f-img-" + uid);
      if (input) input.value = url;
      var thumb = prod.querySelector(".photo-thumb");
      if (thumb) {
        var img = document.createElement("img");
        img.className = "photo-thumb";
        img.src = url;
        thumb.replaceWith(img);
      }
      toast("Foto subida. Pulsa \u201CGuardar ficha\u201D para publicarla.");
    });
  });

  // Switch de visibilidad (guardado inmediato)
  document.addEventListener("change", function (e) {
    var sw = e.target.closest(".vis-switch");
    if (!sw) return;
    var prod = sw.closest(".prod");
    var cat = prod.dataset.cat, idx = Number(prod.dataset.idx);
    var p = STATE[cat][idx];
    if (p._isNew) { toast("Guarda primero la ficha del producto nuevo.", true); sw.checked = true; return; }
    var prevVisible = p.visible;
    var beforeVis = snapshotRow(p);
    p.visible = sw.checked;
    prod.classList.toggle("hidden-prod", !p.visible);
    var row = { slug: p.slug, visible: p.visible };
    var logVisibility = function () {
      logChange({
        action: p.visible ? "mostrar" : "ocultar", entity: "producto", entity_id: p.slug,
        label: (p.visible ? 'Mostró el producto "' : 'Ocultó el producto "') + (p.name || p.slug) + '".',
        before_data: beforeVis, after_data: snapshotRow(p)
      });
    };
    if (LIVE) {
      sb.from("products").update({ visible: p.visible }).eq("slug", p.slug).then(function (res) {
        if (res.error) {
          // La BD rechazó el cambio: revertimos estado y checkbox para no mentir.
          toast("Error: " + res.error.message, true);
          p.visible = prevVisible;
          sw.checked = prevVisible;
          prod.classList.toggle("hidden-prod", !prevVisible);
          return;
        }
        renderList(cat);
        toast(p.visible ? "Producto visible en la web." : "Producto oculto de la web.");
        logVisibility();
      });
    } else {
      persistDemo();
      renderList(cat);
      toast(p.visible ? "Visible (modo demo)." : "Oculto (modo demo).");
    }
  });

  // ---------- Formularios expandibles ----------
  // Tras abrir, al terminar la transición se quita el max-height fijo (pasa a "none")
  // para que si el contenido crece después (textarea, cambio de orientación) no quede
  // cortado con los botones de Cancelar/Guardar inalcanzables.
  function openForm(prod) {
    var form = prod.querySelector(".prod-form");
    form.style.maxHeight = form.scrollHeight + "px";
    prod.dataset.open = "1";
    form.addEventListener("transitionend", function onEnd(e) {
      if (e.propertyName !== "max-height") return;
      form.removeEventListener("transitionend", onEnd);
      if (prod.dataset.open) form.style.maxHeight = "none";
    });
  }
  function closeForm(prod) {
    var form = prod.querySelector(".prod-form");
    if (form.style.maxHeight === "none" || !form.style.maxHeight) {
      form.style.maxHeight = form.scrollHeight + "px";
      void form.offsetHeight; // fuerza reflow para que la transición arranque desde ahí
    }
    form.style.maxHeight = "0";
    delete prod.dataset.open;
  }
  function toggleForm(prod) {
    if (prod.dataset.open) closeForm(prod); else openForm(prod);
  }

  // ---------- Búsqueda y secciones plegables ----------
  var FILTER = "";
  function matchesFilter(p) {
    if (!FILTER) return true;
    var hay = norm(
      (p.name || "") + " " + (p.brand || "") + " " + (p.slug || "") + " " +
      (p.specs || []).join(" ") + " " + (p.efficiency || "")
    );
    return hay.indexOf(FILTER) !== -1;
  }

  (function setupPanelUX() {
    var wrap = document.querySelector(".panel-body .wrap");
    if (!wrap) return;

    var st = document.createElement("style");
    st.textContent =
      ".admin-search{position:relative; margin:0 0 18px;}" +
      ".admin-search svg{position:absolute; left:14px; top:50%; transform:translateY(-50%); color:#8A97A5; pointer-events:none;}" +
      ".admin-search input{width:100%; padding:13px 16px 13px 42px; border:1.5px solid #E3E8ED; border-radius:12px; font-size:15px; font-family:inherit; background:#fff;}" +
      ".admin-search input:focus{outline:none; border-color:#3AA6D9;}" +
      ".section-head.clickable{cursor:pointer; user-select:none; display:flex; align-items:center; gap:10px;}" +
      ".section-head .chev{margin-left:auto; display:inline-flex; color:#8A97A5; transition:transform .2s;}" +
      ".section-card.collapsed .section-head .chev{transform:rotate(-90deg);}" +
      ".section-card.collapsed > :not(.section-head){display:none;}";
    document.head.appendChild(st);

    var bar = document.createElement("div");
    bar.className = "admin-search";
    bar.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>' +
      '<input type="search" id="adminSearch" placeholder="Buscar por nombre, marca o característica…" autocomplete="off">';
    wrap.insertBefore(bar, wrap.firstChild);
    bar.querySelector("input").addEventListener("input", function (e) {
      FILTER = norm(e.target.value.trim());
      renderAll();
    });

    // Cabeceras de sección plegables (Calderas / Aires / Termos)
    Array.prototype.forEach.call(document.querySelectorAll(".section-card"), function (card) {
      var head = card.querySelector(".section-head");
      if (!head) return;
      head.classList.add("clickable");
      var chev = document.createElement("span");
      chev.className = "chev";
      chev.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
      head.appendChild(chev);
      card.classList.add("collapsed"); // plegadas por defecto: con cientos de productos se agradece
      head.addEventListener("click", function () { card.classList.toggle("collapsed"); });
    });

    // Al añadir un producto: limpiar la búsqueda y desplegar su sección,
    // para que la ficha nueva (vacía) no quede filtrada ni oculta.
    // (fase de captura: corre antes que el handler que crea la ficha)
    document.addEventListener("click", function (e) {
      var addBtn = e.target.closest("[data-add]");
      if (!addBtn) return;
      if (FILTER) {
        FILTER = "";
        var s = $("adminSearch");
        if (s) s.value = "";
        renderAll();
      }
      var card = addBtn.closest(".section-card");
      if (card) card.classList.remove("collapsed");
    }, true);
  })();
})();
