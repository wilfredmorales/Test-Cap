'use strict';

/* ============================================================
   Test CAP — tests del CAP (mercancías y viajeros)
   Banco: data/banco-cap.json (generado desde el ZIP oficial de .txt)
   ============================================================ */

const TIPOS = {
  mercancias: {
    nombre: 'Mercancías', emoji: '🚚',
    obligatorias: ['1', '2'], especifica: '2', complementarias: ['4', '4-5'],
  },
  viajeros: {
    nombre: 'Viajeros', emoji: '🚌',
    obligatorias: ['1', '3'], especifica: '3', complementarias: ['5', '4-5'],
  },
};

const PUNTUACION_DEFECTO = { correcta: 1, incorrecta: -0.5, blanco: 0, aprobado: 50 };
const LS = { prefs: 'cap.prefs', stats: 'cap.stats', session: 'cap.session' };

let banco = null;          // { version, fechaFuente, objetivos, preguntas, ... }
let porCodigo = new Map(); // cod -> pregunta
let session = null;        // test en curso
let timerId = null;
let installPrompt = null;

/* ---------- utilidades ---------- */

const $app = () => document.getElementById('app');

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style') el.style.cssText = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

function render(...nodes) {
  const app = $app();
  app.replaceChildren(...nodes.flat(Infinity).filter(n => n != null && n !== false));
  window.scrollTo({ top: 0 });
}

function toast(msg, ms = 3500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), ms);
}

function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* almacenamiento no disponible */ }
}
function lsDel(key) { try { localStorage.removeItem(key); } catch { /* nada */ } }

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const fmt = n => (Math.round(n * 100) / 100).toLocaleString('es-ES');
const letra = i => 'ABCD'[i];

