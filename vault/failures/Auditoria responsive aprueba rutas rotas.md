---
type: failure
status: shipped
updated: 2026-10-14
source:
  - move/scripts/responsive/audit.mjs
---
# Auditoria responsive aprueba rutas rotas

La auditoría ignoraba el estado HTTP y la URL final: una página 404 o 500, o una
redirección a `/ingresar` por sesión vencida, se medía como cualquier otra y salía
"OK" (review T-065, I-2). Al corregirlo, el chequeo del overlay de Next encontró un
error real en `/checkout/plan/[slug]` (`await params` fuera de `<Suspense>`, D120).
