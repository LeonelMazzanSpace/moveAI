# Web (`@move/web`) — convenciones

Next.js (App Router) + TypeScript + Tailwind v4 + shadcn/ui. Contexto general en `README.md` y `docs/development.md`; deploy en `docs/deploy.md`. Este archivo prevalece sobre los defaults de SpaceDev donde difieran (Next App Router en vez de Vite, `fetch` en vez de Axios, TanStack Query sin Redux).

## Antes de usar una API de Next

Esta versión de Next.js tiene cambios incompatibles. Leer la guía correspondiente en `node_modules/next/dist/docs/` antes de escribir código (ver `AGENTS.md`). `cacheComponents` está activo: lo que lee cookies o datos dinámicos va dentro de `<Suspense>`.

## Estructura

- `src/app/`: rutas. Grupos `(public)` (inicio, performance, rehab, recovery, planes, reservar, checkout/resultado y checkout/simulado), `(auth)` (ingresar, registro, recuperar, restablecer, continuar), `(cliente)` (perfil, historial, check-in, reservar/fisioterapia, checkout/plan/[slug]) y `staff/` (dashboard, clientes, turnos, pagos, seguimiento, configuración).
- `src/components/ui/`: componentes shadcn. `src/components/move/`: componentes propios de MOVE. El resto, por dominio (`auth`, `booking`, `checkout`, `client`, `staff`, `layout`, `public`), co-locados con sus tests.
- `src/lib/api/`: `types.ts` (tipos de la API: no se redefinen en otro lado), `client.ts` (`apiFetch`, cliente), `server.ts` (`serverApiFetch`, servidor), `errors.ts`, `config.ts`. `src/lib/format.ts`: formato de fechas, horas y precios.

## Reglas

- Páginas públicas como Server Components con `metadata` para SEO; las áreas cliente y staff pueden usar componentes cliente.
- Llamadas a la API solo con `apiFetch` (cliente) o `serverApiFetch` (servidor). Estado de servidor en el cliente con TanStack Query. Sin Redux.
- Formularios con React Hook Form + Zod. Sin lógica de negocio en los componentes: va en hooks `use…` o en `src/lib/`.
- Componentes funcionales; exports con nombre, salvo los `default export` que Next exige (`page.tsx`, `layout.tsx`, etc.); early returns; funciones chicas; sin `any`.
- Estilos solo con los tokens del tema (`bg-background`, `bg-card`, `bg-soft`, `border-border`, `text-muted-foreground`, tonos `success`/`warning`/`danger`); sin colores hex en componentes. Títulos con `font-display` (Archivo) en mayúsculas; cuerpo Inter. Radio 4px.
- Textos de la UI en español rioplatense con voseo ("Elegí tu plan", "Reservá"). Precios en pesos uruguayos con formato `$ 3.900` (`formatUYU`).
- Fechas: formatear siempre con `timeZone: 'America/Montevideo'` usando los helpers de `src/lib/format.ts`. Las fechas de negocio son strings `YYYY-MM-DD`.
- Sin secretos en el código: solo `NEXT_PUBLIC_API_URL` y `NEXT_PUBLIC_GOOGLE_ENABLED` (se incrustan en el build y son públicas). Sin librería de calendario: grillas propias.
- Los valores provisorios (planes, precios, umbrales) se muestran con el aviso "Valores provisorios — confirmar con MOVE" mientras la configuración tenga `valuesProvisional` en `true`.

## Tests

Vitest + Testing Library: `*.test.tsx` / `*.test.ts` junto al componente, mockeando `@/lib/api/client`. `pnpm --filter @move/web test`. No hay E2E con navegador en el MVP.

## Comandos

`pnpm --filter @move/web` + `dev` · `lint` · `test` · `build`.

## Definition of Done

1. Pedido resuelto sin cambios fuera del alcance.
2. `pnpm lint`, `pnpm test` y `pnpm build` en verde.
3. Pantallas probadas en el navegador (ancho móvil y escritorio), con estados de carga, vacío y error.
4. Sin hex, sin tipos de API duplicados, sin secretos.
5. Commits convencionales; PR hacia `main`, nunca push directo.
