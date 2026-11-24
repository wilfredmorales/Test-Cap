'use strict';

/* ============================================================
   Test CAP — tests del CAP (mercancías y viajeros)
   - Banco: data/banco-cap.json (generado desde el ZIP oficial de .txt)
   - Cuentas, roles y resultados: Supabase (proyecto Test-CAP)
   ============================================================ */

/* ---------- configuración ---------- */

const SUPABASE_URL = 'https://bzalfptgfqsoalqgsklr.supabase.co';
// Clave pública (anon): pensada para ir en la app. Los permisos los imponen las reglas RLS.
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6YWxmcHRnZnFzb2FscWdza2xyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU1Mzg4OTQsImV4cCI6MjExMTExNDg5NH0.DAsi5OEkCV8TnfHE8nAJSlxHgkhQjCJUAOqJPKHWMWo';
// Dirección pública de la app (los enlaces de los correos vuelven aquí).
const URL_APP = 'https://wilfredmorales.github.io/Test-Cap/';
// En la app instalada (APK) las actualizaciones del banco se buscan en GitHub.
const DATOS_REMOTOS = 'https://raw.githubusercontent.com/wilfredmorales/Test-Cap/claude/testcat-repo-review-540xv2/data/';
const SUBIR_ZIP_URL = 'https://github.com/wilfredmorales/Test-Cap/upload/claude/testcat-repo-review-540xv2/fuentes';

const TIPOS = {
  mercancias: { nombre: 'Mercancías', icono: 'camion', obligatorias: ['1', '2'], especifica: '2', complementarias: ['4', '4-5'] },
  viajeros: { nombre: 'Viajeros', icono: 'bus', obligatorias: ['1', '3'], especifica: '3', complementarias: ['5', '4-5'] },
};
const MODOS = { examen: 'Simulacro', ampliacion: 'Ampliación', temas: 'Práctica por temas', falladas: 'Repaso de falladas' };
const PUNTUACION_DEFECTO = { correcta: 1, incorrecta: -0.5, blanco: 0, aprobado: 50 };

const urlDatos = archivo => (window.Capacitor ? DATOS_REMOTOS : 'data/') + archivo;
const redirectApp = () =>
  (!window.Capacitor && /^https?:$/.test(location.protocol) && !/^(localhost|127\.)/.test(location.hostname))
    ? location.origin + location.pathname : URL_APP;

/* ---------- estado ---------- */

let sb = null;             // cliente Supabase
let usuario = null;        // { id, email }
let perfil = null;         // { nombre, rol, activo, email }
let banco = null;
let porCodigo = new Map();
let session = null;        // test en curso
let timerId = null;
let installPrompt = null;
let enRecuperacion = false;

/* ---------- utilidades ---------- */

