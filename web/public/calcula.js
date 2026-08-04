// ============================================================
// calcula.js — Calculadora de caldera y aire acondicionado
// Estima potencia mínima/recomendada y sugiere el producto
// óptimo del catálogo real (Supabase con fallback local).
// Criterios orientativos habituales del sector:
//  · Caldera mixta: la potencia la marca el ACS (agua caliente):
//    1 baño → 24 kW · 2 baños → 28 kW · 3+ baños → 35 kW,
//    ajustando por superficie a calefactar.
//  · Aire: ~100 frigorías/m² (+20% con mucho sol), 1 kW ≈ 860 frig.
// ============================================================
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  if (!$("calcCalderas")) return;

  var esc = window.DecogasUtil.esc;

  // ---------- Catálogos (remoto con fallback local) ----------
  function localList(cat) {
    var ds = (window.DECOGAS_DATASETS || {})[cat];
    return (ds ? ds.products : []).map(function (p) {
      return {
        slug: p.slug, name: p.name, brand: p.brand, price: p.price,
        idealFor: p.idealFor, pop: p.pop, best: p.best === true, visible: true
      };
    });
  }
  function loadList(cat) {
    if (!window.DecogasStore) return Promise.resolve(localList(cat));
    return window.DecogasStore.loadCatalog(cat).then(function (remote) {
      return (remote && remote.length ? remote : localList(cat));
    }).catch(function () { return localList(cat); });
  }

  // ---------- Extracción de capacidades de las fichas ----------
  var maxM2 = function (p) {
    var m = String(p.idealFor + " " + p.name).match(/(\d{2,3})\s*m/i);
    return m ? Number(m[1]) : null;
  };
  var maxBanos = function (p) {
    var m = String(p.idealFor).match(/(\d)\s*bañ/i);
    return m ? Number(m[1]) : null;
  };
  var kwFromName = function (p) {
    var m = String(p.name).match(/\b(2[0-9]|3[0-9])\b/);
    return m ? Number(m[1]) : null;
  };
  // Nº de estancias que cubre el equipo (1 = split simple, 2 = 2x1, 3 = 3x1...)
  var estanciasOf = function (p) {
    var m = String(p.name).match(/(\d)\s*x\s*1/i);
    return m ? Number(m[1]) : 1;
  };
  // Potencia total (kW) de las unidades interiores de un multisplit, sumando los
  // códigos tipo CF25/CF35/HR25/HR35 (el número ÷10 = kW de esa unidad interior).
  var kitKW = function (p) {
    var matches = String(p.name).match(/(?:CF|HR)(\d{2})/gi);
    if (!matches || !matches.length) return null;
    var sum = 0;
    matches.forEach(function (m) { sum += Number(m.slice(-2)) / 10; });
    return sum;
  };

  // ---------- Tabs ----------
  document.querySelectorAll(".calc-tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      document.querySelectorAll(".calc-tab").forEach(function (t) { t.classList.remove("active"); });
      document.querySelectorAll(".calc-panel").forEach(function (p) { p.classList.remove("active"); });
      tab.classList.add("active");
      $(tab.dataset.panel).classList.add("active");
    });
  });

  // ---------- Controles: sliders y chips ----------
  function wireSlider(sliderId, badgeId) {
    var s = $(sliderId);
    s.addEventListener("input", function () { $(badgeId).textContent = s.value + " m²"; });
  }
  wireSlider("cM2", "cM2Val");
  wireSlider("aM2", "aM2Val");
  wireSlider("aM2b", "aM2bVal");
  wireSlider("aM2c", "aM2cVal");

  function wireChoices(groupId) {
    $(groupId).addEventListener("click", function (e) {
      var c = e.target.closest(".calc-choice");
      if (!c) return;
      $(groupId).querySelectorAll(".calc-choice").forEach(function (x) { x.classList.remove("active"); });
      c.classList.add("active");
    });
  }
  wireChoices("cBanos");
  wireChoices("aEstancias");
  wireChoices("aSol");

  var choice = function (groupId) {
    var c = $(groupId).querySelector(".calc-choice.active");
    return c ? c.dataset.value : null;
  };

  // Al elegir 2x1 o 3x1, aparecen las líneas de metros de las estancias extra
  function syncRoomFields() {
    var n = Number(choice("aEstancias"));
    $("aM2bField").style.display = n >= 2 ? "" : "none";
    $("aM2cField").style.display = n >= 3 ? "" : "none";
    $("aM2LabelText").textContent = n === 1 ? "Superficie a climatizar" : "Superficie de la estancia 1";
  }
  $("aEstancias").addEventListener("click", syncRoomFields);
  syncRoomFields();

  // ---------- Render de recomendación ----------
  function catalogLink(cat, slug) {
    return (cat === "calderas" ? "calderas.html" : "aires.html") + "#p=" + esc(slug);
  }
  var LAST = {}; // último equipo recomendado y contexto por categoría (para el presupuesto)

  function recoHTML(cat, best, alts, why, noFit) {
    if (best && !noFit) LAST[cat] = { p: best, why: why };
    var html = "";
    if (best) {
      html += '<div class="reco-card' + (noFit ? " no-fit" : "") + '">' +
        '<span class="reco-tag">' + (noFit ? "NO TENEMOS UN EQUIPO ASÍ DE POTENTE" : "RECOMENDADA PARA TU CASO") + "</span>" +
        '<div class="reco-brand">' + esc(best.brand) + "</div>" +
        '<div class="reco-name">' + esc(best.name) + "</div>" +
        '<div class="reco-price">' + Number(best.price).toLocaleString("es-ES") + ' € <span style="font-size:11px; color:var(--muted); font-weight:500;">IVA e instalación incluidos</span></div>' +
        '<div class="reco-why">' + esc(why) + "</div>" +
        (noFit
          ? '<div class="reco-actions">' +
              '<a class="btn btn-flame" style="padding:11px 20px; font-size:13.5px;" href="tel:+34919930168">Llamar y pedir estudio gratuito</a>' +
              '<a class="btn btn-ghost" style="padding:11px 20px; font-size:13.5px;" href="https://wa.me/34651368631" target="_blank" rel="noopener">WhatsApp</a>' +
            "</div>"
          : '<div class="reco-actions">' +
              '<button class="btn btn-flame" style="padding:11px 20px; font-size:13.5px;" type="button" data-budget="' + cat + '">Presupuesto al instante</button>' +
              '<a class="btn btn-ghost" style="padding:11px 20px; font-size:13.5px;" href="' + catalogLink(cat, best.slug) + '">Ver en el catálogo</a>' +
            "</div>") +
      "</div>";
    }
    if (alts.length) {
      html += '<p style="font-family:\'IBM Plex Mono\'; font-size:11px; letter-spacing:.06em; color:var(--muted); margin:16px 0 8px;">TAMBIÉN VÁLIDAS</p>' +
        alts.map(function (p) {
          return '<a class="alt-row" href="' + catalogLink(cat, p.slug) + '">' +
            '<span class="alt-name">' + esc(p.name) + "</span>" +
            '<span class="alt-price">' + Number(p.price).toLocaleString("es-ES") + " €</span>" +
          "</a>";
        }).join("");
    }
    return html;
  }
  function showResult(boxId) {
    var box = $(boxId);
    box.classList.remove("show");
    void box.offsetWidth;
    box.classList.add("show");
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // ---------- Presupuesto instantáneo ----------
  var eur = function (n) { return Number(n).toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 }); };
  var cuota = function (price, meses) { return eur(Math.ceil((price / meses) * 100) / 100); };

  var bmodal = document.createElement("div");
  bmodal.className = "budget-modal";
  bmodal.innerHTML = '<div class="budget-sheet"><button class="budget-close" type="button" aria-label="Cerrar">\u2715</button><div id="budgetBody"></div></div>';
  document.body.appendChild(bmodal);
  var closeBudget = function () { bmodal.classList.remove("open"); document.body.style.overflow = ""; };
  bmodal.querySelector(".budget-close").addEventListener("click", closeBudget);
  bmodal.addEventListener("click", function (e) { if (e.target === bmodal) closeBudget(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeBudget(); });

  function installInfo(cat) {
    var ds = (window.DECOGAS_DATASETS || {})[cat];
    return ds && ds.installNote ? ds.installNote : "Instalaci\u00F3n est\u00E1ndar incluida.";
  }

  function contextLine(cat) {
    if (cat === "calderas") {
      return "Vivienda de " + $("cM2").value + " m\u00B2 con " + choice("cBanos") + (Number(choice("cBanos")) > 1 ? " ba\u00F1os" : " ba\u00F1o");
    }
    var est = Number(choice("aEstancias"));
    var m2s = [$("aM2").value];
    if (est >= 2) m2s.push($("aM2b").value);
    if (est >= 3) m2s.push($("aM2c").value);
    return (est === 1 ? "Estancia de " + m2s[0] + " m\u00B2" : est + " estancias (" + m2s.join(" + ") + " m\u00B2)") +
      (choice("aSol") === "si" ? " con alta exposici\u00F3n al sol" : "");
  }

  function openBudget(cat) {
    var item = LAST[cat];
    if (!item) return;
    var p = item.p;
    var now = new Date();
    var ref = "PRE-" + now.getFullYear() + String(now.getMonth() + 1).padStart(2, "0") + String(now.getDate()).padStart(2, "0") + "-" + Math.floor(100 + Math.random() * 900);
    var fecha = now.toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
    var equipoLabel = cat === "calderas" ? "Caldera" : "Aire acondicionado";

    $("budgetBody").innerHTML =
      '<div class="budget-head">' +
        '<h3>Tu presupuesto</h3>' +
        '<div class="budget-ref">Ref. ' + ref + '<br>' + esc(fecha) + '</div>' +
      "</div>" +
      '<div class="budget-name-field">' +
        '<input type="text" id="budgetName" placeholder="Tu nombre (opcional, aparecer\u00E1 en el presupuesto)" autocomplete="name">' +
      "</div>" +
      '<div class="budget-lines">' +
        '<div class="budget-line"><span><strong>' + equipoLabel + ":</strong> " + esc(p.name) + " (" + esc(p.brand) + ")</span></div>" +
        '<div class="budget-line"><span>' + esc(contextLine(cat)) + "</span></div>" +
        '<div class="budget-line"><span>Equipo + instalaci\u00F3n est\u00E1ndar</span><span class="amt">' + eur(p.price) + " \u20AC</span></div>" +
        '<div class="budget-line"><span>La instalaci\u00F3n est\u00E1ndar incluye</span><span style="text-align:right; max-width:55%;">' + esc(installInfo(cat)) + "</span></div>" +
        '<div class="budget-line total"><span><strong>Total (IVA incluido)</strong></span><span class="amt">' + eur(p.price) + " \u20AC</span></div>" +
      "</div>" +
      '<div class="budget-extras">' +
        "<strong>\u00BFY si mi instalaci\u00F3n necesita algo m\u00E1s?</strong> Si tu vivienda requiere piezas o metros adicionales " +
        "(salida de humos m\u00E1s larga, m\u00E1s l\u00EDnea frigor\u00EDfica, canaleta extra\u2026), se a\u00F1aden a <strong>36,30 \u20AC por unidad/metro</strong>. " +
        "Lo comprobamos en la <strong>visita t\u00E9cnica gratuita</strong> y te confirmamos el presupuesto final cerrado <strong>por escrito antes de instalar nada</strong>. Sin sorpresas." +
      "</div>" +
      '<div class="budget-fin">' +
        "<h6>Financiaci\u00F3n sin intereses</h6>" +
        '<div class="budget-fin-row">' +
          '<div class="budget-fin-box"><div class="cuota">' + cuota(p.price, 12) + " \u20AC/mes</div><div class=\"meses\">12 MESES</div></div>" +
          '<div class="budget-fin-box"><div class="cuota">' + cuota(p.price, 24) + " \u20AC/mes</div><div class=\"meses\">24 MESES</div></div>" +
          '<div class="budget-fin-box"><div class="cuota">' + cuota(p.price, 36) + " \u20AC/mes</div><div class=\"meses\">36 MESES</div></div>" +
        "</div>" +
      "</div>" +
      '<p class="budget-foot">Presupuesto orientativo generado con la calculadora de decogas.es y sujeto a visita t\u00E9cnica gratuita. ' +
        "INSTALADORES DECOGAS SL \u00B7 CIF B88192075 \u00B7 C. de los Almendros 8, Local 6A, 28821 Coslada \u00B7 919 93 01 68 \u00B7 info@decogas.com</p>" +
      '<div class="budget-actions">' +
        '<a class="btn btn-flame" id="budgetWa" href="#" target="_blank" rel="noopener">Enviar por WhatsApp</a>' +
        '<button class="btn btn-ghost" id="budgetPrint" type="button">Descargar PDF</button>' +
      "</div>";

    var waText = function () {
      var name = ($("budgetName").value || "").trim();
      return "Hola, he generado este presupuesto en vuestra web:\n\n" +
        "\u2022 Ref: " + ref + (name ? "\n\u2022 Nombre: " + name : "") +
        "\n\u2022 " + equipoLabel + ": " + p.name + " (" + p.brand + ")" +
        "\n\u2022 " + contextLine(cat) +
        "\n\u2022 Total con instalaci\u00F3n est\u00E1ndar e IVA: " + eur(p.price) + " \u20AC" +
        "\n\u2022 Financiaci\u00F3n: 12/24/36 meses sin intereses" +
        "\n\nMe gustar\u00EDa concertar la visita t\u00E9cnica gratuita.";
    };
    var updateWa = function () {
      $("budgetWa").href = "https://wa.me/34651368631?text=" + encodeURIComponent(waText());
    };
    updateWa();
    $("budgetName").addEventListener("input", updateWa);
    $("budgetPrint").addEventListener("click", function () { window.print(); });

    bmodal.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-budget]");
    if (btn) openBudget(btn.dataset.budget);
  });

  // ---------- CALDERAS ----------
  $("cCalc").addEventListener("click", function () {
    var m2 = Number($("cM2").value);
    var banos = Number(choice("cBanos"));

    // Potencia por ACS (lo que manda en calderas mixtas) + ajuste por superficie
    var minKW = banos >= 3 ? 28 : 24;
    var recKW = 24;
    if (banos >= 2 || m2 > 120) recKW = 28;
    if (banos >= 3 || m2 > 180) recKW = 35;
    if (recKW < minKW) recKW = minKW;

    $("cMin").innerHTML = minKW + ' <small>kW</small>';
    $("cRec").innerHTML = recKW + ' <small>kW</small>';

    loadList("calderas").then(function (list) {
      var pool = list.filter(function (p) { return p.visible !== false; });
      // Aptas: cumplen m² y baños según su ficha (si la ficha no lo indica, se estima por kW del nombre)
      var fits = pool.filter(function (p) {
        var pm2 = maxM2(p), pb = maxBanos(p), kw = kwFromName(p);
        var okM2 = pm2 != null ? pm2 >= m2 : true;
        var okB = pb != null ? pb >= banos : (kw != null ? (banos <= 1 || kw >= 28) : true);
        var okKW = kw != null ? kw >= recKW - 4 : true;
        return okM2 && okB && okKW;
      });
      // Óptima: la más ajustada (menor capacidad sobrante), favoreciendo la más vendida
      fits.sort(function (a, b) {
        var am = maxM2(a) || 999, bm = maxM2(b) || 999;
        if (am !== bm) return am - bm;
        return (a.pop || 999) - (b.pop || 999);
      });
      var best = fits[0] || null;
      var alts = fits.slice(1, 3);
      var why, noFit = false;
      if (best) {
        why = "Cubre tu superficie de " + m2 + " m² con " + banos + (banos > 1 ? " baños" : " baño") +
          " y una potencia adecuada para agua caliente y calefacción sin sobredimensionar la instalación.";
      } else {
        best = pool.sort(function (a, b) { return (maxM2(b) || 0) - (maxM2(a) || 0); })[0];
        why = "No tenemos en catálogo una caldera con tanta potencia para tu caso (" + m2 + " m² y " + banos + (banos > 1 ? " baños" : " baño") + "). Esta es nuestra opción más potente, mostrada solo como referencia. Necesitas un estudio técnico a medida — llámanos y te lo confirmamos sin compromiso.";
        alts = [];
        noFit = true;
      }
      $("cReco").innerHTML = recoHTML("calderas", best, alts, why, noFit);
      showResult("cResult");
    });
  });

  // ---------- AIRES ----------
  $("aCalc").addEventListener("click", function () {
    var estancias = Number(choice("aEstancias"));
    var sol = choice("aSol") === "si";

    var m2list = [Number($("aM2").value)];
    if (estancias >= 2) m2list.push(Number($("aM2b").value));
    if (estancias >= 3) m2list.push(Number($("aM2c").value));
    var m2 = m2list[0]; // estancia principal, usada como filtro de m² en equipos de 1 sola estancia

    var frig = Math.round(m2list.reduce(function (sum, v) { return sum + v * 100 * (sol ? 1.2 : 1); }, 0));
    var kw = Math.round((frig / 860) * 10) / 10;

    $("aMin").innerHTML = frig.toLocaleString("es-ES") + ' <small>frig.</small>';
    $("aRec").innerHTML = kw.toLocaleString("es-ES") + ' <small>kW</small>';

    loadList("aires").then(function (list) {
      var pool = list.filter(function (p) { return p.visible !== false; });
      var candidates = pool.filter(function (p) { return estanciasOf(p) === estancias; });
      var fits = candidates.filter(function (p) {
        if (estancias >= 2) {
          var pk = kitKW(p);
          return pk == null || pk >= kw - 0.3;
        }
        var pm2 = maxM2(p);
        return pm2 == null || pm2 >= m2;
      });
      fits.sort(function (a, b) {
        if (estancias >= 2) {
          var ak = kitKW(a) || 999, bk = kitKW(b) || 999;
          if (ak !== bk) return ak - bk;
        } else {
          var am = maxM2(a) || 999, bm = maxM2(b) || 999;
          if (am !== bm) return am - bm;
        }
        return a.price - b.price;
      });
      var best = fits[0] || null;
      var alts = fits.slice(1, 3);
      var why, noFit = false;
      if (best) {
        why = estancias >= 2
          ? "Equipo " + estancias + "x1: climatiza tus " + estancias + " estancias (" + m2list.join(" + ") + " m²) con una sola unidad exterior, cubriendo los " + frig.toLocaleString("es-ES") + " frigorías estimadas."
          : "Cubre los " + m2 + " m² de tu estancia" + (sol ? " incluso con alta exposición al sol" : "") + " con un consumo ajustado, sin pagar de más por potencia sobrante.";
      } else {
        best = candidates.sort(function (a, b) { return (kitKW(b) || maxM2(b) || 0) - (kitKW(a) || maxM2(a) || 0); })[0] || pool[0];
        why = estancias >= 2
          ? "No tenemos en catálogo un equipo " + estancias + "x1 con tanta potencia para tus estancias (" + m2list.join(" + ") + " m²). Este es nuestro kit " + estancias + "x1 más potente, mostrado solo como referencia. Necesitas un estudio técnico a medida — llámanos y lo vemos sin compromiso."
          : "No tenemos en catálogo un equipo con tanta potencia para esa superficie. Esta es nuestra opción más potente, mostrada solo como referencia. Necesitas un estudio técnico a medida — llámanos y lo vemos sin compromiso.";
        alts = [];
        noFit = true;
      }
      $("aReco").innerHTML = recoHTML("aires", best, alts, why, noFit);
      showResult("aResult");
    });
  });
})();
