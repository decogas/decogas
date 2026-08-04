// ============================================================
// cambios.js — Panel "Últimos cambios" (registro de auditoría).
//  · Lee public.change_log (solo admins, por RLS) y lo pinta
//    ordenado por fecha, más reciente primero.
//  · Cada fila no revertida tiene un botón "Revertir" que deshace
//    la operación original (según su tipo) y marca la fila como
//    reverted=true, dejando además un nuevo evento action="revertir".
//  · Usa el mismo login de Supabase Auth que el resto de paneles
//    (misma sesión: si ya entraste en otro panel, entras directo).
// ============================================================
(function () {
  "use strict";

  var cfg = window.DECOGAS_CONFIG || {};
  var LIVE = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  var sb = LIVE ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;

  var $ = function (id) { return document.getElementById(id); };
  var esc = window.DecogasUtil.esc;

  var CHANGES = [];

  var toastTimer;
  function toast(text, isErr) {
    var t = $("toast");
    t.textContent = text;
    t.className = isErr ? "err show" : "show";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 3200);
  }

  function showPanel() {
    $("loginScreen").classList.add("hidden");
    $("panel").style.display = "block";
    loadChanges();
  }

  // ---------- Sesión compartida entre paneles ----------
  if (LIVE) {
    sb.auth.getSession().then(function (res) {
      if (res.data && res.data.session) showPanel();
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
    if (!LIVE) { showPanel(); $("loginBtn").disabled = false; return; }
    sb.auth.signInWithPassword({ email: $("adminEmail").value.trim(), password: $("adminPass").value })
      .then(function (res) {
        $("loginBtn").disabled = false;
        if (res.error) { msg.textContent = "Credenciales incorrectas."; msg.classList.add("show"); return; }
        showPanel();
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

  // ---------- Formato de fecha/hora (es-ES) ----------
  function fmtDateTime(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    var fecha = d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
    var hora = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    return fecha + " " + hora;
  }

  // ---------- Descripción legible cuando no hay "label" guardado ----------
  var ACTION_LABEL = {
    crear: "Creó", editar: "Editó", borrar: "Borró", ocultar: "Ocultó",
    mostrar: "Mostró", "cambiar-estado": "Cambió el estado de", revertir: "Revirtió"
  };
  var ENTITY_LABEL = { producto: "un producto", lead: "un cliente" };
  function describe(row) {
    if (row.label) return row.label;
    var a = ACTION_LABEL[row.action] || row.action || "Cambió";
    var e = ENTITY_LABEL[row.entity] || row.entity || "un elemento";
    return a + " " + e + ".";
  }

  // ---------- Carga ----------
  function loadChanges() {
    var box = $("changesList");
    if (!LIVE) {
      box.innerHTML = '<div style="text-align:center; padding:50px 20px; color:var(--muted); font-size:14.5px; background:#fff; border:1px dashed var(--line); border-radius:14px;">' +
        "El registro de cambios solo está disponible conectado a Supabase.</div>";
      $("changesCount").textContent = "0";
      return;
    }
    box.innerHTML = '<p style="color:var(--muted); font-size:14px; padding:6px 0;">Cargando…</p>';
    sb.from("change_log").select("*").order("created_at", { ascending: false }).limit(300).then(function (res) {
      if (res.error) {
        toast("Error leyendo el registro de cambios: " + res.error.message, true);
        CHANGES = [];
      } else {
        CHANGES = res.data || [];
      }
      render();
    });
  }

  // ---------- Render ----------
  function render() {
    $("changesCount").textContent = String(CHANGES.length);
    var box = $("changesList");
    if (!CHANGES.length) {
      box.innerHTML = '<div style="text-align:center; padding:50px 20px; color:var(--muted); font-size:14.5px; background:#fff; border:1px dashed var(--line); border-radius:14px;">' +
        "Todavía no hay cambios registrados. En cuanto se edite algo en el panel, aparecerá aquí.</div>";
      return;
    }
    box.innerHTML = CHANGES.map(function (row, i) {
      var reverted = row.reverted === true;
      return '<div class="change-item' + (reverted ? " reverted" : "") + '" style="animation-delay:' + Math.min(i * 25, 400) + 'ms;">' +
        '<div class="change-top">' +
          '<div class="change-main">' +
            '<div class="change-label">' + esc(describe(row)) + "</div>" +
            '<div class="change-meta">' + esc(fmtDateTime(row.created_at)) + " · " + esc(row.user_email || "—") + "</div>" +
          "</div>" +
          '<div class="change-actions">' +
            (reverted ? '<span class="change-badge">Revertido</span>' : '<button class="revert-btn" data-id="' + esc(row.id) + '" type="button">Revertir</button>') +
            '<button class="del-log-btn" data-id="' + esc(row.id) + '" type="button" title="Eliminar del registro">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>' +
            "</button>" +
          "</div>" +
        "</div>" +
      "</div>";
    }).join("");
  }

  function findChange(id) {
    for (var i = 0; i < CHANGES.length; i++) {
      if (String(CHANGES[i].id) === String(id)) return CHANGES[i];
    }
    return null;
  }

  // ---------- Registro del propio "revertir" (best-effort) ----------
  function currentEmail() {
    return sb.auth.getUser().then(function (r) {
      return (r && r.data && r.data.user && r.data.user.email) || "";
    }).catch(function () { return ""; });
  }
  function logRevertEvent(row) {
    try {
      currentEmail().then(function (email) {
        return sb.from("change_log").insert([{
          user_email: email, action: "revertir", entity: row.entity, entity_id: row.entity_id,
          label: "Revirtió: " + describe(row),
          before_data: row.after_data || null, after_data: row.before_data || null
        }]);
      }).catch(function () { /* best-effort: no interrumpe */ });
    } catch (e) { /* best-effort: no interrumpe */ }
  }

  // ---------- Revertir según el tipo de cambio ----------
  // Devuelve una promesa que resuelve con { error } (formato supabase-js) o
  // se rechaza si el tipo de cambio no se puede revertir automáticamente.
  function doRevert(row) {
    if (row.entity === "producto") {
      if (row.action === "crear") {
        return sb.from("products").delete().eq("slug", row.entity_id);
      }
      if (row.action === "borrar") {
        if (!row.before_data) return Promise.reject(new Error("No hay datos guardados de este producto para restaurarlo."));
        return sb.from("products").upsert([row.before_data], { onConflict: "slug" });
      }
      // editar, ocultar, mostrar: todos restauran la ficha antes del cambio.
      if (!row.before_data) return Promise.reject(new Error("No hay datos guardados de éste cambio para restaurarlo."));
      return sb.from("products").update(row.before_data).eq("slug", row.entity_id);
    }
    if (row.entity === "lead") {
      if (row.action === "borrar") {
        if (!row.before_data) return Promise.reject(new Error("No hay datos guardados de este cliente para restaurarlo."));
        return sb.from("leads").insert([row.before_data]);
      }
      if (!row.before_data) return Promise.reject(new Error("No hay datos guardados de este cambio para restaurarlo."));
      return sb.from("leads").update(row.before_data).eq("id", row.entity_id);
    }
    return Promise.reject(new Error("Este tipo de cambio no se puede revertir automáticamente."));
  }

  document.addEventListener("click", function (e) {
    var delBtn = e.target.closest(".del-log-btn");
    if (delBtn) {
      var delId = delBtn.dataset.id;
      var delRow = findChange(delId);
      if (!delRow) return;
      window.DecogasConfirm.ask({
        title: "Eliminar entrada",
        message: "¿Eliminar esta entrada del registro? Esto NO revierte el cambio, solo lo quita de esta lista.",
        confirmText: "Eliminar", key: "del-log"
      }).then(function (ok) {
        if (!ok) return;
        delBtn.disabled = true;
        sb.from("change_log").delete().eq("id", delId).then(function (res) {
          if (res.error) throw new Error(res.error.message);
          CHANGES = CHANGES.filter(function (r) { return String(r.id) !== String(delId); });
          render();
          toast("Entrada eliminada del registro.");
        }).catch(function (err) {
          delBtn.disabled = false;
          toast("Error al eliminar: " + (err && err.message ? err.message : "desconocido"), true);
        });
      });
      return;
    }
    var btn = e.target.closest(".revert-btn");
    if (!btn) return;
    var id = btn.dataset.id;
    var row = findChange(id);
    if (!row) return;
    window.DecogasConfirm.ask({
      title: "Revertir cambio",
      message: "¿Revertir este cambio? Se restaurará el estado anterior.",
      confirmText: "Revertir", key: "revertir-cambio"
    }).then(function (ok) {
      if (!ok) return;
      btn.disabled = true;
      var original = btn.textContent;
      btn.textContent = "Revirtiendo…";
      doRevert(row).then(function (res) {
        if (res && res.error) throw new Error(res.error.message);
        return sb.from("change_log").update({ reverted: true }).eq("id", row.id);
      }).then(function (res2) {
        if (res2 && res2.error) throw new Error(res2.error.message);
        row.reverted = true;
        render();
        toast("Cambio revertido.");
        logRevertEvent(row);
      }).catch(function (err) {
        btn.disabled = false;
        btn.textContent = original;
        toast("Error al revertir: " + (err && err.message ? err.message : "desconocido"), true);
      });
    });
  });
})();