function fechaES(iso) {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  return isNaN(d) ? iso : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

/* ---------- IndexedDB (banco guardado en el dispositivo) ---------- */

function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('test-cap', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet(key) {
  try {
    const db = await idb();
    return await new Promise((res, rej) => {
      const r = db.transaction('kv').objectStore('kv').get(key);
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  } catch { return undefined; }
}
async function idbSet(key, value) {
  try {
    const db = await idb();
    await new Promise((res, rej) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(value, key);
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
    return true;
  } catch { return false; }
}

/* ---------- carga y actualización del banco ---------- */

function usarBanco(b) {
  banco = b;
  porCodigo = new Map(b.preguntas.map(q => [q.c, q]));
}

async function cargarBanco() {
  const guardado = await idbGet('banco');
  if (guardado && guardado.preguntas) {
    usarBanco(guardado);
    return;
  }
  const res = await fetch('data/banco-cap.json');
  if (!res.ok) throw new Error('No se pudo cargar el banco (' + res.status + ')');
  const b = await res.json();
  usarBanco(b);
  idbSet('banco', b);
}

function compararBancos(viejo, nuevo) {
  const antes = new Map(viejo.preguntas.map(q => [q.c, q]));
  const despues = new Map(nuevo.preguntas.map(q => [q.c, q]));
  let nuevas = 0, eliminadas = 0, cambiaRespuesta = 0, cambiaTexto = 0;
  for (const [c, q] of despues) {
    const v = antes.get(c);
    if (!v) { nuevas++; continue; }
    if (v.r !== q.r) cambiaRespuesta++;
    else if (v.p !== q.p || v.a.join('|') !== q.a.join('|')) cambiaTexto++;
  }
  for (const c of antes.keys()) if (!despues.has(c)) eliminadas++;
  return { nuevas, eliminadas, cambiaRespuesta, cambiaTexto };
}

function resumenCambios(d) {
  const partes = [];
  if (d.nuevas) partes.push(`${d.nuevas} nuevas`);
  if (d.eliminadas) partes.push(`${d.eliminadas} eliminadas`);
  if (d.cambiaRespuesta) partes.push(`${d.cambiaRespuesta} con respuesta cambiada`);
  if (d.cambiaTexto) partes.push(`${d.cambiaTexto} con texto corregido`);
  return partes.length ? partes.join(', ') : 'sin cambios en las preguntas';
}

async function aplicarBanco(nuevo, origen) {
  const diff = compararBancos(banco, nuevo);
  usarBanco(nuevo);
  await idbSet('banco', nuevo);
  const prefs = lsGet(LS.prefs, {});
  prefs.ultimoCambio = { fecha: new Date().toISOString(), origen, diff };
  lsSet(LS.prefs, prefs);
  return diff;
}

/** Busca una versión nueva del banco publicada junto a la app. */
async function buscarActualizacion({ silencioso = false } = {}) {
  if (!navigator.onLine) {
    if (!silencioso) toast('Sin conexión. Inténtalo cuando tengas internet.');
    return;
  }
  try {
    const v = await (await fetch('data/version.json', { cache: 'no-store' })).json();
    if (v.version === banco.version) {
      if (!silencioso) toast('✅ Ya tienes la última versión del banco.');
      return;
    }
    // No sustituir un banco importado más reciente por uno publicado más antiguo.
    if (silencioso && banco.fechaFuente && v.fechaFuente && v.fechaFuente < banco.fechaFuente) return;
    const res = await fetch('data/banco-cap.json?v=' + encodeURIComponent(v.version), { cache: 'no-store' });
    const nuevo = await res.json();
    if (!nuevo.preguntas || nuevo.preguntas.length < 100) throw new Error('banco recibido incompleto');
    const diff = await aplicarBanco(nuevo, 'actualización');
    toast(`🔄 Banco actualizado: ${resumenCambios(diff)}.`, 6000);
    if (!session || session.terminado) pantallaInicio();
  } catch (e) {
    if (!silencioso) toast('No se pudo actualizar: ' + e.message);
  }
}

/* ---------- importar el ZIP oficial de .txt ---------- */

function parseTxt(texto) {
  texto = texto.replace(/\r\n?/g, '\n').replace(/^﻿/, '');
  const bloques = texto.split(/^COD:\s*/m).slice(1);
  const preguntas = [], problemas = [];
  for (const b of bloques) {
    const lineas = b.split('\n').map(l => l.trim());
    const cod = lineas[0];
    const enunciado = [], opciones = [];
    let respuesta = null, norma = '', ref = '', actual = null;
    for (const l of lineas.slice(1).filter(Boolean)) {
      const m = enunciado.length ? l.match(/^([A-D])(?:\s+(.*))?$/) : null;
      if (l.startsWith('RESPUESTA:')) { respuesta = l.split(':')[1].trim().toUpperCase().charAt(0); actual = 'R'; }
      else if (l.startsWith('NORMA:')) { norma = l.slice(6).trim(); actual = 'N'; }
      else if (l.startsWith('REFERENCIA DOCTRINAL:')) { ref = l.slice(21).trim(); actual = 'F'; }
      else if (m && respuesta === null && m[1] === letra(opciones.length)) { opciones.push(m[2] || ''); actual = m[1]; }
      else if (actual === null) enunciado.push(l);
      else if ('ABCD'.includes(actual) && respuesta === null) opciones[opciones.length - 1] = (opciones[opciones.length - 1] + ' ' + l).trim();
      else if (actual === 'N') norma += ' ' + l;
      else if (actual === 'F') ref += ' ' + l;
      else if (!opciones.length) enunciado.push(l);
    }
    const q = { c: cod, p: enunciado.join(' '), a: opciones, r: respuesta };
    if (norma) q.n = norma;
    if (ref && ref !== norma) q.f = ref;
    if (opciones.length !== 4 || !opciones.every(Boolean)) problemas.push(`COD ${cod}: ${opciones.length} opciones`);
    if (!'ABCD'.slice(0, opciones.length).includes(respuesta || '?')) problemas.push(`COD ${cod}: respuesta no válida`);
    if (!q.p) problemas.push(`COD ${cod}: sin enunciado`);
    preguntas.push(q);
  }
  return { preguntas, problemas };
}

/** Versión = hash del contenido; mismo cálculo que scripts/build_banco.py. */
function textoCanonico(preguntas) {
  return [...preguntas].sort((x, y) => (x.c < y.c ? -1 : x.c > y.c ? 1 : 0))
    .map(q => [q.c, q.o, q.p, ...q.a, q.r].join('\u001f')).join('\n');
}

async function hashTexto(s) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
  } catch { return 'local-' + Date.now(); }
}

async function importarZip(file) {
  if (!window.JSZip) throw new Error('No se pudo cargar el lector de ZIP (¿sin conexión?)');
  const zip = await JSZip.loadAsync(file);
  const objetivos = [], preguntas = [], problemas = [];
  let fecha = null;
  const entradas = Object.values(zip.files).filter(f => !f.dir && /\.txt$/i.test(f.name));
  if (!entradas.length) throw new Error('El ZIP no contiene archivos .txt');
  for (const f of entradas) {
    const m = f.name.match(/Secci.n\s*([\d;]+)/i);
    const seccion = m ? m[1].replace(';', '-') : '?';
    const id = f.name.split('/').pop().replace(/\.txt$/i, '').toUpperCase();
    const r = parseTxt(await f.async('string'));
    problemas.push(...r.problemas.map(p => `${f.name}: ${p}`));
    const anterior = banco.objetivos.find(o => o.id === id);
    objetivos.push({ id, seccion, titulo: anterior ? anterior.titulo : id, n: r.preguntas.length });
    r.preguntas.forEach(q => preguntas.push({ ...q, o: id }));
    if (f.date && (!fecha || f.date > fecha)) fecha = f.date;
  }
  if (problemas.length) {
    throw new Error(`${problemas.length} preguntas no se pudieron leer bien. Primer problema: ${problemas[0]}`);
  }
  const orden = Object.keys(banco.secciones);
  objetivos.sort((a, b) => (orden.indexOf(a.seccion) - orden.indexOf(b.seccion)) || a.id.localeCompare(b.id));
  const nuevo = {
    version: await hashTexto(textoCanonico(preguntas)),
    fechaFuente: fecha ? fecha.toISOString().slice(0, 10) : null,
    generado: new Date().toISOString(),
    fuente: file.name,
    total: preguntas.length,
    secciones: banco.secciones,
    objetivos,
    preguntas,
  };
  return aplicarBanco(nuevo, 'ZIP importado');
}

/* ---------- preferencias y estadísticas ---------- */

function prefs() {
  return { tipo: null, puntuacion: { ...PUNTUACION_DEFECTO }, ...lsGet(LS.prefs, {}) };
}
function guardarPref(k, v) { const p = prefs(); p[k] = v; lsSet(LS.prefs, p); }

function objetivosDe(secciones) { return banco.objetivos.filter(o => secciones.includes(o.seccion)); }
function preguntasDe(objIds) {
  const set = new Set(objIds);
  return banco.preguntas.filter(q => set.has(q.o));
}

function registrarStats(ses) {
  const stats = lsGet(LS.stats, {});
  for (const c of ses.ids) {
    const resp = ses.respuestas[c];
    if (!resp) continue;
    const q = porCodigo.get(c);
    if (!q) continue;
    const s = stats[c] || { ok: 0, ko: 0 };
    if (resp === q.r) s.ok++; else s.ko++;
    s.ultima = resp === q.r ? 'ok' : 'ko';
    stats[c] = s;
  }
  lsSet(LS.stats, stats);
}

function falladasDe(tipo) {
  const stats = lsGet(LS.stats, {});
  const t = TIPOS[tipo];
  const objs = new Set(objetivosDe([...t.obligatorias, ...t.complementarias]).map(o => o.id));
  return banco.preguntas.filter(q => objs.has(q.o) && stats[q.c] && stats[q.c].ultima === 'ko');
}

/* ---------- pantallas ---------- */

function pantallaInicio() {
  pararTimer();
  const p = prefs();
  const tipo = p.tipo;
  const guardada = lsGet(LS.session, null);

  const selector = h('div', { class: 'segmented', role: 'group', 'aria-label': 'Tipo de transporte' },
    Object.entries(TIPOS).map(([k, t]) =>
      h('button', {
        type: 'button', 'aria-pressed': String(tipo === k),
        onclick: () => { guardarPref('tipo', k); pantallaInicio(); },
      }, h('span', { class: 'emoji' }, t.emoji), t.nombre)));

  const nodos = [
    h('h1', {}, 'Tests del CAP'),
    h('p', { class: 'muted' }, 'Banco oficial de preguntas del Ministerio de Transportes.'),
    h('div', { class: 'card' }, h('h2', {}, '¿Qué CAP preparas?'), selector),
  ];

  if (guardada && !guardada.terminado) {
    nodos.push(h('div', { class: 'card' },
      h('div', { class: 'spread' },
        h('div', {}, h('strong', {}, 'Tienes un test sin terminar'),
          h('div', { class: 'muted small' }, `${guardada.titulo} · ${Object.keys(guardada.respuestas).length}/${guardada.ids.length} respondidas`)),
        h('div', { class: 'row' },
          h('button', { class: 'btn', type: 'button', onclick: () => { lsDel(LS.session); pantallaInicio(); } }, 'Descartar'),
          h('button', { class: 'btn primary', type: 'button', onclick: () => { session = guardada; pantallaTest(); } }, 'Continuar')))));
  }

  if (tipo) {
    const t = TIPOS[tipo];
    const nOblig = preguntasDe(objetivosDe(t.obligatorias).map(o => o.id)).length;
    const nEsp = preguntasDe(objetivosDe([t.especifica]).map(o => o.id)).length;
    const nFall = falladasDe(tipo).length;
    const modo = (titulo, desc, fn, disabled) => h('button', { class: 'mode', type: 'button', onclick: fn, disabled },
      h('span', {}, h('strong', {}, titulo), h('span', { class: 'muted small' }, desc)), h('span', { class: 'arrow' }, '›'));

    nodos.push(h('div', { class: 'card' },
      h('h2', {}, `${t.emoji} CAP ${t.nombre}`),
      h('div', { class: 'modes' },
        modo('Simulacro de examen', `100 preguntas de las secciones ${t.obligatorias.join('ª y ')}ª · ${nOblig} en el banco`,
          () => pantallaConfig({ tipo, clase: 'examen' })),
        modo('Examen de ampliación', `25 preguntas solo de la sección ${t.especifica}ª · ${nEsp} en el banco`,
          () => pantallaConfig({ tipo, clase: 'ampliacion' })),
        modo('Practicar por temas', 'Elige los objetivos y ve la solución al momento',
          () => pantallaTemas(tipo)),
        modo('Repasar falladas', nFall ? `${nFall} preguntas falladas la última vez` : 'Aún no tienes preguntas falladas',
          () => pantallaConfig({ tipo, clase: 'falladas' }), !nFall),
      )));
  }

  nodos.push(tarjetaBanco(), tarjetaInstalar());
  render(...nodos.filter(Boolean));
}

function tarjetaBanco() {
  const p = prefs();
  const input = h('input', {
    type: 'file', accept: '.zip,application/zip', class: 'hidden',
    onchange: async e => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      toast('Leyendo ZIP…');
      try {
        const diff = await importarZip(f);
        toast(`✅ Banco importado: ${banco.total} preguntas (${resumenCambios(diff)}).`, 6000);
        pantallaInicio();
      } catch (err) { toast('❌ ' + err.message, 8000); }
    },
  });
  const btnAct = h('button', {
    class: 'btn primary', type: 'button',
    onclick: async () => {
      btnAct.disabled = true; btnAct.textContent = 'Buscando…';
      await buscarActualizacion();
      btnAct.disabled = false; btnAct.textContent = '🔄 Actualizar';
    },
  }, '🔄 Actualizar');

  return h('div', { class: 'card' },
    h('h2', {}, 'Banco de preguntas'),
    h('p', { class: 'small' },
      `${banco.total.toLocaleString('es-ES')} preguntas · fuente del ${fechaES(banco.fechaFuente)} · versión ${banco.version}`),
    p.ultimoCambio ? h('p', { class: 'muted small' },
      `Último cambio (${p.ultimoCambio.origen}, ${fechaES(p.ultimoCambio.fecha)}): ${resumenCambios(p.ultimoCambio.diff)}.`) : null,
    h('div', { class: 'row' }, btnAct,
      h('button', { class: 'btn', type: 'button', onclick: () => input.click() }, '📦 Importar ZIP oficial'), input),
    h('p', { class: 'muted small' },
      'La app busca actualizaciones sola al abrirse. "Importar ZIP" sirve para cargar a mano el ZIP de .txt que publica el Ministerio.'));
}

function tarjetaInstalar() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone) return null;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return h('div', { class: 'card' },
    h('h2', {}, '📲 Instalar la app'),
    ios
      ? h('p', { class: 'small' }, 'En Safari, pulsa el botón Compartir y luego "Añadir a pantalla de inicio".')
      : installPrompt
        ? h('button', {
          class: 'btn primary', type: 'button',
          onclick: async () => { installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; pantallaInicio(); },
        }, 'Instalar en este dispositivo')
        : h('p', { class: 'small' }, 'En Chrome o Edge: menú ⋮ → "Instalar aplicación" o "Añadir a pantalla de inicio".'),
    h('p', { class: 'muted small' }, 'Una vez instalada funciona sin conexión.'));
}

