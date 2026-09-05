// Shared between the Dockerfile ENV/ARG rule (no-secrets-in-env) and the
// Compose environment rule (no-plaintext-secrets) so both flag the same
// key shapes and the same value shapes.
const SECRET_KEY_PATTERNS: readonly RegExp[] = [
  // No leading separator, for PGPASSWORD.
  /password(?:[_-]|$)/iu,
  /(?:^|[_-])secret(?:[_-]|$)/iu,
  /(?:^|[_-])token(?:[_-]|$)/iu,
  /(?:^|[_-])api_key(?:[_-]|$)/iu,
  /(?:^|[_-])apikey(?:[_-]|$)/iu,
  /(?:^|[_-])private_key(?:[_-]|$)/iu,
  /(?:^|[_-])auth(?:[_-]|$)/iu,
  // GITHUB_PAT; the trailing separator keeps PATH and PATTERN out.
  /(?:^|[_-])pat(?:[_-]|$)/iu,
];

export const isSecretKey = (key: string): boolean =>
  SECRET_KEY_PATTERNS.some((regex) => regex.test(key));

// A URL with no userinfo in its authority. `user:pw@host` does not match.
const CREDENTIAL_FREE_URL = /^[a-z][a-z0-9+.-]*:\/\/[^@/\s]*(?:\/|$)/iu;

export const isLiteralSecretValue = (value: string): boolean =>
  value.length > 0 &&
  !value.startsWith("$") &&
  !CREDENTIAL_FREE_URL.test(value);
