// Acepta un enlace de Google Sheets o un ID y devuelve solo el ID.
export function extraerIdHoja(valor: string): string | null {
  const v = valor.trim();
  const m = v.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (m?.[1]) return m[1];
  return /^[a-zA-Z0-9_-]{20,}$/.test(v) ? v : null;
}