function pantallaTemas(tipo) {
  const t = TIPOS[tipo];
  const grupos = [
    ['Formación obligatoria (cuenta para el examen)', objetivosDe(t.obligatorias)],
    ['Formación complementaria', objetivosDe(t.complementarias)],
  ];
  const checks = [];
  const bloques = grupos.map(([titulo, objs]) => h('div', { class: 'card' },
    h('h2', {}, titulo),
    objs.map(o => {
      const cb = h('input', { type: 'checkbox', value: o.id });
      checks.push(cb);
      return h('label', { class: 'check' }, cb,
        h('span', {}, h('strong', {}, `${o.id} `), o.titulo,
          h('span', { class: 'muted small' }, ` · sección ${o.seccion} · ${o.n} preguntas`)));
    })));

  render(
    h('h1', {}, `Practicar por temas · ${t.nombre}`),
    h('div', { class: 'row' },
      h('button', { class: 'btn', type: 'button', onclick: () => checks.forEach(c => { c.checked = true; }) }, 'Marcar todos'),
      h('button', { class: 'btn', type: 'button', onclick: () => checks.forEach(c => { c.checked = false; }) }, 'Ninguno')),
    ...bloques,
    h('div', { class: 'row end' },
      h('button', { class: 'btn', type: 'button', onclick: pantallaInicio }, '← Volver'),
      h('button', {
        class: 'btn primary', type: 'button',
        onclick: () => {
          const ids = checks.filter(c => c.checked).map(c => c.value);
          if (!ids.length) return toast('Elige al menos un tema.');
          pantallaConfig({ tipo, clase: 'temas', objetivos: ids });
        },
      }, 'Siguiente →')));
}

