// ============================================================
// harness.js — Utilidades para testear los IIFEs de navegador
// de Decogas con node:test, sin depender de jsdom.
// ------------------------------------------------------------
// Los .js del proyecto son IIFEs que cuelgan de `window` y usan
// `document` / `localStorage`. Para ejercitarlos en Node:
//
//  1) makeContext(): crea un contexto `vm` con stubs mínimos de
//     window/document/localStorage/fetch/timers. Cada archivo se
//     carga con runFile() y sus exports quedan en context.window.
//
//  2) FakeDocument / FakeElement: DOM falso, deliberadamente
//     simple. getElementById devuelve un elemento genérico (o uno
//     preconfigurado). Se capturan innerHTML/textContent/clases y
//     los listeners registrados, para poder disparar eventos a mano.
//
//  3) extractFn(): para la lógica pura que vive DENTRO del closure
//     (no exportada: esc, catalogLink, normalizeLead) se extrae el
//     TEXTO real de la función del archivo fuente y se evalúa. Así
//     se testea el código de producción, no una copia.
//
// Diseño a propósito naíf: cubre justo lo que estos archivos tocan.
// ============================================================
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var SRC = path.join(__dirname, "..", "web", "public");

// ---------- DOM falso ----------
function FakeClassList() {
  this._set = Object.create(null);
}
FakeClassList.prototype.add = function () {
  for (var i = 0; i < arguments.length; i++) this._set[arguments[i]] = true;
};
FakeClassList.prototype.remove = function () {
  for (var i = 0; i < arguments.length; i++) delete this._set[arguments[i]];
};
FakeClassList.prototype.contains = function (n) { return !!this._set[n]; };
FakeClassList.prototype.toggle = function (n, force) {
  var has = !!this._set[n];
  var next = arguments.length > 1 ? !!force : !has;
  if (next) this._set[n] = true; else delete this._set[n];
  return next;
};

function FakeElement(tag) {
  this.tagName = (tag || "div").toUpperCase();
  this.dataset = {};
  this.style = {};
  this.style.setProperty = function (k, v) { this[k] = v; };
  this.style.removeProperty = function (k) { delete this[k]; };
  this.style.getPropertyValue = function (k) { return this[k] || ""; };
  this.classList = new FakeClassList();
  this.className = "";
  this.value = "";
  this.checked = false;
  this.children = [];
  this.listeners = {};
  this.offsetWidth = 0;
  this._html = "";
  this._text = "";
  this._qs = {};   // selector -> elemento devuelto por querySelector
  this._qsa = {};  // selector -> array devuelto por querySelectorAll
  this._attrs = {};
}
Object.defineProperty(FakeElement.prototype, "innerHTML", {
  get: function () { return this._html; },
  set: function (v) { this._html = String(v); }
});
Object.defineProperty(FakeElement.prototype, "textContent", {
  get: function () { return this._text; },
  set: function (v) { this._text = String(v); }
});
FakeElement.prototype.addEventListener = function (type, fn) {
  (this.listeners[type] = this.listeners[type] || []).push(fn);
};
FakeElement.prototype.removeEventListener = function () {};
FakeElement.prototype.dispatch = function (type, ev) {
  (this.listeners[type] || []).forEach(function (fn) { fn(ev || {}); });
};
FakeElement.prototype.appendChild = function (c) { this.children.push(c); return c; };
FakeElement.prototype.insertBefore = function (c) { this.children.push(c); return c; };
FakeElement.prototype.replaceWith = function () {};
FakeElement.prototype.remove = function () {};
FakeElement.prototype.scrollIntoView = function () {};
FakeElement.prototype.getBoundingClientRect = function () {
  return { left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100 };
};
FakeElement.prototype.closest = function (sel) {
  return this._qs[sel] !== undefined ? this._qs[sel] : null;
};
FakeElement.prototype.contains = function () { return false; };
FakeElement.prototype.setAttribute = function (k, v) { this._attrs[k] = String(v); };
FakeElement.prototype.getAttribute = function (k) {
  return this._attrs[k] !== undefined ? this._attrs[k] : null;
};
FakeElement.prototype.querySelector = function (sel) {
  if (this._qs[sel] !== undefined) return this._qs[sel];
  // Por defecto: un elemento genérico, para no reventar cadenas como
  // bmodal.querySelector(".budget-close").addEventListener(...).
  return new FakeElement();
};
FakeElement.prototype.querySelectorAll = function (sel) {
  return this._qsa[sel] !== undefined ? this._qsa[sel] : [];
};
FakeElement.prototype.setQuery = function (sel, el) { this._qs[sel] = el; return this; };

