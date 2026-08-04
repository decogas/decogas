// ============================================================
// clientes.js — Panel de clientes (solicitudes del formulario)
//  · LIVE: lee la tabla "leads" de Supabase (solo autenticados).
//  · DEMO: lee los guardados en este navegador (localStorage).
// Filtros: nombre, rango de fechas e interés (caldera/aire/otros).
// ============================================================
(function () {
  "use strict";

  var cfg = window.DECOGAS_CONFIG || {};
  var LIVE = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  var sb = LIVE ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;

  var $ = function (id) { return document.getElementById(id); };
  var esc = window.DecogasUtil.esc;
  var norm = window.DecogasUtil.norm;

  var LEADS = [];

  // Notas internas por cliente (mini-CRM). Se guardan en este navegador
  // (localStorage) porque la tabla no tiene columna de nota.
  var NOTES = {};
  try { NOTES = JSON.parse(localStorage.getItem("decogas_lead_notes") || "{}") || {}; } catch (e) { NOTES = {}; }
  function saveNote(id, text) {
    if (text) NOTES[id] = text; else delete NOTES[id];
    try { localStorage.setItem("decogas_lead_notes", JSON.stringify(NOTES)); } catch (e) { /* sin storage */ }
  }
  var FILTER = { name: "", from: null, to: null, interest: "", estado: "" };

  // Estados del mini-CRM (v7): deben coincidir con el CHECK de la BD
  var ESTADOS = ["pendiente", "llamado", "presupuestado", "aprobado", "denegado"];
  var ESTADO_LABEL = { pendiente: "Pendiente", llamado: "Llamado", presupuestado: "Presupuestado", aprobado: "Aprobado", denegado: "Denegado" };
  // Flechita del desplegable de estado (se repite en el botón al abrir/cerrar/revertir)
  var ESTADO_CARET = '<svg class="lead-estado-caret" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';

  var toastTimer;
  function toast(text, isErr) {
    var t = $("toast");
    t.textContent = text;
    t.className = isErr ? "err show" : "show";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 3200);
  }

  // ---------- Registro de auditoría (best-effort) ----------
  // Igual que en admin.js: nunca debe romper la operación principal si falla.
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

  // ---------- Sesión compartida entre paneles ----------
  if (LIVE) {
    sb.auth.getSession().then(function (res) {
      if (res.data && res.data.session) {
        $("loginScreen").classList.add("hidden");
        $("panel").style.display = "block";
        loadLeads();
      }
    }).catch(function () {
      // Sin red no podemos recuperar la sesión: dejamos la pantalla de login.
    });
  }

  // ---------- Login (mismo usuario que el panel de catálogo) ----------
  $("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var msg = $("loginMsg");
    msg.classList.remove("show");
    $("loginBtn").disabled = true;
    var enter = function () {
      $("loginScreen").classList.add("hidden");
      $("panel").style.display = "block";
      loadLeads();
    };
    if (!LIVE) { enter(); $("loginBtn").disabled = false; return; }
    sb.auth.signInWithPassword({ email: $("adminEmail").value.trim(), password: $("adminPass").value })
      .then(function (res) {
        $("loginBtn").disabled = false;
        if (res.error) { msg.textContent = "Credenciales incorrectas."; msg.classList.add("show"); return; }
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
  function normalizeLead(r) {
    return {
      id: r.id || null,
      created_at: r.created_at || new Date().toISOString(),
      name: String(r.name || ""), phone: String(r.phone || ""),
      email: String(r.email || ""), interest: String(r.interest || ""),
      message: String(r.message || ""),
      // Autocontenida (sin variables externas): el harness de tests la extrae aislada
      estado: ["pendiente", "llamado", "presupuestado", "aprobado", "denegado"].indexOf(r.estado) !== -1 ? r.estado : "pendiente"
    };
  }
  function loadLeads() {
    if (LIVE) {
      sb.from("leads").select("*").order("created_at", { ascending: false }).then(function (res) {
        if (res.error) {
          toast("Error leyendo clientes: " + res.error.message + " — ¿ejecutaste setup-supabase-v4.sql?", true);
          LEADS = [];
        } else {
          LEADS = (res.data || []).map(normalizeLead);
        }
        render();
      });
    } else {
      try { LEADS = JSON.parse(localStorage.getItem("decogas_leads") || "[]").map(normalizeLead); }
      catch (e) { LEADS = []; }
      render();
    }
  }

  // ---------- Clasificación de interés ----------
  function interestGroup(interest) {
    var t = norm(interest);
    if (t.indexOf("caldera") !== -1) return "caldera";
    if (t.indexOf("aire") !== -1) return "aire";
    return "otro";
  }
  function badgeHTML(interest) {
    var g = interestGroup(interest);
    var cls = g === "caldera" ? "caldera" : g === "aire" ? "aire" : "otro";
    return '<span class="badge ' + cls + '">' + esc(interest || "Consulta") + "</span>";
  }

  // ---------- Filtros ----------
  function filtered() {
    return LEADS.filter(function (l) {
      if (FILTER.name && norm(l.name).indexOf(FILTER.name) === -1) return false;
      var d = new Date(l.created_at);
      if (FILTER.from && d < FILTER.from) return false;
      if (FILTER.to) {
        var end = new Date(FILTER.to);
        end.setHours(23, 59, 59, 999);
        if (d > end) return false;
      }
      if (FILTER.interest && interestGroup(l.interest) !== FILTER.interest) return false;
      if (FILTER.estado && l.estado !== FILTER.estado) return false;
      return true;
    });
  }

  // ---------- Render ----------
  function fmtDate(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) +
      " · " + d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  }
  // ---------- Estadísticas (solicitudes/semana + estados + interés) ----------
  function weekStart(d) {
    var x = new Date(d);
    x.setHours(0, 0, 0, 0);
    var day = (x.getDay() + 6) % 7; // lunes = 0
    x.setDate(x.getDate() - day);
    return x;
  }
  function renderStats() {
    var box = $("leadsList");
    if (!box || !box.parentNode || typeof box.parentNode.insertBefore !== "function") return;
    var host = $("statsPro");
    if (!host) {
      host = document.createElement("div");
      host.id = "statsPro";
      host.className = "stats-pro";
      box.parentNode.insertBefore(host, box);
    }
    if (!LEADS.length) { host.innerHTML = ""; return; }

    // Solicitudes por semana (últimas 8, de lunes a domingo)
    var weeks = [];
    var w = weekStart(new Date());
    for (var i = 7; i >= 0; i--) {
      var ini = new Date(w);
      ini.setDate(ini.getDate() - i * 7);
      weeks.push({ ini: ini, n: 0 });
    }
    LEADS.forEach(function (l) {
      var ws = weekStart(new Date(l.created_at)).getTime();
      for (var j = 0; j < weeks.length; j++) {
        if (weeks[j].ini.getTime() === ws) { weeks[j].n++; return; }
      }
    });
    var max = Math.max.apply(null, weeks.map(function (x) { return x.n; }).concat([1]));
    var bars = weeks.map(function (x) {
      var h = Math.round((x.n / max) * 100);
      var label = x.ini.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
      return '<div class="sp-col" title="Semana del ' + label + ": " + x.n + '">' +
        '<span class="sp-n">' + (x.n || "") + "</span>" +
        '<div class="sp-bar" style="height:' + Math.max(h, 3) + '%"></div>' +
        '<span class="sp-lbl">' + label + "</span>" +
      "</div>";
    }).join("");

    // Recuento por estado y por interés
    var porEstado = ESTADOS.map(function (s) {
      var n = LEADS.filter(function (l) { return l.estado === s; }).length;
      return '<span class="sp-tag est-' + s + '">' + ESTADO_LABEL[s] + " · <strong>" + n + "</strong></span>";
    }).join("");
    var grupos = { caldera: 0, aire: 0, otro: 0 };
    LEADS.forEach(function (l) { grupos[interestGroup(l.interest)]++; });
    var porInteres =
      '<span class="sp-tag">Calderas · <strong>' + grupos.caldera + "</strong></span>" +
      '<span class="sp-tag">Aires · <strong>' + grupos.aire + "</strong></span>" +
      '<span class="sp-tag">Otros · <strong>' + grupos.otro + "</strong></span>";

    host.innerHTML =
      '<div class="sp-chart"><h4>Solicitudes por semana</h4><div class="sp-bars">' + bars + "</div></div>" +
      '<div class="sp-side">' +
        "<h4>Por estado</h4><div class=\"sp-tags\">" + porEstado + "</div>" +
        "<h4>Por interés</h4><div class=\"sp-tags\">" + porInteres + "</div>" +
      "</div>";
  }

  function render() {
    var list = filtered();
    // Estadísticas
    $("statTotal").textContent = LEADS.length;
    var now = new Date();
    $("statMes").textContent = LEADS.filter(function (l) {
      var d = new Date(l.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    $("statFiltered").textContent = list.length;
    renderStats();

    var box = $("leadsList");
    if (!list.length) {
      box.innerHTML = '<div class="empty-state">' +
        (LEADS.length ? "Ningún cliente coincide con los filtros actuales." :
          "Todavía no hay clientes. En cuanto alguien envíe el formulario de la web, aparecerá aquí.") +
        "</div>";
      return;
    }
    box.innerHTML = list.map(function (l, i) {
      return '<div class="lead" style="animation-delay:' + Math.min(i * 40, 400) + 'ms;">' +
        '<div class="lead-top">' +
          '<div class="lead-name">' + esc(l.name) + "</div>" +
          badgeHTML(l.interest) +
          '<span class="lead-date">' + fmtDate(l.created_at) + "</span>" +
          (l.id
            ? '<div class="lead-estado-wrap">' +
                '<button type="button" class="lead-estado est-' + esc(l.estado) + '" data-id="' + esc(l.id) + '" aria-haspopup="listbox" aria-expanded="false" aria-label="Estado de la solicitud">' +
                  esc(ESTADO_LABEL[l.estado]) + ESTADO_CARET +
                '</button>' +
                '<div class="lead-estado-menu" role="listbox">' +
                  ESTADOS.map(function (s) {
                    return '<button type="button" class="lead-estado-opt est-' + s + (s === l.estado ? " active" : "") + '" data-value="' + s + '" role="option"' + (s === l.estado ? ' aria-selected="true"' : "") + ">" + ESTADO_LABEL[s] + "</button>";
                  }).join("") +
                "</div>" +
              "</div>"
            : "") +
          (l.id ? '<button class="lead-del" data-id="' + esc(l.id) + '" type="button">Eliminar</button>' : "") +
        "</div>" +
        '<div class="lead-contact">' +
          (l.phone ? '<a href="tel:' + esc(l.phone.replace(/\s/g, "")) + '"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>' + esc(l.phone) + "</a>" : "") +
          (l.email ? '<a href="mailto:' + esc(l.email) + '"><svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>' + esc(l.email) + "</a>" : "") +
        "</div>" +
        (l.message ? '<div class="lead-msg">' + esc(l.message) + "</div>" : "") +
        (l.id ? '<textarea class="lead-nota" data-id="' + esc(l.id) + '" rows="1" placeholder="Nota interna (privada, solo tú la ves)…">' + esc(NOTES[l.id] || "") + "</textarea>" : "") +
      "</div>";
    }).join("");
  }

  // ---------- Controles ----------
  var debounce;
  $("qName").addEventListener("input", function () {
    clearTimeout(debounce);
    debounce = setTimeout(function () {
      FILTER.name = norm($("qName").value.trim());
      render();
    }, 150);
  });
  $("qFrom").addEventListener("change", function () {
    FILTER.from = this.value ? new Date(this.value) : null;
    render();
  });
  $("qTo").addEventListener("change", function () {
    FILTER.to = this.value ? new Date(this.value) : null;
    render();
  });
  $("interestChips").addEventListener("click", function (e) {
    var chip = e.target.closest(".chip");
    if (!chip) return;
    $("interestChips").querySelectorAll(".chip").forEach(function (c) { c.classList.remove("active"); });
    chip.classList.add("active");
    FILTER.interest = chip.dataset.int;
    render();
  });

  // Filtro por estado: chips inyectados junto a los de interés
  var intChips = $("interestChips");
  if (intChips && typeof intChips.insertAdjacentHTML === "function") {
    intChips.insertAdjacentHTML("afterend",
      '<div class="chips" id="estadoChips" style="margin-top:8px;">' +
        '<button class="chip active" type="button" data-est="">Todos los estados</button>' +
        ESTADOS.map(function (s) {
          return '<button class="chip" type="button" data-est="' + s + '">' + ESTADO_LABEL[s] + "</button>";
        }).join("") +
      "</div>");
    $("estadoChips").addEventListener("click", function (e) {
      var chip = e.target.closest(".chip");
      if (!chip) return;
      $("estadoChips").querySelectorAll(".chip").forEach(function (c) { c.classList.remove("active"); });
      chip.classList.add("active");
      FILTER.estado = chip.dataset.est;
      render();
    });
  }

  // Desplegable de estado (propio, no <select> nativo: así se puede dar
  // estilo al menú abierto — bordes redondeados y sombra como el resto del panel).
  function closeEstadoMenu(menu) {
    menu.classList.remove("open");
    menu.previousElementSibling.setAttribute("aria-expanded", "false");
  }
  document.addEventListener("click", function (e) {
    var openMenu = document.querySelector(".lead-estado-menu.open");
    var trigger = e.target.closest(".lead-estado");
    if (trigger) {
      var menu = trigger.nextElementSibling;
      var wasOpen = menu.classList.contains("open");
      if (openMenu && openMenu !== menu) closeEstadoMenu(openMenu);
      menu.classList.toggle("open", !wasOpen);
      trigger.setAttribute("aria-expanded", String(!wasOpen));
      return;
    }
    var opt = e.target.closest(".lead-estado-opt");
    if (opt) {
      var optMenu = opt.closest(".lead-estado-menu");
      closeEstadoMenu(optMenu);
      cambiarEstado(optMenu.previousElementSibling, opt.dataset.value);
      return;
    }
    if (openMenu) closeEstadoMenu(openMenu);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var openMenu = document.querySelector(".lead-estado-menu.open");
    if (openMenu) closeEstadoMenu(openMenu);
  });

  // Cambio de estado de una solicitud (v7): guarda y revierte si falla
  function cambiarEstado(trigger, nuevo) {
    var id = trigger.dataset.id;
    var lead = null;
    for (var i = 0; i < LEADS.length; i++) {
      if (String(LEADS[i].id) === String(id)) { lead = LEADS[i]; break; }
    }
    if (!lead || nuevo === lead.estado) return;
    var anterior = lead.estado;
    // Optimista: refleja el cambio en el botón ya mismo, igual que hacía el <select> nativo.
    trigger.className = "lead-estado est-" + nuevo;
    trigger.innerHTML = esc(ESTADO_LABEL[nuevo]) + ESTADO_CARET;
    var revertir = function () {
      trigger.className = "lead-estado est-" + anterior;
      trigger.innerHTML = esc(ESTADO_LABEL[anterior]) + ESTADO_CARET;
    };
    var aplicar = function () {
      lead.estado = nuevo;
      render();
      toast("Estado actualizado: " + ESTADO_LABEL[nuevo] + ".");
      logChange({
        action: "cambiar-estado", entity: "lead", entity_id: String(lead.id),
        label: "Cambió el estado de " + (lead.name || "un cliente") + " a " + ESTADO_LABEL[nuevo] + ".",
        before_data: { id: lead.id, estado: anterior },
        after_data: { id: lead.id, estado: nuevo }
      });
    };
    if (LIVE) {
      sb.from("leads").update({ estado: nuevo }).eq("id", id).then(function (res) {
        if (res.error) {
          revertir();
          var msg = String(res.error.message || "");
          toast(msg.indexOf("estado") !== -1
            ? "Falta la columna de estados: ejecuta supabase/setup-supabase-v7-estados.sql en Supabase."
            : "Error guardando el estado: " + msg, true);
          return;
        }
        aplicar();
      });
    } else {
      try {
        var arr = JSON.parse(localStorage.getItem("decogas_leads") || "[]");
        arr.forEach(function (r) { if (String(r.id) === String(id)) r.estado = nuevo; });
        localStorage.setItem("decogas_leads", JSON.stringify(arr));
      } catch (err) { /* demo sin almacenamiento: solo en memoria */ }
      aplicar();
    }
  }

  // Guardar nota interna al salir del campo
  document.addEventListener("change", function (e) {
    var ta = e.target.closest(".lead-nota");
    if (!ta) return;
    saveNote(ta.dataset.id, ta.value.trim());
    toast("Nota guardada.");
  });

  // Borrado (solo LIVE con id)
  document.addEventListener("click", function (e) {
    var del = e.target.closest(".lead-del");
    if (!del) return;
    window.DecogasConfirm.ask({
      title: "Eliminar cliente",
      message: "¿Eliminar este cliente de la lista? Esta acción no se puede deshacer.",
      confirmText: "Eliminar", key: "del-cliente"
    }).then(function (ok) {
      if (!ok) return;
      var id = del.dataset.id;
      var lead = null;
      for (var i = 0; i < LEADS.length; i++) {
        if (String(LEADS[i].id) === String(id)) { lead = LEADS[i]; break; }
      }
      if (LIVE) {
        sb.from("leads").delete().eq("id", id).then(function (res) {
          if (res.error) { toast("Error: " + res.error.message, true); return; }
          LEADS = LEADS.filter(function (l) { return String(l.id) !== String(id); });
          render();
          toast("Cliente eliminado.");
          if (lead) {
            logChange({
              action: "borrar", entity: "lead", entity_id: String(id),
              label: 'Eliminó al cliente "' + (lead.name || "sin nombre") + '".',
              before_data: {
                id: lead.id, name: lead.name, phone: lead.phone, email: lead.email,
                interest: lead.interest, message: lead.message, estado: lead.estado, created_at: lead.created_at
              },
              after_data: null
            });
          }
        });
      }
    });
  });
})();
