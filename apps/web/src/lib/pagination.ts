const MAX_PAGE = 10_000;

/** Número de página de un query param de la URL, acotado a `[1, 10_000]`. */
export function clampPage(raw: string | undefined): number {
  const page = Number(raw);
  if (!Number.isInteger(page) || page < 1) return 1;
  return Math.min(page, MAX_PAGE);
}
