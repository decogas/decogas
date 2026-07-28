// ============================================================
// analiticas.js — Acceso (login) al panel de analíticas.
//  Usa el mismo login de Supabase Auth que el resto de paneles
//  (misma sesión: si ya entraste en admin o clientes, entras aquí
//  directamente). El pintado de las analíticas lo hace analitica.js,
//  que se carga aparte y escucha la sesión por su cuenta.
// ============================================================
(function () {
  "use strict";

  var cfg = window.DECOGAS_CONFIG || {};
  var LIVE = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  var sb = LIVE ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;

  var $ = function (id) { return document.getElementById(id); };

  function showPanel() {
    $("loginScreen").classList.add("hidden");
    $("panel").style.display = "block";
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
})();
