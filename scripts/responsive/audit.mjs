// Auditoría responsive: recorre todas las rutas de la web (públicas, acceso, cliente y staff, más las pestañas de
// Configuración) a 375×812, 768×1024, 1024×768 y 1440×900, y busca problemas de layout.
//
// Por cada combinación ruta × ancho revisa:
//   - scroll horizontal de la página (`scrollWidth > clientWidth` del documento);
//   - elementos visibles fuera del viewport, o cortados por un contenedor con `overflow: hidden` (los contenedores con su
//     propio scroll horizontal están bien);
//   - botones, links (no en línea dentro de un texto) y controles de formulario con área menor a 32×32 px;
//   - texto cortado por `overflow` (recorte o puntos suspensivos), esté el texto en el elemento o en alguno de sus hijos;
//   - `ruta-inesperada`: la ruta respondió con estado >= 400, o terminó en otra URL que la pedida (salvo las que redirigen
//     por diseño);
//   - `error-overlay`: el diálogo de errores de Next quedó abierto en la página.
// Además, donde el botón "Abrir menú" está visible, abre el menú y revisa el panel abierto.
// Guarda una captura PNG de cada combinación en `tmp/responsive/` (ignorado por git) y sale con código 1 si hay hallazgos.
//
// Requisitos: API y web corriendo contra una base con los datos de `pnpm manual:demo-data` y Chromium de Playwright
// instalado (`pnpm exec playwright install chromium`).
//
// Variables de entorno:
//   MANUAL_STAFF_PASSWORD   (obligatoria) contraseña del staff de demostración
//   MANUAL_CLIENT_PASSWORD  (obligatoria) contraseña de los clientes de demostración
//   MANUAL_STAFF_EMAIL      (opcional) default staff@example.com
//   WEB_URL                 (obligatoria) URL de TU web local, por ejemplo http://localhost:3265
//   API_URL                 (obligatoria) URL de TU API local, por ejemplo http://localhost:3165/api
//   AUDIT_ONLY              (opcional) filtro por texto de la ruta (por ejemplo `/staff/turnos`) para repetir solo una parte
//   (WEB_URL y API_URL no tienen default a propósito: los puertos 3000 y 3001 son los de la app de desarrollo y el script
//   los rechaza. Tienen que ser locales: localhost, 127.0.0.1 o ::1. El script imprime el destino antes de empezar.)
//
// Cada ruta tiene que responder con un estado < 400 y quedarse en la URL pedida; si no, es un hallazgo `ruta-inesperada`
// (salvo las rutas con `expectRedirect`, que redirigen por diseño). El overlay de errores de Next también es un hallazgo.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

let WEB_URL = '';
let API_URL = '';
const STAFF_EMAIL = process.env.MANUAL_STAFF_EMAIL ?? 'staff@example.com';
const CLIENT_EMAIL = 'sofia.martinez@example.com';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = resolve(ROOT, 'tmp/responsive');
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const FORBIDDEN_PORTS = new Set(['3000', '3001']);
const MIN_TARGET = 32;
// Elementos del diálogo de error de Next 16 (next/dist/next-devtools/dev-overlay), dentro del shadow DOM de `nextjs-portal`.
const OVERLAY_SELECTOR = '[data-nextjs-dialog], [data-nextjs-dialog-overlay], [data-nextjs-error-overlay-nav], .nextjs__container_errors_wrapper';

const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
];

const CONFIG_TABS = ['planes', 'horarios', 'profesionales', 'reglas', 'contacto', 'calendario'];

function requireEnv(name, hint = '') {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}.${hint ? ` ${hint}` : ''}`);
  return value;
}

const TARGET_HINT = 'Definila con tu API y tu web locales (ver docs/responsive-audit.md, sección "Cómo se corre").';

function assertLocalTarget(name, value) {
  let host;
  try {
    host = new URL(value).hostname;
  } catch {
    throw new Error(`${name} no es una URL válida (por ejemplo http://localhost:3001/api).`);
  }
  if (!LOCAL_HOSTS.has(host.toLowerCase())) {
    throw new Error(`${name} no es local: la auditoría solo corre contra una API y una web locales.`);
  }
  const port = new URL(value).port;
  if (FORBIDDEN_PORTS.has(port)) {
    throw new Error(`${name} usa el puerto ${port}, que es el de la app de desarrollo: usá los puertos de tu propia API y web (ver docs/responsive-audit.md).`);
  }
}

async function login(browser, email, password) {
  const context = await browser.newContext({ locale: 'es-UY', timezoneId: 'America/Montevideo' });
  const response = await context.request.post(`${API_URL}/auth/sign-in/email`, {
    headers: { origin: WEB_URL },
    data: { email, password },
  });
  if (!response.ok()) throw new Error(`No se pudo ingresar con ${email} (${response.status()}).`);
  return context;
}