function pantallaConfig({ tipo, clase, objetivos }) {
  const t = TIPOS[tipo];
  const p = prefs();
  let pool, titulo, defN, defMin, defFeedback;
  if (clase === 'examen') {
    pool = preguntasDe(objetivosDe(t.obligatorias).map(o => o.id));
    titulo = `Simulacro CAP ${t.nombre}`; defN = 100; defMin = 120; defFeedback = 'final';
  } else if (clase === 'ampliacion') {
    pool = preguntasDe(objetivosDe([t.especifica]).map(o => o.id));
    titulo = `Ampliación a ${t.nombre}`; defN = 25; defMin = 30; defFeedback = 'final';
  } else if (clase === 'falladas') {
    pool = falladasDe(tipo);
    titulo = `Repaso de falladas · ${t.nombre}`; defN = Math.min(30, pool.length); defMin = 0; defFeedback = 'inmediato';
  } else {
    pool = preguntasDe(objetivos);
    titulo = `Práctica · ${objetivos.join(', ')}`; defN = Math.min(30, pool.length); defMin = 0; defFeedback = 'inmediato';
  }
  const pt = { ...PUNTUACION_DEFECTO, ...p.puntuacion };

  const num = (id, label, value, attrs = {}) => h('label', { class: 'field' }, label,
    h('input', { id, type: 'number', inputmode: 'decimal', value, ...attrs }));

  render(
    h('h1', {}, titulo),
    h('p', { class: 'muted' }, `${pool.length.toLocaleString('es-ES')} preguntas disponibles.`),
    h('div', { class: 'card' },
      h('h2', {}, 'Test'),
      h('div', { class: 'grid2' },
        num('c-n', 'Número de preguntas', Math.min(defN, pool.length), { min: 1, max: pool.length, step: 1 }),
        num('c-min', 'Tiempo (minutos, 0 = sin límite)', defMin, { min: 0, max: 600, step: 1 }),
        h('label', { class: 'field' }, 'Corrección',
          h('select', { id: 'c-fb' },
            h('option', { value: 'final', selected: defFeedback === 'final' }, 'Al final (como en el examen)'),
            h('option', { value: 'inmediato', selected: defFeedback === 'inmediato' }, 'Al responder cada pregunta'))))),
    h('div', { class: 'card' },
      h('h2', {}, 'Puntuación'),
      h('div', { class: 'grid2' },
        num('c-ok', 'Acierto', pt.correcta, { step: 0.05 }),
        num('c-ko', 'Fallo', pt.incorrecta, { step: 0.05 }),
        num('c-bl', 'En blanco', pt.blanco, { step: 0.05 }),
        num('c-ap', '% para aprobar', pt.aprobado, { min: 0, max: 100, step: 1 })),
      h('p', { class: 'muted small' }, 'Comprueba los criterios de tu convocatoria; puedes cambiarlos aquí.')),
    h('div', { class: 'row end' },
      h('button', { class: 'btn', type: 'button', onclick: () => (clase === 'temas' ? pantallaTemas(tipo) : pantallaInicio()) }, '← Volver'),
      h('button', {
        class: 'btn primary', type: 'button',
        onclick: () => {
          const val = id => Number(String(document.getElementById(id).value).replace(',', '.'));
          const n = Math.floor(val('c-n'));
          const min = val('c-min');
          const punt = { correcta: val('c-ok'), incorrecta: val('c-ko'), blanco: val('c-bl'), aprobado: val('c-ap') };
          if (!Number.isFinite(n) || n < 1) return toast('Indica un número de preguntas válido.');
          if (!Number.isFinite(min) || min < 0) return toast('Indica un tiempo válido.');
          if (Object.values(punt).some(v => !Number.isFinite(v))) return toast('Revisa los valores de puntuación.');
          if (punt.correcta <= 0) return toast('El acierto debe valer más de 0.');
          if (punt.aprobado < 0 || punt.aprobado > 100) return toast('El % para aprobar debe estar entre 0 y 100.');
          guardarPref('puntuacion', punt);
          empezarTest({
            titulo, tipo, clase,
            ids: shuffle(pool).slice(0, Math.min(n, pool.length)).map(q => q.c),
            minutos: min, feedback: document.getElementById('c-fb').value, puntuacion: punt,
          });
        },
      }, 'Empezar')));
}