const $app = () => document.getElementById('app');

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style') el.style.cssText = v;
    else if (k === 'html') el.innerHTML = v; // solo con SVG propios, nunca con datos
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const ICONOS = {
  camion: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  bus: '<rect x="4" y="3.5" width="16" height="13" rx="2"/><path d="M4 10h16M8 16.5v2M16 16.5v2"/><circle cx="8" cy="13.3" r=".9"/><circle cx="16" cy="13.3" r=".9"/>',
  examen: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/>',
  temas: '<path d="M4 5h16M4 12h16M4 19h10"/>',
  repaso: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/>',
  ampliacion: '<path d="M12 5v14M5 12h14"/>',
  usuarios: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3 2.9-4.6 5.5-4.6s4.9 1.6 5.5 4.6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.6c2.4.1 4.1 1.6 4.6 4.4"/>',
  grafico: '<path d="M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3"/>',
  banco: '<ellipse cx="12" cy="6" rx="7" ry="2.8"/><path d="M5 6v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6M5 12v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-6"/>',
  historial: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  salir: '<path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/>',
  perfil: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>',
  ojo: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  flecha: '<path d="M9 6l6 6-6 6"/>',
};
const icono = (n, cls = 'ico') => h('span', {
  class: cls, 'aria-hidden': 'true',
  html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONOS[n] || ''}</svg>`,
});

function render(...nodes) {
  $app().replaceChildren(...nodes.flat(Infinity).filter(n => n != null && n !== false));
  pintarCabecera();
  window.scrollTo({ top: 0 });
}

function toast(msg, ms = 3800) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), ms);
}

/** Diálogo de confirmación propio (window.confirm no funciona en todas las vistas). */
function confirmar(mensaje, aceptar = 'Sí', cancelar = 'Cancelar', peligro = false) {
  return new Promise(resolve => {
    const cerrar = v => { capa.remove(); resolve(v); };
    const btnOk = h('button', { class: 'btn ' + (peligro ? 'danger-solid' : 'primary'), type: 'button', onclick: () => cerrar(true) }, aceptar);
    const capa = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', onclick: e => { if (e.target === capa) cerrar(false); } },
      h('div', { class: 'card modal-card' },
        h('p', {}, mensaje),
        h('div', { class: 'row end' },
          h('button', { class: 'btn', type: 'button', onclick: () => cerrar(false) }, cancelar), btnOk)));
    document.body.append(capa);
    btnOk.focus();
  });
}

/* localStorage: todo lo personal va separado por cuenta */
const clave = k => (usuario ? `${k}.${usuario.id}` : k);
function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function lsSet(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sin almacenamiento */ } }
function lsDel(key) { try { localStorage.removeItem(key); } catch { /* nada */ } }
const LS = {
  prefs: () => clave('cap.prefs'), stats: () => clave('cap.stats'),
  session: () => clave('cap.session'), cola: () => clave('cap.cola'), perfil: () => clave('cap.perfil'),
};

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
const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  }));
function fechaES(iso, conHora = false) {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', ...(conHora ? { hour: '2-digit', minute: '2-digit' } : {}) });
}
const correoValido = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

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

/* ---------- banco de preguntas ---------- */

function usarBanco(b) { banco = b; porCodigo = new Map(b.preguntas.map(q => [q.c, q])); }

async function cargarBanco() {
  const guardado = await idbGet('banco');
  if (guardado && guardado.preguntas) { usarBanco(guardado); return; }
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
  const p = [];
  if (d.nuevas) p.push(`${d.nuevas} nuevas`);
  if (d.eliminadas) p.push(`${d.eliminadas} eliminadas`);
  if (d.cambiaRespuesta) p.push(`${d.cambiaRespuesta} con respuesta cambiada`);
  if (d.cambiaTexto) p.push(`${d.cambiaTexto} con texto corregido`);
  return p.length ? p.join(', ') : 'sin cambios en las preguntas';
}
async function aplicarBanco(nuevo, origen) {
  const diff = compararBancos(banco, nuevo);
  usarBanco(nuevo);
  await idbSet('banco', nuevo);
  lsSet('cap.banco.ultimoCambio', { fecha: new Date().toISOString(), origen, diff });
  return diff;
}

async function buscarActualizacion({ silencioso = false } = {}) {
  if (!navigator.onLine) { if (!silencioso) toast('Sin conexión. Inténtalo cuando tengas internet.'); return; }
  try {
    const v = await (await fetch(urlDatos('version.json'), { cache: 'no-store' })).json();
    if (v.version === banco.version) { if (!silencioso) toast('Ya tienes la última versión del banco.'); return; }
    if (silencioso && banco.fechaFuente && v.fechaFuente && v.fechaFuente < banco.fechaFuente) return;
    const res = await fetch(urlDatos('banco-cap.json') + '?v=' + encodeURIComponent(v.version), { cache: 'no-store' });
    const nuevo = await res.json();
    if (!nuevo.preguntas || nuevo.preguntas.length < 100) throw new Error('banco recibido incompleto');
    const diff = await aplicarBanco(nuevo, 'actualización');
    toast(`Banco actualizado: ${resumenCambios(diff)}.`, 6000);
    if (usuario && (!session || session.terminado)) pantallaInicio();
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

/** Lee y valida el ZIP oficial. No cambia el banco del dispositivo. */
async function leerZip(file) {
  if (!window.JSZip) throw new Error('No se pudo cargar el lector de ZIP');
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
  if (problemas.length) throw new Error(`${problemas.length} preguntas no se pudieron leer bien. Primera: ${problemas[0]}`);
  const orden = Object.keys(banco.secciones);
  objetivos.sort((a, b) => (orden.indexOf(a.seccion) - orden.indexOf(b.seccion)) || a.id.localeCompare(b.id));
  const nuevo = {
    version: await hashTexto(textoCanonico(preguntas)),
    fechaFuente: fecha ? fecha.toISOString().slice(0, 10) : null,
    generado: new Date().toISOString(), fuente: file.name, total: preguntas.length,
    secciones: banco.secciones, objetivos, preguntas,
  };
  return nuevo;
}

/* ---------- cuentas (Supabase Auth) ---------- */

function traducirError(e) {
  const m = (e && (e.message || e.error_description || e.error)) || String(e);
  const tabla = [
    [/invalid login credentials/i, 'Correo o contraseña incorrectos.'],
    [/email not confirmed/i, 'Aún no has confirmado tu correo. Revisa tu bandeja de entrada (y la de spam).'],
    [/user (is )?banned/i, 'Esta cuenta está desactivada. Contacta con el administrador.'],
    [/already registered|already been registered/i, 'Ya existe una cuenta con ese correo. Inicia sesión o recupera la contraseña.'],
    [/password should be at least|weak password|password is too weak/i, 'La contraseña es demasiado débil: usa al menos 8 caracteres con letras y números.'],
    [/rate limit|too many requests|over_email_send_rate_limit/i, 'Demasiados intentos. Espera unos minutos y vuelve a probar.'],
    [/same.*password|different from the old/i, 'La nueva contraseña debe ser distinta de la anterior.'],
    [/failed to fetch|network|load failed/i, 'Sin conexión con el servidor. Comprueba tu internet.'],
    [/expired|invalid.*(token|link)|otp/i, 'El enlace ha caducado o ya se usó. Pide uno nuevo.'],
    [/captcha/i, 'Completa la verificación de seguridad.'],
  ];
  for (const [re, txt] of tabla) if (re.test(m)) return txt;
  return m;
}

function claveSegura(p) {
  if (p.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (!/[a-zA-Z]/.test(p) || !/\d/.test(p)) return 'La contraseña debe combinar letras y números.';
  return null;
}

async function cargarPerfil() {
  const cache = lsGet(LS.perfil(), null);
  try {
    const { data, error } = await sb.from('perfiles').select('email, nombre, rol, activo').eq('id', usuario.id).single();
    if (error) throw error;
    perfil = data;
    lsSet(LS.perfil(), data);
    sb.from('perfiles').update({ ultimo_acceso: new Date().toISOString() }).eq('id', usuario.id).then(() => {}, () => {});
  } catch (e) {
    if (!cache) throw e;
    perfil = cache; // sin conexión: usamos el último perfil conocido
  }
}

async function entrarConSesion(s) {
  usuario = { id: s.user.id, email: s.user.email };
  try {
    await cargarPerfil();
  } catch (e) {
    usuario = null;
    pantallaLogin({ error: 'No se pudo cargar tu perfil: ' + traducirError(e) });
    return;
  }
  if (!perfil.activo) {
    usuario = null; perfil = null; // antes de signOut, para que no salte el aviso de "sesión terminada"
    await sb.auth.signOut().catch(() => {});
    pantallaLogin({ error: 'Esta cuenta está desactivada. Contacta con el administrador.' });
    return;
  }
  vaciarCola();
  const guardada = lsGet(LS.session(), null);
  if (guardada && guardada.terminado) lsDel(LS.session());
  pantallaInicio();
}

async function cerrarSesion() {
  pararTimer();
  session = null;
  usuario = null; perfil = null;
  try { await sb.auth.signOut(); } catch { /* sin conexión: se borra la sesión local igualmente */ }
  pantallaLogin({ info: 'Has cerrado sesión.' });
}

/* ---------- pantallas de acceso ---------- */

function campo(id, etiqueta, attrs = {}) {
  const input = h('input', { id, name: id, ...attrs });
  let extra = null;
  if (attrs.type === 'password') {
    extra = h('button', {
      class: 'ver-clave', type: 'button', 'aria-label': 'Mostrar u ocultar contraseña',
      onclick: () => { input.type = input.type === 'password' ? 'text' : 'password'; },
    }, icono('ojo'));
  }
  return h('label', { class: 'field' }, h('span', { class: 'field-label' }, etiqueta),
    h('span', { class: 'field-input' }, input, extra));
}

function marcoAcceso(titulo, subtitulo, ...contenido) {
  return h('div', { class: 'auth' },
    h('aside', { class: 'auth-brand' },
      h('div', { class: 'auth-brand-inner' },
        h('img', { src: 'icons/icon-192.png', alt: '', width: 56, height: 56, class: 'auth-logo' }),
        h('p', { class: 'eyebrow' }, 'Certificado de Aptitud Profesional'),
        h('h1', { class: 'auth-claim' }, 'Prepara el CAP con el banco oficial de preguntas'),
        h('ul', { class: 'auth-points' },
          h('li', {}, `${banco ? banco.total.toLocaleString('es-ES') : '8.655'} preguntas del Ministerio de Transportes`),
          h('li', {}, 'Mercancías y viajeros, con simulacros de 100 preguntas'),
          h('li', {}, 'Tu progreso guardado en todos tus dispositivos'))),
      h('div', { class: 'road', 'aria-hidden': 'true' })),
    h('section', { class: 'auth-form' },
      h('div', { class: 'auth-card' },
        h('h2', { class: 'auth-title' }, titulo),
        subtitulo ? h('p', { class: 'muted' }, subtitulo) : null,
        ...contenido)));
}

function aviso(tipo, texto) { return texto ? h('div', { class: `alert ${tipo}`, role: tipo === 'error' ? 'alert' : 'status' }, texto) : null; }

function botonCargando(btn, cargando, texto) {
  btn.disabled = cargando;
  if (cargando) { btn.dataset.txt = btn.textContent; btn.textContent = texto || 'Un momento…'; }
  else if (btn.dataset.txt) btn.textContent = btn.dataset.txt;
}

function pantallaLogin({ error, info, email = '' } = {}) {
  pararTimer();
  const btn = h('button', { class: 'btn primary block', type: 'submit' }, 'Iniciar sesión');
  const zonaAviso = h('div', {}, aviso('error', error), aviso('info', info));
  const form = h('form', {
    class: 'form', novalidate: true,
    onsubmit: async e => {
      e.preventDefault();
      const correo = form.email.value.trim().toLowerCase();
      const pass = form.password.value;
      if (!correoValido(correo) || !pass) { zonaAviso.replaceChildren(aviso('error', 'Escribe tu correo y tu contraseña.')); return; }
      botonCargando(btn, true, 'Entrando…');
      const { data, error: err } = await sb.auth.signInWithPassword({ email: correo, password: pass });
      botonCargando(btn, false);
      if (err) {
        const txt = traducirError(err);
        zonaAviso.replaceChildren(aviso('error', txt));
        if (/confirmado/.test(txt)) {
          zonaAviso.append(h('button', {
            class: 'btn link', type: 'button',
            onclick: async () => {
              const { error: e2 } = await sb.auth.resend({ type: 'signup', email: correo, options: { emailRedirectTo: redirectApp() } });
              toast(e2 ? traducirError(e2) : 'Te hemos reenviado el correo de confirmación.');
            },
          }, 'Reenviar correo de confirmación'));
        }
        return;
      }
      await entrarConSesion(data.session);
    },
  },
  zonaAviso,
  campo('email', 'Correo electrónico', { type: 'email', autocomplete: 'email', inputmode: 'email', required: true, value: email }),
  campo('password', 'Contraseña', { type: 'password', autocomplete: 'current-password', required: true }),
  h('div', { class: 'row spread-row' },
    h('span'),
    h('button', { class: 'btn link', type: 'button', onclick: () => pantallaRecuperar(form.email.value.trim()) }, '¿Has olvidado la contraseña?')),
  btn);

  render(marcoAcceso('Iniciar sesión', 'Entra con tu cuenta para hacer tests y guardar tu progreso.',
    form,
    h('p', { class: 'auth-alt' }, '¿No tienes cuenta? ',
      h('button', { class: 'btn link', type: 'button', onclick: () => pantallaRegistro(form.email.value.trim()) }, 'Crear cuenta'))));
}

function pantallaRegistro(email = '') {
  const btn = h('button', { class: 'btn primary block', type: 'submit' }, 'Crear cuenta');
  const zonaAviso = h('div');
  const acepto = h('input', { type: 'checkbox', id: 'acepto', required: true });
  const form = h('form', {
    class: 'form', novalidate: true,
    onsubmit: async e => {
      e.preventDefault();
      const nombre = form.nombre.value.trim();
      const correo = form.email.value.trim().toLowerCase();
      const pass = form.password.value;
      const err = !nombre ? 'Escribe tu nombre.'
        : !correoValido(correo) ? 'Escribe un correo válido.'
          : claveSegura(pass) || (pass !== form.password2.value ? 'Las contraseñas no coinciden.' : null)
            || (!acepto.checked ? 'Acepta las condiciones para continuar.' : null);
      if (err) { zonaAviso.replaceChildren(aviso('error', err)); return; }
      botonCargando(btn, true, 'Creando cuenta…');
      const { data, error } = await sb.auth.signUp({
        email: correo, password: pass, options: { data: { nombre }, emailRedirectTo: redirectApp() },
      });
      botonCargando(btn, false);
      if (error) { zonaAviso.replaceChildren(aviso('error', traducirError(error))); return; }
      if (data.session) { await entrarConSesion(data.session); return; }
      render(marcoAcceso('Revisa tu correo', null,
        aviso('ok', `Te hemos enviado un enlace a ${correo} para confirmar la cuenta. Ábrelo y después inicia sesión.`),
        h('p', { class: 'muted small' }, 'Si no lo ves en unos minutos, mira en la carpeta de spam.'),
        h('button', { class: 'btn primary block', type: 'button', onclick: () => pantallaLogin({ email: correo }) }, 'Ir a iniciar sesión')));
    },
  },
  zonaAviso,
  campo('nombre', 'Nombre', { type: 'text', autocomplete: 'name', maxlength: 80, required: true }),
  campo('email', 'Correo electrónico', { type: 'email', autocomplete: 'email', inputmode: 'email', required: true, value: email }),
  campo('password', 'Contraseña', { type: 'password', autocomplete: 'new-password', required: true, minlength: 8 }),
  h('p', { class: 'hint' }, 'Mínimo 8 caracteres, con letras y números.'),
  campo('password2', 'Repite la contraseña', { type: 'password', autocomplete: 'new-password', required: true }),
  h('label', { class: 'check' }, acepto,
    h('span', { class: 'small' }, 'Acepto que se guarden mi correo, mi nombre y mis resultados para usar la app.')),
  btn);

  render(marcoAcceso('Crear cuenta', 'Es gratis. Solo necesitas un correo.',
    form,
    h('p', { class: 'auth-alt' }, '¿Ya tienes cuenta? ',
      h('button', { class: 'btn link', type: 'button', onclick: () => pantallaLogin({ email: form.email.value.trim() }) }, 'Inicia sesión'))));
}

function pantallaRecuperar(email = '') {
  const btn = h('button', { class: 'btn primary block', type: 'submit' }, 'Enviar enlace');
  const zonaAviso = h('div');
  const form = h('form', {
    class: 'form', novalidate: true,
    onsubmit: async e => {
      e.preventDefault();
      const correo = form.email.value.trim().toLowerCase();
      if (!correoValido(correo)) { zonaAviso.replaceChildren(aviso('error', 'Escribe un correo válido.')); return; }
      botonCargando(btn, true, 'Enviando…');
      const { error } = await sb.auth.resetPasswordForEmail(correo, { redirectTo: redirectApp() });
      botonCargando(btn, false);
      if (error && /rate|conexión|fetch/i.test(traducirError(error) + error.message)) {
        zonaAviso.replaceChildren(aviso('error', traducirError(error))); return;
      }
      // Mismo mensaje exista o no la cuenta, para no revelar qué correos están registrados.
      zonaAviso.replaceChildren(aviso('ok', `Si existe una cuenta con ${correo}, recibirás un enlace para crear una contraseña nueva.`));
    },
  },
  zonaAviso,
  campo('email', 'Correo electrónico', { type: 'email', autocomplete: 'email', inputmode: 'email', required: true, value: email }),
  btn);
  render(marcoAcceso('Recuperar contraseña', 'Te enviaremos un enlace a tu correo para crear una contraseña nueva.',
    form,
    h('p', { class: 'auth-alt' },
      h('button', { class: 'btn link', type: 'button', onclick: () => pantallaLogin({ email: form.email.value.trim() }) }, '← Volver a iniciar sesión'))));
}

function pantallaNuevaClave() {
  const btn = h('button', { class: 'btn primary block', type: 'submit' }, 'Guardar contraseña');
  const zonaAviso = h('div');
  const form = h('form', {
    class: 'form', novalidate: true,
    onsubmit: async e => {
      e.preventDefault();
      const pass = form.password.value;
      const err = claveSegura(pass) || (pass !== form.password2.value ? 'Las contraseñas no coinciden.' : null);
      if (err) { zonaAviso.replaceChildren(aviso('error', err)); return; }
      botonCargando(btn, true, 'Guardando…');
      const { error } = await sb.auth.updateUser({ password: pass });
      botonCargando(btn, false);
      if (error) { zonaAviso.replaceChildren(aviso('error', traducirError(error))); return; }
      enRecuperacion = false;
      toast('Contraseña cambiada.');
      const { data } = await sb.auth.getSession();
      if (data.session) await entrarConSesion(data.session); else pantallaLogin({ info: 'Contraseña cambiada. Inicia sesión.' });
    },
  },
  zonaAviso,
  campo('password', 'Nueva contraseña', { type: 'password', autocomplete: 'new-password', required: true }),
  h('p', { class: 'hint' }, 'Mínimo 8 caracteres, con letras y números.'),
  campo('password2', 'Repite la contraseña', { type: 'password', autocomplete: 'new-password', required: true }),
  btn);
  render(marcoAcceso('Nueva contraseña', 'Escribe la contraseña que quieres usar a partir de ahora.', form));
}

/* ---------- cabecera y menú de cuenta ---------- */

function iniciales() {
  const base = (perfil && perfil.nombre) || (usuario && usuario.email) || '?';
  return base.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
}

function pintarCabecera() {
  const zona = document.getElementById('cuenta');
  if (!zona) return;
  if (!usuario || !perfil) { zona.replaceChildren(); document.body.classList.add('sin-sesion'); return; }
  document.body.classList.remove('sin-sesion');
  const menu = h('div', { class: 'menu hidden', role: 'menu' },
    h('div', { class: 'menu-head' },
      h('strong', {}, perfil.nombre || 'Sin nombre'),
      h('span', { class: 'muted small' }, usuario.email),
      perfil.rol === 'admin' ? h('span', { class: 'pill pill-admin' }, 'Administrador') : null),
    h('button', { type: 'button', role: 'menuitem', onclick: () => irA(pantallaInicio) }, icono('examen'), 'Tests'),
    h('button', { type: 'button', role: 'menuitem', onclick: () => irA(pantallaHistorial) }, icono('historial'), 'Mi historial'),
    h('button', { type: 'button', role: 'menuitem', onclick: () => irA(pantallaPerfil) }, icono('perfil'), 'Mi cuenta'),
    perfil.rol === 'admin' ? h('button', { type: 'button', role: 'menuitem', onclick: () => irA(() => pantallaAdmin('resumen')) }, icono('usuarios'), 'Administración') : null,
    h('hr'),
    h('button', { type: 'button', role: 'menuitem', class: 'menu-danger', onclick: () => irA(cerrarSesion) }, icono('salir'), 'Cerrar sesión'));
  const boton = h('button', {
    class: 'avatar', type: 'button', 'aria-haspopup': 'menu', 'aria-label': 'Menú de cuenta',
    onclick: e => { e.stopPropagation(); menu.classList.toggle('hidden'); },
  }, iniciales());
  zona.replaceChildren(boton, menu);
}
const cerrarMenus = () => document.querySelectorAll('.menu').forEach(m => m.classList.add('hidden'));
document.addEventListener('click', cerrarMenus);
document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarMenus(); });

async function irA(fn) {
  if (session && !session.terminado &&
    !(await confirmar('Tienes un test en curso. Queda guardado y podrás continuarlo después. ¿Salir?', 'Salir'))) return;
  pararTimer();
  session = null;
  fn();
}

/* ---------- preferencias y estadísticas locales ---------- */

function prefs() { return { tipo: null, puntuacion: { ...PUNTUACION_DEFECTO }, ...lsGet(LS.prefs(), {}) }; }
function guardarPref(k, v) { const p = prefs(); p[k] = v; lsSet(LS.prefs(), p); }
function objetivosDe(secciones) { return banco.objetivos.filter(o => secciones.includes(o.seccion)); }
function preguntasDe(objIds) { const set = new Set(objIds); return banco.preguntas.filter(q => set.has(q.o)); }

function registrarStats(ses) {
  const stats = lsGet(LS.stats(), {});
  for (const c of ses.ids) {
    const resp = ses.respuestas[c];
    const q = porCodigo.get(c);
    if (!resp || !q) continue;
    const s = stats[c] || { ok: 0, ko: 0 };
    if (resp === q.r) s.ok++; else s.ko++;
    s.ultima = resp === q.r ? 'ok' : 'ko';
    stats[c] = s;
  }
  lsSet(LS.stats(), stats);
}
function falladasDe(tipo) {
  const stats = lsGet(LS.stats(), {});
  const t = TIPOS[tipo];
  const objs = new Set(objetivosDe([...t.obligatorias, ...t.complementarias]).map(o => o.id));
  return banco.preguntas.filter(q => objs.has(q.o) && stats[q.c] && stats[q.c].ultima === 'ko');
}

/* ---------- resultados en el servidor (con cola sin conexión) ---------- */

function encolarResultado(fila) {
  const cola = lsGet(LS.cola(), []);
  cola.push(fila);
  lsSet(LS.cola(), cola.slice(-200));
  vaciarCola();
}
let vaciando = false;
async function vaciarCola() {
  if (vaciando || !usuario || !navigator.onLine) return;
  vaciando = true;
  try {
    let cola = lsGet(LS.cola(), []);
    while (cola.length) {
      const { error } = await sb.from('resultados').insert(cola[0]);
      if (error && error.code !== '23505') break; // 23505 = ya estaba guardado
      cola = cola.slice(1);
      lsSet(LS.cola(), cola);
    }
  } finally { vaciando = false; }
}
window.addEventListener('online', vaciarCola);

/* ---------- pantalla de inicio ---------- */

function pantallaInicio() {
  pararTimer();
  const p = prefs();
  const tipo = p.tipo;
  const guardada = lsGet(LS.session(), null);
  const nombre = (perfil.nombre || '').split(' ')[0];

  const selector = h('div', { class: 'tipo-grid', role: 'group', 'aria-label': 'Tipo de transporte' },
    Object.entries(TIPOS).map(([k, t]) =>
      h('button', {
        type: 'button', class: 'tipo', 'aria-pressed': String(tipo === k),
        onclick: () => { guardarPref('tipo', k); pantallaInicio(); },
      }, icono(t.icono, 'tipo-ico'), h('span', { class: 'tipo-nombre' }, t.nombre),
      h('span', { class: 'tipo-sub' }, k === 'mercancias' ? 'Camiones y transporte de carga' : 'Autobuses y transporte de personas'))));

  const nodos = [
    h('div', { class: 'page-head' },
      h('p', { class: 'eyebrow' }, 'Panel de estudio'),
      h('h1', {}, nombre ? `Hola, ${nombre}` : 'Tests del CAP'),
      h('p', { class: 'muted' }, 'Elige el CAP que preparas y el tipo de test.')),
    h('section', { class: 'card' }, h('h2', {}, '¿Qué CAP preparas?'), selector),
  ];

  if (guardada && !guardada.terminado) {
    nodos.push(h('section', { class: 'card card-accent' },
      h('div', { class: 'spread' },
        h('div', {}, h('strong', {}, 'Tienes un test sin terminar'),
          h('div', { class: 'muted small' }, `${guardada.titulo} · ${Object.keys(guardada.respuestas).length} de ${guardada.ids.length} respondidas`)),
        h('div', { class: 'row' },
          h('button', { class: 'btn', type: 'button', onclick: () => { lsDel(LS.session()); pantallaInicio(); } }, 'Descartar'),
          h('button', { class: 'btn primary', type: 'button', onclick: () => { session = guardada; pantallaTest(); } }, 'Continuar')))));
  }

  if (tipo) {
    const t = TIPOS[tipo];
    const nOblig = preguntasDe(objetivosDe(t.obligatorias).map(o => o.id)).length;
    const nEsp = preguntasDe(objetivosDe([t.especifica]).map(o => o.id)).length;
    const nFall = falladasDe(tipo).length;
    const modo = (ico, titulo, desc, meta, fn, disabled) => h('button', { class: 'mode', type: 'button', onclick: fn, disabled },
      icono(ico, 'mode-ico'),
      h('span', { class: 'mode-txt' }, h('strong', {}, titulo), h('span', { class: 'muted small' }, desc)),
      h('span', { class: 'mode-meta' }, meta), icono('flecha', 'mode-arrow'));

    nodos.push(h('section', { class: 'card' },
      h('div', { class: 'spread' }, h('h2', {}, `CAP ${t.nombre}`), h('span', { class: 'pill' }, `${nOblig.toLocaleString('es-ES')} preguntas`)),
      h('div', { class: 'modes' },
        modo('examen', 'Simulacro de examen', `Secciones ${t.obligatorias.join('ª y ')}ª · corrección al final`, '100 · 120 min',
          () => pantallaConfig({ tipo, clase: 'examen' })),
        modo('ampliacion', 'Examen de ampliación', `Solo sección ${t.especifica}ª (${nEsp.toLocaleString('es-ES')} preguntas)`, '25 preguntas',
          () => pantallaConfig({ tipo, clase: 'ampliacion' })),
        modo('temas', 'Practicar por temas', 'Elige objetivos y ve la solución al momento', 'Libre',
          () => pantallaTemas(tipo)),
        modo('repaso', 'Repasar falladas', nFall ? 'Las que fallaste la última vez' : 'Aún no tienes falladas', String(nFall),
          () => pantallaConfig({ tipo, clase: 'falladas' }), !nFall))));
  }

  nodos.push(tarjetaInstalar());
  render(...nodos);
}

function tarjetaInstalar() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  let incrustada = false;
  try { incrustada = window.self !== window.top; } catch { incrustada = true; }
  if (standalone || incrustada || window.Capacitor) return null;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /android/i.test(navigator.userAgent);
  return h('section', { class: 'card card-soft' },
    h('h2', {}, 'Instala la app'),
    android ? h('p', { class: 'small' }, h('a', { class: 'btn', href: 'dist/test-cap.apk', download: 'test-cap.apk' }, 'Descargar la app para Android (APK)')) : null,
    ios
      ? h('p', { class: 'small' }, 'En Safari, pulsa Compartir y después "Añadir a pantalla de inicio".')
      : installPrompt
        ? h('button', {
          class: 'btn primary', type: 'button',
          onclick: async () => { installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; pantallaInicio(); },
        }, 'Instalar en este dispositivo')
        : h('p', { class: 'small' }, 'En Chrome o Edge: menú ⋮ → "Instalar aplicación".'),
    h('p', { class: 'muted small' }, 'Instalada funciona sin conexión.'));
}

/* ---------- configuración del test ---------- */

function pantallaTemas(tipo) {
  const t = TIPOS[tipo];
  const grupos = [['Formación obligatoria', 'Cuenta para el examen', objetivosDe(t.obligatorias)],
    ['Formación complementaria', 'No entra en el examen', objetivosDe(t.complementarias)]];
  const checks = [];
  render(
    h('div', { class: 'page-head' },
      h('p', { class: 'eyebrow' }, `CAP ${t.nombre}`), h('h1', {}, 'Practicar por temas')),
    h('div', { class: 'row' },
      h('button', { class: 'btn', type: 'button', onclick: () => checks.forEach(c => { c.checked = true; }) }, 'Marcar todos'),
      h('button', { class: 'btn', type: 'button', onclick: () => checks.forEach(c => { c.checked = false; }) }, 'Ninguno')),
    grupos.map(([titulo, sub, objs]) => h('section', { class: 'card' },
      h('div', { class: 'spread' }, h('h2', {}, titulo), h('span', { class: 'muted small' }, sub)),
      objs.map(o => {
        const cb = h('input', { type: 'checkbox', value: o.id, id: 'obj-' + o.id });
        checks.push(cb);
        return h('label', { class: 'check' }, cb,
          h('span', { class: 'check-txt' }, h('span', { class: 'obj-id' }, o.id), h('span', {}, o.titulo)),
          h('span', { class: 'muted small nowrap' }, `${o.n}`));
      }))),
    h('div', { class: 'row end sticky-actions' },
      h('button', { class: 'btn', type: 'button', onclick: pantallaInicio }, 'Volver'),
      h('button', {
        class: 'btn primary', type: 'button',
        onclick: () => {
          const ids = checks.filter(c => c.checked).map(c => c.value);
          if (!ids.length) return toast('Elige al menos un tema.');
          pantallaConfig({ tipo, clase: 'temas', objetivos: ids });
        },
      }, 'Continuar')));
}

function pantallaConfig({ tipo, clase, objetivos }) {
  const t = TIPOS[tipo];
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
  const pt = { ...PUNTUACION_DEFECTO, ...prefs().puntuacion };
  const num = (id, label, value, attrs = {}) => h('label', { class: 'field' }, h('span', { class: 'field-label' }, label),
    h('span', { class: 'field-input' }, h('input', { id, type: 'number', inputmode: 'decimal', value, ...attrs })));

  render(
    h('div', { class: 'page-head' },
      h('p', { class: 'eyebrow' }, MODOS[clase]), h('h1', {}, titulo),
      h('p', { class: 'muted' }, `${pool.length.toLocaleString('es-ES')} preguntas disponibles`)),
    h('section', { class: 'card' },
      h('h2', {}, 'Test'),
      h('div', { class: 'grid2' },
        num('c-n', 'Número de preguntas', Math.min(defN, pool.length), { min: 1, max: pool.length, step: 1 }),
        num('c-min', 'Tiempo en minutos (0 = sin límite)', defMin, { min: 0, max: 600, step: 1 }),
        h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Corrección'),
          h('span', { class: 'field-input' }, h('select', { id: 'c-fb' },
            h('option', { value: 'final', selected: defFeedback === 'final' }, 'Al final, como en el examen'),
            h('option', { value: 'inmediato', selected: defFeedback === 'inmediato' }, 'Al responder cada pregunta')))))),
    h('section', { class: 'card' },
      h('h2', {}, 'Puntuación'),
      h('div', { class: 'grid4' },
        num('c-ok', 'Acierto', pt.correcta, { step: 0.05 }),
        num('c-ko', 'Fallo', pt.incorrecta, { step: 0.05 }),
        num('c-bl', 'En blanco', pt.blanco, { step: 0.05 }),
        num('c-ap', '% para aprobar', pt.aprobado, { min: 0, max: 100, step: 1 })),
      h('p', { class: 'muted small' }, 'Ajusta los criterios a los de tu convocatoria.')),
    h('div', { class: 'row end' },
      h('button', { class: 'btn', type: 'button', onclick: () => (clase === 'temas' ? pantallaTemas(tipo) : pantallaInicio()) }, 'Volver'),
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
            titulo, tipo, clase, ids: shuffle(pool).slice(0, Math.min(n, pool.length)).map(q => q.c),
            minutos: min, feedback: document.getElementById('c-fb').value, puntuacion: punt,
          });
        },
      }, 'Empezar test')));
}

/* ---------- test ---------- */

function empezarTest({ titulo, tipo, clase, ids, minutos, feedback, puntuacion }) {
  session = {
    id: uuid(), titulo, tipo, clase, ids, feedback, puntuacion,
    respuestas: {}, idx: 0, terminado: false, inicio: Date.now(),
    finEn: minutos > 0 ? Date.now() + minutos * 60000 : null, versionBanco: banco.version,
  };
  guardarSesion();
  pantallaTest();
}
function guardarSesion() { if (session) lsSet(LS.session(), session); }
function pararTimer() { clearInterval(timerId); timerId = null; document.getElementById('timer').classList.add('hidden'); }
function arrancarTimer() {
  const el = document.getElementById('timer');
  if (!session.finEn) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  const tick = () => {
    const resta = Math.max(0, Math.round((session.finEn - Date.now()) / 1000));
    el.textContent = `${Math.floor(resta / 60)}:${String(resta % 60).padStart(2, '0')}`;
    el.classList.toggle('crit', resta <= 300);
    el.classList.toggle('warn', resta > 300 && resta <= 900);
    if (resta <= 0) { toast('Se acabó el tiempo.'); terminarTest(); }
  };
  clearInterval(timerId);
  tick();
  timerId = setInterval(tick, 1000);
}

function pantallaTest() {
  if (session.finEn && Date.now() >= session.finEn) return terminarTest();
  session.ids = session.ids.filter(c => porCodigo.has(c));
  if (!session.ids.length) { lsDel(LS.session()); toast('Las preguntas de ese test ya no están en el banco.'); return pantallaInicio(); }
  session.idx = Math.min(session.idx, session.ids.length - 1);
  if (!timerId) arrancarTimer();

  const c = session.ids[session.idx];
  const q = porCodigo.get(c);
  const elegida = session.respuestas[c];
  const mostrar = session.feedback === 'inmediato' && elegida;
  const obj = banco.objetivos.find(o => o.id === q.o);
  const total = session.ids.length;
  const respondidas = Object.keys(session.respuestas).length;
  const ir = i => { session.idx = i; guardarSesion(); pantallaTest(); };

  const opciones = q.a.map((texto, i) => {
    const L = letra(i);
    let cls = 'option';
    if (mostrar) { if (L === q.r) cls += ' correct'; else if (L === elegida) cls += ' wrong'; } else if (L === elegida) cls += ' selected';
    return h('button', {
      class: cls, type: 'button', disabled: mostrar, 'aria-pressed': String(L === elegida),
      onclick: () => {
        if (elegida === L && session.feedback === 'final') delete session.respuestas[c];
        else session.respuestas[c] = L;
        guardarSesion();
        pantallaTest();
      },
    }, h('span', { class: 'letter' }, L), h('span', { class: 'option-txt' }, texto));
  });
  const ultima = session.idx === total - 1;

  render(
    h('div', { class: 'test-head' },
      h('div', {}, h('p', { class: 'eyebrow' }, MODOS[session.clase]), h('strong', {}, session.titulo)),
      h('span', { class: 'muted small' }, `${respondidas}/${total} respondidas`)),
    h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': total, 'aria-valuenow': session.idx + 1 },
      h('div', { style: `width:${((session.idx + 1) / total) * 100}%` })),
    h('section', { class: 'card question-card' },
      h('div', { class: 'q-meta' },
        h('span', { class: 'q-num' }, `Pregunta ${session.idx + 1}`, h('span', { class: 'muted' }, ` / ${total}`)),
        h('span', { class: 'badges' },
          h('span', { class: 'badge', title: obj ? obj.titulo : '' }, `Objetivo ${q.o}`),
          h('span', { class: 'badge' }, `COD ${q.c}`))),
      h('p', { class: 'question' }, q.p),
      h('div', { class: 'options' }, opciones),
      mostrar ? h('div', { class: `feedback ${elegida === q.r ? 'ok' : 'bad'}` },
        h('strong', {}, elegida === q.r ? 'Correcta' : `Incorrecta · la buena es la ${q.r}`),
        q.n ? h('span', { class: 'small' }, `Norma: ${q.n}`) : null) : null,
      session.feedback === 'final' && elegida ? h('p', { class: 'muted small' }, 'Pulsa otra vez tu respuesta para dejarla en blanco.') : null),
    h('div', { class: 'row test-nav' },
      ultima ? null : h('button', { class: 'btn danger', type: 'button', onclick: confirmarTerminar }, 'Terminar test'),
      h('span', { class: 'grow' }),
      h('button', { class: 'btn', type: 'button', disabled: session.idx === 0, onclick: () => ir(session.idx - 1) }, 'Anterior'),
      ultima
        ? h('button', { class: 'btn primary', type: 'button', onclick: confirmarTerminar }, 'Terminar test')
        : h('button', { class: 'btn primary', type: 'button', onclick: () => ir(session.idx + 1) }, elegida ? 'Siguiente' : 'Saltar')));
}

async function confirmarTerminar() {
  const sin = session.ids.length - Object.keys(session.respuestas).length;
  if (sin > 0 && !(await confirmar(`Te quedan ${sin} preguntas sin responder. ¿Terminar el test?`, 'Terminar'))) return;
  terminarTest();
}

function calcular(ses) {
  const pt = ses.puntuacion;
  let ok = 0, ko = 0, blanco = 0;
  for (const c of ses.ids) {
    const r = ses.respuestas[c];
    if (!r) blanco++; else if (r === porCodigo.get(c).r) ok++; else ko++;
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
    const r = calcular(session);
    encolarResultado({
      tipo: session.tipo, modo: session.clase, preguntas: session.ids.length,
      correctas: r.ok, falladas: r.ko, blanco: r.blanco,
      puntos: Math.round(r.puntos * 100) / 100, porcentaje: Math.round(Math.max(-9999, r.pct) * 100) / 100,
      aprobado: r.aprobado, duracion_seg: Math.round((session.fin - session.inicio) / 1000),
      version_banco: session.versionBanco || banco.version, id_cliente: session.id || uuid(),
    });
  }
  pantallaResultado();
}

function pantallaResultado() {
  const r = calcular(session);
  const minutos = Math.round(((session.fin || Date.now()) - session.inicio) / 60000);
  const stat = (num, label, cls = '') => h('div', { class: 'stat ' + cls }, h('div', { class: 'stat-num' }, num), h('div', { class: 'stat-label' }, label));
  render(
    h('div', { class: 'page-head' }, h('p', { class: 'eyebrow' }, MODOS[session.clase]), h('h1', {}, 'Resultado'),
      h('p', { class: 'muted' }, session.titulo)),
    h('section', { class: `result ${r.aprobado ? 'ok' : 'bad'}` },
      h('div', { class: 'result-score' }, `${fmt(r.pct)}%`),
      h('div', {},
        h('div', { class: 'result-label' }, r.aprobado ? 'Aprobado' : 'No aprobado'),
        h('div', { class: 'small' }, `${fmt(r.puntos)} de ${fmt(r.max)} puntos · mínimo ${fmt(session.puntuacion.aprobado)}%`))),
    h('section', { class: 'stats' },
      stat(r.ok, `Correctas · ${fmt(r.ok * session.puntuacion.correcta)} pts`, 'ok'),
      stat(r.ko, `Falladas · ${fmt(r.ko * session.puntuacion.incorrecta)} pts`, 'bad'),
      stat(r.blanco, `En blanco · ${fmt(r.blanco * session.puntuacion.blanco)} pts`),
      stat(`${minutos} min`, 'Tiempo empleado')),
    h('p', { class: 'muted small' }, 'El resultado se guarda en tu historial.'),
    h('div', { class: 'row end' },
      h('button', { class: 'btn', type: 'button', onclick: () => { lsDel(LS.session()); session = null; pantallaInicio(); } }, 'Inicio'),
      h('button', { class: 'btn primary', type: 'button', onclick: () => pantallaRevision('ko') }, 'Revisar respuestas')));
}

function pantallaRevision(filtro) {
  const filtros = { ko: 'Falladas', blanco: 'En blanco', ok: 'Correctas', todas: 'Todas' };
  const items = session.ids.map((c, i) => ({ i, q: porCodigo.get(c), r: session.respuestas[c] }))
    .filter(({ q, r }) => filtro === 'todas' || (filtro === 'ok' && r === q.r) || (filtro === 'ko' && r && r !== q.r) || (filtro === 'blanco' && !r));
  render(
    h('div', { class: 'page-head' }, h('h1', {}, 'Revisión')),
    h('div', { class: 'tabs', role: 'tablist' },
      Object.entries(filtros).map(([k, v]) => h('button', {
        type: 'button', role: 'tab', 'aria-selected': String(k === filtro), onclick: () => pantallaRevision(k),
      }, v))),
    items.length ? null : h('p', { class: 'empty' }, 'No hay preguntas en este grupo.'),
    items.map(({ i, q, r }) => h('section', { class: 'card question-card' },
      h('div', { class: 'q-meta' },
        h('span', { class: 'q-num' }, `Pregunta ${i + 1}`),
        h('span', { class: 'badges' }, h('span', { class: 'badge' }, `Objetivo ${q.o}`), h('span', { class: 'badge' }, `COD ${q.c}`))),
      h('p', { class: 'question' }, q.p),
      h('div', { class: 'options' }, q.a.map((t, j) => {
        const L = letra(j);
        const cls = L === q.r ? 'option correct' : (L === r ? 'option wrong' : 'option');
        return h('div', { class: cls }, h('span', { class: 'letter' }, L), h('span', { class: 'option-txt' }, t));
      })),
      h('div', { class: `feedback ${!r ? '' : r === q.r ? 'ok' : 'bad'}` },
        h('strong', {}, !r ? `En blanco · correcta: ${q.r}` : r === q.r ? 'Correcta' : `Respondiste ${r} · correcta: ${q.r}`),
        q.n ? h('span', { class: 'small' }, `Norma: ${q.n}`) : null))),
    h('div', { class: 'row end' },
      h('button', { class: 'btn', type: 'button', onclick: pantallaResultado }, 'Resultado'),
      h('button', { class: 'btn primary', type: 'button', onclick: () => { lsDel(LS.session()); session = null; pantallaInicio(); } }, 'Inicio')));
}

/* ---------- historial ---------- */

function tablaResultados(filas, conUsuario = false) {
  if (!filas.length) return h('p', { class: 'empty' }, 'Todavía no hay tests terminados.');
  return h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
    h('thead', {}, h('tr', {},
      h('th', {}, 'Fecha'), conUsuario ? h('th', {}, 'Usuario') : null, h('th', {}, 'Test'),
      h('th', { class: 'num' }, 'Nota'), h('th', { class: 'num' }, 'Aciertos'), h('th', {}, 'Resultado'))),
    h('tbody', {}, filas.map(f => h('tr', {},
      h('td', { class: 'nowrap' }, fechaES(f.creado, true)),
      conUsuario ? h('td', {}, f.perfiles ? (f.perfiles.nombre || f.perfiles.email) : '—') : null,
      h('td', {}, `${MODOS[f.modo] || f.modo} · ${TIPOS[f.tipo] ? TIPOS[f.tipo].nombre : f.tipo}`),
      h('td', { class: 'num' }, `${fmt(Number(f.porcentaje))}%`),
      h('td', { class: 'num' }, `${f.correctas}/${f.preguntas}`),
      h('td', {}, h('span', { class: 'pill ' + (f.aprobado ? 'pill-ok' : 'pill-bad') }, f.aprobado ? 'Aprobado' : 'Suspenso')))))));
}

async function pantallaHistorial() {
  const pendientes = lsGet(LS.cola(), []).length;
  const cont = h('div', {}, h('p', { class: 'muted' }, 'Cargando…'));
  render(
    h('div', { class: 'page-head' }, h('p', { class: 'eyebrow' }, 'Tu progreso'), h('h1', {}, 'Mi historial')),
    pendientes ? aviso('info', `${pendientes} resultado(s) pendientes de enviar. Se guardarán al recuperar la conexión.`) : null,
    h('section', { class: 'card' }, cont));
  const { data, error } = await sb.from('resultados')
    .select('creado, tipo, modo, preguntas, correctas, falladas, blanco, porcentaje, aprobado')
    .eq('user_id', usuario.id).order('creado', { ascending: false }).limit(100);
  if (error) { cont.replaceChildren(aviso('error', traducirError(error))); return; }
  const ex = data.filter(f => f.modo === 'examen');
  const resumen = h('div', { class: 'stats' },
    h('div', { class: 'stat' }, h('div', { class: 'stat-num' }, data.length), h('div', { class: 'stat-label' }, 'Tests (últimos 100)')),
    h('div', { class: 'stat' }, h('div', { class: 'stat-num' }, ex.length), h('div', { class: 'stat-label' }, 'Simulacros')),
    h('div', { class: 'stat ok' }, h('div', { class: 'stat-num' }, ex.length ? `${fmt(100 * ex.filter(f => f.aprobado).length / ex.length)}%` : '—'),
      h('div', { class: 'stat-label' }, 'Simulacros aprobados')),
    h('div', { class: 'stat' }, h('div', { class: 'stat-num' }, ex.length ? `${fmt(ex.reduce((s, f) => s + Number(f.porcentaje), 0) / ex.length)}%` : '—'),
      h('div', { class: 'stat-label' }, 'Nota media en simulacros')));
  cont.replaceChildren(resumen, tablaResultados(data));
}

/* ---------- mi cuenta ---------- */

function pantallaPerfil() {
  const zona1 = h('div'), zona2 = h('div');
  const btn1 = h('button', { class: 'btn primary', type: 'submit' }, 'Guardar nombre');
  const f1 = h('form', {
    class: 'form', novalidate: true,
    onsubmit: async e => {
      e.preventDefault();
      const nombre = f1.nombre.value.trim().slice(0, 80);
      if (!nombre) { zona1.replaceChildren(aviso('error', 'Escribe tu nombre.')); return; }
      botonCargando(btn1, true);
      const { error } = await sb.from('perfiles').update({ nombre }).eq('id', usuario.id);
      botonCargando(btn1, false);
      if (error) { zona1.replaceChildren(aviso('error', traducirError(error))); return; }
      perfil.nombre = nombre; lsSet(LS.perfil(), perfil); pintarCabecera();
      zona1.replaceChildren(aviso('ok', 'Nombre guardado.'));
    },
  }, zona1, campo('nombre', 'Nombre', { type: 'text', value: perfil.nombre || '', maxlength: 80, autocomplete: 'name' }), h('div', { class: 'row end' }, btn1));

  const btn2 = h('button', { class: 'btn primary', type: 'submit' }, 'Cambiar contraseña');
  const f2 = h('form', {
    class: 'form', novalidate: true,
    onsubmit: async e => {
      e.preventDefault();
      const pass = f2.password.value;
      const err = claveSegura(pass) || (pass !== f2.password2.value ? 'Las contraseñas no coinciden.' : null);
      if (err) { zona2.replaceChildren(aviso('error', err)); return; }
      botonCargando(btn2, true);
      const { error } = await sb.auth.updateUser({ password: pass });
      botonCargando(btn2, false);
      if (error) { zona2.replaceChildren(aviso('error', traducirError(error))); return; }
      f2.reset();
      zona2.replaceChildren(aviso('ok', 'Contraseña cambiada.'));
    },
  }, zona2,
  campo('password', 'Nueva contraseña', { type: 'password', autocomplete: 'new-password' }),
  campo('password2', 'Repite la contraseña', { type: 'password', autocomplete: 'new-password' }),
  h('div', { class: 'row end' }, btn2));

  render(
    h('div', { class: 'page-head' }, h('p', { class: 'eyebrow' }, 'Cuenta'), h('h1', {}, 'Mi cuenta'),
      h('p', { class: 'muted' }, usuario.email, perfil.rol === 'admin' ? ' · Administrador' : '')),
    h('section', { class: 'card' }, h('h2', {}, 'Datos'), f1),
    h('section', { class: 'card' }, h('h2', {}, 'Contraseña'), f2),
    h('section', { class: 'card' }, h('h2', {}, 'Sesión'),
      h('p', { class: 'muted small' }, 'Cierra la sesión en este dispositivo.'),
      h('button', { class: 'btn danger', type: 'button', onclick: cerrarSesion }, 'Cerrar sesión')));
}

/* ---------- administración ---------- */

const llamarAdmin = body => llamarFuncion('admin-usuarios', body);

function pantallaAdmin(pestana = 'resumen') {
  if (!perfil || perfil.rol !== 'admin') return pantallaInicio();
  const tabs = { resumen: ['grafico', 'Resumen'], usuarios: ['usuarios', 'Usuarios'], resultados: ['historial', 'Resultados'], banco: ['banco', 'Banco de preguntas'] };
  const cont = h('div');
  render(
    h('div', { class: 'page-head' }, h('p', { class: 'eyebrow' }, 'Administración'), h('h1', {}, tabs[pestana][1])),
    h('div', { class: 'tabs', role: 'tablist' }, Object.entries(tabs).map(([k, [ico, txt]]) =>
      h('button', { type: 'button', role: 'tab', 'aria-selected': String(k === pestana), onclick: () => pantallaAdmin(k) }, icono(ico), txt))),
    cont);
  ({ resumen: adminResumen, usuarios: adminUsuarios, resultados: adminResultados, banco: adminBanco })[pestana](cont);
}

async function adminResumen(cont) {
  cont.replaceChildren(h('p', { class: 'muted' }, 'Cargando…'));
  const { data, error } = await sb.rpc('estadisticas_admin');
  if (error) { cont.replaceChildren(aviso('error', traducirError(error))); return; }
  const s = data || {};
  const stat = (n, l, cls = '') => h('div', { class: 'stat ' + cls }, h('div', { class: 'stat-num' }, (n ?? '—').toLocaleString('es-ES')), h('div', { class: 'stat-label' }, l));
  cont.replaceChildren(
    h('section', { class: 'stats' },
      stat(s.usuarios, 'Usuarios registrados'), stat(s.usuarios_activos, 'Cuentas activas', 'ok'),
      stat(s.nuevos_7d, 'Nuevos esta semana'), stat(s.activos_7d, 'Han hecho tests esta semana'),
      stat(s.tests_total, 'Tests terminados'), stat(s.tests_7d, 'Tests esta semana'),
      stat(s.aprobados_pct == null ? '—' : `${fmt(s.aprobados_pct)}%`, 'Simulacros aprobados'), stat(s.admins, 'Administradores')));
}

async function adminUsuarios(cont, { q = '', pagina = 0 } = {}) {
  const POR_PAGINA = 25;
  const buscar = h('input', { id: 'buscar-usuario', type: 'search', placeholder: 'Buscar por correo o nombre', value: q, autocomplete: 'off' });
  const lista = h('div', {}, h('p', { class: 'muted' }, 'Cargando…'));
  const invEmail = h('input', { id: 'inv-email', type: 'email', placeholder: 'correo@ejemplo.com', autocomplete: 'off' });
  const invNombre = h('input', { id: 'inv-nombre', type: 'text', placeholder: 'Nombre', maxlength: 80 });
  const btnInv = h('button', { class: 'btn', type: 'submit' }, 'Enviar invitación');
  cont.replaceChildren(
    h('form', {
      class: 'toolbar', onsubmit: e => { e.preventDefault(); adminUsuarios(cont, { q: buscar.value.trim(), pagina: 0 }); },
    }, h('span', { class: 'field-input grow' }, buscar), h('button', { class: 'btn primary', type: 'submit' }, 'Buscar')),
    h('section', { class: 'card' }, lista),
    h('section', { class: 'card' }, h('h2', {}, 'Invitar a un usuario'),
      h('p', { class: 'muted small' }, 'Le llega un correo para crear su contraseña.'),
      h('form', {
        class: 'toolbar', onsubmit: async e => {
          e.preventDefault();
          const email = invEmail.value.trim().toLowerCase();
          if (!correoValido(email)) return toast('Escribe un correo válido.');
          botonCargando(btnInv, true, 'Enviando…');
          try { await llamarAdmin({ accion: 'invitar', email, nombre: invNombre.value.trim(), redirectTo: redirectApp() }); toast(`Invitación enviada a ${email}.`); invEmail.value = ''; invNombre.value = ''; }
          catch (err) { toast(traducirError(err)); }
          botonCargando(btnInv, false);
        },
      }, h('span', { class: 'field-input grow' }, invEmail), h('span', { class: 'field-input grow' }, invNombre), btnInv)));

  let consulta = sb.from('perfiles').select('id, email, nombre, rol, activo, creado, ultimo_acceso', { count: 'exact' })
    .order('creado', { ascending: false }).range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1);
  const limpio = q.replace(/[%,()*\\]/g, ' ').trim();
  if (limpio) consulta = consulta.or(`email.ilike.%${limpio}%,nombre.ilike.%${limpio}%`);
  const { data, error, count } = await consulta;
  if (error) { lista.replaceChildren(aviso('error', traducirError(error))); return; }

  const accion = async (texto, body, peligro = false) => {
    if (!(await confirmar(texto, 'Confirmar', 'Cancelar', peligro))) return;
    try { await llamarAdmin(body); toast('Hecho.'); adminUsuarios(cont, { q, pagina }); } catch (e) { toast(traducirError(e)); }
  };
  const filas = data.map(u => {
    const yo = u.id === usuario.id;
    return h('div', { class: 'user-row' + (u.activo ? '' : ' inactive') },
      h('div', { class: 'user-avatar' }, (u.nombre || u.email).slice(0, 1).toUpperCase()),
      h('div', { class: 'user-main' },
        h('div', { class: 'user-name' }, u.nombre || 'Sin nombre', yo ? h('span', { class: 'muted small' }, ' (tú)') : null),
        h('div', { class: 'muted small ellipsis' }, u.email),
        h('div', { class: 'muted small' }, `Alta ${fechaES(u.creado)} · último acceso ${fechaES(u.ultimo_acceso)}`)),
      h('div', { class: 'user-tags' },
        h('span', { class: 'pill ' + (u.rol === 'admin' ? 'pill-admin' : '') }, u.rol === 'admin' ? 'Admin' : 'Usuario'),
        h('span', { class: 'pill ' + (u.activo ? 'pill-ok' : 'pill-bad') }, u.activo ? 'Activo' : 'Desactivado')),
      h('div', { class: 'user-actions' },
        h('button', {
          class: 'btn sm', type: 'button', disabled: yo,
          onclick: () => accion(u.rol === 'admin' ? `¿Quitar el rol de administrador a ${u.email}?` : `¿Hacer administrador a ${u.email}? Podrá gestionar usuarios.`,
            { accion: 'rol', id: u.id, rol: u.rol === 'admin' ? 'usuario' : 'admin' }),
        }, u.rol === 'admin' ? 'Quitar admin' : 'Hacer admin'),
        h('button', {
          class: 'btn sm', type: 'button', disabled: yo,
          onclick: () => accion(u.activo ? `¿Desactivar a ${u.email}? No podrá iniciar sesión.` : `¿Reactivar a ${u.email}?`,
            { accion: 'activo', id: u.id, activo: !u.activo }, u.activo),
        }, u.activo ? 'Desactivar' : 'Activar'),
        h('button', {
          class: 'btn sm', type: 'button',
          onclick: async () => {
            if (!(await confirmar(`¿Enviar a ${u.email} un enlace para cambiar la contraseña?`, 'Enviar'))) return;
            const { error: e2 } = await sb.auth.resetPasswordForEmail(u.email, { redirectTo: redirectApp() });
            toast(e2 ? traducirError(e2) : 'Enlace enviado.');
          },
        }, 'Enviar recuperación'),
        h('button', {
          class: 'btn sm danger', type: 'button', disabled: yo || u.rol === 'admin',
          onclick: () => accion(`¿Eliminar la cuenta de ${u.email} y todos sus resultados? No se puede deshacer.`, { accion: 'eliminar', id: u.id }, true),
        }, 'Eliminar')));
  });
  const paginas = Math.max(1, Math.ceil((count || 0) / POR_PAGINA));
  lista.replaceChildren(
    h('div', { class: 'spread' }, h('h2', {}, `${(count || 0).toLocaleString('es-ES')} usuarios`), h('span', { class: 'muted small' }, `Página ${pagina + 1} de ${paginas}`)),
    ...(filas.length ? filas : [h('p', { class: 'empty' }, 'No hay usuarios con esa búsqueda.')]),
    h('div', { class: 'row end' },
      h('button', { class: 'btn', type: 'button', disabled: pagina === 0, onclick: () => adminUsuarios(cont, { q, pagina: pagina - 1 }) }, 'Anterior'),
      h('button', { class: 'btn', type: 'button', disabled: pagina + 1 >= paginas, onclick: () => adminUsuarios(cont, { q, pagina: pagina + 1 }) }, 'Siguiente')));
}

async function adminResultados(cont) {
  cont.replaceChildren(h('p', { class: 'muted' }, 'Cargando…'));
  const { data, error } = await sb.from('resultados')
    .select('creado, tipo, modo, preguntas, correctas, porcentaje, aprobado, perfiles(nombre, email)')
    .order('creado', { ascending: false }).limit(100);
  if (error) { cont.replaceChildren(aviso('error', traducirError(error))); return; }
  cont.replaceChildren(h('section', { class: 'card' }, h('h2', {}, 'Últimos 100 tests'), tablaResultados(data, true)));
}

function pedirTexto(mensaje, esperado) {
  return new Promise(resolve => {
    const input = h('input', { id: 'confirmar-texto', type: 'text', autocomplete: 'off', placeholder: esperado });
    const cerrar = v => { capa.remove(); resolve(v); };
    const capa = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
      h('div', { class: 'card modal-card' },
        h('p', {}, mensaje),
        h('label', { class: 'field' }, h('span', { class: 'field-label' }, `Escribe ${esperado} para confirmar`), h('span', { class: 'field-input' }, input)),
        h('div', { class: 'row end' },
          h('button', { class: 'btn', type: 'button', onclick: () => cerrar(false) }, 'Cancelar'),
          h('button', { class: 'btn danger-solid', type: 'button', onclick: () => cerrar(input.value.trim().toUpperCase() === esperado) }, 'Publicar'))));
    document.body.append(capa);
    input.focus();
  });
}

function archivoBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

async function llamarFuncion(nombre, body) {
  const { data, error } = await sb.functions.invoke(nombre, { body });
  if (error) {
    let msg = error.message;
    try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch { /* sin cuerpo */ }
    throw new Error(msg);
  }
  return data;
}

const ESTADO_VERSION = { publicada: ['pill-ok', 'Publicada'], publicando: ['pill-admin', 'Publicando…'], fallida: ['pill-bad', 'Fallida'] };

let sondeoBanco = null;
async function adminBanco(cont) {
  clearTimeout(sondeoBanco);
  const zonaCandidato = h('div');
  const zonaVersiones = h('div', {}, h('p', { class: 'muted' }, 'Cargando versiones…'));
  const input = h('input', {
    type: 'file', accept: '.zip,application/zip', class: 'hidden',
    onchange: async e => {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      zonaCandidato.replaceChildren(h('section', { class: 'card' }, h('p', { class: 'muted' }, `Leyendo y validando ${f.name}…`)));
      try { mostrarCandidato(f, await leerZip(f)); }
      catch (err) { zonaCandidato.replaceChildren(h('section', { class: 'card' }, aviso('error', 'No se puede publicar: ' + err.message))); }
    },
  });

  function mostrarCandidato(file, nuevo) {
    const diff = compararBancos(banco, nuevo);
    const riesgo = (diff.eliminadas + diff.cambiaRespuesta) / Math.max(1, banco.total);
    const igual = nuevo.version === banco.version;
    const fila = (t, v, cls = '') => h('tr', {}, h('td', {}, t), h('td', { class: 'num ' + cls }, v.toLocaleString('es-ES')));
    const btnPub = h('button', { class: 'btn primary', type: 'button', disabled: igual }, 'Publicar para todos');
    btnPub.addEventListener('click', async () => {
      const ok = riesgo > 0.10
        ? await pedirTexto(`Este banco elimina o cambia la respuesta de ${diff.eliminadas + diff.cambiaRespuesta} preguntas (${fmt(riesgo * 100)} %). Es un cambio grande: revisa que el ZIP sea el correcto.`, 'PUBLICAR')
        : await confirmar(`¿Publicar este banco (${nuevo.total.toLocaleString('es-ES')} preguntas) para todos los usuarios?`, 'Publicar');
      if (!ok) return;
      botonCargando(btnPub, true, 'Publicando…');
      try {
        await llamarFuncion('publicar-banco', {
          accion: 'publicar', zip: await archivoBase64(file), version: nuevo.version,
          total: nuevo.total, fechaFuente: nuevo.fechaFuente, cambios: diff,
        });
        toast('Banco enviado. GitHub lo publicará en unos minutos.', 6000);
        zonaCandidato.replaceChildren();
        cargarVersiones();
      } catch (err) { toast(err.message, 8000); botonCargando(btnPub, false); }
    });
    zonaCandidato.replaceChildren(h('section', { class: 'card card-accent' },
      h('div', { class: 'spread' }, h('h2', {}, 'ZIP validado'), h('span', { class: 'pill pill-ok' }, 'Sin errores')),
      h('p', { class: 'muted small' }, `${file.name} · fuente del ${fechaES(nuevo.fechaFuente)} · versión ${nuevo.version}`),
      igual ? aviso('info', 'Este ZIP tiene exactamente las mismas preguntas que el banco actual. No hay nada que publicar.') : null,
      riesgo > 0.10 ? aviso('error', `Atención: cambio grande (${fmt(riesgo * 100)} % de preguntas eliminadas o con otra respuesta).`) : null,
      h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('tbody', {},
        fila('Preguntas en el ZIP', nuevo.total),
        fila('Nuevas', diff.nuevas, diff.nuevas ? 'txt-ok' : ''),
        fila('Eliminadas', diff.eliminadas, diff.eliminadas ? 'txt-bad' : ''),
        fila('Con la respuesta cambiada', diff.cambiaRespuesta, diff.cambiaRespuesta ? 'txt-bad' : ''),
        fila('Con el texto corregido', diff.cambiaTexto)))),
      h('div', { class: 'row end' },
        h('button', { class: 'btn', type: 'button', onclick: () => zonaCandidato.replaceChildren() }, 'Cancelar'), btnPub)));
  }

  async function cargarVersiones() {
    clearTimeout(sondeoBanco);
    let { data, error } = await sb.from('banco_versiones')
      .select('id, version, archivo, fecha_fuente, total, cambios, estado, mensaje, creado, perfiles(nombre, email)')
      .order('creado', { ascending: false }).limit(20);
    if (error) { zonaVersiones.replaceChildren(aviso('error', traducirError(error))); return; }
    if (data.some(v => v.estado === 'publicando')) {
      try { await llamarFuncion('publicar-banco', { accion: 'comprobar' }); } catch { /* se reintenta */ }
      ({ data } = await sb.from('banco_versiones')
        .select('id, version, archivo, fecha_fuente, total, cambios, estado, mensaje, creado, perfiles(nombre, email)')
        .order('creado', { ascending: false }).limit(20));
    }
    const activa = data.find(v => v.estado === 'publicada');
    zonaVersiones.replaceChildren(
      h('div', { class: 'spread' }, h('h2', {}, 'Versiones publicadas'), h('span', { class: 'muted small' }, 'Las 20 últimas')),
      ...data.map(v => {
        const [cls, txt] = ESTADO_VERSION[v.estado] || ['', v.estado];
        const c = v.cambios || {};
        const resumen = c.restaurada_desde ? `Vuelta a la versión #${c.restaurada_desde}`
          : ('nuevas' in c) ? resumenCambios(c) : '';
        const esActiva = activa && v.id === activa.id;
        return h('div', { class: 'version-row' },
          h('div', { class: 'user-main' },
            h('div', { class: 'user-name' }, `#${v.id} · ${v.total.toLocaleString('es-ES')} preguntas`,
              esActiva ? h('span', { class: 'pill pill-ok', style: 'margin-left:8px' }, 'Activa') : null),
            h('div', { class: 'muted small' }, `Fuente del ${fechaES(v.fecha_fuente)} · versión `, h('span', { class: 'mono' }, v.version)),
            h('div', { class: 'muted small' }, `${fechaES(v.creado, true)}${v.perfiles ? ' · ' + (v.perfiles.nombre || v.perfiles.email) : ''}`),
            resumen ? h('div', { class: 'small' }, resumen) : null,
            v.mensaje ? h('div', { class: 'muted small' }, v.mensaje) : null),
          h('div', { class: 'user-tags' }, h('span', { class: 'pill ' + cls }, txt)),
          v.estado === 'publicada' && !esActiva && activa && v.version !== activa.version
            ? h('div', { class: 'user-actions' }, h('button', {
              class: 'btn sm', type: 'button',
              onclick: async () => {
                if (!(await confirmar(`¿Volver a la versión #${v.id} (${v.total} preguntas)? Todos los usuarios la recibirán en unos minutos.`, 'Volver a esta versión'))) return;
                try { await llamarFuncion('publicar-banco', { accion: 'activar', id: v.id }); toast('Enviado. GitHub la publicará en unos minutos.'); cargarVersiones(); }
                catch (err) { toast(err.message, 8000); }
              },
            }, 'Volver a esta versión')) : null);
      }));
    // Mientras haya una publicación en curso, se comprueba cada 30 s (solo con esta pantalla abierta).
    if (data.some(v => v.estado === 'publicando') && zonaVersiones.isConnected) {
      sondeoBanco = setTimeout(() => { if (zonaVersiones.isConnected) cargarVersiones(); }, 30000);
    }
  }

  const btnAct = h('button', {
    class: 'btn', type: 'button',
    onclick: async () => { botonCargando(btnAct, true, 'Buscando…'); await buscarActualizacion(); botonCargando(btnAct, false); adminBanco(cont); },
  }, 'Actualizar este dispositivo');

  cont.replaceChildren(
    h('section', { class: 'card' },
      h('h2', {}, 'Banco en este dispositivo'),
      h('div', { class: 'stats' },
        h('div', { class: 'stat' }, h('div', { class: 'stat-num' }, banco.total.toLocaleString('es-ES')), h('div', { class: 'stat-label' }, 'Preguntas')),
        h('div', { class: 'stat' }, h('div', { class: 'stat-num sm' }, fechaES(banco.fechaFuente)), h('div', { class: 'stat-label' }, 'Fecha de la fuente')),
        h('div', { class: 'stat' }, h('div', { class: 'stat-num sm mono' }, banco.version), h('div', { class: 'stat-label' }, 'Versión'))),
      h('div', { class: 'row' }, btnAct)),
    h('section', { class: 'card' },
      h('h2', {}, 'Publicar un banco nuevo'),
      h('ol', { class: 'steps' },
        h('li', {}, 'Descarga el ZIP de preguntas en .txt que publica el Ministerio.'),
        h('li', {}, 'Súbelo aquí: la app comprueba todas las preguntas y te enseña qué cambia.'),
        h('li', {}, 'Pulsa "Publicar para todos". En unos minutos todos los usuarios lo reciben al abrir la app.')),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', onclick: () => input.click() }, 'Subir ZIP'), input)),
    zonaCandidato,
    h('section', { class: 'card' }, zonaVersiones));
  cargarVersiones();
}

