// ============================================================
// presupuesto.js — Presupuesto instantáneo dentro de la ficha de producto.
// El botón #presupuestoBtn lleva data-name/brand/price/cat; al pulsarlo abre
// el mismo modal que la calculadora, ya relleno con ESE producto.
// ============================================================
(function () {
  "use strict";
  var btn = document.getElementById("presupuestoBtn");
  if (!btn || !window.DecogasUtil) return;

  var esc = window.DecogasUtil.esc;
  var eur = function (n) { return Number(n).toLocaleString("es-ES"); };
  var cuota = function (price, meses) { return eur(Math.ceil((price / meses) * 100) / 100); };

  var name = btn.getAttribute("data-name") || "";
  var brand = btn.getAttribute("data-brand") || "";
  var price = Number(btn.getAttribute("data-price")) || 0;
  var cat = btn.getAttribute("data-cat") || "";
  var equipoLabel = cat === "calderas" ? "Caldera" : cat === "aires" ? "Aire acondicionado" : "Equipo";
  var installInfo = cat === "calderas"
    ? "80 cm de salida de humos y 3 m de conexión a desagüe"
    : cat === "aires"
      ? "3 m de línea frigorífica, soportes y desagüe por gravedad"
      : "conexiones de agua y desagüe estándar";

  // Modal (mismas clases que el de la calculadora)
  var modal = document.createElement("div");
  modal.className = "budget-modal";
  modal.innerHTML = '<div class="budget-sheet"><button class="budget-close" type="button" aria-label="Cerrar">✕</button><div id="budgetBody2"></div></div>';
  document.body.appendChild(modal);
  var close = function () { modal.classList.remove("open"); document.body.style.overflow = ""; };
  modal.querySelector(".budget-close").addEventListener("click", close);
  modal.addEventListener("click", function (e) { if (e.target === modal) close(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });

  btn.addEventListener("click", function () {
    var now = new Date();
    var ref = "PRE-" + now.getFullYear() + String(now.getMonth() + 1).padStart(2, "0") + String(now.getDate()).padStart(2, "0") + "-" + Math.floor(100 + Math.random() * 900);
    var fecha = now.toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

    document.getElementById("budgetBody2").innerHTML =
      '<div class="budget-head"><h3>Tu presupuesto</h3><div class="budget-ref">Ref. ' + ref + "<br>" + esc(fecha) + "</div></div>" +
      '<div class="budget-name-field"><input type="text" id="budgetName2" placeholder="Tu nombre (opcional, aparecerá en el presupuesto)" autocomplete="name"></div>' +
      '<div class="budget-lines">' +
        '<div class="budget-line"><span><strong>' + equipoLabel + ":</strong> " + esc(name) + (brand ? " (" + esc(brand) + ")" : "") + "</span></div>" +
        '<div class="budget-line"><span>Equipo + instalación estándar</span><span class="amt">' + eur(price) + " €</span></div>" +
        '<div class="budget-line"><span>La instalación estándar incluye</span><span style="text-align:right; max-width:55%;">' + esc(installInfo) + "</span></div>" +
        '<div class="budget-line total"><span><strong>Total (IVA incluido)</strong></span><span class="amt">' + eur(price) + " €</span></div>" +
      "</div>" +
      '<div class="budget-extras"><strong>¿Y si mi instalación necesita algo más?</strong> Si tu vivienda requiere piezas o metros adicionales, se añaden a <strong>36,30 € por unidad/metro</strong>. Lo comprobamos en la <strong>visita técnica gratuita</strong> y te confirmamos el presupuesto final cerrado <strong>por escrito antes de instalar nada</strong>. Sin sorpresas.</div>' +
      '<div class="budget-fin"><h6>Financiación sin intereses</h6><div class="budget-fin-row">' +
        '<div class="budget-fin-box"><div class="cuota">' + cuota(price, 12) + " €/mes</div><div class=\"meses\">12 MESES</div></div>" +
        '<div class="budget-fin-box"><div class="cuota">' + cuota(price, 24) + " €/mes</div><div class=\"meses\">24 MESES</div></div>" +
        '<div class="budget-fin-box"><div class="cuota">' + cuota(price, 36) + " €/mes</div><div class=\"meses\">36 MESES</div></div>" +
      "</div></div>" +
      '<p class="budget-foot">Presupuesto orientativo generado en la web de Decogas y sujeto a visita técnica gratuita. INSTALADORES DECOGAS SL · CIF B88192075 · C. de los Almendros 8, Local 6A, 28821 Coslada · 910 29 91 15 · info@decogas.com</p>' +
      '<div class="budget-actions"><a class="btn btn-flame" id="budgetWa2" href="#" target="_blank" rel="noopener">Enviar por WhatsApp</a><button class="btn btn-ghost" id="budgetPrint2" type="button">Descargar PDF</button></div>';

    var waText = function () {
      var nm = (document.getElementById("budgetName2").value || "").trim();
      return "Hola, he generado este presupuesto en vuestra web:\n\n• Ref: " + ref + (nm ? "\n• Nombre: " + nm : "") +
        "\n• " + equipoLabel + ": " + name + (brand ? " (" + brand + ")" : "") +
        "\n• Total con instalación estándar e IVA: " + eur(price) + " €" +
        "\n• Financiación: 12/24/36 meses sin intereses" +
        "\n\nMe gustaría concertar la visita técnica gratuita.";
    };
    var updateWa = function () { document.getElementById("budgetWa2").href = "https://wa.me/34651368631?text=" + encodeURIComponent(waText()); };
    updateWa();
    document.getElementById("budgetName2").addEventListener("input", updateWa);
    document.getElementById("budgetPrint2").addEventListener("click", function () { window.print(); });

    modal.classList.add("open");
    document.body.style.overflow = "hidden";
  });
})();
