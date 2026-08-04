// ============================================================
// analitica.js — Sección de analítica del panel de control.
// Lee public.web_events + leads de Supabase (solo admin, por RLS)
// y pinta: visitas, visitantes, llamadas, WhatsApp, formularios,
// evolución por día, páginas top, fuentes y móvil vs escritorio.
// ============================================================
(function () {
  "use strict";
  var cfg = window.DECOGAS_CONFIG || {};
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) return;

  var sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  var box = function () { return document.getElementById("analiticaBox"); };
  var busy = false, done = false;

  // ---------- Rango de fechas seleccionado ----------
  function ymd(d) { return d.toISOString().slice(0, 10); }
  function startOfDay(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function endOfDay(d) { var x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
  var RANGE = { since: startOfDay(new Date(Date.now() - 29 * 24 * 3600 * 1000)), until: endOfDay(new Date()), label: "Últimos 30 días" };

  function computeRange() {
    var sel = document.getElementById("analiticaRango");
    var val = sel ? sel.dataset.value : "30";
    var now = new Date();
    if (val === "7" || val === "30") {
      var n = val === "7" ? 6 : 29;
      RANGE = { since: startOfDay(new Date(Date.now() - n * 24 * 3600 * 1000)), until: endOfDay(now), label: "Últimos " + val + " días" };
    } else if (val === "mesActual") {
      var f = new Date(now.getFullYear(), now.getMonth(), 1);
      RANGE = { since: startOfDay(f), until: endOfDay(now), label: "Este mes" };
    } else if (val === "mesAnterior") {
      var fa = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      var ua = new Date(now.getFullYear(), now.getMonth(), 0);
      RANGE = { since: startOfDay(fa), until: endOfDay(ua), label: "Mes anterior" };
    } else if (val === "custom") {
      var di = document.getElementById("analiticaDesde"), hi = document.getElementById("analiticaHasta");
      var d = di && di.value ? new Date(di.value + "T00:00:00") : RANGE.since;
      var h = hi && hi.value ? new Date(hi.value + "T23:59:59") : RANGE.until;
      RANGE = { since: d, until: h, label: "Del " + ymd(d).split("-").reverse().join("/") + " al " + ymd(h).split("-").reverse().join("/") };
    }
    return RANGE;
  }

  function fmt(n) { return Number(n || 0).toLocaleString("es-ES"); }
  // Reutiliza el esc() compartido (escapa también la comilla simple); si no
  // estuviera cargado, usa un fallback local igual de estricto.
  var esc = (window.DecogasUtil && window.DecogasUtil.esc) || function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  function pretty(path) {
    if (!path || path === "/") return "Inicio";
    return path.replace(/^\//, "").replace(/\.html?$/, "").replace(/\/$/, "") || "Inicio";
  }

  function load(force) {
    if (busy || (done && !force)) return;
    var el = box(); if (!el) return;
    busy = true;
    el.innerHTML = '<p style="color:var(--muted); font-size:14px; padding:6px 0;">Cargando datos…</p>';
    var since = RANGE.since.toISOString(), until = RANGE.until.toISOString();
    Promise.all([
      sb.from("web_events").select("type,path,source,session,device,created_at").gte("created_at", since).lte("created_at", until).limit(50000),
      sb.from("leads").select("created_at").gte("created_at", since).lte("created_at", until).limit(5000)
    ]).then(function (res) {
      busy = false;
      if (res[0].error) {
        var msg = res[0].error.message || "";
        if (/web_events|does not exist|relation|schema cache/i.test(msg)) {
          el.innerHTML = '<div style="background:#FFF3E8; border:1px solid #FFD9C2; color:#E2501C; border-radius:11px; padding:16px; font-size:13.5px; line-height:1.6;">' +
            '<strong>Falta activar la analítica.</strong><br>Ejecuta en Supabase (SQL Editor) el archivo <code>supabase/setup-supabase-v8-analitica.sql</code> y recarga esta página. A partir de ahí se registrará cada visita.</div>';
          return;
        }
        el.innerHTML = '<p style="color:var(--err); font-size:14px;">No se pudo cargar la analítica: ' + esc(msg) + "</p>";
        return;
      }
      done = true;
      render(res[0].data || [], (res[1] && res[1].data) || []);
    }).catch(function (e) {
      busy = false;
      el.innerHTML = '<p style="color:var(--err); font-size:14px;">Error cargando analítica.</p>';
    });
  }

  function render(events, leads) {
    var el = box(); if (!el) return;

    var views = 0, calls = 0, wa = 0;
    var sessions = {}, byDay = {}, byDayC = {}, byDayW = {}, byPage = {}, bySource = {}, dev = { movil: 0, escritorio: 0 };
    for (var i = 0; i < events.length; i++) {
      var e = events[i];
      if (e.session) sessions[e.session] = 1;
      if (e.type === "pageview") {
        views++;
        var d = (e.created_at || "").slice(0, 10);
        byDay[d] = (byDay[d] || 0) + 1;
        var pg = pretty(e.path);
        byPage[pg] = (byPage[pg] || 0) + 1;
        var src = e.source || "directo";
        if (src === "interno") src = "directo";
        bySource[src] = (bySource[src] || 0) + 1;
        if (e.device === "movil") dev.movil++; else if (e.device === "escritorio") dev.escritorio++;
      } else if (e.type === "call") { calls++; var dc = (e.created_at || "").slice(0, 10); byDayC[dc] = (byDayC[dc] || 0) + 1; }
      else if (e.type === "whatsapp") { wa++; var dw = (e.created_at || "").slice(0, 10); byDayW[dw] = (byDayW[dw] || 0) + 1; }
    }
    var visitantes = Object.keys(sessions).length;
    var formularios = leads.length;
    var contactos = calls + wa + formularios;

    // ---- Tarjetas de resumen ----
    function card(label, value, accent, sub) {
      return '<div style="background:var(--cloud); border:1px solid var(--line); border-radius:13px; padding:14px 16px;">' +
        '<div style="font-family:\'IBM Plex Mono\'; font-size:10.5px; color:var(--muted); text-transform:uppercase; letter-spacing:.05em;">' + label + "</div>" +
        '<div style="font-family:\'Fraunces\',serif; font-weight:700; font-size:27px; line-height:1.1; margin-top:5px;' + (accent ? " color:" + accent + ";" : "") + '">' + value + "</div>" +
        (sub ? '<div style="font-size:11.5px; color:var(--muted); margin-top:3px;">' + sub + "</div>" : "") +
        "</div>";
    }
    var cards = '<div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(115px,1fr)); gap:12px; margin-bottom:22px;">' +
      card("Visitas", fmt(views)) +
      card("Visitantes", fmt(visitantes)) +
      card("Llamadas", fmt(calls), "var(--flame)") +
      card("WhatsApp", fmt(wa), "#1E9E5A") +
      card("Formularios", fmt(formularios), "var(--ice)") +
      card("Contactos totales", fmt(contactos), "var(--navy)", "llamadas + WhatsApp + formularios") +
      "</div>";

    // ---- Gráfico por día (según el rango elegido, máx. 31 barras) ----
    var totalDias = Math.round((RANGE.until - RANGE.since) / (24 * 3600 * 1000)) + 1;
    var CAP = 31;
    var days = [];
    var nDias = Math.min(totalDias, CAP);
    for (var k = nDias - 1; k >= 0; k--) {
      var dt = new Date(RANGE.until.getTime() - k * 24 * 3600 * 1000);
      days.push(dt.toISOString().slice(0, 10));
    }
    var chartNote = totalDias > CAP ? " (mostrando los últimos " + CAP + " días del rango)" : "";
    var maxDay = 1;
    days.forEach(function (dd) { if ((byDay[dd] || 0) > maxDay) maxDay = byDay[dd]; });
    function dayDetailHTML(dd) {
      var v = byDay[dd] || 0, c = byDayC[dd] || 0, w = byDayW[dd] || 0;
      var human = dd.slice(8, 10) + "/" + dd.slice(5, 7) + "/" + dd.slice(0, 4);
      return '<b>' + human + '</b> — ' + fmt(v) + ' visitas · ' + fmt(c) + ' llamadas · ' + fmt(w) + ' WhatsApp';
    }
    var bars = days.map(function (dd) {
      var v = byDay[dd] || 0;
      var h = Math.round((v / maxDay) * 100);
      var lbl = dd.slice(8, 10) + "/" + dd.slice(5, 7);
      return '<div class="aday" data-day="' + dd + '" title="' + lbl + ": " + v + ' visitas">' +
        '<div style="font-size:9.5px; font-weight:700; color:var(--navy); font-family:\'IBM Plex Mono\'; min-height:12px;">' + (v || "") + "</div>" +
        '<div style="width:100%; height:70px; display:flex; align-items:flex-end;">' +
        '<div style="width:100%; background:linear-gradient(180deg,#FF7A45,#E2501C); height:' + Math.max(h, 2) + '%; border-radius:4px 4px 0 0;"></div></div>' +
        '<div style="font-size:9px; color:var(--muted); font-family:\'IBM Plex Mono\';">' + dd.slice(8, 10) + "</div></div>";
    }).join("");
    var chart = '<div style="margin-bottom:22px;">' +
      '<div style="font-size:12.5px; font-weight:600; color:var(--muted); margin-bottom:10px;">Visitas por día' + esc(chartNote) + ' · pulsa un día para ver su detalle</div>' +
      '<div id="dayChart" class="day-chart">' + bars + "</div>" +
      '<div id="dayDetail" style="margin-top:10px; font-size:13px; color:var(--text); background:var(--cloud); border:1px solid var(--line); border-radius:9px; padding:9px 12px;">' + dayDetailHTML(days[days.length - 1]) + "</div>" +
      "</div>";

    // ---- Listas (páginas top + fuentes) ----
    function rankList(title, obj, total) {
      var arr = Object.keys(obj).map(function (k) { return [k, obj[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6);
      if (!arr.length) return '<div><div style="font-size:12.5px; font-weight:600; color:var(--muted); margin-bottom:10px;">' + title + '</div><p style="font-size:13px; color:var(--muted);">Sin datos todavía.</p></div>';
      var rows = arr.map(function (r) {
        var pct = total ? Math.round((r[1] / total) * 100) : 0;
        return '<div style="margin-bottom:9px;">' +
          '<div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:3px;"><span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:72%;">' + esc(r[0]) + '</span><span style="font-family:\'IBM Plex Mono\'; color:var(--muted);">' + fmt(r[1]) + "</span></div>" +
          '<div style="height:6px; background:var(--line); border-radius:99px; overflow:hidden;"><div style="height:100%; width:' + pct + '%; background:var(--navy); border-radius:99px;"></div></div>' +
          "</div>";
      }).join("");
      return '<div><div style="font-size:12.5px; font-weight:600; color:var(--muted); margin-bottom:10px;">' + title + "</div>" + rows + "</div>";
    }
    var lists = '<div class="analitica-lists">' +
      rankList("Páginas más vistas", byPage, views) +
      rankList("De dónde vienen", bySource, views) +
      "</div>";

    // ---- Móvil vs escritorio ----
    var devTotal = dev.movil + dev.escritorio || 1;
    var movilPct = Math.round((dev.movil / devTotal) * 100);
    var escPct = 100 - movilPct;
    var deviceBar = '<div style="margin-top:22px;">' +
      '<div style="font-size:12.5px; font-weight:600; color:var(--muted); margin-bottom:8px;">Dispositivo</div>' +
      '<div style="display:flex; height:12px; border-radius:999px; overflow:hidden; background:var(--line);">' +
        '<div style="width:' + movilPct + '%; background:var(--flame);"></div>' +
        '<div style="width:' + escPct + '%; background:#3E5C76;"></div>' +
      '</div>' +
      '<div style="display:flex; justify-content:space-between; gap:12px; margin-top:9px; font-size:12.5px; font-weight:600; color:var(--text);">' +
        '<span style="display:inline-flex; align-items:center; gap:6px;"><span style="width:9px; height:9px; border-radius:2px; background:var(--flame); flex:none;"></span>Móvil ' + movilPct + '%</span>' +
        '<span style="display:inline-flex; align-items:center; gap:6px;"><span style="width:9px; height:9px; border-radius:2px; background:#3E5C76; flex:none;"></span>Escritorio ' + escPct + '%</span>' +
      '</div>' +
    '</div>';

    var note = views === 0
      ? '<div style="background:var(--cloud); border:1px dashed var(--line); border-radius:11px; padding:14px; font-size:13px; color:var(--muted); margin-top:18px;">Aún no hay visitas registradas. En cuanto la web reciba tráfico, aquí verás todo en tiempo casi real.</div>'
      : "";

    el.innerHTML = cards + chart + lists + deviceBar + note;
    var dayChartEl = el.querySelector("#dayChart");
    if (dayChartEl) {
      dayChartEl.addEventListener("click", function (ev) {
        var b = ev.target && ev.target.closest ? ev.target.closest(".aday") : null;
        if (!b) return;
        var det = el.querySelector("#dayDetail");
        if (det) det.innerHTML = dayDetailHTML(b.getAttribute("data-day"));
        var all = el.querySelectorAll(".aday");
        for (var z = 0; z < all.length; z++) all[z].style.opacity = ".5";
        b.style.opacity = "1";
      });
    }
  }

  // Cargar cuando haya sesión de admin (sesión directa o login nuevo)
  sb.auth.getSession().then(function (r) { if (r && r.data && r.data.session) load(); });
  if (sb.auth.onAuthStateChange) {
    sb.auth.onAuthStateChange(function (_e, s) { if (s) load(); });
  }
  // Botón de refresco (si existe)
  document.addEventListener("click", function (e) {
    if (e.target && e.target.id === "analiticaRefresh") { computeRange(); done = false; load(true); }
  });

  // Selector de rango (desplegable propio, no <select> nativo): los presets
  // recargan al momento; "personalizado" solo muestra los campos de fecha y
  // espera al botón Actualizar.
  function selectRange(value, label) {
    var trigger = document.getElementById("analiticaRango");
    if (!trigger) return;
    trigger.dataset.value = value;
    var labelEl = document.getElementById("analiticaRangoLabel");
    if (labelEl) labelEl.textContent = label;

    var isCustom = value === "custom";
    var di = document.getElementById("analiticaDesde"), hi = document.getElementById("analiticaHasta"), g = document.getElementById("analiticaGuion");
    if (di) di.style.display = isCustom ? "inline-block" : "none";
    if (hi) hi.style.display = isCustom ? "inline-block" : "none";
    if (g) g.style.display = isCustom ? "inline" : "none";
    if (!isCustom) { computeRange(); done = false; load(true); }
  }
  document.addEventListener("click", function (e) {
    var trigger = e.target.closest && e.target.closest("#analiticaRango");
    var menu = document.querySelector(".range-menu");
    if (trigger) {
      var open = menu.classList.toggle("open");
      trigger.setAttribute("aria-expanded", String(open));
      return;
    }
    var opt = e.target.closest && e.target.closest(".range-opt");
    if (opt && menu && menu.contains(opt)) {
      menu.querySelectorAll(".range-opt").forEach(function (o) { o.classList.remove("active"); o.removeAttribute("aria-selected"); });
      opt.classList.add("active");
      opt.setAttribute("aria-selected", "true");
      menu.classList.remove("open");
      var t = document.getElementById("analiticaRango");
      if (t) t.setAttribute("aria-expanded", "false");
      selectRange(opt.dataset.value, opt.textContent);
      return;
    }
    if (menu && menu.classList.contains("open") && !menu.contains(e.target)) {
      menu.classList.remove("open");
      var trg = document.getElementById("analiticaRango");
      if (trg) trg.setAttribute("aria-expanded", "false");
    }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var menu = document.querySelector(".range-menu.open");
    if (menu) {
      menu.classList.remove("open");
      var trg = document.getElementById("analiticaRango");
      if (trg) trg.setAttribute("aria-expanded", "false");
    }
  });
})();
