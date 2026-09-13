/* Lassana Coulibaly — interactions */
(function () {
  'use strict';

  var header = document.getElementById('siteHeader');
  var toggle = document.getElementById('navToggle');

  /* Header : ombre au scroll */
  function onScroll() {
    if (window.scrollY > 8) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* Menu mobile */
  if (toggle) {
    toggle.addEventListener('click', function () {
      var open = header.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    });
    header.querySelectorAll('.nav-link').forEach(function (l) {
      l.addEventListener('click', function () {
        header.classList.remove('nav-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* Lien de nav actif selon la section visible */
  var links = Array.prototype.slice.call(document.querySelectorAll('.nav-link'));
  var map = {};
  links.forEach(function (l) {
    var id = l.getAttribute('href').slice(1);
    if (id) map[id] = l;
  });
  var sections = Object.keys(map)
    .map(function (id) { return document.getElementById(id); })
    .filter(Boolean);

  var spy = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        links.forEach(function (l) { l.classList.remove('is-active'); });
        if (map[e.target.id]) map[e.target.id].classList.add('is-active');
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
  sections.forEach(function (s) { spy.observe(s); });

  /* Reveal au scroll */
  var reveals = document.querySelectorAll('.reveal');
  var ro = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('is-visible');
        ro.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  reveals.forEach(function (el) { ro.observe(el); });

  /* Vidéos : lecture automatique quand visibles, pause hors écran, son au clic */
  var vMedias = Array.prototype.slice.call(document.querySelectorAll('.v-media'));
  vMedias.forEach(function (wrap) {
    var video = wrap.querySelector('video');
    var muteBtn = wrap.querySelector('.v-mute');
    if (!video) return;
    video.muted = true; // requis pour l'autoplay

    muteBtn && muteBtn.addEventListener('click', function (e) {
      e.preventDefault();
      var willUnmute = video.muted;
      if (willUnmute) {
        // un seul son à la fois
        vMedias.forEach(function (o) {
          if (o !== wrap) {
            var ov = o.querySelector('video');
            if (ov) ov.muted = true;
            o.classList.remove('is-unmuted');
            var ob = o.querySelector('.v-mute');
            if (ob) { ob.setAttribute('aria-pressed', 'false'); ob.setAttribute('aria-label', 'Activer le son'); }
          }
        });
        video.muted = false;
        wrap.classList.add('is-unmuted');
        muteBtn.setAttribute('aria-pressed', 'true');
        muteBtn.setAttribute('aria-label', 'Couper le son');
        var pp = video.play(); if (pp && pp.catch) pp.catch(function () {});
      } else {
        video.muted = true;
        wrap.classList.remove('is-unmuted');
        muteBtn.setAttribute('aria-pressed', 'false');
        muteBtn.setAttribute('aria-label', 'Activer le son');
      }
    });
  });

  var vObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var wrap = e.target;
      var video = wrap.querySelector('video');
      if (!video) return;
      if (e.isIntersecting && e.intersectionRatio >= 0.5) {
        var p = video.play(); if (p && p.catch) p.catch(function () {});
      } else {
        video.pause();
        if (!video.muted) { // réinitialise le son quand on quitte l'écran
          video.muted = true;
          wrap.classList.remove('is-unmuted');
          var b = wrap.querySelector('.v-mute');
          if (b) { b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-label', 'Activer le son'); }
        }
      }
    });
  }, { threshold: [0, 0.5] });
  vMedias.forEach(function (w) { vObserver.observe(w); });

  /* Année dans le footer */
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();
