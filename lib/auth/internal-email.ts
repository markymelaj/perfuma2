const INTERNAL_DOMAIN = 'usuarios.consigna.local';

export function normalizeUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '');
}

export function makeInternalEmail(username: string) {
  const normalized = normalizeUsername(username);
  return `${normalized}@${INTERNAL_DOMAIN}`;
}

export function looksLikeEmail(value: string) {
  return /@/.test(value);
}
