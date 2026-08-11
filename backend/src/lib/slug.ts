export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Build a chama slug from name + county (e.g. "Mraru" + "Nairobi" →
 * "mraru-nairobi"). Callers enforce uniqueness by appending a numeric suffix
 * when the base slug is already taken — name uniqueness itself is *not*
 * required globally, only the slug is.
 */
export function buildChamaSlug(name: string, county?: string | null): string {
  const parts = [slugify(name)];
  if (county) {
    const countySlug = slugify(county);
    if (countySlug && countySlug !== parts[0]) parts.push(countySlug);
  }
  return parts.join('-') || 'chama';
}

export function uniqueSlug(base: string, taken: (slug: string) => Promise<boolean>): Promise<string> {
  return (async () => {
    if (!(await taken(base))) return base;
    for (let i = 2; i < 1000; i++) {
      const candidate = `${base}-${i}`;
      if (!(await taken(candidate))) return candidate;
    }
    throw new Error('Could not allocate a unique chama slug');
  })();
}
