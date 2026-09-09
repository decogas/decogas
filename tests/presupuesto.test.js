// ============================================================
// presupuesto.test.js — La lógica del presupuesto rápido de la portada.
//
// Lo que se protege aquí es lo que le decimos al cliente sobre el precio,
// así que conviene que no se rompa sin que nadie se entere:
//   · leer bien los m² y los baños para los que sirve cada máquina,
//   · no ofrecer un multisplit a quien quiere climatizar una sola estancia,
//   · enseñar el abanico de gamas y no solo lo más barato,
//   · no repetir "Eficiencia A" como si distinguiera algo (las 48 calderas
//     del catálogo son A),
//   · y que el panel entienda después el presupuesto que se guardó.
// ============================================================
"use strict";

var test = require("node:test");
var assert = require("node:assert");
var h = require("./harness");

var F = "presupuesto-rapido.js";
var leerM2 = h.extractFn(F, "leerM2");
var leerBanos = h.extractFn(F, "leerBanos");
var textoMedidas = h.extractFn(F, "textoMedidas");
var esMultisplit = h.extractFn(F, "esMultisplit");

// ---------- Leer para qué vivienda sirve cada máquina ----------

test("lee los m² y los baños de ideal_for", function () {
  assert.strictEqual(leerM2("Viviendas de hasta 150 m² con 2 baños."), 150);
  assert.strictEqual(leerBanos("Viviendas de hasta 150 m² con 2 baños."), 2);
});

test('"2-3 baños" cuenta como 3, que es el máximo que cubre', function () {
  assert.strictEqual(leerBanos("Viviendas de hasta 180 m² con 2-3 baños."), 3);
});

test("si no hay dato, devuelve null y no se inventa un número", function () {
  assert.strictEqual(leerM2("Viviendas de tamaño medio con 1 baño."), null);
  assert.strictEqual(leerBanos("Hasta 25 m²."), null);
});

test("las medidas se buscan también en las specs, no solo en ideal_for", function () {
  // Caso real: hay calderas cuyo ideal_for no trae número ("tamaño medio")
  // pero sí lo traen sus specs. Si solo mirásemos ideal_for, esas máquinas
  // no podrían salir nunca en un presupuesto.
  var p = { ideal_for: "Viviendas de tamaño medio con 1 baño.", specs: ["Condensación", "Hasta 100 m² y 1 baño"] };
  assert.strictEqual(leerM2(textoMedidas(p)), 100);
  assert.strictEqual(leerBanos(textoMedidas(p)), 1);
});

// ---------- Multisplit ----------

test("reconoce los multisplit por el nombre", function () {
  assert.ok(esMultisplit("Aire 2x1 Hisense 2AMW42U4RGC+CF25YR04G"));
  assert.ok(esMultisplit("Ferroli Giada M 2x1 (9+12) WiFi"));
  assert.ok(esMultisplit("Aire 3x1 Hisense 3AMW62U4RJC+CF25YR04G"));
});

test("un split normal no es multisplit aunque lleve números en el nombre", function () {
  assert.ok(!esMultisplit("Samsung AR40H09C WiFi"));
  assert.ok(!esMultisplit("Daikin TXF25F WiFi"));
  assert.ok(!esMultisplit("WindFree Comfort S2 AR60F09"));
  assert.ok(!esMultisplit("Perfera TXM20A WiFi"));
});

// ---------- Las tres gamas ----------

var ETIQUETAS = ["La más ajustada de precio", "El equilibrio entre precio y equipamiento", "La mejor equipada"];
var tresGamas = h.extractFn(F, "tresGamas", { ETIQUETAS: ETIQUETAS });

function maqs() {
  var precios = Array.prototype.slice.call(arguments);
  return precios.map(function (p, i) { return { n: "M" + i, p: p }; });
}

test("con muchas opciones enseña la más barata, una intermedia y la más equipada", function () {
  // Caso real: para 120 m² y 2 baños encajan 33 calderas de 1250 a 3595 €.
  // Antes se enseñaban las tres más baratas y el resto no existía.
  var op = maqs(1250, 1300, 1400, 1500, 1700, 2200, 2900, 3595);
  var tres = tresGamas(op);
  assert.strictEqual(tres.length, 3);
  assert.strictEqual(tres[0].m.p, 1250, "la primera es la más ajustada");
  assert.strictEqual(tres[2].m.p, 3595, "la última es la mejor equipada");
  assert.ok(tres[1].m.p > 1250 && tres[1].m.p < 3595, "la de en medio está entre las dos");
  assert.strictEqual(tres[0].et, ETIQUETAS[0]);
  assert.strictEqual(tres[2].et, ETIQUETAS[2]);
});

test("si solo encaja una, no se le pone etiqueta de gama", function () {
  var tres = tresGamas(maqs(1250));
  assert.strictEqual(tres.length, 1);
  assert.strictEqual(tres[0].et, "La que encaja con tu vivienda");
});

test("con dos o tres opciones se enseñan todas, sin repetir ninguna", function () {
  [2, 3].forEach(function (n) {
    var op = maqs.apply(null, [1000, 1500, 2000].slice(0, n));
    var tres = tresGamas(op);
    assert.strictEqual(tres.length, n);
    var vistos = tres.map(function (x) { return x.m.p; });
    assert.strictEqual(new Set(vistos).size, n, "no se repite ninguna máquina");
    assert.strictEqual(tres[n - 1].et, ETIQUETAS[2], "la más cara es la mejor equipada");
  });
});

