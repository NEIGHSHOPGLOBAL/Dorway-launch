(function () {
  'use strict';

  /* ---- Theme toggle ---- */
  var root = document.documentElement;
  var themeToggle = document.querySelectorAll('.theme-toggle');
  var stored = localStorage.getItem('dorway-theme');
  if (stored) root.setAttribute('data-theme', stored);

  function currentIsDark() {
    var attr = root.getAttribute('data-theme');
    if (attr) return attr === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function syncThemeIcons() {
    var dark = currentIsDark();
    document.querySelectorAll('[data-icon-sun]').forEach(function (el) {
      el.style.display = dark ? 'none' : 'block';
    });
    document.querySelectorAll('[data-icon-moon]').forEach(function (el) {
      el.style.display = dark ? 'block' : 'none';
    });
  }
  themeToggle.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var next = currentIsDark() ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      localStorage.setItem('dorway-theme', next);
      syncThemeIcons();
    });
  });
  syncThemeIcons();

  /* ---- Nav scroll state ---- */
  var nav = document.querySelector('.nav');
  function onScroll() {
    if (window.scrollY > 40) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---- Mobile drawer ---- */
  var hamburger = document.querySelector('.hamburger');
  var drawer = document.querySelector('.mobile-drawer');
  var drawerClose = document.querySelector('.mobile-drawer-close');
  var drawerBackdrop = document.querySelector('.mobile-drawer-backdrop');
  function openDrawer() { drawer.classList.add('open'); document.body.style.overflow = 'hidden'; }
  function closeDrawer() { drawer.classList.remove('open'); document.body.style.overflow = ''; }
  if (hamburger) hamburger.addEventListener('click', openDrawer);
  if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
  if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeDrawer);
  document.querySelectorAll('.mobile-drawer-panel a').forEach(function (a) {
    a.addEventListener('click', closeDrawer);
  });

  /* ---- FAQ accordion ---- */
  var faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(function (item, idx) {
    var btn = item.querySelector('.faq-question');
    var answer = item.querySelector('.faq-answer');
    function setOpen(open) {
      item.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
      answer.style.maxHeight = open ? answer.scrollHeight + 'px' : '0px';
    }
    setOpen(idx === 0);
    btn.addEventListener('click', function () {
      var willOpen = !item.classList.contains('open');
      faqItems.forEach(function (other) {
        if (other !== item) {
          other.classList.remove('open');
          other.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
          other.querySelector('.faq-answer').style.maxHeight = '0px';
        }
      });
      setOpen(willOpen);
    });
  });
  window.addEventListener('resize', function () {
    faqItems.forEach(function (item) {
      if (item.classList.contains('open')) {
        var answer = item.querySelector('.faq-answer');
        answer.style.maxHeight = answer.scrollHeight + 'px';
      }
    });
  });

  /* ---- Pricing toggle ---- */
  var pricingButtons = document.querySelectorAll('.pricing-toggle button');
  var priceEls = document.querySelectorAll('[data-monthly][data-annual]');
  pricingButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      pricingButtons.forEach(function (b) { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      var mode = btn.getAttribute('data-mode');
      priceEls.forEach(function (el) {
        el.textContent = mode === 'annual' ? el.getAttribute('data-annual') : el.getAttribute('data-monthly');
      });
    });
  });

  /* ---- Hero conversation sequence (runs once on load) ---- */
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var heroBubbles = document.querySelectorAll('.hero-msg');
  var heroStatus = document.querySelector('.hero-status-pill');

  if (reduceMotion) {
    heroBubbles.forEach(function (b) { b.classList.add('shown'); });
    if (heroStatus) {
      heroStatus.textContent = 'Contacted';
      heroStatus.classList.remove('pill-amber');
      heroStatus.classList.add('pill-green');
    }
  } else {
    var delay = 300;
    heroBubbles.forEach(function (bubble, i) {
      setTimeout(function () {
        bubble.classList.add('shown');
      }, delay + i * 400);
    });
    var totalDelay = delay + heroBubbles.length * 400 + 200;
    setTimeout(function () {
      if (heroStatus) {
        heroStatus.textContent = 'Contacted';
        heroStatus.classList.remove('pill-amber');
        heroStatus.classList.add('pill-green');
      }
    }, totalDelay);
  }

  /* ---- lucide icons ---- */
  if (window.lucide) window.lucide.createIcons();

  /* ---- AOS: scroll reveal ---- */
  if (window.AOS) {
    window.AOS.init({
      duration: 600,
      easing: 'ease-out-cubic',
      once: true,
      offset: 60,
      disable: function () {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      }
    });
  }
})();
