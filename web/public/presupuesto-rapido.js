// ============================================================
// presupuesto-rapido.js — Presupuesto orientativo en la portada
//
// Convive con el formulario de siempre, no lo sustituye: son dos pestañas
// dentro de la misma tarjeta. Quien quiere contar su caso escribe; quien
// solo quiere saber el precio responde unas pocas preguntas y lo ve al momento.
//
// De dónde sale el precio: NO se inventa nada. Se cruza lo que responde el
// cliente con la columna "ideal_for" del catálogo, que ya dice para qué
// vivienda sirve cada máquina ("Viviendas de hasta 150 m² con 2 baños").
// Si nada encaja, no se enseña ningún precio: se recoge el caso y se avisa
// de que llamamos nosotros.
// ============================================================
(function () {
  "use strict";

  var cfg = window.DECOGAS_CONFIG || {};
  var LIVE = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);
  var $ = function (id) { return document.getElementById(id); };

  var caja = $("presupuestoRapido");
  if (!caja) return;

  // Lo que entra en el precio, tal y como está explicado en las páginas de
  // calderas y de aires. Si allí cambia, cambiar aquí también.
  var INCLUYE = {
    calderas: [
      "Instalación estándar con 80 cm de tubo de salida de humos y 3 m de conexión a desagüe",
      "Puesta en marcha y análisis de combustión con analizador homologado, por escrito",
      "Retirada del equipo antiguo",
      "Garantía de 2 años en la instalación y 3 años en la máquina"
    ],
    aires: [
      "Instalación estándar con 3 m de línea frigorífica y 1 m de canaleta interior",
      "Puesta en marcha y comprobación de funcionamiento",
      "Garantía de 2 años en la instalación y 3 años en la máquina"
    ]
  };
  var EXTRAS = "Si tu vivienda necesita más metros o piezas adicionales, se facturan a 36,30 €/ud. El técnico te lo confirma en la visita, antes de instalar nada.";

  var CAT = [];
  var R = {};
  var pila = [];

  var esc = function (t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var eur = function (n) { return Number(n).toLocaleString("es-ES") + " €"; };

  // ---------- Catálogo ----------
  // Se lee una sola vez, y solo cuando el cliente abre la pestaña: así no
  // penaliza la carga de la portada a quien no la usa.
  // Si alguien vuelve a pedir el catálogo mientras se está trayendo, se
  // apunta en la cola. Antes se descartaba, y el que esperaba se quedaba
  // colgado para siempre.
  var cargando = false;
  var enEspera = [];
  function cargarCatalogo(despues) {
    if (CAT.length) return despues();
    if (!LIVE) return despues();
    if (cargando) { enEspera.push(despues); return; }
    cargando = true;
    fetch(cfg.supabaseUrl.replace(/\/+$/, "") +
      "/rest/v1/products?select=name,brand,price,category,ideal_for,efficiency&visible=eq.true&order=price.asc", {
      headers: { apikey: cfg.supabaseAnonKey, Authorization: "Bearer " + cfg.supabaseAnonKey }
    })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (d) {
        CAT = (d || []).map(function (p) {
          return {
            n: p.name, m: p.brand, p: p.price, c: p.category,
            e: p.efficiency, i: p.ideal_for,
            m2: leerM2(p.ideal_for), b: leerBanos(p.ideal_for)
          };
        });
        cargando = false;
        despues();
        avisarEspera();
      })
      .catch(function () { cargando = false; despues(); avisarEspera(); });
  }

  function avisarEspera() {
    var cola = enEspera; enEspera = [];
    cola.forEach(function (f) { f(); });
  }

  // "Viviendas de hasta 150 m² con 2 baños." -> 150 y 2
  function leerM2(t) { var m = /(\d+)\s*m/.exec(t || ""); return m ? Number(m[1]) : null; }
  function leerBanos(t) {
    var m = /(\d+)\s*(?:-\s*(\d+)\s*)?ba/.exec(t || "");
    return m ? Number(m[2] || m[1]) : null;
  }

  // ---------- Las preguntas ----------
  var PASOS = {
    inicio: {
      p: "¿Qué necesitas?",
      campo: "servicio",
      ops: [
        { t: "Cambiar mi caldera", v: "caldera", ir: "banos" },
        { t: "Instalar aire acondicionado", v: "aire", ir: "estancias" },
        { t: "Aerotermia", v: "aerotermia", ir: "datos" },
        { t: "Una avería o reparación", v: "reparacion", ir: "datos" }
      ]
    },
    banos: {
      p: "¿Cuántos baños tiene la vivienda?",
      campo: "banos",
      ops: [{ t: "1 baño", v: 1, ir: "metros" }, { t: "2 baños", v: 2, ir: "metros" }, { t: "3 o más", v: 3, ir: "metros" }]
    },
    metros: {
      p: "¿Cuántos metros cuadrados tiene?",
      campo: "metros",
      ops: [
        { t: "Hasta 90 m²", v: 90, ir: "gas" },
        { t: "Entre 90 y 120 m²", v: 120, ir: "gas" },
        { t: "Entre 120 y 150 m²", v: 150, ir: "gas" },
        { t: "Más de 150 m²", v: 200, ir: "gas" }
      ]
    },
    gas: {
      p: "¿Ya tienes caldera de gas instalada?",
      campo: "gas",
      ops: [
        { t: "Sí, la cambio por otra", v: "si", ir: "sitio" },
        { t: "No, sería instalación nueva", v: "no", ir: "datos" }
      ]
    },
    sitio: {
      p: "¿La caldera nueva iría en el mismo sitio?",
      campo: "sitio",
      ops: [
        { t: "Sí, en el mismo sitio", v: "si", ir: "datos" },
        { t: "No, quiero cambiarla de sitio", v: "no", ir: "datos" },
        { t: "No lo sé", v: "nose", ir: "datos" }
      ]
    },
    estancias: {
      p: "¿Cuántas estancias quieres climatizar?",
      campo: "estancias",
      ops: [{ t: "Una", v: 1, ir: "metrosAire" }, { t: "Dos", v: 2, ir: "metrosAire" }, { t: "Tres o más", v: 3, ir: "metrosAire" }]
    },
    metrosAire: {
      p: "¿Cuántos m² tiene la estancia más grande?",
      campo: "metrosAire",
      ops: [
        { t: "Hasta 25 m²", v: 25, ir: "preinst" },
        { t: "Entre 25 y 35 m²", v: 35, ir: "preinst" },
        { t: "Entre 35 y 50 m²", v: 50, ir: "preinst" },
        { t: "Más de 50 m²", v: 70, ir: "preinst" }
      ]
    },
    preinst: {
      p: "¿Tienes preinstalación de aire?",
      campo: "preinst",
      ops: [
        { t: "Sí, ya está puesta", v: "si", ir: "datos" },
        { t: "No", v: "no", ir: "datos" },
        { t: "No lo sé", v: "nose", ir: "datos" }
      ]
    }
  };

  var TOTAL = { caldera: 5, aire: 4, aerotermia: 2, reparacion: 2 };

  function pintar(id) {
    if (id === "datos") return pintarDatos();
    var paso = PASOS[id];
    var total = TOTAL[R.servicio] || 5;
    caja.innerHTML =
      '<div class="pr-barra"><i style="width:' + Math.min(96, (pila.length / total) * 100) + '%"></i></div>' +
      '<p class="pr-num">Pregunta ' + (pila.length + 1) + '</p>' +
      '<h3 class="pr-preg">' + esc(paso.p) + "</h3>" +
      '<div class="pr-ops">' + paso.ops.map(function (o, k) {
        return '<button type="button" class="pr-op" data-k="' + k + '">' + esc(o.t) + "</button>";
      }).join("") + "</div>" +
      (pila.length ? '<button type="button" class="pr-atras">← Volver</button>' : "");

    Array.prototype.forEach.call(caja.querySelectorAll(".pr-op"), function (b) {
      b.addEventListener("click", function () {
        var o = paso.ops[Number(b.dataset.k)];
        R[paso.campo] = o.v;
        pila.push(id);
        pintar(o.ir);
      });
    });
    var atras = caja.querySelector(".pr-atras");
    if (atras) atras.addEventListener("click", function () { pintar(pila.pop()); });
  }

  function pintarDatos() {
    caja.innerHTML =
      '<div class="pr-barra"><i style="width:96%"></i></div>' +
      '<p class="pr-num">Último paso</p>' +
      '<h3 class="pr-preg">¿A dónde te lo enviamos?</h3>' +
      '<div class="field"><label for="prNombre">Nombre</label>' +
        '<input type="text" id="prNombre" maxlength="80" placeholder="Tu nombre"></div>' +
      '<div class="field"><label for="prTel">Teléfono</label>' +
        '<input type="tel" id="prTel" maxlength="25" placeholder="600 000 000"></div>' +
      '<div class="field"><label for="prEmail">Email</label>' +
        '<input type="email" id="prEmail" maxlength="120" placeholder="tu@email.com"></div>' +
      '<p class="pr-error" id="prError"></p>' +
      '<button type="button" class="btn btn-flame pr-enviar" id="prEnviar">Ver mi presupuesto</button>' +
      '<button type="button" class="pr-atras">← Volver</button>' +
      '<p class="pr-legal">Solo lo usamos para enviarte el presupuesto y contactarte. Nada de publicidad.</p>';

    caja.querySelector(".pr-atras").addEventListener("click", function () { pintar(pila.pop()); });
    $("prEnviar").addEventListener("click", enviar);
  }

  // ---------- Emparejar con el catálogo ----------
  function buscar() {
    if (R.servicio === "caldera") {
      return CAT.filter(function (p) {
        return p.c === "calderas" && p.m2 && p.b && p.m2 >= R.metros && p.b >= R.banos;
      }).slice(0, 3);
    }
    if (R.servicio === "aire" && R.estancias === 1) {
      return CAT.filter(function (p) {
        return p.c === "aires" && p.m2 && p.m2 >= R.metrosAire && p.n.indexOf("x1") === -1;
      }).slice(0, 3);
    }
    if (R.servicio === "aire") {
      var pat = R.estancias === 2 ? "2x1" : "3x1";
      return CAT.filter(function (p) { return p.c === "aires" && p.n.indexOf(pat) !== -1; }).slice(0, 3);
    }
    return [];
  }

  // Motivos por los que NO se puede dar un precio de forma responsable.
  function motivos(op) {
    var m = [];
    if (!op.length) m.push("Tu caso necesita que lo miremos con calma");
    if (R.servicio === "aerotermia") m.push("La aerotermia siempre necesita un estudio previo");
    if (R.servicio === "reparacion") m.push("Una avería hay que verla antes de dar un precio");
    if (R.gas === "no") m.push("Una instalación de gas nueva necesita visita técnica");
    if (R.sitio === "no") m.push("Cambiar la caldera de sitio necesita visita técnica");
    if (R.sitio === "nose" || R.preinst === "nose") m.push("Hay un dato que afecta al precio y no está claro");
    if (R.preinst === "no") m.push("Sin preinstalación hay que ver el recorrido de las tuberías");
    return m;
  }

  function resumenRespuestas() {
    var t = [];
    t.push("PRESUPUESTO RÁPIDO desde la web");
    t.push("Servicio: " + ({ caldera: "Cambiar caldera", aire: "Aire acondicionado", aerotermia: "Aerotermia", reparacion: "Reparación" }[R.servicio] || R.servicio));
    if (R.banos) t.push("Vivienda: " + R.metros + " m², " + R.banos + " baño" + (R.banos > 1 ? "s" : ""));
    if (R.gas) t.push("¿Ya tiene gas?: " + (R.gas === "si" ? "sí" : "no"));
    if (R.sitio) t.push("¿Mismo sitio?: " + ({ si: "sí", no: "no", nose: "no lo sabe" }[R.sitio]));
    if (R.estancias) t.push("Estancias: " + R.estancias + " · hasta " + R.metrosAire + " m²");
    if (R.preinst) t.push("¿Preinstalación?: " + ({ si: "sí", no: "no", nose: "no lo sabe" }[R.preinst]));
    return t.join("\n");
  }

  function enviar() {
    var nombre = ($("prNombre").value || "").trim();
    var tel = ($("prTel").value || "").trim();
    var email = ($("prEmail").value || "").trim();
    var err = $("prError");

    if (!nombre) { err.textContent = "Escribe tu nombre, por favor."; return; }
    if (tel.replace(/\D/g, "").length < 9) { err.textContent = "Escribe un teléfono válido."; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = "Escribe un email válido."; return; }
    err.textContent = "";
    $("prEnviar").disabled = true;

    // Si el catálogo aún no ha llegado (conexión lenta, o el cliente ha ido
    // muy rápido), se espera. Si no, buscar() no encontraría nada y le
    // diríamos "ya te llamamos" a alguien a quien sí le encajaba una máquina.
    if (LIVE && !CAT.length) {
      $("prEnviar").textContent = "Un momento\u2026";
      cargarCatalogo(function () { $("prEnviar").textContent = "Ver mi presupuesto"; decidir(nombre, tel, email); });
      return;
    }
    decidir(nombre, tel, email);
  }

  function decidir(nombre, tel, email) {
    var op = buscar();
    var faltan = motivos(op);
    var auto = op.length > 0 && faltan.length === 0;

    var texto = resumenRespuestas() + "\n\n" +
      (auto ? "Presupuesto mostrado: " + op[0].n + " — " + eur(op[0].p)
            : "SIN PRECIO AUTOMÁTICO. Motivos: " + faltan.join("; "));

    guardarLead({ name: nombre, phone: tel, email: email, message: texto,
      interest: R.servicio === "caldera" ? "Caldera de gas"
              : R.servicio === "aire" ? "Aire acondicionado"
              : R.servicio === "aerotermia" ? "Aerotermia" : "Reparación" });

    registrarConversion(email, tel);
    mostrarResultado(auto, op, faltan, nombre);
  }

  // Misma conversión de Google Ads que el formulario de siempre, con los
  // datos de usuario para Conversiones mejoradas (copiado de app.js).
  function registrarConversion(email, tel) {
    try {
      if (!window.gtag || !cfg.googleAdsConversions || !cfg.googleAdsConversions.formulario) return;
      var userData = {};
      if (email) userData.email = email;
      if (tel) {
        var d = tel.replace(/[^\d+]/g, "");
        userData.phone_number = d.indexOf("+") === 0 ? d : "+34" + d;
      }
      window.gtag("event", "conversion", { send_to: cfg.googleAdsConversions.formulario, user_data: userData });
    } catch (e) { /* la analítica nunca corta el flujo del cliente */ }
  }

  function guardarLead(lead) {
    if (!LIVE) return;
    fetch(cfg.supabaseUrl.replace(/\/+$/, "") + "/rest/v1/leads", {
      method: "POST",
      headers: {
        apikey: cfg.supabaseAnonKey,
        Authorization: "Bearer " + cfg.supabaseAnonKey,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify(lead)
    }).catch(function () { /* si falla el guardado, el cliente ya ve su precio igual */ });
  }

  function mostrarResultado(auto, op, faltan, nombre) {
    var incluye = INCLUYE[R.servicio === "caldera" ? "calderas" : "aires"] || [];
    if (auto) {
      var el = op[0];
      caja.innerHTML =
        '<div class="pr-ok">Listo, ' + esc(nombre.split(" ")[0]) + ". Esto es lo que encaja contigo:</div>" +
        '<div class="pr-maquina">' +
          '<p class="pr-et">La opción que mejor encaja</p>' +
          '<h3 class="pr-nom">' + esc(el.n) + "</h3>" +
          '<p class="pr-det">' + esc(el.m || "") + (el.e ? " · Eficiencia " + esc(el.e) : "") +
            (el.i ? "<br>" + esc(el.i) : "") + "</p>" +
          '<p class="pr-precio">' + eur(el.p) + ' <span>instalación incluida</span></p>' +
        "</div>" +
        (op.length > 1 ? '<p class="pr-otras">También te encajarían ' +
          op.slice(1).map(function (x) { return esc(x.n) + " (" + eur(x.p) + ")"; }).join(" y ") + ".</p>" : "") +
        '<div class="pr-incluye"><p class="pr-et">Qué incluye ese precio</p><ul>' +
          incluye.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" +
          '<p class="pr-extras">' + esc(EXTRAS) + "</p></div>" +
        '<p class="pr-aviso">Es un presupuesto orientativo, sujeto a visita técnica. Te llamamos para confirmarlo todo sin compromiso.</p>' +
        '<a class="btn btn-flame pr-enviar" href="tel:+34919930168">Llamar ahora · 919 93 01 68</a>' +
        '<button type="button" class="pr-atras" id="prOtro">Probar con otros datos</button>';
    } else {
      caja.innerHTML =
        '<div class="pr-ok">Gracias, ' + esc(nombre.split(" ")[0]) + ". Ya tenemos tus datos.</div>" +
        '<p class="pr-texto">Tu caso conviene mirarlo bien antes de darte un precio, así que te llamamos nosotros y te lo decimos con seguridad. Preferimos eso a darte una cifra que luego cambie.</p>' +
        (faltan.length ? '<ul class="pr-motivos">' + faltan.map(function (m) { return "<li>" + esc(m) + "</li>"; }).join("") + "</ul>" : "") +
        '<p class="pr-aviso">Respondemos el mismo día laborable. Si prefieres no esperar, llámanos.</p>' +
        '<a class="btn btn-flame pr-enviar" href="tel:+34919930168">Llamar ahora · 919 93 01 68</a>' +
        '<button type="button" class="pr-atras" id="prOtro">Empezar de nuevo</button>';
    }
    var otro = $("prOtro");
    if (otro) otro.addEventListener("click", reiniciar);
  }

  function reiniciar() { R = {}; pila = []; pintar("inicio"); }

  // ---------- Pestañas ----------
  var tabForm = $("tabFormulario");
  var tabPres = $("tabPresupuesto");
  var panelForm = $("panelFormulario");
  var panelPres = $("panelPresupuesto");

  function activar(cual) {
    var esPres = cual === "presupuesto";
    tabPres.classList.toggle("active", esPres);
    tabForm.classList.toggle("active", !esPres);
    tabPres.setAttribute("aria-selected", esPres ? "true" : "false");
    tabForm.setAttribute("aria-selected", esPres ? "false" : "true");
    panelPres.hidden = !esPres;
    panelForm.hidden = esPres;
    // Se pide el catálogo, pero NO se repinta nada: la primera pregunta no
    // depende de él. Repintando aquí se perdía el clic del cliente si lo daba
    // justo mientras llegaba la respuesta, y parecía que el botón no iba.
    if (esPres && !CAT.length) cargarCatalogo(function () {});
  }
  if (tabForm && tabPres) {
    tabForm.addEventListener("click", function () { activar("formulario"); });
    tabPres.addEventListener("click", function () { activar("presupuesto"); });
  }

  reiniciar();
})();