/* ---------- test ---------- */

function empezarTest({ titulo, tipo, clase, ids, minutos, feedback, puntuacion }) {
  session = {
    titulo, tipo, clase, ids, feedback, puntuacion,
    respuestas: {}, idx: 0, terminado: false,
    inicio: Date.now(),
    finEn: minutos > 0 ? Date.now() + minutos * 60000 : null,
  };
  guardarSesion();
  pantallaTest();
}

function guardarSesion() { if (session) lsSet(LS.session, session); }

function pararTimer() {
  clearInterval(timerId); timerId = null;
  document.getElementById('timer').classList.add('hidden');
}

function arrancarTimer() {
  const el = document.getElementById('timer');
  if (!session.finEn) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  const tick = () => {
    const resta = Math.max(0, Math.round((session.finEn - Date.now()) / 1000));
    const mm = Math.floor(resta / 60), ss = resta % 60;
    el.textContent = `⏱ ${mm}:${String(ss).padStart(2, '0')}`;
    el.classList.toggle('crit', resta <= 300);
    el.classList.toggle('warn', resta > 300 && resta <= 900);
    if (resta <= 0) { toast('⏱ Se acabó el tiempo.'); terminarTest(); }
  };
  clearInterval(timerId);
  tick();
  timerId = setInterval(tick, 1000);
}