/* ---------- arranque ---------- */

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installPrompt = e;
  if (usuario && (!session || session.terminado)) pantallaInicio();
});

document.getElementById('btn-home').addEventListener('click', () => { if (usuario) irA(pantallaInicio); });

function errorFatal(titulo, texto) {
  render(h('div', { class: 'auth-form solo' }, h('div', { class: 'auth-card' }, h('h2', {}, titulo), h('p', {}, texto),
    h('button', { class: 'btn primary', type: 'button', onclick: () => location.reload() }, 'Reintentar'))));
}

async function init() {
  try {
    if (!window.Capacitor && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  } catch { /* sin modo offline */ }
  try { await cargarBanco(); } catch (e) { return errorFatal('No se pudo cargar el banco', e.message); }
  if (!window.supabase) return errorFatal('No se pudo iniciar', 'Falta la librería de cuentas. Recarga la página.');

  // Errores que vuelven en el enlace del correo (caducado, ya usado...)
  const params = new URLSearchParams(location.hash.slice(1));
  const errorEnlace = params.get('error_description');
  enRecuperacion = params.get('type') === 'recovery';

  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'cap-auth' },
  });
  sb.auth.onAuthStateChange((evento, s) => {
    if (evento === 'PASSWORD_RECOVERY') { enRecuperacion = true; setTimeout(pantallaNuevaClave, 0); }
    if (evento === 'SIGNED_OUT' && usuario) { usuario = null; perfil = null; setTimeout(() => pantallaLogin({ info: 'Tu sesión ha terminado.' }), 0); }
    if (evento === 'TOKEN_REFRESHED' && s && usuario) vaciarCola();
  });

  const { data } = await sb.auth.getSession();
  if (location.hash && /access_token|error/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
  if (enRecuperacion && data.session) { pantallaNuevaClave(); return; }
  if (data.session) await entrarConSesion(data.session);
  else pantallaLogin({ error: errorEnlace ? traducirError({ message: errorEnlace }) : null });
  buscarActualizacion({ silencioso: true });
}

document.addEventListener('DOMContentLoaded', init);
