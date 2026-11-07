// A bare `_KEY` suffix would also catch PRIMARY_KEY and PUBLIC_KEY, so only
// the words that name a credential count.
const CREDENTIAL_KEY_WORDS = [
  "master",
  "encryption",
  "signing",
  "access",
  "service",
  "service[_-]role",
  "admin",
  "license",
  "hmac",
  "jwt",
  "openai",
  "anthropic",
  "gemini",
  "mistral",
  "cohere",
  "groq",
  "deepseek",
  "openrouter",
  "huggingface",
  "hf",
] as const;

const SECRET_KEY_PATTERNS: readonly RegExp[] = [
  new RegExp(`(?:^|[_-])(?:${CREDENTIAL_KEY_WORDS.join("|")})[_-]key$`, "iu"),
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

// The last word of a key that describes a secret instead of holding it.
// `POSTGRES_PASSWORD_FILE=/run/secrets/...` is the setup both secrets rules
// recommend. A word that can be the credential itself (`header`, `hash`,
// `salt`, `key`, `value`, `url`, `uri`, `dsn`, `id`, `user`) is not listed,
// so `AUTH_HEADER` and `API_TOKEN_ID` stay reported.
const SECRET_DESCRIPTOR_WORDS = [
  // Where the secret lives.
  "file",
  "path",
  "dir",
  "sock",
  "socket",
  // How long it lasts, or how long it must be.
  "ttl",
  "timeout",
  "seconds",
  "minutes",
  "hours",
  "days",
  "expire",
  "expires",
  "expiry",
  "expiration",
  "expires?[_-]in",
  "length",
  // How many, or how large.
  "limit",
  "budget",
  "count",
  "size",
  // Which one, or which scheme guards it.
  "name",
  "type",
  "mode",
  "driver",
  "method",
  "policy",
  "provider",
  "algorithm",
  // Whether the check is on.
  "enabled",
  "disabled",
] as const;

const SECRET_DESCRIPTOR_SUFFIX = new RegExp(
  `[_-](?:${SECRET_DESCRIPTOR_WORDS.join("|")})$`,
  "iu"
);

// `MAX_TOKEN` and `MIN_TOKENS` name a bound on a count of tokens.
const BOUND_PREFIX = /^(?:max|min)[_-]/iu;

export const isSecretKey = (key: string): boolean =>
  !SECRET_DESCRIPTOR_SUFFIX.test(key) &&
  !BOUND_PREFIX.test(key) &&
  SECRET_KEY_PATTERNS.some((regex) => regex.test(key));

const CREDENTIAL_FREE_URL = /^[a-z][a-z0-9+.-]*:\/\/[^@/\s]*(?:\/|$)/iu;

// An on/off switch is not a secret. `AUTH_ENABLED=true` matches the `auth`
// key pattern and `MYSQL_ALLOW_EMPTY_PASSWORD=yes` matches `password`. The
// digits are for `MYSQL_RANDOM_ROOT_PASSWORD=1`, whose key says nothing
// about a switch. No other digit is a switch.
const SWITCH_VALUE = /^(?:true|false|yes|no|on|off|0|1)$/iu;

// `ENV TOKEN=""` / `ARG KEY=''` declare a build-time secret with no value;
// the quotes are shell syntax, not a literal.
const SURROUNDING_QUOTES_RE = /^(?<quote>["'])(?<inner>.*)\k<quote>$/su;

export const isLiteralSecretValue = (value: string): boolean => {
  const unquoted = SURROUNDING_QUOTES_RE.exec(value)?.groups?.inner ?? value;

  return (
    unquoted.length > 0 &&
    !unquoted.startsWith("$") &&
    !SWITCH_VALUE.test(unquoted) &&
    !CREDENTIAL_FREE_URL.test(unquoted)
  );
};

// Provider token prefixes: OpenAI-style `sk-`, Hugging Face `hf_`, GitHub
// `ghp_` and `github_pat_`, and AWS long-term (`AKIA`) and temporary (`ASIA`)
// access key ids. The boundary keeps a longer word that merely ends in a
// prefix, such as `task-`, out.
const PROVIDER_TOKEN_PATTERNS: readonly RegExp[] = [
  /(?<![A-Za-z0-9])sk-[\w-]{20,}/gu,
  /(?<![A-Za-z0-9])hf_[A-Za-z0-9]{20,}/gu,
  /(?<![A-Za-z0-9])gh[pousr]_[A-Za-z0-9]{20,}/gu,
  /(?<![A-Za-z0-9])github_pat_\w{20,}/gu,
  /(?<![A-Za-z0-9])A(?:KI|SI)A[0-9A-Z]{16}(?![0-9A-Z])/gu,
];

const DIGIT = /\d/u;
const RANDOM_RUN = /[A-Za-z0-9]{16}/u;

// A random token this long has a digit and an unbroken run of characters.
// `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx` has no digit, `sk-learn-random-forest-v1`
// has no long run, and AWS documents its sample key id with an `EXAMPLE` suffix.
const isRealToken = (match: string): boolean =>
  DIGIT.test(match) && RANDOM_RUN.test(match) && !match.endsWith("EXAMPLE");

export const containsProviderToken = (value: string): boolean =>
  PROVIDER_TOKEN_PATTERNS.some((regex) =>
    [...value.matchAll(regex)].some(([match]) => isRealToken(match))
  );

export const maskProviderTokens = (text: string, mask: string): string => {
  let masked = text;

  for (const regex of PROVIDER_TOKEN_PATTERNS) {
    masked = masked.replaceAll(regex, (match) =>
      isRealToken(match) ? mask : match
    );
  }

  return masked;
};
