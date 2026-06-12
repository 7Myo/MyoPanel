import sanitize from "sanitize-filename";

export function slugify(value, fallback = "bot") {
  const normalized = String(value || fallback)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  return sanitize(normalized || fallback);
}

export function uniqueSlug(base, exists) {
  let candidate = slugify(base);
  let index = 2;
  while (exists(candidate)) {
    candidate = `${slugify(base)}-${index}`;
    index += 1;
  }
  return candidate;
}