function pantallaTest() {
  if (session.finEn && Date.now() >= session.finEn) return terminarTest();
  // Si el banco cambió y alguna pregunta ya no existe, se quita del test.
  session.ids = session.ids.filter(c => porCodigo.has(c));
  if (!session.ids.length) { lsDel(LS.session); toast('Las preguntas de ese test ya no están en el banco.'); return pantallaInicio(); }
  session.idx = Math.min(session.idx, session.ids.length - 1);
  if (!timerId) arrancarTimer();

  const c = session.ids[session.idx];
  const q = porCodigo.get(c);
  const elegida = session.respuestas[c];
  const mostrar = session.feedback === 'inmediato' && elegida;
  const obj = banco.objetivos.find(o => o.id === q.o);
  const total = session.ids.length;
  const respondidas = Object.keys(session.respuestas).length;

  const opciones = q.a.map((texto, i) => {
    const L = letra(i);
    let cls = 'option';
    if (mostrar) {
      if (L === q.r) cls += ' correct';
      else if (L === elegida) cls += ' wrong';
    } else if (L === elegida) cls += ' selected';
    return h('button', {
      class: cls, type: 'button', disabled: mostrar,
      onclick: () => {
        if (elegida === L && session.feedback === 'final') delete session.respuestas[c];
        else session.respuestas[c] = L;
        guardarSesion();
        pantallaTest();
      },
    }, h('span', { class: 'letter' }, L + ')'), h('span', {}, texto));
  });

  const ultima = session.idx === total - 1;
  const ir = i => { session.idx = i; guardarSesion(); pantallaTest(); };

  render(
    h('div', { class: 'spread' },
      h('strong', {}, session.titulo),
      h('span', { class: 'muted small' }, `${respondidas}/${total} respondidas`)),
    h('div', { class: 'progress' }, h('div', { style: `width:${((session.idx + 1) / total) * 100}%` })),
    h('div', { class: 'card' },
      h('div', { class: 'badges' },
        h('span', { class: 'badge' }, `Pregunta ${session.idx + 1} de ${total}`),
        h('span', { class: 'badge' }, `COD ${q.c}`),
        h('span', { class: 'badge', title: obj ? obj.titulo : '' }, `Objetivo ${q.o}`)),
      h('p', { class: 'question' }, q.p),
      h('div', { class: 'options' }, opciones),
      mostrar ? h('p', { class: 'norma' },
        elegida === q.r ? '✅ Correcta. ' : `❌ La correcta es la ${q.r}. `,
        q.n ? `Norma: ${q.n}` : '') : null,
      session.feedback === 'final' && elegida ? h('p', { class: 'muted small' }, 'Pulsa otra vez tu respuesta para dejarla en blanco.') : null),
    h('div', { class: 'row end' },
      h('button', { class: 'btn', type: 'button', disabled: session.idx === 0, onclick: () => ir(session.idx - 1) }, '← Anterior'),
      ultima
        ? h('button', { class: 'btn primary', type: 'button', onclick: confirmarTerminar }, 'Terminar')
        : h('button', { class: 'btn primary', type: 'button', onclick: () => ir(session.idx + 1) }, elegida ? 'Siguiente →' : 'Saltar →')),
    h('div', { class: 'card' },
      h('div', { class: 'spread' }, h('h2', {}, 'Preguntas'),
        h('button', { class: 'btn danger', type: 'button', onclick: confirmarTerminar }, 'Terminar test')),
      h('div', { class: 'palette' }, session.ids.map((cc, i) => {
        const r = session.respuestas[cc];
        let cls = r ? 'answered' : '';
        if (r && session.feedback === 'inmediato') cls = r === porCodigo.get(cc).r ? 'correct' : 'wrong';
        if (i === session.idx) cls += ' current';
        return h('button', { type: 'button', class: cls, onclick: () => ir(i), 'aria-label': `Pregunta ${i + 1}` }, i + 1);
      }))));
}

