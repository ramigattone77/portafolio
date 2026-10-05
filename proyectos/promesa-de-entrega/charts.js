/* Gráficos del proyecto "La promesa de entrega" (Vega-Lite).
   Datos: promesa-datos.js (window.OLIST). Movimiento: solo opacidad y trazo, y nada si el sistema pide reducir movimiento. */
(function () {
  var D;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;
  if (!reduce && 'IntersectionObserver' in window) root.classList.add('js');

  /* ---------- Utilidades de movimiento ---------- */
  function onEnter(el, fn, margin) {
    if (reduce || !('IntersectionObserver' in window)) { fn(); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); fn(); } });
    }, { rootMargin: margin || '0px 0px -12% 0px', threshold: 0.15 });
    io.observe(el);
  }
  var fmt = function (n, dec) { return n.toFixed(dec).replace('.', ','); };

  // Secciones que aparecen al entrar en pantalla
  document.querySelectorAll('[data-reveal]').forEach(function (el) {
    onEnter(el, function () { el.classList.add('is-visible'); }, '0px 0px -8% 0px');
  });

  // Indicadores que cuentan hasta su valor
  document.querySelectorAll('[data-count]').forEach(function (el) {
    var end = parseFloat(el.dataset.count), dec = parseInt(el.dataset.dec || '0', 10);
    onEnter(el, function () {
      if (reduce) return;
      var t0 = performance.now(), dur = 1100;
      (function step(t) {
        var p = Math.min(1, Math.max(0, (t - t0) / dur)), e = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(end * e, dec);
        if (p < 1) requestAnimationFrame(step); else el.textContent = fmt(end, dec);
      })(t0);
      setTimeout(function () { el.textContent = fmt(end, dec); }, dur + 300); // por si la pestaña pausa la animación
    });
  });

  function fail(e) {
    if (e) console.error(e);
    document.querySelectorAll('.viz__chart').forEach(function (c) {
      c.classList.add('is-error'); c.setAttribute('data-msg', 'No se pudo cargar el gráfico. Revisá la conexión y recargá la página.');
    });
  }
  if (!window.vegaEmbed) { fail(); return; }
  // Datos: el paquete promesa-datos.js si está (abrir sin servidor) o los JSON publicados
  var NOMS = ['cohortes', 'estados', 'flete_bins', 'flete_mediana', 'flujos', 'kpis', 'lorenz', 'precipicio'];
  (window.OLIST ? Promise.resolve(window.OLIST) : Promise.all(NOMS.map(function (n) {
    return fetch('data/' + n + '.json').then(function (r) { if (!r.ok) throw new Error(n + ': ' + r.status); return r.json(); });
  })).then(function (arr) { var o = {}; NOMS.forEach(function (n, i) { o[n] = arr[i]; }); return o; }))
    .then(function (data) { D = data; main(); }).catch(fail);

  function main() {

  /* ---------- Tema desde los tokens del sitio ---------- */
  var css = getComputedStyle(root), v = function (n) { return css.getPropertyValue(n).trim(); };
  var C = { text: v('--text'), muted: v('--text-muted'), border: v('--border'), strong: v('--border-strong'),
            data: v('--data'), accent: v('--accent'), surface: v('--surface') };
  var config = {
    background: null, font: 'Inter, system-ui, sans-serif', view: { stroke: null },
    axis: { labelColor: C.muted, titleColor: C.muted, gridColor: C.border, domainColor: C.strong, tickColor: C.strong,
            labelFontSize: 12, titleFontSize: 12, titleFontWeight: 500 },
    legend: { labelColor: C.muted, titleColor: C.muted, labelFontSize: 12, titleFontSize: 12 },
    text: { color: C.text, font: 'Inter, system-ui, sans-serif' },
    locale: { number: { decimal: ',', thousands: '.', grouping: [3], currency: ['$', ''] } }
  };
  var opts = { actions: false, renderer: 'svg', config: config };
  var views = {};

  // Entrada animada del SVG: trazos que se dibujan, áreas y celdas que aparecen
  function animate(svg) {
    if (reduce || !svg.animate) return;
    svg.querySelectorAll('.mark-line path').forEach(function (p) {
      var L = p.getTotalLength ? p.getTotalLength() : 0; if (!L) return;
      p.animate([{ strokeDasharray: L, strokeDashoffset: L }, { strokeDasharray: L, strokeDashoffset: 0 }],
                { duration: 1400, easing: 'cubic-bezier(.2,.7,.2,1)' });
    });
    svg.querySelectorAll('.mark-area path').forEach(function (p) {
      p.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay: 700, fill: 'backwards' });
    });
    var cells = svg.querySelectorAll('.mark-rect path, .mark-symbol path, .mark-rule line');
    var step = Math.min(14, 600 / Math.max(cells.length, 1));
    cells.forEach(function (p, i) {
      p.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, delay: i * step, fill: 'backwards', easing: 'ease-out' });
    });
    svg.querySelectorAll('.mark-text text').forEach(function (p) {
      p.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 500, fill: 'backwards' });
    });
  }

  // Cada gráfico se dibuja cuando se acerca a la pantalla (con esqueleto de carga mientras tanto)
  function embed(id, spec) {
    var el = document.getElementById(id);
    spec.$schema = 'https://vega.github.io/schema/vega-lite/v5.json';
    spec.width = spec.width || 'container';
    return new Promise(function (resolve) {
      onEnter(el, function () {
        vegaEmbed(el, spec, opts).then(function (res) {
          views[id] = res.view;
          el.classList.add('is-ready');
          var svg = el.querySelector('svg'); if (svg) animate(svg);
          resolve(res.view);
        }).catch(function (e) {
          console.error(id, e); el.classList.add('is-error');
          el.setAttribute('data-msg', 'No se pudo dibujar este gráfico.');
        });
      }, '0px 0px 25% 0px');
    });
  }

  /* ---------- Selección compartida de estado (mapa, pesas y flujos) ---------- */
  var NOMBRES = { AC: 'Acre', AL: 'Alagoas', AM: 'Amazonas', AP: 'Amapá', BA: 'Bahía', CE: 'Ceará', DF: 'Distrito Federal',
    ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MG: 'Minas Gerais', MS: 'Mato Grosso do Sul', MT: 'Mato Grosso',
    PA: 'Pará', PB: 'Paraíba', PE: 'Pernambuco', PI: 'Piauí', PR: 'Paraná', RJ: 'Río de Janeiro', RN: 'Rio Grande do Norte',
    RO: 'Rondônia', RR: 'Roraima', RS: 'Rio Grande do Sul', SC: 'Santa Catarina', SE: 'Sergipe', SP: 'São Paulo', TO: 'Tocantins' };
  var porEstado = {}; D.estados.forEach(function (d) { porEstado[d.estado] = d; });
  var sel = document.getElementById('estado-sel'), clearBtn = document.getElementById('estado-clear'), out = document.getElementById('estado-out');
  Object.keys(NOMBRES).sort(function (a, b) { return NOMBRES[a].localeCompare(NOMBRES[b], 'es'); }).forEach(function (k) {
    var o = document.createElement('option'); o.value = k; o.textContent = NOMBRES[k] + ' (' + k + ')'; sel.appendChild(o);
  });
  function setFoco(est) {
    est = est || null;
    ['chart-mapa', 'chart-colchon', 'chart-flujos'].forEach(function (id) {
      if (views[id]) views[id].signal('foco', est).runAsync();
    });
    sel.value = est || ''; clearBtn.hidden = !est;
    if (est && porEstado[est]) {
      var d = porEstado[est];
      out.textContent = NOMBRES[est] + ': ' + fmt(100 * d.cumplimiento, 1) + '% a tiempo, ' + d.pedidos.toLocaleString('es-AR') +
        ' pedidos, ' + d.dias_prometidos + ' días prometidos contra ' + d.dias_reales + ' reales (medianas).';
    } else out.textContent = '';
  }
  sel.addEventListener('change', function () { setFoco(sel.value); });
  clearBtn.addEventListener('click', function () { setFoco(null); });
  var focoParam = function () { return { name: 'foco', value: null }; };
  var dim = function (test) { return { condition: { test: 'foco == null || ' + test, value: 1 }, value: 0.18 }; };

  /* 1. Precipicio de satisfacción */
  var prec = D.precipicio.map(function (d) { return Object.assign({}, d); });
  prec.filter(function (d) { return d.dias === 0; }).forEach(function (d) { prec.push(Object.assign({}, d, { tramo: 'Con atraso' })); });
  embed('chart-precipicio', {
    height: 320, data: { values: prec },
    encoding: { x: { field: 'dias', type: 'quantitative', title: 'Días respecto de la fecha prometida (negativo = atraso)', scale: { domain: [-15, 25] } } },
    layer: [
      { mark: { type: 'area', opacity: 0.18 }, encoding: {
          y: { field: 'ic_bajo', type: 'quantitative', title: 'Puntaje medio de la reseña', scale: { domain: [1, 5] } }, y2: { field: 'ic_alto' },
          color: { field: 'tramo', type: 'nominal', scale: { domain: ['Con atraso', 'A tiempo'], range: [C.data, C.accent] }, legend: null } } },
      { mark: { type: 'line', strokeWidth: 2.5 }, encoding: { y: { field: 'media', type: 'quantitative' },
          color: { field: 'tramo', type: 'nominal', legend: { title: null, orient: 'top-right' } } } },
      { params: [{ name: 'hover', select: { type: 'point', fields: ['dias'], on: 'pointerover', nearest: true, clear: 'pointerout' } }],
        mark: { type: 'rule', color: C.strong }, encoding: {
          opacity: { condition: { param: 'hover', empty: false, value: 0.6 }, value: 0 },
          tooltip: [{ field: 'dias', title: 'Días vs. promesa' }, { field: 'media', title: 'Puntaje medio', format: '.2f' },
                    { field: 'n', title: 'Pedidos', format: ',d' }] } },
      { transform: [{ filter: { param: 'hover', empty: false } }], mark: { type: 'point', filled: true, size: 80 },
        encoding: { y: { field: 'media', type: 'quantitative' }, color: { field: 'tramo', type: 'nominal' } } },
      { transform: [{ filter: { param: 'hover', empty: false } }, { filter: 'datum.tramo == "A tiempo" || datum.dias < 0' }],
        mark: { type: 'text', dy: -14, fontWeight: 600, fontSize: 13 },
        encoding: { y: { field: 'media', type: 'quantitative' }, text: { field: 'media', format: '.2f' } } },
      { data: { values: [{ x: 0 }] }, mark: { type: 'rule', strokeDash: [4, 4], color: C.strong }, encoding: { x: { field: 'x', type: 'quantitative' } } },
      { data: { values: [{ x: 0, y: 1.25, t: 'Fecha prometida' }] }, mark: { type: 'text', align: 'left', dx: 6, color: C.muted, fontSize: 12 },
        encoding: { x: { field: 'x', type: 'quantitative' }, y: { field: 'y', type: 'quantitative' }, text: { field: 't' } } }
    ]
  });

  /* 2. Mapa de mosaicos (clic para seleccionar un estado) */
  var grid = { RR: [2, 0], AP: [4, 0], AM: [1, 1], PA: [3, 1], MA: [4, 1], CE: [5, 1], RN: [6, 1],
               AC: [0, 2], RO: [1, 2], MT: [2, 2], TO: [3, 2], PI: [4, 2], PE: [5, 2], PB: [6, 2],
               GO: [3, 3], DF: [4, 3], BA: [5, 3], AL: [6, 3], MS: [2, 4], MG: [4, 4], ES: [5, 4], SE: [6, 4],
               SP: [3, 5], RJ: [4, 5], PR: [3, 6], SC: [3, 7], RS: [3, 8] };
  var est = D.estados.map(function (d) { var g = grid[d.estado] || [0, 0]; return Object.assign({ col: g[0], fila: g[1], nombre: NOMBRES[d.estado] }, d); });
  embed('chart-mapa', {
    width: 392, height: 504, data: { values: est }, params: [focoParam()],
    encoding: { x: { field: 'col', type: 'ordinal', axis: null }, y: { field: 'fila', type: 'ordinal', axis: null },
                opacity: dim('datum.estado == foco') },
    layer: [
      { params: [{ name: 'pt', select: { type: 'point', on: 'pointerover', clear: 'pointerout' } }],
        mark: { type: 'rect', cornerRadius: 4, cursor: 'pointer' }, encoding: {
          color: { field: 'cumplimiento', type: 'quantitative', title: 'A tiempo', scale: { domain: [0.78, 0.97], range: [C.data, C.border], interpolate: 'lab' },
                   legend: { format: '.0%', orient: 'right', gradientLength: 160 } },
          stroke: { condition: { param: 'pt', empty: false, value: C.text }, value: C.surface },
          strokeWidth: { condition: { param: 'pt', empty: false, value: 2 }, value: 3 },
          tooltip: [{ field: 'nombre', title: 'Estado' }, { field: 'cumplimiento', title: 'A tiempo', format: '.1%' },
                    { field: 'pedidos', title: 'Pedidos', format: ',d' }, { field: 'dias_prometidos', title: 'Días prometidos (mediana)', format: 'd' },
                    { field: 'dias_reales', title: 'Días reales (mediana)', format: 'd' }, { field: 'puntaje', title: 'Puntaje medio', format: '.2f' }] } },
      { mark: { type: 'text', fontWeight: 600, fontSize: 12, dy: -7 }, encoding: { text: { field: 'estado' } } },
      { mark: { type: 'text', fontSize: 11, dy: 8 }, encoding: { text: { field: 'cumplimiento', format: '.0%' } } }
    ]
  }).then(function (view) {
    view.addEventListener('click', function (e, item) {
      var d = item && item.datum; if (!d || !d.estado) return;
      setFoco(sel.value === d.estado ? null : d.estado);
    });
  });

  /* 3. Colchón: días prometidos vs reales por estado */
  var dumb = [];
  D.estados.forEach(function (d) {
    dumb.push({ estado: d.estado, nombre: NOMBRES[d.estado], tipo: 'Reales', dias: d.dias_reales, prometidos: d.dias_prometidos, pedidos: d.pedidos });
    dumb.push({ estado: d.estado, nombre: NOMBRES[d.estado], tipo: 'Prometidos', dias: d.dias_prometidos, prometidos: d.dias_prometidos, pedidos: d.pedidos });
  });
  embed('chart-colchon', {
    height: 560, data: { values: dumb }, params: [focoParam()],
    encoding: { y: { field: 'estado', type: 'nominal', title: null, sort: { field: 'prometidos', op: 'max', order: 'descending' } },
                x: { field: 'dias', type: 'quantitative', title: 'Días desde la compra (mediana)' },
                opacity: dim('datum.estado == foco') },
    layer: [
      { mark: { type: 'line', color: C.strong, strokeWidth: 2 }, encoding: { detail: { field: 'estado' } } },
      { mark: { type: 'point', filled: true, size: 90, opacity: 1 }, encoding: {
          color: { field: 'tipo', type: 'nominal', scale: { domain: ['Reales', 'Prometidos'], range: [C.accent, C.data] }, legend: { title: null, orient: 'top' } },
          tooltip: [{ field: 'nombre', title: 'Estado' }, { field: 'tipo', title: 'Días' }, { field: 'dias', title: 'Mediana', format: 'd' },
                    { field: 'pedidos', title: 'Pedidos', format: ',d' }] } }
    ]
  });

  /* 4. Matriz de flujos vendedor -> cliente */
  embed('chart-flujos', {
    height: 420, data: { values: D.flujos.filter(function (d) { return d.items >= 30; }) }, params: [focoParam()],
    mark: { type: 'rect', stroke: C.surface, strokeWidth: 1 },
    encoding: {
      x: { field: 'destino', type: 'nominal', title: 'Estado del cliente', sort: { field: 'items', op: 'sum', order: 'descending' }, axis: { labelAngle: 0 } },
      y: { field: 'origen', type: 'nominal', title: 'Estado del vendedor', sort: { field: 'items', op: 'sum', order: 'descending' } },
      color: { field: 'atraso', type: 'quantitative', title: 'Con atraso', scale: { domain: [0, 0.25], range: [C.border, C.data], clamp: true, interpolate: 'lab' },
               legend: { format: '.0%', orient: 'top' } },
      opacity: dim('datum.destino == foco || datum.origen == foco'),
      tooltip: [{ field: 'origen', title: 'Desde' }, { field: 'destino', title: 'Hacia' }, { field: 'items', title: 'Ítems', format: ',d' },
                { field: 'atraso', title: 'Con atraso', format: '.1%' }]
    }
  });

  /* 5. Distancia vs peso del flete */
  embed('chart-flete', {
    height: 340,
    encoding: { x: { field: 'km', type: 'quantitative', title: 'Distancia vendedor-cliente (km)', scale: { domain: [0, 3500] } } },
    layer: [
      { data: { values: D.flete_bins.filter(function (d) { return d.pct < 70; }).map(function (d) { return Object.assign({ km2: d.km + 250, pct2: d.pct + 5 }, d); }) },
        mark: { type: 'rect', clip: true }, encoding: {
          x2: { field: 'km2' }, y: { field: 'pct', type: 'quantitative', title: 'Flete sobre el total pagado (%)', scale: { domain: [0, 70] } },
          y2: { field: 'pct2' },
          color: { field: 'n', type: 'quantitative', title: 'Ítems', scale: { type: 'log', range: [C.surface, C.strong], interpolate: 'lab' }, legend: { orient: 'top' } },
          tooltip: [{ field: 'km', title: 'Desde km' }, { field: 'pct', title: 'Desde % flete' }, { field: 'n', title: 'Ítems', format: ',d' }] } },
      { data: { values: D.flete_mediana }, mark: { type: 'line', color: C.data, strokeWidth: 3, point: { filled: true, color: C.data, size: 50 } }, encoding: {
          y: { field: 'pct_mediana', type: 'quantitative' },
          tooltip: [{ field: 'km', title: 'Distancia (centro del tramo)' }, { field: 'pct_mediana', title: 'Flete mediano (%)', format: '.1f' },
                    { field: 'cumplimiento', title: 'A tiempo', format: '.1%' }, { field: 'n', title: 'Ítems', format: ',d' }] } }
    ]
  });

  /* 6. Cohortes de recompra (al pasar por una fila se resalta la cohorte) */
  embed('chart-cohortes', {
    height: 420, data: { values: D.cohortes },
    params: [{ name: 'fila', select: { type: 'point', fields: ['cohorte'], on: 'pointerover', clear: 'pointerout' } }],
    mark: { type: 'rect', stroke: C.surface, strokeWidth: 1 },
    encoding: {
      x: { field: 'mes_relativo', type: 'ordinal', title: 'Meses desde la primera compra', axis: { labelAngle: 0 } },
      y: { field: 'cohorte', type: 'ordinal', title: 'Cohorte (mes de la primera compra)' },
      color: { field: 'retencion', type: 'quantitative', title: 'Vuelve a comprar', scale: { domain: [0, 0.008], range: [C.border, C.accent], interpolate: 'lab' },
               legend: { format: '.1%', orient: 'top' } },
      opacity: { condition: { param: 'fila', empty: true, value: 1 }, value: 0.35 },
      tooltip: [{ field: 'cohorte', title: 'Cohorte' }, { field: 'mes_relativo', title: 'Mes' },
                { field: 'retencion', title: 'Vuelve a comprar', format: '.2%' }, { field: 'tam', title: 'Clientes en la cohorte', format: ',d' }]
    }
  });

  /* 7. Curva de Lorenz con control deslizante */
  var L = D.lorenz;
  function shareAt(x) { // facturación acumulada en x, por interpolación lineal
    for (var i = 1; i < L.length; i++) {
      if (L[i].vendedores >= x) {
        var a = L[i - 1], b = L[i], t = (x - a.vendedores) / (b.vendedores - a.vendedores || 1);
        return a.facturacion + t * (b.facturacion - a.facturacion);
      }
    }
    return 1;
  }
  embed('chart-lorenz', {
    height: 360, params: [{ name: 'qx', value: 0.9 }, { name: 'qy', value: shareAt(0.9) }],
    encoding: { x: { field: 'vendedores', type: 'quantitative', title: 'Vendedores acumulados (de menor a mayor facturación)', axis: { format: '.0%' }, scale: { domain: [0, 1] } },
                y: { field: 'facturacion', type: 'quantitative', title: 'Facturación acumulada', axis: { format: '.0%' }, scale: { domain: [0, 1] } } },
    layer: [
      { data: { values: [{ vendedores: 0, facturacion: 0 }, { vendedores: 1, facturacion: 1 }] }, mark: { type: 'line', strokeDash: [4, 4], color: C.strong } },
      { data: { values: L }, mark: { type: 'area', color: C.data, opacity: 0.15 } },
      { data: { values: L }, mark: { type: 'line', color: C.data, strokeWidth: 2.5 },
        encoding: { tooltip: [{ field: 'vendedores', title: 'Vendedores', format: '.0%' }, { field: 'facturacion', title: 'Facturación', format: '.0%' }] } },
      { data: { values: [{}] }, transform: [{ calculate: 'qx', as: 'vendedores' }, { calculate: 'qy', as: 'facturacion' }],
        mark: { type: 'rule', color: C.text, strokeDash: [2, 3] }, encoding: { y: { datum: 0 }, y2: { field: 'facturacion' } } },
      { data: { values: [{}] }, transform: [{ calculate: 'qx', as: 'vendedores' }, { calculate: 'qy', as: 'facturacion' }],
        mark: { type: 'point', filled: true, size: 90, color: C.text } },
      { data: { values: [{ vendedores: 0.25, facturacion: 0.62, t: 'Igualdad perfecta' }] }, mark: { type: 'text', color: C.muted }, encoding: { text: { field: 't' } } }
    ]
  }).then(function (view) {
    var r = document.getElementById('top-range'), o = document.getElementById('top-val'), txt = document.getElementById('top-out');
    function upd() {
      var k = parseInt(r.value, 10), x = 1 - k / 100, y = shareAt(x);
      o.textContent = k;
      txt.textContent = 'El ' + k + '% de los vendedores con más ventas factura el ' + Math.round(100 * (1 - y)) + '%.';
      view.signal('qx', x).signal('qy', y).runAsync();
    }
    r.addEventListener('input', upd); upd();
  });
  }
})();
