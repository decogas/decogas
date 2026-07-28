// ============================================================
// recientes.js — "Vistos recientemente" (sin cookies, solo localStorage)
//  · En una ficha de producto: registra el producto visitado.
//  · En las páginas de catálogo: pinta una tira con los últimos vistos,
//    enlazando de vuelta a sus fichas.
// ============================================================
(function () {
  "use strict";

  var KEY = "decogas_recientes";
  var MAX = 6;
  var esc = window.DecogasUtil.esc;

  function leer() {
    try {
      var arr = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function guardar(arr) {
    try { localStorage.setItem(KEY, JSON.stringify(arr.slice(0, MAX))); }
    catch (e) { /* sin almacenamiento: no pasa nada */ }
  }

  var page = document.body.getAttribute("data-page") || "";

  // ---------- En la ficha: registrar la visita ----------
  if (page === "producto") {
    var m = window.location.pathname.match(/producto\/([^/]+)\.html$/);
    var titulo = document.querySelector(".prod-title");
    if (m && titulo) {
      var img = document.querySelector(".prod-media img");
      var precio = document.querySelector(".prod-price strong");
      var item = {
        slug: decodeURIComponent(m[1]),
        name: titulo.textContent.trim(),
        img: img ? img.getAttribute("src") : "",
        price: precio ? precio.textContent.trim() : ""
      };
      var lista = leer().filter(function (x) { return x && x.slug !== item.slug; });
      lista.unshift(item);
      guardar(lista);
    }
    return;
  }

  // ---------- En el catálogo: pintar la tira ----------
  if (page !== "calderas" && page !== "aires" && page !== "termos" && page !== "aerotermia") return;
  var root = document.getElementById("catalogRoot");
  if (!root || !root.parentNode || typeof root.parentNode.insertBefore !== "function") return;
  var vistos = leer().filter(function (x) { return x && x.slug && x.name; });
  if (!vistos.length) return;

  var strip = document.createElement("div");
  strip.className = "recientes";
  strip.innerHTML =
    '<div class="recientes-head"><h4>Vistos recientemente</h4>' +
    '<button class="recientes-clear" type="button">Borrar</button></div>' +
    '<div class="recientes-row">' +
    vistos.map(function (x) {
      return '<a class="reciente" href="producto/' + encodeURIComponent(x.slug) + '.html">' +
        (x.img && /^https?:\/\//.test(x.img)
          ? '<img src="' + esc(x.img) + '" alt="" loading="lazy">'
          : '<span class="reciente-noimg"></span>') +
        '<span class="reciente-info"><span class="reciente-name">' + esc(x.name) + "</span>" +
        (x.price ? '<span class="reciente-price">' + esc(x.price) + "</span>" : "") +
        "</span></a>";
    }).join("") +
    "</div>";
  root.parentNode.insertBefore(strip, root);

  strip.querySelector(".recientes-clear").addEventListener("click", function () {
    guardar([]);
    strip.remove();
  });
})();