function confirmarTerminar() {
  const sin = session.ids.length - Object.keys(session.respuestas).length;
  if (sin > 0 && !confirm(`Te quedan ${sin} preguntas sin responder. ¿Terminar igualmente?`)) return;
  terminarTest();
}

function calcular(ses) {
  const pt = ses.puntuacion;
  let ok = 0, ko = 0, blanco = 0;
  for (const c of ses.ids) {
    const r = ses.respuestas[c];
    if (!r) blanco++;
    else if (r === porCodigo.get(c).r) ok++;
    else ko++;
  }
  const puntos = ok * pt.correcta + ko * pt.incorrecta + blanco * pt.blanco;
  const max = ses.ids.length * pt.correcta;
  const pct = max > 0 ? (puntos / max) * 100 : 0;
  return { ok, ko, blanco, puntos, max, pct, aprobado: pct >= pt.aprobado };
}

function terminarTest() {
  pararTimer();
  if (!session.terminado) {
    session.terminado = true;
    session.fin = Date.now();
    registrarStats(session);
    guardarSesion();
  }
  pantallaResultado();
}

function pantallaResultado() {
  const r = calcular(session);
  const minutos = Math.round(((session.fin || Date.now()) - session.inicio) / 60000);
  const stat = (num, label) => h('div', { class: 'stat' }, h('div', { class: 'num' }, num), h('div', { class: 'muted small' }, label));
  render(
    h('h1', {}, 'Resultado'),
    h('p', { class: 'muted' }, session.titulo),
    h('div', { class: `result-banner ${r.aprobado ? 'ok' : 'bad'}` },
      r.aprobado ? '✅ Aprobado' : '❌ No aprobado',
      h('div', { class: 'small' }, `${fmt(r.puntos)} de ${fmt(r.max)} puntos (${fmt(r.pct)} %) · mínimo ${fmt(session.puntuacion.aprobado)} %`)),
    h('div', { class: 'card' },
      h('div', { class: 'stats' },
        stat(r.ok, `Correctas (${fmt(r.ok * session.puntuacion.correcta)} pts)`),
        stat(r.ko, `Falladas (${fmt(r.ko * session.puntuacion.incorrecta)} pts)`),
        stat(r.blanco, `En blanco (${fmt(r.blanco * session.puntuacion.blanco)} pts)`),
        stat(`${minutos} min`, 'Tiempo empleado'))),
    h('div', { class: 'row end' },
      h('button', { class: 'btn', type: 'button', onclick: () => { lsDel(LS.session); session = null; pantallaInicio(); } }, 'Inicio'),
      h('button', { class: 'btn primary', type: 'button', onclick: () => pantallaRevision('ko') }, 'Revisar respuestas')));
}