async function apiGet(context, path) {
  const response = await context.request.get(`${API_URL}${path}`, { headers: { origin: WEB_URL } });
  if (!response.ok()) throw new Error(`GET ${path} → ${response.status()}`);
  return response.json();
}

// Rutas del Frontend route map (más las pestañas de Configuración). Las que llevan parámetros usan un valor de ejemplo.
function buildRoutes({ planSlug, clientId }) {
  const anon = (path, options = {}) => ({ path, role: 'anon', ...options });
  const client = (path) => ({ path, role: 'client' });
  const staff = (path) => ({ path, role: 'staff' });
  return [
    anon('/'),
    anon('/performance'),
    anon('/rehab'),
    anon('/recovery'),
    anon('/planes'),
    anon('/planes?service=performance'),
    anon('/planes?service=recovery'),
    anon('/reservar'),
    anon('/checkout/resultado?ref=00000000-0000-4000-8000-000000000000'),
    anon('/checkout/resultado?debito=00000000-0000-4000-8000-000000000000'),
    anon('/checkout/simulado?ref=00000000-0000-4000-8000-000000000000'),
    anon('/checkout/simulado?debito=00000000-0000-4000-8000-000000000000'),
    anon('/ingresar'),
    anon('/registro'),
    anon('/recuperar'),
    anon('/restablecer?token=audit'),
    anon('/continuar'),
    client('/'),
    client('/perfil'),
    client('/historial'),
    client('/reservar/fisioterapia'),
    client(`/checkout/plan/${planSlug}`),
    client('/check-in'),
    staff('/'),
    staff('/staff'),
    staff('/staff/clientes'),
    staff('/staff/clientes/nuevo'),
    staff(`/staff/clientes/${clientId}`),
    staff('/staff/turnos'),
    staff('/staff/pagos'),
    staff('/staff/seguimiento'),
    staff('/staff/seguimiento?tipo=checkin'),
    staff('/staff/seguimiento/check-in'),
    ...CONFIG_TABS.map((tab) => staff(`/staff/configuracion?tab=${tab}`)),
  ];
}

