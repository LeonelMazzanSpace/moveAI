// Lower-case without accents ("Lucía" and "lucia" compare equal).
const normalize = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();

export function matchesClientSearch(row: { name: string; email: string; planName: string | null }, q: string): boolean {
  const needle = normalize(q.trim());
  if (needle === '') return true;
  return [row.name, row.email, row.planName].some((field) => field !== null && normalize(field).includes(needle));
}
