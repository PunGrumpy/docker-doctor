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
  "length",
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

export const isSecretKey = (key: string): boolean =>
  !SECRET_DESCRIPTOR_SUFFIX.test(key) &&
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
