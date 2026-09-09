// calcula.js — calculadora de caldera / aire.
//  · catalogLink: se extrae su texto real y se verifica que escapa el slug
//    (fix reciente: debe usar esc()).
//  · Lógica de kW (calderas) y frigorías/kW (aires): se DRIVE el IIFE con un
//    DOM falso, se dispara el click de calcular y se leen los valores que
//    el propio código escribe en cMin/cRec (aMin/aRec), y la recomendación.
"use strict";

var test = require("node:test");
var assert = require("node:assert");
var h = require("./harness");

// ---------- catalogLink: escapado del slug ----------
var esc = h.extractFn("utils.js", "esc");
var catalogLink = h.extractFn("calcula.js", "catalogLink", { esc: esc });

// Las direcciones del sitio ya no llevan .html: /calderas, no /calderas.html.
test("catalogLink apunta al catálogo correcto según la categoría", function () {
  assert.strictEqual(catalogLink("calderas", "cald-24"), "calderas#p=cald-24");
  assert.strictEqual(catalogLink("aires", "aire-25"), "aires#p=aire-25");
});

test("catalogLink escapa el slug (evita romper el href / inyección)", function () {
  var out = catalogLink("aires", 'x"><img src=y onerror=alert(1)>');
  assert.ok(out.indexOf('"') === -1 || out.indexOf("#p=") !== -1);
  assert.ok(out.indexOf("&quot;") !== -1, "las comillas deben ir escapadas");
  assert.ok(out.indexOf("&lt;") !== -1 && out.indexOf("&gt;") !== -1, "< y > escapados");
  assert.ok(out.indexOf("<img") === -1, "no debe quedar la etiqueta cruda");
});

// ---------- Helpers de drive ----------
// Monta el DOM mínimo que calcula.js toca y devuelve {ctx, doc}.
function bootCalcula(dataset) {
  var doc = new h.FakeDocument();
  doc.register("calcCalderas", {}); // gatilla que el IIFE no haga early-return
  // Elementos que el IIFE referencia al cargar / calcular:
  ["cM2", "cM2Val", "aM2", "aM2Val", "cBanos", "aEstancias", "aSol",
   "cMin", "cRec", "cReco", "cResult", "cCalc",
   "aMin", "aRec", "aReco", "aResult", "aCalc"].forEach(function (id) { doc.getElementById(id); });

  var win = { DECOGAS_DATASETS: dataset || {} };
  // Sin DecogasStore => loadList usa localList (datos locales), sin red.
  var ctx = h.makeContext({ document: doc, window: win });
  h.runFile(ctx, "utils.js");
  h.runFile(ctx, "calcula.js");
  return { ctx: ctx, doc: doc };
}
function setChoice(doc, groupId, value) {
  var choiceEl = new h.FakeElement();
  choiceEl.dataset.value = String(value);
  doc.getElementById(groupId).setQuery(".calc-choice.active", choiceEl);
}
function clickCalc(doc, id) { doc.getElementById(id).dispatch("click", {}); }

// ---------- Calderas: potencia mínima / recomendada ----------
test("caldera: 90 m² y 1 baño => mín 24 kW, rec 24 kW", function () {
  var b = bootCalcula();
  b.doc.getElementById("cM2").value = "90";
  setChoice(b.doc, "cBanos", 1);
  clickCalc(b.doc, "cCalc");
  assert.strictEqual(b.doc.getElementById("cMin").innerHTML, "24 <small>kW</small>");
  assert.strictEqual(b.doc.getElementById("cRec").innerHTML, "24 <small>kW</small>");
});

test("caldera: 90 m² y 2 baños => mín 24 kW, rec 28 kW", function () {
  var b = bootCalcula();
  b.doc.getElementById("cM2").value = "90";
  setChoice(b.doc, "cBanos", 2);
  clickCalc(b.doc, "cCalc");
  assert.strictEqual(b.doc.getElementById("cMin").innerHTML, "24 <small>kW</small>");
  assert.strictEqual(b.doc.getElementById("cRec").innerHTML, "28 <small>kW</small>");
});

test("caldera: 200 m² y 1 baño => rec 35 kW por superficie", function () {
  var b = bootCalcula();
  b.doc.getElementById("cM2").value = "200";
  setChoice(b.doc, "cBanos", 1);
  clickCalc(b.doc, "cCalc");
  assert.strictEqual(b.doc.getElementById("cMin").innerHTML, "24 <small>kW</small>");
  assert.strictEqual(b.doc.getElementById("cRec").innerHTML, "35 <small>kW</small>");
});

test("caldera: 90 m² y 3 baños => mín 28 kW, rec 35 kW", function () {
  var b = bootCalcula();
  b.doc.getElementById("cM2").value = "90";
  setChoice(b.doc, "cBanos", 3);
  clickCalc(b.doc, "cCalc");
  assert.strictEqual(b.doc.getElementById("cMin").innerHTML, "28 <small>kW</small>");
  assert.strictEqual(b.doc.getElementById("cRec").innerHTML, "35 <small>kW</small>");
});

// ---------- Aires: frigorías y kW ----------
test("aire: 20 m² sin sol => 2000 frig y ~2.3 kW", function () {
  var b = bootCalcula();
  b.doc.getElementById("aM2").value = "20";
  setChoice(b.doc, "aEstancias", 1);
  setChoice(b.doc, "aSol", "no");
  clickCalc(b.doc, "aCalc");
  var frig = 2000, kw = 2.3;
  assert.strictEqual(b.doc.getElementById("aMin").innerHTML,
    frig.toLocaleString("es-ES") + " <small>frig.</small>");
  assert.strictEqual(b.doc.getElementById("aRec").innerHTML,
    kw.toLocaleString("es-ES") + " <small>kW</small>");
});

test("aire: 20 m² con sol => +20% => 2400 frig y ~2.8 kW", function () {
  var b = bootCalcula();
  b.doc.getElementById("aM2").value = "20";
  setChoice(b.doc, "aEstancias", 1);
  setChoice(b.doc, "aSol", "si");
  clickCalc(b.doc, "aCalc");
  var frig = 2400, kw = 2.8;
  assert.strictEqual(b.doc.getElementById("aMin").innerHTML,
    frig.toLocaleString("es-ES") + " <small>frig.</small>");
  assert.strictEqual(b.doc.getElementById("aRec").innerHTML,
    kw.toLocaleString("es-ES") + " <small>kW</small>");
});

// ---------- Selección de producto (recomendación) ----------
test("caldera: recomienda la ficha más ajustada y genera enlace al catálogo", function () {
  var dataset = {
    calderas: {
      installNote: "x",
      products: [
        { slug: "peque-24", name: "Peque 24", brand: "MarcaA", price: 1000, pop: 1,
          idealFor: "Hasta 100 m² con 1 baño", best: true },
        { slug: "grande-28", name: "Grande 28", brand: "MarcaB", price: 1200, pop: 2,
          idealFor: "Hasta 150 m² con 2 baños" }
      ]
    }
  };
  var b = bootCalcula(dataset);
  b.doc.getElementById("cM2").value = "90";
  setChoice(b.doc, "cBanos", 1);
  clickCalc(b.doc, "cCalc");
  return h.flush().then(function () {
    var html = b.doc.getElementById("cReco").innerHTML;
    assert.ok(html.indexOf("Peque 24") !== -1, "debe recomendar la más ajustada (100 m²)");
    assert.ok(html.indexOf("calderas#p=peque-24") !== -1, "enlace al catálogo con el slug");
  });
});
