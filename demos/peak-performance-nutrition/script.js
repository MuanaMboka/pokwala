(function () {
  "use strict";

  document.documentElement.classList.add("js");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Header state on scroll ---------- */
  var header = document.querySelector(".site-header");
  function onScroll() {
    header.classList.toggle("is-scrolled", window.scrollY > 24);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- Mobile nav ---------- */
  var nav = document.getElementById("main-nav");
  var navToggle = document.querySelector(".nav-toggle");

  function setNav(open) {
    nav.classList.toggle("is-open", open);
    navToggle.setAttribute("aria-expanded", String(open));
    navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.style.overflow = open ? "hidden" : "";
  }
  navToggle.addEventListener("click", function () {
    setNav(!nav.classList.contains("is-open"));
  });
  nav.addEventListener("click", function (e) {
    if (e.target.closest("a")) setNav(false);
  });

  /* ---------- Dropdowns (click / keyboard / touch) ---------- */
  var drops = document.querySelectorAll(".has-drop");
  function closeDrops(except) {
    drops.forEach(function (d) {
      if (d === except) return;
      d.classList.remove("is-open");
      d.querySelector(".drop-toggle").setAttribute("aria-expanded", "false");
    });
  }
  drops.forEach(function (d) {
    var btn = d.querySelector(".drop-toggle");
    btn.addEventListener("click", function () {
      var open = !d.classList.contains("is-open");
      closeDrops(d);
      d.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", String(open));
    });
  });
  document.addEventListener("click", function (e) {
    if (!e.target.closest(".has-drop")) closeDrops();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    closeDrops();
    if (nav.classList.contains("is-open")) { setNav(false); navToggle.focus(); }
  });

  /* ---------- Active nav link ---------- */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.main-nav > ul > li > a[href^="#"]'));
  var sections = navLinks
    .map(function (a) { return document.querySelector(a.getAttribute("href")); })
    .filter(Boolean);

  /* ---------- Reveal on scroll + counters ---------- */
  var reveals = document.querySelectorAll(".reveal");
  var counters = document.querySelectorAll("[data-count]");

  function runCounter(el) {
    var target = parseInt(el.getAttribute("data-count"), 10);
    var suffix = el.getAttribute("data-suffix") || "";
    if (reduceMotion) { el.textContent = target + suffix; return; }
    var start = null, dur = 1400;
    function tick(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        if (el.hasAttribute("data-count")) runCounter(el);
        else el.classList.add("is-visible");
        io.unobserve(el);
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });

    reveals.forEach(function (el, i) {
      el.style.transitionDelay = (i % 3) * 80 + "ms";
      io.observe(el);
    });
    counters.forEach(function (el) { io.observe(el); });

    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = "#" + entry.target.id;
        navLinks.forEach(function (a) { a.classList.toggle("is-active", a.getAttribute("href") === id); });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach(function (s) { spy.observe(s); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
    /* counters already hold their final values in the markup */
  }

  /* ---------- Booking form ----------
     To receive submissions, set FORM_ENDPOINT to a form service URL
     (e.g. Formspree: https://formspree.io/f/xxxxxx). Left empty, the form
     validates and shows the success message without sending anything. */
  var FORM_ENDPOINT = "";

  var form = document.getElementById("book-form");
  var success = document.getElementById("form-success");
  var rules = {
    name: function (v) { return v.trim().length > 1 ? "" : "Please enter your name."; },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? "" : "Please enter a valid email address."; },
    sport: function (v) { return v ? "" : "Please select your sport."; }
  };

  function validateField(name) {
    var input = form.elements[name];
    var msg = rules[name](input.value);
    var field = input.closest(".field");
    field.classList.toggle("has-error", !!msg);
    input.setAttribute("aria-invalid", msg ? "true" : "false");
    document.getElementById("err-" + name).textContent = msg;
    return !msg;
  }

  Object.keys(rules).forEach(function (name) {
    var input = form.elements[name];
    input.setAttribute("aria-describedby", "err-" + name);
    input.addEventListener("blur", function () { if (input.value) validateField(name); });
    input.addEventListener("input", function () {
      if (input.closest(".field").classList.contains("has-error")) validateField(name);
    });
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var firstInvalid = null;
    Object.keys(rules).forEach(function (name) {
      if (!validateField(name) && !firstInvalid) firstInvalid = form.elements[name];
    });
    if (firstInvalid) { firstInvalid.focus(); return; }

    var btn = form.querySelector('button[type="submit"]');
    var label = btn.querySelector(".btn-label");
    var original = label.textContent;
    btn.disabled = true;
    label.textContent = "Sending…";

    var done = function (ok) {
      btn.disabled = false;
      label.textContent = original;
      if (ok) {
        form.reset();
        success.textContent = "Thanks! Your request is in — expect a reply within one working day.";
      } else {
        success.textContent = "Something went wrong. This is a demo, so nothing was sent.";
      }
      success.hidden = false;
    };

    if (!FORM_ENDPOINT) {
      setTimeout(function () {
        done(true);
        success.textContent = "This is a demo site, so nothing was sent. On a live site this request would go straight to the nutritionist's inbox.";
      }, 700);
      return;
    }

    fetch(FORM_ENDPOINT, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: new FormData(form)
    }).then(function (r) { done(r.ok); }).catch(function () { done(false); });
  });

  /* ---------- Demo badge ---------- */
  var badge = document.getElementById("demo-badge");
  if (badge) {
    try { if (sessionStorage.getItem("demo-badge-hidden")) badge.hidden = true; } catch (err) {}
    badge.querySelector(".demo-badge-close").addEventListener("click", function () {
      badge.hidden = true;
      try { sessionStorage.setItem("demo-badge-hidden", "1"); } catch (err) {}
    });
  }

  /* ---------- Footer year ---------- */
  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();