function pantallaRevision(filtro) {
  const filtros = { ko: 'Falladas', blanco: 'En blanco', ok: 'Correctas', todas: 'Todas' };
  const items = session.ids.map((c, i) => ({ i, q: porCodigo.get(c), r: session.respuestas[c] }))
    .filter(({ q, r }) => filtro === 'todas' ||
      (filtro === 'ok' && r === q.r) || (filtro === 'ko' && r && r !== q.r) || (filtro === 'blanco' && !r));

  render(
    h('h1', {}, 'Revisión'),
    h('div', { class: 'segmented', style: 'grid-template-columns:repeat(4,1fr)' },
      Object.entries(filtros).map(([k, v]) => h('button', {
        type: 'button', 'aria-pressed': String(k === filtro), onclick: () => pantallaRevision(k),
      }, v))),
    items.length ? null : h('p', { class: 'muted' }, 'No hay preguntas en este grupo.'),
    items.map(({ i, q, r }) => h('div', { class: 'card' },
      h('div', { class: 'badges' },
        h('span', { class: 'badge' }, `Pregunta ${i + 1}`), h('span', { class: 'badge' }, `COD ${q.c}`),
        h('span', { class: 'badge' }, `Objetivo ${q.o}`)),
      h('p', { class: 'question' }, q.p),
      h('div', { class: 'options' }, q.a.map((t, j) => {
        const L = letra(j);
        const cls = L === q.r ? 'option correct' : (L === r ? 'option wrong' : 'option');
        return h('div', { class: cls }, h('span', { class: 'letter' }, L + ')'), h('span', {}, t));
      })),
      h('p', { class: 'norma' },
        !r ? `⚪ En blanco · correcta: ${q.r}` : r === q.r ? '✅ Correcta' : `❌ Respondiste ${r} · correcta: ${q.r}`,
        q.n ? ` · Norma: ${q.n}` : ''))),
    h('div', { class: 'row end' },
      h('button', { class: 'btn', type: 'button', onclick: pantallaResultado }, '← Resultado'),
      h('button', { class: 'btn primary', type: 'button', onclick: () => { lsDel(LS.session); session = null; pantallaInicio(); } }, 'Inicio')));
}

/* ---------- arranque ---------- */

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installPrompt = e;
  if (!session || session.terminado) pantallaInicio();
});

document.getElementById('btn-home').addEventListener('click', () => {
  if (session && !session.terminado && !confirm('¿Salir al inicio? El test queda guardado para continuar después.')) return;
  pararTimer();
  session = null;
  pantallaInicio();
});

async function init() {
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  try {
    await cargarBanco();
  } catch (e) {
    render(h('div', { class: 'card' }, h('h2', {}, 'No se pudo cargar el banco'), h('p', {}, e.message),
      h('button', { class: 'btn primary', type: 'button', onclick: () => location.reload() }, 'Reintentar')));
    return;
  }
  const guardada = lsGet(LS.session, null);
  if (guardada && guardada.terminado) lsDel(LS.session);
  pantallaInicio();
  buscarActualizacion({ silencioso: true });
}

document.addEventListener('DOMContentLoaded', init);
