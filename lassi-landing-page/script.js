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

  /* Vidéo profil : lecture avec son au clic */
  var vf = document.getElementById('profilVideo');
  if (vf) {
    var vid = vf.querySelector('video');
    function playVid() {
      vf.classList.add('is-playing');
      vid.setAttribute('controls', '');
      var p = vid.play();
      if (p && p.catch) p.catch(function () {});
    }
    vf.querySelector('.video-play').addEventListener('click', playVid);
    vid.addEventListener('ended', function () {
      vf.classList.remove('is-playing');
      vid.removeAttribute('controls');
      vid.currentTime = 0;
    });
  }

  /* Année dans le footer */
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();