function FakeDocument() {
  this._byId = {};
  this._qs = {};
  this._qsa = {};
  this.listeners = {};
  this.body = new FakeElement("body");
  this.documentElement = new FakeElement("html");
  this.documentElement.scrollTop = 0;
  this.documentElement.scrollHeight = 1000;
}
FakeDocument.prototype.getElementById = function (id) {
  if (this._byId[id] === null) return null; // registrado explícitamente como ausente
  if (!this._byId[id]) { var el = new FakeElement(); el.id = id; this._byId[id] = el; }
  return this._byId[id];
};
FakeDocument.prototype.register = function (id, props) {
  var el = new FakeElement();
  el.id = id;
  if (props) Object.keys(props).forEach(function (k) { el[k] = props[k]; });
  this._byId[id] = el;
  return el;
};
FakeDocument.prototype.absent = function (id) { this._byId[id] = null; };
FakeDocument.prototype.createElement = function (tag) { return new FakeElement(tag); };
FakeDocument.prototype.querySelector = function (sel) {
  return this._qs[sel] !== undefined ? this._qs[sel] : null;
};
FakeDocument.prototype.querySelectorAll = function (sel) {
  return this._qsa[sel] !== undefined ? this._qsa[sel] : [];
};
FakeDocument.prototype.addEventListener = function (type, fn) {
  (this.listeners[type] = this.listeners[type] || []).push(fn);
};
FakeDocument.prototype.removeEventListener = function () {};
FakeDocument.prototype.dispatch = function (type, ev) {
  (this.listeners[type] || []).forEach(function (fn) { fn(ev || {}); });
};

// ---------- localStorage falso ----------
function FakeStorage() { this._d = {}; }
FakeStorage.prototype.getItem = function (k) {
  return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null;
};
FakeStorage.prototype.setItem = function (k, v) { this._d[k] = String(v); };
FakeStorage.prototype.removeItem = function (k) { delete this._d[k]; };
FakeStorage.prototype.clear = function () { this._d = {}; };

// ---------- Contexto vm ----------
function makeContext(opts) {
  opts = opts || {};
  var doc = opts.document || new FakeDocument();
  var storage = opts.localStorage || new FakeStorage();
  var win = opts.window || {};
  win.document = doc;
  win.localStorage = storage;
  win.scrollY = 0;
  win.innerHeight = 800;
  win.location = win.location || { href: "https://decogas.test/index.html" };
  if (!win.location.href) win.location.href = "https://decogas.test/index.html";
  // Respetamos lo que ya traiga `win` (los tests pueden pasar sus propios
  // stubs dentro del objeto window) y sólo rellenamos lo que falte.
  win.alert = opts.alert || win.alert || function () {};
  win.confirm = opts.confirm || win.confirm || function () { return true; };
  win.DecogasConfirm = opts.DecogasConfirm || win.DecogasConfirm || { ask: function () { return Promise.resolve(true); } };
  win.print = opts.print || win.print || function () {};
  win.getComputedStyle = function () { return {}; };

  var ctx = {
    window: win,
    document: doc,
    localStorage: storage,
    navigator: { userAgent: "node" },
    location: win.location,
    console: console,
    fetch: opts.fetch || function () { return Promise.reject(new Error("no fetch stub")); },
    setTimeout: function () { return 0; },   // no-op: no queremos timers reales en tests
    clearTimeout: function () {},
    setInterval: function () { return 0; },
    clearInterval: function () {},
    requestAnimationFrame: function () { return 0; },
    cancelAnimationFrame: function () {},
    queueMicrotask: queueMicrotask,
    URL: URL, // global estándar del navegador (app.js lo usa para componer URLs)
    performance: { now: function () { return 0; } },
    AbortController: function () { this.signal = {}; this.abort = function () {}; },
    IntersectionObserver: function () {
      this.observe = function () {}; this.unobserve = function () {}; this.disconnect = function () {};
    },
    Promise: Promise
  };
  ctx.self = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  return ctx;
}

function runFile(ctx, name) {
  var code = fs.readFileSync(path.join(SRC, name), "utf8");
  vm.runInContext(code, ctx, { filename: name });
  return ctx;
}

// ---------- Extracción de funciones no exportadas ----------
function findFnStart(source, name) {
  var decl = source.indexOf("function " + name + "(");
  if (decl !== -1) return decl;
  var assign = source.indexOf(name + " = function");
  if (assign !== -1) return source.indexOf("function", assign);
  throw new Error("Función no encontrada en fuente: " + name);
}
function sliceFn(source, start) {
  var open = source.indexOf("{", start);
  var depth = 0, i = open;
  for (; i < source.length; i++) {
    var ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) { i++; break; } }
  }
  return source.slice(start, i);
}
// Extrae el TEXTO de una función del archivo y la evalúa. `deps` es un
// objeto {nombre: valor} de variables libres que la función necesita en
// su ámbito (p.ej. catalogLink depende de esc).
function extractFn(fileName, fnName, deps) {
  var source = fs.readFileSync(path.join(SRC, fileName), "utf8");
  var src = sliceFn(source, findFnStart(source, fnName));
  deps = deps || {};
  var names = Object.keys(deps);
  var vals = names.map(function (k) { return deps[k]; });
  // Function(param1, param2, ..., body): los nombres van como argumentos
  // separados, no unidos en una sola cadena.
  // eslint-disable-next-line no-new-func
  var factory = Function.apply(null, names.concat("return (" + src + ")"));
  return factory.apply(null, vals);
}

// Espera a que se vacíe la cola de microtareas (para promesas del vm).
function flush() {
  return new Promise(function (r) { setImmediate(r); });
}

module.exports = {
  SRC: SRC,
  FakeElement: FakeElement,
  FakeDocument: FakeDocument,
  FakeStorage: FakeStorage,
  makeContext: makeContext,
  runFile: runFile,
  extractFn: extractFn,
  flush: flush
};
