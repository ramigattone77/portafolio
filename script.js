/* Portafolio Ramiro Gattone — JS mínimo: revelado al entrar en pantalla.
   El parámetro ?tema=claro|oscuro fuerza el modo solo para vistas previas; sin él manda la preferencia del sistema. */
(function () {
  var root = document.documentElement;
  var tema = new URLSearchParams(location.search).get('tema');
  if (tema === 'oscuro') root.setAttribute('data-theme', 'dark');
  if (tema === 'claro') root.setAttribute('data-theme', 'light');

  var els = document.querySelectorAll('[data-reveal]');
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  root.classList.add('js');
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  els.forEach(function (el) { io.observe(el); });
})();
