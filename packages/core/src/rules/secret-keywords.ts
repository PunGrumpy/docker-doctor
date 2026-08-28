// Shared between the Dockerfile ENV/ARG rule (no-secrets-in-env) and the
// Compose environment rule (no-plaintext-secrets) so both flag the same
// key shapes.
const SECRET_KEY_PATTERNS: readonly RegExp[] = [
  /(?:^|[_-])password(?:[_-]|$)/iu,
  /(?:^|[_-])secret(?:[_-]|$)/iu,
  /(?:^|[_-])token(?:[_-]|$)/iu,
  /(?:^|[_-])api_key(?:[_-]|$)/iu,
  /(?:^|[_-])private_key(?:[_-]|$)/iu,
  /(?:^|[_-])auth(?:[_-]|$)/iu,
];

export const isSecretKey = (key: string): boolean =>
  SECRET_KEY_PATTERNS.some((regex) => regex.test(key));