// Se ejecuta dentro de la página: devuelve los hallazgos del DOM actual.
function collectFindings({ minTarget, overlaySelector }) {
  const vw = document.documentElement.clientWidth;
  const findings = [];
  const describe = (el) => {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const label = (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
    return `${tag}${id}${label ? ` “${label}”` : ''}`;
  };
  const isIgnored = (el) => Boolean(el.closest('nextjs-portal, [data-nextjs-toast], [data-nextjs-dev-tools-button]'));
  const isVisible = (el) => {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    for (let node = el.parentElement; node; node = node.parentElement) {
      const parentStyle = getComputedStyle(node);
      if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden') return false;
      // Un ancestro `sr-only` (1×1 px con recorte) esconde todo lo que lleva adentro.
      const parentRect = node.getBoundingClientRect();
      if (parentRect.width <= 1 && parentRect.height <= 1 && parentStyle.overflow !== 'visible') return false;
    }
    return true;
  };
  // Qué pasa con un elemento que se sale de su caja o del viewport, mirando sus contenedores de adentro hacia afuera:
  // 'scroll' = un contenedor con scroll horizontal propio lo alcanza; 'cut' = un contenedor con overflow hidden/clip lo
  // recorta y no se puede ver ni alcanzar; 'free' = nada lo contiene (sobresale de verdad).
  const containment = (el) => {
    const rect = el.getBoundingClientRect();
    for (let node = el.parentElement; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
      const overflowX = getComputedStyle(node).overflowX;
      if (overflowX === 'auto' || overflowX === 'scroll') return 'scroll';
      if (overflowX === 'hidden' || overflowX === 'clip') {
        const box = node.getBoundingClientRect();
        if (rect.right > box.right + 1 || rect.left < box.left - 1) return 'cut';
      }
    }
    return 'free';
  };
  const isOutsideViewport = (rect) => rect.right > vw + 1 || rect.left < -1;
  // Texto propio del elemento o de cualquiera de sus hijos visibles (un recorte sobre un <span> hijo también es texto cortado).
  const hasVisibleText = (el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.textContent.trim() === '') continue;
      if (node.parentElement === el || isVisible(node.parentElement)) return true;
    }
    return false;
  };
  // Un link está en una oración si su padre tiene texto propio además del link.
  const isInSentence = (el) =>
    [...(el.parentElement?.childNodes ?? [])].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '');

  // Overlay de errores de Next: el botón de herramientas siempre está; el diálogo de error, solo si la página falló.
  const overlay = document.querySelector('nextjs-portal')?.shadowRoot;
  if (overlay?.querySelector(overlaySelector)) {
    const message = overlay.querySelector('[data-nextjs-dialog-content], .nextjs__container_errors_desc')?.textContent ?? '';
    findings.push({ kind: 'error-overlay', detail: message.replace(/\s+/g, ' ').trim().slice(0, 120) || 'overlay de errores de Next abierto' });
  }

  const root = document.documentElement;
  if (root.scrollWidth > root.clientWidth) {
    findings.push({ kind: 'scroll-horizontal', detail: `scrollWidth ${root.scrollWidth} > clientWidth ${root.clientWidth}` });
  }

  const everything = [...document.body.querySelectorAll('*')].filter((el) => !isIgnored(el));

  for (const el of everything) {
    if (!isVisible(el)) continue;
    const rect = el.getBoundingClientRect();
    const state = containment(el);
    const hit = state === 'cut' || (state === 'free' && isOutsideViewport(rect));
    if (!hit) continue;
    // Solo se informa el elemento más externo que sobresale.
    const parent = el.parentElement;
    const parentHit =
      parent && parent !== document.body && parent !== document.documentElement &&
      (containment(parent) === 'cut' || (containment(parent) === 'free' && isOutsideViewport(parent.getBoundingClientRect())));
    if (parentHit) continue;
    const kind = state === 'cut' ? 'recortado-por-overflow' : 'fuera-del-viewport';
    findings.push({ kind, detail: `${describe(el)} (${Math.round(rect.left)}→${Math.round(rect.right)} de ${vw})` });
  }

  const clickable = everything.filter((el) => el.matches('button, a[href], [role="button"], [role="tab"], [role="menuitem"], summary, select, input:not([type="hidden"]), textarea'));
  for (const el of clickable) {
    if (!isVisible(el)) continue;
    const style = getComputedStyle(el);
    // Los links en línea dentro de una oración no tienen un área propia (excepción de WCAG 2.5.8); un link suelto, sí.
    if (el.matches('a') && style.display === 'inline' && isInSentence(el)) continue;
    // Un link "estirado" (su ::after absoluto cubre la fila o la tarjeta) se toca en toda esa área: el ::after tiene que medir
    // al menos lo mínimo táctil; un subrayado o un ícono decorativo no cuenta.
    if (el.matches('a')) {
      const after = getComputedStyle(el, '::after');
      const coversTarget = parseFloat(after.width) >= minTarget && parseFloat(after.height) >= minTarget;
      if (after.position === 'absolute' && after.content !== 'none' && coversTarget) continue;
    }
    // Un checkbox o radio nativo se toca por su etiqueta.
    const isChoice = el.matches('input[type="checkbox"], input[type="radio"]');
    const label = isChoice ? (el.closest('label') ?? (el.id ? document.querySelector(`label[for="${el.id}"]`) : null)) : null;
    const rect = (label ?? el).getBoundingClientRect();
    if (el.matches('.sr-only') || rect.width === 0 || rect.height === 0) continue;
    if (rect.width < minTarget || rect.height < minTarget) {
      findings.push({ kind: 'area-tactil', detail: `${describe(el)} ${Math.round(rect.width)}×${Math.round(rect.height)}` });
    }
  }

  for (const el of everything) {
    if (!isVisible(el)) continue;
    const style = getComputedStyle(el);
    const clipsX = style.overflowX === 'hidden' || style.overflowX === 'clip';
    const clipsY = style.overflowY === 'hidden' || style.overflowY === 'clip';
    if (!clipsX && !clipsY) continue;
    // El texto solo para lectores de pantalla (`sr-only`: 1×1 px con recorte) no se ve, no cuenta.
    if (el.clientWidth <= 1 && el.clientHeight <= 1) continue;
    if (!hasVisibleText(el)) continue;
    if (clipsX && el.scrollWidth > el.clientWidth + 1) {
      findings.push({ kind: 'texto-cortado', detail: `${describe(el)} (ancho ${el.clientWidth}, contenido ${el.scrollWidth})` });
    } else if (clipsY && el.scrollHeight > el.clientHeight + 1) {
      findings.push({ kind: 'texto-cortado', detail: `${describe(el)} (alto ${el.clientHeight}, contenido ${el.scrollHeight})` });
    }
  }
  return findings;
}

async function settle(page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
}

const slug = (route, width, suffix) =>
  `${route.role}${route.path.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'inicio'}__${width}${suffix}`.slice(0, 150);

