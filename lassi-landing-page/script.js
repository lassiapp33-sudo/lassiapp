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

  function setMuteUI(wrap, on) {
    var b = wrap.querySelector('.v-mute');
    if (on) {
      wrap.classList.add('is-unmuted');
      if (b) { b.setAttribute('aria-pressed', 'true'); b.setAttribute('aria-label', 'Couper le son'); }
    } else {
      wrap.classList.remove('is-unmuted');
      if (b) { b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-label', 'Activer le son'); }
    }
  }
  function muteOthers(except) {
    vMedias.forEach(function (o) {
      if (o !== except) {
        var ov = o.querySelector('video');
        if (ov) ov.muted = true;
        setMuteUI(o, false);
      }
    });
  }

  vMedias.forEach(function (wrap) {
    var video = wrap.querySelector('video');
    var muteBtn = wrap.querySelector('.v-mute');
    if (!video) return;
    video.muted = true; // requis pour l'autoplay

    muteBtn && muteBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (video.muted) {
        muteOthers(wrap);
        video.muted = false;
        setMuteUI(wrap, true);
        var pp = video.play(); if (pp && pp.catch) pp.catch(function () {});
      } else {
        video.muted = true;
        setMuteUI(wrap, false);
      }
    });
  });

  /* Vidéo "Profil" : son automatique dès qu'elle est visible (si le navigateur l'autorise) */
  var pendingAutosound = null;
  function tryAutosound(wrap) {
    var video = wrap.querySelector('video');
    muteOthers(wrap);
    video.muted = false;
    var p = video.play();
    if (p && p.then) {
      p.then(function () { setMuteUI(wrap, true); pendingAutosound = null; })
       .catch(function () { video.muted = true; setMuteUI(wrap, false); pendingAutosound = wrap; });
    } else {
      setMuteUI(wrap, true);
    }
  }

  var vObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var wrap = e.target;
      var video = wrap.querySelector('video');
      if (!video) return;
      var vis = e.isIntersecting && e.intersectionRatio >= 0.5;
      wrap._inView = vis;
      if (vis) {
        var p = video.play(); if (p && p.catch) p.catch(function () {});
        if (wrap.classList.contains('v-autosound')) tryAutosound(wrap);
      } else {
        video.pause();
        if (!video.muted) { video.muted = true; setMuteUI(wrap, false); }
        if (pendingAutosound === wrap) pendingAutosound = null;
      }
    });
  }, { threshold: [0, 0.5] });
  vMedias.forEach(function (w) { vObserver.observe(w); });

  /* Débloque le son auto après la première interaction (exigence navigateur) */
  function unlockAutosound() {
    if (pendingAutosound && pendingAutosound._inView) tryAutosound(pendingAutosound);
  }
  ['pointerdown', 'touchstart', 'keydown'].forEach(function (ev) {
    document.addEventListener(ev, unlockAutosound, { passive: true });
  });

  /* Visionneuse plein écran : chaque image / vidéo s'ouvre seule */
  var lb = document.getElementById('lightbox');
  if (lb) {
    var lbContent = lb.querySelector('.lb-content');
    var lbClose = lb.querySelector('.lb-close');

    function openLB(node) {
      lbContent.innerHTML = '';
      lbContent.appendChild(node);
      lb.classList.add('open');
      lb.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(function () { lb.classList.add('visible'); });
    }
    function closeLB() {
      lb.classList.remove('visible');
      setTimeout(function () {
        lb.classList.remove('open');
        lb.setAttribute('aria-hidden', 'true');
        var v = lbContent.querySelector('video');
        if (v) { v.pause(); }
        lbContent.innerHTML = '';
        document.body.style.overflow = '';
      }, 250);
    }
    lbClose.addEventListener('click', closeLB);
    lb.addEventListener('click', function (e) { if (e.target === lb) closeLB(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && lb.classList.contains('open')) closeLB();
    });

    /* Images (hors miniature PDF qui ouvre le document) */
    document.querySelectorAll('.media-frame img').forEach(function (img) {
      if (img.closest('.tile--doc')) return;
      img.addEventListener('click', function () {
        var full = new Image();
        full.src = img.currentSrc || img.src;
        full.alt = img.alt || '';
        openLB(full);
      });
    });

    /* Vidéos (le clic sur le bouton son ne déclenche pas la visionneuse) */
    vMedias.forEach(function (wrap) {
      var srcEl = wrap.querySelector('video source');
      if (!srcEl) return;
      wrap.addEventListener('click', function (e) {
        if (e.target.closest('.v-mute')) return;
        var bg = wrap.querySelector('video');
        if (bg) bg.pause();
        var v = document.createElement('video');
        v.src = srcEl.src;
        v.controls = true;
        v.autoplay = true;
        v.loop = true;
        v.playsInline = true;
        v.muted = false;
        openLB(v);
        var pp = v.play(); if (pp && pp.catch) pp.catch(function () {});
      });
    });
  }

  /* Année dans le footer */
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();
