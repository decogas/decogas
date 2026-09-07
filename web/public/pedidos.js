// ============================================================
// pedidos.js — Panel de pedidos a proveedores
//  · Lista el catálogo (tabla "products") con un botón "Pedir".
//  · "Pedir" abre WhatsApp con el mensaje ya escrito para el proveedor
//    que corresponde a esa máquina, y registra el pedido en "pedidos".
//  · Debajo, el historial con su estado, que se avanza con un clic.
//
// Por qué WhatsApp por enlace y no por API:
//   La API de WhatsApp exige un número dedicado y plantillas aprobadas, y las
//   respuestas del proveedor llegarían a la API en vez de al móvil. Con el
//   enlace wa.me el mensaje sale del número de siempre y las respuestas
//   llegan donde siempre. Mismo resultado, sin coste ni riesgo de bloqueo.
// ============================================================
(function () {
  "use strict";

  var cfg = window.DECOGAS_CONFIG || {};
  var LIVE = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  var sb = LIVE ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;

  var $ = function (id) { return document.getElementById(id); };
  var esc = window.DecogasUtil.esc;
  var norm = window.DecogasUtil.norm;

  // ---------- CONFIGURACIÓN: proveedores ----------
  // Se pide por CATEGORÍA, no por marca: ahora mismo todas las calderas van a
  // TUVAIN y todos los aires a JABAD. Si algún día una marca concreta cambia
  // de proveedor, se añade aquí en EXCEPCIONES_MARCA y manda sobre la categoría.
  var PROVEEDORES = {
    calderas: { nombre: "TUVAIN", tel: "34638842967" },
    aires:    { nombre: "JABAD",  tel: "34610279623" },
    termos:   { nombre: "TUVAIN", tel: "34638842967" }   // sin confirmar: revisar
  };
  var EXCEPCIONES_MARCA = {
    // "Daikin": { nombre: "OTRO PROVEEDOR", tel: "34600000000" },
  };
  function proveedorDe(p) {
    return EXCEPCIONES_MARCA[p.brand] || PROVEEDORES[p.category] || PROVEEDORES.calderas;
  }

  // ---------- CONFIGURACIÓN: estados ----------
  // Para cambiarlos basta con tocar esta lista (y el CHECK de la tabla en la BD).
  var ESTADOS = ["pedido", "confirmado", "pagado", "recibido", "instalado"];
  var ESTADO_LABEL = {
    pedido: "Pedido", confirmado: "Confirmado", pagado: "Pagado",
    recibido: "Recibido", instalado: "Instalado", cancelado: "Cancelado"
  };

  var CATALOGO = [];
  var PEDIDOS = [];
  var FILTRO = { texto: "", categoria: "" };

  // Vista del catálogo: lista (compacta, para pedir rápido) o cuadrícula (con
  // foto, para reconocer la máquina de un vistazo). Se recuerda entre visitas.
  var VISTA = "lista";
  try { VISTA = localStorage.getItem("decogas_pedidos_vista") || "lista"; } catch (e) { /* sin storage */ }

  // Se usa la foto original tal cual, sin pasar por el transformador de
  // imágenes de Supabase. Se midió: las fotos del catálogo pesan entre 4 y
  // 23 KB, así que reducirlas ahorraba ~1 KB y a cambio metía una dependencia
  // más (el servicio de transformación) que puede fallar en silencio.
  // Si algún día se suben fotos grandes, aquí es donde habría que reducirlas.
  function miniatura(url) { return url || ""; }

  var toastTimer;
  function toast(text, isErr) {
    var t = $("toast");
    t.textContent = text;
    t.className = isErr ? "err show" : "show";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 3200);
  }

  // ---------- Sesión compartida con el resto del panel ----------
  if (LIVE) {
    sb.auth.getSession().then(function (res) {
      if (res.data && res.data.session) entrar();
    }).catch(function () { /* sin red: se queda la pantalla de login */ });
  }

  function entrar() {
    $("loginScreen").classList.add("hidden");
    $("panel").style.display = "block";
    cargar();
  }

  $("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var msg = $("loginMsg");
    msg.classList.remove("show");
    $("loginBtn").disabled = true;
    if (!LIVE) { entrar(); $("loginBtn").disabled = false; return; }
    sb.auth.signInWithPassword({ email: $("adminEmail").value.trim(), password: $("adminPass").value })
      .then(function (res) {
        $("loginBtn").disabled = false;
        if (res.error) { msg.textContent = "Credenciales incorrectas."; msg.classList.add("show"); return; }
        entrar();
      })
      .catch(function () {
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
  function cargar() {
    if (!LIVE) { pintar(); return; }
    sb.from("products").select("slug,name,brand,category,price,img").eq("visible", true).order("category").order("name")
      .then(function (res) {
        if (res.error) { toast("No se pudo cargar el catálogo.", true); return; }
        CATALOGO = res.data || [];
        aplicarVista();
      });
    cargarPedidos();
  }

  function cargarPedidos() {
    if (!LIVE) { PEDIDOS = []; pintarHistorial(); return; }
    sb.from("pedidos").select("*").order("created_at", { ascending: false })
      .then(function (res) {
        if (res.error) {
          // Aún no existe la tabla: la página sigue sirviendo para pedir.
          $("historial").innerHTML = '<div class="empty-state">Todavía no se puede guardar el historial: falta crear la tabla «pedidos» en la base de datos.</div>';
          return;
        }
        PEDIDOS = res.data || [];
        pintarHistorial();
        pintarStats();
      });
  }

  // ---------- El mensaje de cada máquina ----------
  // Independiente para cada una: lleva su modelo, su marca y el proveedor al
  // que le toca. Se abre en WhatsApp escrito y solo hay que darle a enviar.
  function mensajeDe(p) {
    var prov = proveedorDe(p);
    return "Hola, buenos días.\n\n" +
      "Os hacemos pedido de:\n" +
      "· " + p.name + (p.brand ? " (" + p.brand + ")" : "") + " — 1 ud.\n\n" +
      "Confirmadme disponibilidad y plazo de entrega, por favor.\n" +
      "Gracias.\n\n" +
      "Instalaciones Decogas";
  }

  function enlaceWhatsApp(p) {
    return "https://wa.me/" + proveedorDe(p).tel + "?text=" + encodeURIComponent(mensajeDe(p));
  }

  // ---------- Pintar el catálogo ----------
  function pasaFiltro(p) {
    if (FILTRO.categoria && p.category !== FILTRO.categoria) return false;
    if (FILTRO.texto) {
      var t = norm(p.name + " " + (p.brand || ""));
      if (t.indexOf(norm(FILTRO.texto)) === -1) return false;
    }
    return true;
  }

  var ICONO_WA = '<svg viewBox="0 0 24 24"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.87.5 3.62 1.44 5.15L2 22l5.09-1.53a9.87 9.87 0 0 0 4.95 1.31c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm5.79 14.16c-.24.68-1.4 1.3-1.93 1.36-.5.05-.95.24-3.2-.67-2.7-1.09-4.42-3.85-4.55-4.03-.13-.18-1.09-1.45-1.09-2.77 0-1.31.69-1.96.93-2.23.24-.27.53-.34.7-.34.18 0 .35 0 .5.01.16.01.38-.06.59.45.22.53.74 1.84.8 1.97.07.14.11.29.02.47-.09.18-.13.29-.26.45-.13.16-.28.35-.4.47-.13.13-.27.28-.12.54.16.27.7 1.15 1.5 1.86 1.03.92 1.9 1.2 2.17 1.34.27.13.42.11.58-.07.16-.18.67-.78.85-1.05.18-.27.35-.22.59-.13.24.09 1.54.73 1.8.86.27.13.44.2.5.31.07.11.07.63-.17 1.31z"/></svg>';

  // Una ficha en la lista compacta.
  function filaLista(p) {
    return '<div class="ped">' +
      '<div>' +
        '<div class="ped-nom">' + esc(p.name) + '</div>' +
        '<div class="ped-meta">' + esc(p.brand || "") +
          ' · pedido a <b>' + esc(proveedorDe(p).nombre) + '</b></div>' +
      '</div>' +
      '<div class="ped-precio">' + (p.price ? Number(p.price).toLocaleString("es-ES") + " €" : "") + '</div>' +
      '<a class="btn-wa" href="' + esc(enlaceWhatsApp(p)) + '" target="_blank" rel="noopener" data-slug="' + esc(p.slug) + '">' +
        ICONO_WA + 'Pedir</a>' +
    '</div>';
  }

  // Una tarjeta en la cuadrícula, con foto.
  function tarjeta(p) {
    var foto = miniatura(p.img);
    return '<div class="tarjeta">' +
      '<div class="tarjeta-foto">' +
        (foto ? '<img src="' + esc(foto) + '" alt="' + esc(p.name) + '" loading="lazy">'
              : '<span class="sin-foto">sin foto</span>') +
      '</div>' +
      '<div class="tarjeta-cuerpo">' +
        '<div class="ped-nom">' + esc(p.name) + '</div>' +
        '<div class="ped-meta">' + esc(p.brand || "") +
          ' · <b>' + esc(proveedorDe(p).nombre) + '</b></div>' +
        '<div class="tarjeta-pie">' +
          '<span class="ped-precio">' + (p.price ? Number(p.price).toLocaleString("es-ES") + " €" : "") + '</span>' +
          '<a class="btn-wa" href="' + esc(enlaceWhatsApp(p)) + '" target="_blank" rel="noopener" data-slug="' + esc(p.slug) + '">' +
            ICONO_WA + 'Pedir</a>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function pintarCatalogo() {
    var lista = CATALOGO.filter(pasaFiltro);
    var cont = $("catalogo");

    // El contador ayuda cuando se busca: dice cuántas quedan tras filtrar.
    var res = $("resultados");
    if (res) {
      res.textContent = lista.length === CATALOGO.length
        ? CATALOGO.length + " máquinas"
        : lista.length + " de " + CATALOGO.length + " máquinas";
    }

    if (!lista.length) {
      cont.innerHTML = '<div class="empty-state">No hay máquinas que coincidan con la búsqueda.</div>';
      return;
    }

    // Agrupadas por categoría, con el proveedor visible en la cabecera.
    var porCat = {};
    lista.forEach(function (p) { (porCat[p.category] = porCat[p.category] || []).push(p); });

    var esGrid = VISTA === "cuadricula";
    var html = "";
    Object.keys(porCat).sort().forEach(function (cat) {
      var prov = PROVEEDORES[cat] || {};
      html += '<div class="ped-cat">' +
        '<h2>' + esc(cat.charAt(0).toUpperCase() + cat.slice(1)) + '</h2>' +
        '<span class="prov">' + esc(prov.nombre || "sin proveedor") + '</span>' +
        '<span class="linea"></span></div>';
      html += esGrid ? '<div class="cuadricula">' : '';
      porCat[cat].forEach(function (p) { html += esGrid ? tarjeta(p) : filaLista(p); });
      html += esGrid ? '</div>' : '';
    });
    cont.innerHTML = html;

    // Al pulsar: se abre WhatsApp (por el href) y además se registra el pedido.
    Array.prototype.forEach.call(cont.querySelectorAll(".btn-wa"), function (a) {
      a.addEventListener("click", function () {
        var p = CATALOGO.filter(function (x) { return x.slug === a.getAttribute("data-slug"); })[0];
        if (p) registrarPedido(p);
      });
    });
  }

  // ---------- Registrar ----------
  function registrarPedido(p) {
    var prov = proveedorDe(p);
    var fila = {
      producto_slug: p.slug,
      producto: p.name,
      marca: p.brand || null,
      categoria: p.category,
      proveedor: prov.nombre,
      precio: p.price || null,
      estado: "pedido"
    };
    if (!LIVE) { toast("Modo demo: no se guarda."); return; }
    sb.from("pedidos").insert([fila]).select().then(function (res) {
      if (res.error) { toast("Se abrió WhatsApp, pero no se pudo guardar el pedido.", true); return; }
      toast("Pedido registrado a " + prov.nombre + ".");
      cargarPedidos();
    });
  }

  // ---------- Historial ----------
  function pintarHistorial() {
    var cont = $("historial");
    if (!PEDIDOS.length) {
      cont.innerHTML = '<div class="empty-state">Todavía no hay pedidos registrados.</div>';
      return;
    }
    cont.innerHTML = PEDIDOS.map(function (r) {
      var f = new Date(r.created_at);
      var fecha = f.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) +
        " · " + f.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
      return '<div class="hist">' +
        '<div>' +
          '<div class="ped-nom">' + esc(r.producto) + '</div>' +
          '<div class="ped-meta">' + esc(r.marca || "") + ' · <b>' + esc(r.proveedor || "") + '</b></div>' +
        '</div>' +
        '<div class="hist-fecha">' + esc(fecha) + '</div>' +
        '<button class="est est-' + esc(r.estado) + '" data-id="' + esc(r.id) + '" type="button" title="Pulsa para avanzar el estado">' +
          esc(ESTADO_LABEL[r.estado] || r.estado) + '</button>' +
        '<button class="hist-del" data-del="' + esc(r.id) + '" type="button" title="Borrar">✕</button>' +
      '</div>';
    }).join("");

    Array.prototype.forEach.call(cont.querySelectorAll(".est"), function (b) {
      b.addEventListener("click", function () { avanzarEstado(b.getAttribute("data-id")); });
    });
    Array.prototype.forEach.call(cont.querySelectorAll(".hist-del"), function (b) {
      b.addEventListener("click", function () { borrar(b.getAttribute("data-del")); });
    });
  }

  function avanzarEstado(id) {
    var r = PEDIDOS.filter(function (x) { return String(x.id) === String(id); })[0];
    if (!r) return;
    var i = ESTADOS.indexOf(r.estado);
    var siguiente = ESTADOS[(i + 1) % ESTADOS.length];
    sb.from("pedidos").update({ estado: siguiente }).eq("id", id).then(function (res) {
      if (res.error) { toast("No se pudo cambiar el estado.", true); return; }
      r.estado = siguiente;
      pintarHistorial();
      pintarStats();
    });
  }

  function borrar(id) {
    var seguir = function () {
      sb.from("pedidos").delete().eq("id", id).then(function (res) {
        if (res.error) { toast("No se pudo borrar.", true); return; }
        PEDIDOS = PEDIDOS.filter(function (x) { return String(x.id) !== String(id); });
        pintarHistorial(); pintarStats();
        toast("Pedido borrado.");
      });
    };
    // DecogasConfirm es un objeto con .ask(), no una función (igual que en clientes.js).
    if (window.DecogasConfirm && window.DecogasConfirm.ask) {
      window.DecogasConfirm.ask({
        title: "Borrar pedido",
        message: "¿Quitar este pedido del historial? Esto no cancela el pedido con el proveedor.",
        confirmText: "Borrar", key: "del-pedido"
      }).then(function (ok) { if (ok) seguir(); });
    } else if (confirm("¿Borrar este pedido del historial?")) { seguir(); }
  }

  // ---------- Contadores ----------
  function pintarStats() {
    var ahora = new Date();
    var delMes = PEDIDOS.filter(function (r) {
      var f = new Date(r.created_at);
      return f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear();
    });
    var enCamino = PEDIDOS.filter(function (r) { return r.estado === "pedido" || r.estado === "confirmado" || r.estado === "pagado"; });
    var enAlmacen = PEDIDOS.filter(function (r) { return r.estado === "recibido"; });
    $("statMes").textContent = delMes.length;
    $("statCamino").textContent = enCamino.length;
    $("statAlmacen").textContent = enAlmacen.length;
    $("statTotal").textContent = PEDIDOS.length;
  }

  function pintar() { pintarCatalogo(); pintarHistorial(); pintarStats(); }

  // ---------- Vista: lista / cuadrícula ----------
  function aplicarVista() {
    Array.prototype.forEach.call(document.querySelectorAll("#vistaBtns .chip"), function (b) {
      b.classList.toggle("active", b.getAttribute("data-vista") === VISTA);
    });
    pintarCatalogo();
  }
  Array.prototype.forEach.call(document.querySelectorAll("#vistaBtns .chip"), function (b) {
    b.addEventListener("click", function () {
      VISTA = b.getAttribute("data-vista");
      try { localStorage.setItem("decogas_pedidos_vista", VISTA); } catch (e) { /* sin storage */ }
      aplicarVista();
    });
  });

  // ---------- Filtros ----------
  // Buscar mientras se escribe, sin esperar a nada.
  $("qProd").addEventListener("input", function () {
    FILTRO.texto = this.value.trim();
    pintarCatalogo();
  });
  // Escape limpia la búsqueda: es lo que espera cualquiera al teclear.
  $("qProd").addEventListener("keydown", function (e) {
    if (e.key === "Escape" && this.value) { this.value = ""; FILTRO.texto = ""; pintarCatalogo(); }
  });
  Array.prototype.forEach.call(document.querySelectorAll("#catChips .chip"), function (c) {
    c.addEventListener("click", function () {
      Array.prototype.forEach.call(document.querySelectorAll("#catChips .chip"), function (x) { x.classList.remove("active"); });
      c.classList.add("active");
      FILTRO.categoria = c.getAttribute("data-cat") || "";
      pintarCatalogo();
    });
  });
})();
