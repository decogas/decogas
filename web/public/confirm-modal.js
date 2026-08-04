// ============================================================
// confirm-modal.js — Diálogo de confirmación propio (ES5, sin build).
// Sustituye a window.confirm() nativo por un modal con el estilo
// del sitio, más una casilla opcional "No volver a preguntar".
//
//   window.DecogasConfirm.ask({
//     title: "Eliminar producto",
//     message: "¿Eliminar definitivamente...?",
//     confirmText: "Eliminar",   // opcional, por defecto "Eliminar"
//     cancelText: "Cancelar",    // opcional
//     danger: true,              // opcional: botón OK en rojo
//     key: "del-producto"        // opcional: activa "no volver a preguntar"
//   }).then(function (ok) { if (!ok) return; ... });
//
// Si key está presente y el usuario marcó antes "no volver a
// preguntar" para esa key, ask() resuelve true sin mostrar nada.
// Debe cargarse tras utils.js y antes de los scripts que lo usan.
// ============================================================
(function () {
  "use strict";

  var LS_PREFIX = "decogas_skip_confirm_";
  var overlay = null, boxTitle, boxMsg, checkWrap, checkInput, btnCancel, btnOk;
  var activeResolve = null, lastFocused = null;

  function injectStyles() {
    var st = document.createElement("style");
    st.textContent =
      ".dg-confirm-overlay{position:fixed; inset:0; z-index:500; display:none; align-items:center; justify-content:center;" +
      " background:rgba(14,34,56,.45); padding:20px;}" +
      ".dg-confirm-overlay.open{display:flex;}" +
      ".dg-confirm-box{background:#fff; border-radius:16px; max-width:420px; width:100%; padding:26px 26px 20px;" +
      " box-shadow:0 20px 50px rgba(14,34,56,.28); animation:dgConfirmIn .18s ease both;}" +
      "@keyframes dgConfirmIn{from{opacity:0; transform:translateY(8px) scale(.98);} to{opacity:1; transform:none;}}" +
      ".dg-confirm-title{font-family:'Fraunces',serif; font-size:19px; color:var(--navy,#0E2238); margin-bottom:10px;}" +
      ".dg-confirm-msg{font-family:'Inter',sans-serif; font-size:14.5px; line-height:1.5; color:var(--muted,#5B6B7B); white-space:pre-line;}" +
      ".dg-confirm-check{display:flex; align-items:center; gap:8px; margin-top:16px; font-family:'Inter',sans-serif;" +
      " font-size:13.5px; color:var(--muted,#5B6B7B); cursor:pointer; user-select:none;}" +
      ".dg-confirm-check input{width:16px; height:16px; accent-color:var(--flame,#FF6B35); cursor:pointer;}" +
      ".dg-confirm-actions{display:flex; justify-content:flex-end; gap:10px; margin-top:22px;}";
    document.head.appendChild(st);
  }

  function build() {
    if (overlay) return;
    injectStyles();
    overlay = document.createElement("div");
    overlay.className = "dg-confirm-overlay";
    overlay.innerHTML =
      '<div class="dg-confirm-box" role="alertdialog" aria-modal="true" aria-labelledby="dgConfirmTitle" aria-describedby="dgConfirmMsg">' +
        '<h3 class="dg-confirm-title" id="dgConfirmTitle"></h3>' +
        '<p class="dg-confirm-msg" id="dgConfirmMsg"></p>' +
        '<label class="dg-confirm-check" id="dgConfirmCheckWrap"><input type="checkbox" id="dgConfirmCheck">No volver a preguntar</label>' +
        '<div class="dg-confirm-actions">' +
          '<button type="button" class="btn ghost small" id="dgConfirmCancel"></button>' +
          '<button type="button" class="btn small" id="dgConfirmOk"></button>' +
        "</div>" +
      "</div>";
    document.body.appendChild(overlay);
    boxTitle = overlay.querySelector("#dgConfirmTitle");
    boxMsg = overlay.querySelector("#dgConfirmMsg");
    checkWrap = overlay.querySelector("#dgConfirmCheckWrap");
    checkInput = overlay.querySelector("#dgConfirmCheck");
    btnCancel = overlay.querySelector("#dgConfirmCancel");
    btnOk = overlay.querySelector("#dgConfirmOk");

    btnCancel.addEventListener("click", function () { settle(false); });
    btnOk.addEventListener("click", function () { settle(true); });
    overlay.addEventListener("click", function (e) { if (e.target === overlay) settle(false); });
    document.addEventListener("keydown", function (e) {
      if (!overlay.classList.contains("open")) return;
      if (e.key === "Escape") settle(false);
    });
  }

  function settle(ok) {
    if (!activeResolve) return;
    if (ok && checkWrap.style.display !== "none" && checkInput.checked && overlay.dataset.key) {
      try { localStorage.setItem(LS_PREFIX + overlay.dataset.key, "1"); } catch (e) {}
    }
    overlay.classList.remove("open");
    var resolve = activeResolve;
    activeResolve = null;
    if (lastFocused && lastFocused.focus) lastFocused.focus();
    resolve(ok);
  }

  function ask(opts) {
    opts = opts || {};
    if (opts.key) {
      try {
        if (localStorage.getItem(LS_PREFIX + opts.key) === "1") return Promise.resolve(true);
      } catch (e) {}
    }
    build();
    return new Promise(function (resolve) {
      activeResolve = resolve;
      lastFocused = document.activeElement;
      boxTitle.textContent = opts.title || "¿Estás seguro?";
      boxMsg.textContent = opts.message || "";
      btnCancel.textContent = opts.cancelText || "Cancelar";
      btnOk.textContent = opts.confirmText || "Eliminar";
      btnOk.className = "btn small" + (opts.danger === false ? "" : " danger");
      checkWrap.style.display = opts.key ? "flex" : "none";
      checkInput.checked = false;
      overlay.dataset.key = opts.key || "";
      overlay.classList.add("open");
      btnCancel.focus();
    });
  }

  window.DecogasConfirm = { ask: ask };
}());
