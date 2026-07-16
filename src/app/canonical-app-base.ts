const CANONICAL_APP_BASE_ERROR =
  "Canonical app base must be an HTTPS URL without credentials, query, or fragment";

export function validateCanonicalAppBase(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(CANONICAL_APP_BASE_ERROR);
  }
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new Error(CANONICAL_APP_BASE_ERROR);
  }
  return url.toString();
}
