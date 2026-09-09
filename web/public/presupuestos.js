// ============================================================
// presupuestos.js — Los presupuestos que la web ha dado sola.
//
// Cada vez que alguien usa el presupuesto rápido de la portada, sus datos
// se guardan como cliente (tabla `leads`, la de siempre) con un mensaje
// que empieza por "PRESUPUESTO RÁPIDO desde la web". Aquí se recogen esos
// clientes y se enseñan ya masticados: quién es, cómo llamarle, qué pidió
// y qué precios llegó a ver.
//
// Por qué se leen de `leads` y no de una tabla aparte: un cliente es un
// cliente. Si se guardara en dos sitios habría que cuadrarlos a mano, y
// alguien que pide precio por aquí acabaría sin aparecer en Clientes.
// ============================================================
(function () {
  "use strict";

  var cfg = window.DECOGAS_CONFIG || {};
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) return;

  var MARCA = "PRESUPUESTO RÁPIDO desde la web";
  var sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  var caja = function () { return document.getElementById("presupuestosBox"); };
  var cuenta = function () { return document.getElementById("presupuestosCount"); };
  var cargando = false, cargado = false;

  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fecha(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return "";
    var dias = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
    return dias[d.getDay()] + " " + d.getDate() + "/" + (d.getMonth() + 1) + " · " +
      String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  // ---------- Leer el mensaje que dejó el presupuesto ----------
  // El texto lo escribe presupuesto-rapido.js y tiene esta forma:
  //   PRESUPUESTO RÁPIDO desde la web
  //   Servicio: Cambiar caldera
  //   Vivienda: 120 m², 2 baños
  //   ...
  //   Presupuesto mostrado: A — 1250 € | B — 1695 € | C — 3595 €
  //   Encajaban 33 máquinas (1250 € a 3595 €)
  // o bien:
  //   SIN PRECIO AUTOMÁTICO. Motivos: ...
  function leer(msg) {
    var t = String(msg || "");
    var out = { respuestas: [], maquinas: [], motivos: [], abanico: "" };
    t.split("\n").forEach(function (l) {
      l = l.trim();
      if (!l || l === MARCA) return;
      if (/^Presupuesto mostrado:/i.test(l)) {
        out.maquinas = l.replace(/^Presupuesto mostrado:\s*/i, "").split("|").map(function (x) { return x.trim(); });
      } else if (/^Encajaban/i.test(l)) {
        out.abanico = l;
      } else if (/^SIN PRECIO/i.test(l)) {
        out.motivos = l.replace(/^SIN PRECIO AUTOMÁTICO\.\s*Motivos:\s*/i, "").split(";").map(function (x) { return x.trim(); }).filter(Boolean);
      } else if (l.indexOf(":") !== -1) {
        out.respuestas.push(l);
      }
    });
    return out;
  }

  function tel(n) { return String(n || "").replace(/[^\d+]/g, ""); }

  function fila(l) {
    var p = leer(l.message);
    var dio = p.maquinas.length > 0;
    var resumen = dio
      ? p.maquinas[0].split("—")[1] ? "desde " + p.maquinas[0].split("—")[1].trim() : "con precio"
      : "sin precio";

    return '<div class="pres-item' + (dio ? "" : " sin") + '">' +
      '<button type="button" class="pres-cab" aria-expanded="false">' +
        '<span class="pres-flecha" aria-hidden="true">▸</span>' +
        '<span class="pres-quien">' + esc(l.name || "Sin nombre") + "</span>" +
        '<span class="pres-que">' + esc(l.interest || "—") + "</span>" +
        '<span class="pres-marca">' + esc(resumen) + "</span>" +
        '<span class="pres-cuando">' + esc(fecha(l.created_at)) + "</span>" +
      "</button>" +
      '<div class="pres-detalle" hidden>' +
        '<div class="pres-contacto">' +
          (l.phone ? '<a class="btn ghost small" href="tel:' + esc(tel(l.phone)) + '">📞 ' + esc(l.phone) + "</a>" : "") +
          (l.email ? '<a class="btn ghost small" href="mailto:' + esc(l.email) + '">✉ ' + esc(l.email) + "</a>" : "") +
          (l.phone ? '<a class="btn ghost small" href="https://wa.me/' + esc(tel(l.phone).replace(/^\+?34?/, "34")) + '" target="_blank" rel="noopener">WhatsApp</a>' : "") +
        "</div>" +
        '<div class="pres-cols">' +
          '<div><p class="pres-tit">Lo que nos ha contado</p><ul class="pres-lista">' +
            (p.respuestas.length ? p.respuestas.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("")
                                 : "<li>Sin detalle</li>") +
          "</ul></div>" +
          "<div>" +
            (dio
              ? '<p class="pres-tit">Precios que ha visto</p><ul class="pres-lista">' +
                  p.maquinas.map(function (m) { return "<li>" + esc(m) + "</li>"; }).join("") + "</ul>" +
                  (p.abanico ? '<p class="pres-nota">' + esc(p.abanico) + "</p>" : "")
              : '<p class="pres-tit">No se le dio precio</p><ul class="pres-lista">' +
                  (p.motivos.length ? p.motivos.map(function (m) { return "<li>" + esc(m) + "</li>"; }).join("")
                                    : "<li>Sin motivo registrado</li>") + "</ul>" +
                  '<p class="pres-nota">Este cliente espera que le llaméis.</p>') +
          "</div>" +
        "</div>" +
      "</div>" +
    "</div>";
  }

  function pintar(leads) {
    var el = caja();
    if (!el) return;
    var c = cuenta();
    if (c) c.textContent = leads.length ? leads.length + (leads.length === 1 ? " presupuesto" : " presupuestos") : "";

    if (!leads.length) {
      el.innerHTML = '<p class="pres-vacio">Todavía no ha usado nadie el presupuesto rápido de la portada. ' +
        "En cuanto alguien lo use, aparecerá aquí con sus datos y con los precios que llegó a ver.</p>";
      return;
    }

    var conPrecio = leads.filter(function (l) { return /Presupuesto mostrado:/i.test(l.message || ""); }).length;
    el.innerHTML =
      '<p class="pres-resumen"><strong>' + leads.length + "</strong> personas han pedido precio desde la portada. " +
        "A <strong>" + conPrecio + "</strong> se les pudo dar una cifra al momento; las otras <strong>" +
        (leads.length - conPrecio) + "</strong> esperan vuestra llamada.</p>" +
      '<div class="pres-lista-items">' + leads.map(fila).join("") + "</div>";

    // Desplegar / plegar cada uno
    Array.prototype.forEach.call(el.querySelectorAll(".pres-cab"), function (b) {
      b.addEventListener("click", function () {
        var abierto = b.getAttribute("aria-expanded") === "true";
        b.setAttribute("aria-expanded", abierto ? "false" : "true");
        b.parentNode.querySelector(".pres-detalle").hidden = abierto;
        b.querySelector(".pres-flecha").textContent = abierto ? "▸" : "▾";
      });
    });
  }

  function cargar(forzar) {
    if (cargando || (cargado && !forzar)) return;
    cargando = true;
    var el = caja();
    if (el) el.innerHTML = '<p class="pres-vacio">Cargando…</p>';
    sb.from("leads").select("*")
      .ilike("message", MARCA + "%")
      .order("created_at", { ascending: false })
      .limit(500)
      .then(function (res) {
        cargando = false;
        if (res.error) {
          if (el) el.innerHTML = '<p class="pres-vacio">No se han podido leer los presupuestos: ' + esc(res.error.message) + "</p>";
          return;
        }
        cargado = true;
        pintar(res.data || []);
      })
      .catch(function () {
        cargando = false;
        if (el) el.innerHTML = '<p class="pres-vacio">No se ha podido conectar. Prueba a actualizar.</p>';
      });
  }

  // Igual que la analítica: se carga cuando hay sesión de administrador.
  sb.auth.getSession().then(function (r) { if (r && r.data && r.data.session) cargar(); });
  if (sb.auth.onAuthStateChange) {
    sb.auth.onAuthStateChange(function (_e, s) { if (s) cargar(); });
  }
  document.addEventListener("click", function (e) {
    if (e.target && e.target.id === "presupuestosRefresh") cargar(true);
  });
})();
