// ============================================================
// app.js — Comportamiento común a todas las páginas
// (cabecera, navegación móvil, animaciones, formulario)
// Todo con guardas de existencia y delegación de eventos.
// ============================================================
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };

  // ---------- Imágenes rotas del blog: ocultarlas con elegancia ----------
  // Los artículos enlazan fotos de la web antigua; si alguna falta, en vez
  // de mostrar el icono de imagen rota, ocultamos la figura entera.
  document.addEventListener("error", function (e) {
    var t = e.target;
    if (t && t.tagName === "IMG" && t.closest && t.closest(".article-prose")) {
      var fig = t.closest("figure") || t;
      fig.style.display = "none";
    }
  }, true);

  // ---------- Tablas anchas del blog: scroll horizontal en móvil ----------
  // Envolvemos cada tabla del artículo para que se pueda deslizar en vez de
  // desbordar la página (que quedaría cortada por overflow-x:hidden).
  (function () {
    var tables = document.querySelectorAll(".article-prose table");
    for (var i = 0; i < tables.length; i++) {
      var t = tables[i];
      if (t.parentNode && t.parentNode.classList && t.parentNode.classList.contains("table-scroll")) continue;
      var wrap = document.createElement("div");
      wrap.className = "table-scroll";
      t.parentNode.insertBefore(wrap, t);
      wrap.appendChild(t);
    }
  })();

  // ---------- Cabecera pegajosa ----------
  var header = $("siteHeader");
  if (header) {
    var onScroll = function () {
      var y = window.scrollY || document.documentElement.scrollTop;
      header.classList.toggle("scrolled", y > 40);
    };
    document.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // ---------- Navegación móvil (delegación) ----------
  var mobileNav = $("mobileNav");
  if (mobileNav) {
    document.addEventListener("click", function (e) {
      if (e.target.closest("#navToggle")) mobileNav.classList.toggle("open");
      else if (e.target.closest("#navClose") || e.target.closest("#mobileNav a")) {
        mobileNav.classList.remove("open");
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") mobileNav.classList.remove("open");
    });
  }

  // ---------- Revelado al hacer scroll ----------
  var revealEls = document.querySelectorAll(".reveal, .reveal-stagger");
  if (revealEls.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealEls.forEach(function (el) { io.observe(el); });
  }

  // ---------- Contadores animados ----------
  var counters = document.querySelectorAll(".counter");
  if (counters.length) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var target = parseInt(el.dataset.target, 10) || 0;
        var start = performance.now();
        var tick = function (now) {
          var p = Math.min(1, (now - start) / 1400);
          el.textContent = Math.round((1 - Math.pow(1 - p, 3)) * target);
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        cio.unobserve(el);
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { cio.observe(el); });
  }

  // ---------- Efecto 3D en tarjetas (delegación: cubre tarjetas re-renderizadas) ----------
  document.addEventListener("mousemove", function (e) {
    var card = e.target.closest(".p-card");
    if (!card || card.closest(".p-card.open")) return;
    var r = card.getBoundingClientRect();
    var x = (e.clientX - r.left) / r.width - 0.5;
    var y = (e.clientY - r.top) / r.height - 0.5;
    card.style.transform = "perspective(700px) rotateY(" + (x * 8) + "deg) rotateX(" + (-y * 8) + "deg) translateY(-4px)";
  });
  document.addEventListener("mouseout", function (e) {
    var card = e.target.closest(".p-card");
    if (card && !card.contains(e.relatedTarget)) card.style.transform = "";
  });

  // ---------- Botones magnéticos (delegación) ----------
  document.addEventListener("mousemove", function (e) {
    var btn = e.target.closest(".btn-flame, .btn-white");
    if (!btn) return;
    var r = btn.getBoundingClientRect();
    var x = (e.clientX - r.left) / r.width - 0.5;
    var y = (e.clientY - r.top) / r.height - 0.5;
    btn.style.transform = "translate(" + (x * 10) + "px, " + (y * 10) + "px)";
  });
  document.addEventListener("mouseout", function (e) {
    var btn = e.target.closest(".btn-flame, .btn-white");
    if (btn && !btn.contains(e.relatedTarget)) btn.style.transform = "";
  });

  // ---------- Modo claro/oscuro (el tema inicial lo pone theme.js en el head) ----------
  var themeBtn = document.getElementById("themeBtn");
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var actual = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
      var nuevo = actual === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", nuevo);
      try { localStorage.setItem("decogas_theme", nuevo); } catch (err) { /* sin almacenamiento */ }
    });
  }

  // ---------- Formulario de contacto (solo en index) ----------
  var form = $("infoForm");
  if (form) {
    var submitBtn = $("submitBtn");
    var successOverlay = $("successOverlay");

    // Chips de servicio (delegación)
    var serviceGroup = $("serviceGroup");
    if (serviceGroup) {
      serviceGroup.addEventListener("click", function (e) {
        var chip = e.target.closest(".radio-chip");
        if (!chip) return;
        serviceGroup.querySelectorAll(".radio-chip").forEach(function (c) { c.classList.remove("active"); });
        chip.classList.add("active");
      });
    }

    var setError = function (fieldId, hasError) {
      var field = $(fieldId);
      if (field) field.classList.toggle("error", hasError);
    };

    var validate = function () {
      var v = function (id) { var el = $(id); return el ? el.value.trim() : ""; };
      var checks = [
        ["field-nombre", v("nombre").length > 1],
        ["field-telefono", /^[0-9+()\s-]{9,}$/.test(v("telefono"))],
        ["field-email", /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v("email"))],
        ["field-mensaje", v("mensaje").length > 4]
      ];
      var ok = true;
      checks.forEach(function (c) { setError(c[0], !c[1]); if (!c[1]) ok = false; });
      return ok;
    };

    var burstSparkles = function (container) {
      var colors = ["#FF6B35", "#3AA6D9", "#FFB930"];
      for (var i = 0; i < 18; i++) {
        var s = document.createElement("span");
        s.className = "sparkle";
        var angle = Math.random() * Math.PI * 2;
        var dist = 60 + Math.random() * 90;
        s.style.setProperty("--sx", Math.cos(angle) * dist + "px");
        s.style.setProperty("--sy", Math.sin(angle) * dist + "px");
        s.style.left = "50%";
        s.style.top = "38%";
        s.style.background = colors[i % colors.length];
        container.appendChild(s);
        setTimeout(function (el) { el.remove(); }.bind(null, s), 950);
      }
    };

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!validate()) return;
      var consent = document.getElementById("consentCheck");
      var consentRow = document.getElementById("consentRow");
      if (consent && !consent.checked) {
        if (consentRow) {
          consentRow.classList.remove("shake");
          void consentRow.offsetWidth;
          consentRow.classList.add("error", "shake");
          consentRow.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return;
      }
      if (consentRow) consentRow.classList.remove("error");

      // Trampa anti-bots: si este campo oculto viene relleno, es un robot.
      // Fingimos éxito para no darle pistas, pero no se envía nada.
      var hp = document.getElementById("empresa_web");
      if (hp && hp.value) {
        if (successOverlay) successOverlay.classList.add("show");
        return;
      }

      // Freno de ritmo: evita envíos repetidos desde el mismo navegador
      try {
        var last = Number(localStorage.getItem("decogas_last_send") || 0);
        if (Date.now() - last < 20000) {
          if (submitBtn) {
            submitBtn.classList.remove("loading");
            submitBtn.classList.add("shake");
            setTimeout(function () { submitBtn.classList.remove("shake"); }, 600);
          }
          return;
        }
      } catch (err) { /* sin localStorage: seguimos igualmente */ }

      var cut = function (s, max) { return String(s).slice(0, max); };
      var val = function (id) { return document.getElementById(id).value.trim(); };
      var servicioInput = form.querySelector('input[name="servicio"]:checked');
      var servicio = servicioInput ? servicioInput.value : "Consulta";
      var cfg = window.DECOGAS_CONFIG || {};
      var lead = {
        name: cut(val("nombre"), 80),
        phone: cut(val("telefono"), 25),
        email: cut(val("email"), 120),
        interest: cut(servicio, 60),
        message: cut(val("mensaje"), 2000)
      };

      // 1) Guardar el cliente en la base de datos (o en el navegador en modo demo)
      var saveLead = function () {
        if (cfg.supabaseUrl && cfg.supabaseAnonKey) {
          return fetch(cfg.supabaseUrl.replace(/\/+$/, "") + "/rest/v1/leads", {
            method: "POST",
            headers: {
              apikey: cfg.supabaseAnonKey,
              Authorization: "Bearer " + cfg.supabaseAnonKey,
              "Content-Type": "application/json",
              Prefer: "return=minimal"
            },
            body: JSON.stringify(lead)
          }).then(function (r) { if (!r.ok) throw new Error("leads " + r.status); });
        }
        try {
          var arr = JSON.parse(localStorage.getItem("decogas_leads") || "[]");
          arr.unshift(Object.assign({ created_at: new Date().toISOString() }, lead));
          localStorage.setItem("decogas_leads", JSON.stringify(arr));
          return Promise.resolve();
        } catch (err) { return Promise.reject(err); }
      };

      // 2) Aviso por correo con todos los detalles + enlace al panel de clientes
      var sendEmail = function () {
        if (!cfg.notifyEmail) return Promise.resolve();
        return fetch("https://formsubmit.co/ajax/" + encodeURIComponent(cfg.notifyEmail), {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            _subject: "Nuevo cliente desde la web: " + lead.name + " (" + lead.interest + ")",
            _template: "table",
            _captcha: "false",
            "Nombre": lead.name,
            "Tel\u00E9fono": lead.phone,
            "Email": lead.email,
            "Qu\u00E9 busca": lead.interest,
            "Mensaje": lead.message,
            "Fecha": new Date().toLocaleString("es-ES"),
            "Panel de clientes": new URL("clientes.html", window.location.href).href
          })
        }).then(function (r) { if (!r.ok) throw new Error("email " + r.status); });
      };

      if (submitBtn) submitBtn.classList.add("loading");
      Promise.allSettled([saveLead(), sendEmail()]).then(function (results) {
        if (submitBtn) submitBtn.classList.remove("loading");
        var anyOk = results.some(function (r) { return r.status === "fulfilled"; });
        if (anyOk) {
          try { localStorage.setItem("decogas_last_send", String(Date.now())); } catch (err) {}
          if (window.gtag && cfg.googleAdsConversions && cfg.googleAdsConversions.formulario) {
            window.gtag("event", "conversion", { send_to: cfg.googleAdsConversions.formulario });
          }
          if (successOverlay) {
            successOverlay.classList.add("show");
            burstSparkles(successOverlay);
          }
        } else {
          // Último recurso si no hay red: abrir el correo del visitante
          var subject = encodeURIComponent("Solicitud de informaci\u00F3n \u2014 " + servicio);
          var body = encodeURIComponent("Nombre: " + lead.name + "\nTel\u00E9fono: " + lead.phone +
            "\nEmail: " + lead.email + "\nServicio: " + lead.interest + "\n\nMensaje:\n" + lead.message);
          window.location.href = "mailto:info@decogas.com?subject=" + subject + "&body=" + body;
          // Fallo total: NO mostramos la pantalla de éxito; avisamos al visitante.
          window.alert("No hemos podido enviar tu solicitud automáticamente. Hemos abierto tu gestor de correo para que nos escribas a info@decogas.com; si no se abre, llámanos al 919 93 01 68.");
        }
      });
    });

    var resetLink = $("resetForm");
    if (resetLink) {
      resetLink.addEventListener("click", function (e) {
        e.preventDefault();
        if (successOverlay) successOverlay.classList.remove("show");
        form.reset();
        if (serviceGroup) {
          var chips = serviceGroup.querySelectorAll(".radio-chip");
          chips.forEach(function (c) { c.classList.remove("active"); });
          if (chips[0]) chips[0].classList.add("active");
        }
        ["field-nombre", "field-telefono", "field-email", "field-mensaje"].forEach(function (id) { setError(id, false); });
      });
    }
  }

  // ---------- Precios dinámicos en elementos estáticos (index) ----------
  if (window.DecogasPrices && document.querySelector("[data-price-slug]")) {
    window.DecogasPrices.load().then(window.DecogasPrices.applyToDom);
  }
})();