// Una página que falla (estado >= 400) o que termina en otra URL que la pedida (sesión vencida → /ingresar, 404 que
// redirige) no es la que se quería auditar. Las rutas con `expectRedirect` redirigen por diseño, pero igual deben ser < 400.
function unexpectedRoute(route, status, finalPath) {
  const findings = [];
  if (status >= 400 || status === 0) findings.push({ kind: 'ruta-inesperada', detail: `respondió ${status || 'sin respuesta'}` });
  const requestedPath = new URL(route.path, 'http://audit.local').pathname;
  if (!route.expectRedirect && finalPath !== requestedPath) {
    findings.push({ kind: 'ruta-inesperada', detail: `pidió ${requestedPath} y terminó en ${finalPath}` });
  }
  return findings;
}

async function auditPage(page, route, viewport, results) {
  const label = `${route.role} ${route.path}`;
  await page.setViewportSize(viewport);
  const response = await page.goto(`${WEB_URL}${route.path}`, { waitUntil: 'domcontentloaded' });
  await settle(page);
  await page.screenshot({ path: resolve(OUT_DIR, `${slug(route, viewport.width, '')}.png`), fullPage: true });
  const findings = [
    ...unexpectedRoute(route, response?.status() ?? 0, new URL(page.url()).pathname),
    ...(await page.evaluate(collectFindings, { minTarget: MIN_TARGET, overlaySelector: OVERLAY_SELECTOR })),
  ];
  results.push({ route: label, width: viewport.width, state: 'página', findings, finalUrl: new URL(page.url()).pathname });

  const menuButton = page.getByRole('button', { name: /^Abrir men/i }).first();
  if ((await menuButton.count()) === 0 || !(await menuButton.isVisible())) return;
  await menuButton.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: resolve(OUT_DIR, `${slug(route, viewport.width, '__menu')}.png`) });
  const menuFindings = await page.evaluate(collectFindings, { minTarget: MIN_TARGET, overlaySelector: OVERLAY_SELECTOR });
  results.push({ route: label, width: viewport.width, state: 'menú abierto', findings: menuFindings, finalUrl: new URL(page.url()).pathname });
}

function printReport(results) {
  let total = 0;
  for (const result of results) {
    total += result.findings.length;
    const head = `${result.findings.length === 0 ? 'OK ' : 'XX '} ${String(result.width).padStart(4)}  ${result.route}${result.state === 'página' ? '' : ` [${result.state}]`}`;
    console.log(head);
    for (const finding of result.findings) console.log(`        - ${finding.kind}: ${finding.detail}`);
  }
  return total;
}

async function main() {
  API_URL = requireEnv('API_URL', TARGET_HINT).replace(/\/$/, '');
  WEB_URL = requireEnv('WEB_URL', TARGET_HINT).replace(/\/$/, '');
  assertLocalTarget('API_URL', API_URL);
  assertLocalTarget('WEB_URL', WEB_URL);
  console.log(`• Destino: API ${API_URL}; web ${WEB_URL}`);
  const staffPassword = requireEnv('MANUAL_STAFF_PASSWORD');
  const clientPassword = requireEnv('MANUAL_CLIENT_PASSWORD');
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  try {
    const contexts = {
      anon: await browser.newContext({ locale: 'es-UY', timezoneId: 'America/Montevideo' }),
      client: await login(browser, CLIENT_EMAIL, clientPassword),
      staff: await login(browser, STAFF_EMAIL, staffPassword),
    };
    const plans = await apiGet(contexts.anon, '/catalog/plans');
    const planSlug = (plans.find((plan) => plan.autoDebitEnabled) ?? plans[0])?.slug;
    const clients = await apiGet(contexts.staff, '/staff/clients');
    const clientList = Array.isArray(clients) ? clients : (clients.items ?? clients.data ?? []);
    const clientId = clientList[0]?.id;
    if (!planSlug || !clientId) throw new Error('Faltan planes o clientes de demostración (¿corriste pnpm manual:demo-data?).');

    const filter = process.env.AUDIT_ONLY;
    const routes = buildRoutes({ planSlug, clientId }).filter((route) => !filter || route.path.includes(filter));
    const pages = Object.fromEntries(await Promise.all(Object.entries(contexts).map(async ([role, context]) => [role, await context.newPage()])));

    const results = [];
    for (const route of routes) {
      for (const viewport of VIEWPORTS) {
        try {
          await auditPage(pages[route.role], route, viewport, results);
        } catch (error) {
          results.push({
            route: `${route.role} ${route.path}`,
            width: viewport.width,
            state: 'página',
            findings: [{ kind: 'error-de-auditoria', detail: error instanceof Error ? error.message.split('\n')[0] : String(error) }],
          });
        }
      }
    }

    const total = printReport(results);
    writeFileSync(resolve(OUT_DIR, 'resultado.json'), JSON.stringify(results, null, 2));
    console.log(`\n${results.length} combinaciones revisadas, ${total} hallazgos. Capturas en tmp/responsive/.`);
    process.exitCode = total === 0 ? 0 : 1;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