test("nunca se enseña la misma máquina dos veces", function () {
  for (var n = 1; n <= 40; n++) {
    var op = [];
    for (var i = 0; i < n; i++) op.push({ n: "M" + i, p: 1000 + i * 50 });
    var vistos = tresGamas(op).map(function (x) { return x.m.n; });
    assert.strictEqual(new Set(vistos).size, vistos.length, "n=" + n);
  }
});

// ---------- Lo que distingue a una máquina de otra ----------

var rasgos = h.extractFn(F, "rasgos");

test("la eficiencia solo aparece cuando de verdad distingue", function () {
  var maq = { m: "Ferroli", e: "A", s: ["Condensación"] };
  assert.ok(rasgos(maq, false).indexOf("Eficiencia A") === -1, "si todas son A, no se dice");
  assert.ok(rasgos(maq, true).indexOf("Eficiencia A") !== -1, "si difieren, sí se dice");
});

test("no repite las medidas ni los m², que ya van aparte", function () {
  var maq = { m: "Bosch", e: "A", s: ["Condensación", "Hasta 100 m² y 1 baño", "Medidas: 626x400x270 mm", "Caudalímetro incl."] };
  var r = rasgos(maq, false);
  assert.ok(r.every(function (x) { return !/^Medidas/i.test(x); }), "fuera las medidas");
  assert.ok(r.every(function (x) { return !/\d+\s*m²/.test(x); }), "fuera los m²");
  assert.ok(r.indexOf("Condensación") !== -1);
  assert.ok(r.indexOf("Caudalímetro incl.") !== -1);
});

test("no se le sueltan al cliente quince rasgos de golpe", function () {
  var maq = { m: "Marca", e: "A", s: ["a", "b", "c", "d", "e", "f", "g"] };
  assert.ok(rasgos(maq, true).length <= 4);
});

// ---------- Lo que se guarda, se tiene que poder volver a leer ----------

var leer = h.extractFn("presupuestos.js", "leer", { MARCA: "PRESUPUESTO RÁPIDO desde la web" });

test("el panel entiende un presupuesto con precio", function () {
  var msg = [
    "PRESUPUESTO RÁPIDO desde la web",
    "Servicio: Cambiar caldera",
    "Vivienda: 120 m², 2 baños",
    "¿Ya tiene gas?: sí",
    "",
    "Presupuesto mostrado: Ferroli Alpha 28 C — 1.250 € | Baxi Neodens 28/28 — 1.500 € | Vaillant ecoTec Plus — 2.295 €",
    "Encajaban 33 máquinas (1.250 € a 3.595 €)"
  ].join("\n");
  var p = leer(msg);
  assert.strictEqual(p.maquinas.length, 3);
  assert.strictEqual(p.maquinas[0], "Ferroli Alpha 28 C — 1.250 €");
  assert.ok(p.abanico.indexOf("33 máquinas") !== -1);
  assert.strictEqual(p.motivos.length, 0);
  assert.ok(p.respuestas.indexOf("Servicio: Cambiar caldera") !== -1);
  assert.ok(p.respuestas.indexOf("PRESUPUESTO RÁPIDO desde la web") === -1, "la marca no es una respuesta");
});

test("el panel entiende un presupuesto sin precio y por qué no lo hubo", function () {
  var msg = [
    "PRESUPUESTO RÁPIDO desde la web",
    "Servicio: Aerotermia",
    "",
    "SIN PRECIO AUTOMÁTICO. Motivos: La aerotermia siempre necesita un estudio previo; Tu caso necesita que lo miremos con calma"
  ].join("\n");
  var p = leer(msg);
  assert.strictEqual(p.maquinas.length, 0);
  assert.strictEqual(p.motivos.length, 2);
  assert.strictEqual(p.motivos[0], "La aerotermia siempre necesita un estudio previo");
});

test("un mensaje vacío o raro no revienta el panel", function () {
  [undefined, null, "", "cualquier cosa"].forEach(function (m) {
    var p = leer(m);
    assert.ok(Array.isArray(p.maquinas) && Array.isArray(p.motivos) && Array.isArray(p.respuestas));
  });
});

// ---------- No colar una máquina demasiado grande ----------

var ajustadas = h.extractFn(F, "ajustadas", { HOLGURA: 1.5 });

test("descarta las máquinas que se pasan mucho del tamaño de la vivienda", function () {
  // Caso real: para 90 m² encajaban 48 calderas y la "mejor equipada" salía
  // una de 220 m² y 3 baños por 3.595 €. No es mejor: es la equivocada.
  var lista = [90, 100, 110, 130, 150, 180, 220].map(function (m) { return { m2: m, p: m * 20 }; });
  var out = ajustadas(lista, 90);
  assert.ok(out.every(function (p) { return p.m2 <= 135; }), "nada por encima de 90 × 1,5");
  assert.strictEqual(out.length, 4);
});

test("si con el margen justo no queda nada, se amplía antes que dejarle sin respuesta", function () {
  var lista = [200, 220].map(function (m) { return { m2: m, p: 3000 }; });
  assert.strictEqual(ajustadas(lista, 90).length, 2);
});

test("una lista vacía sigue vacía, no se inventa nada", function () {
  assert.strictEqual(ajustadas([], 120).length, 0);
});
