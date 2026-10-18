import { isLiteralSecretValue, isSecretKey } from "./secret-keywords";

const REDACTED = "***";

// The userinfo of any `scheme://user:password@host` URL. A bare token can
// sit in the user part (`https://<token>@github.com`), so a user name is
// masked even without a password.
const URL_USERINFO_RE =
  /(?<![a-z])(?<scheme>[a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/giu;

// `KEY=value` as a shell assignment or a flag (`--password=value`). A value
// in quotes may contain spaces.
const ASSIGNMENT_RE =
  /(?<![^\s=;&|'"`])(?<key>[^\s=;&|'"`]+)=(?<value>"[^"]*"|'[^']*'|[^\s;&|]+)/gu;

// `--password value`, the spelling with a space instead of `=`.
const SPACED_FLAG_RE =
  /(?<flag>--[a-z][\w-]*)(?<gap>\s+)(?<value>[^\s;&|-][^\s;&|]*)/giu;

// Flags and npm keys spell words as `api-key`, `apiKey` or `_authToken`.
// The secret-key patterns expect `api_key` and an `_` before each word.
const CAMEL_BOUNDARY_RE = /(?<=[a-z0-9])(?=[A-Z])/gu;

const looksSecret = (key: string): boolean =>
  isSecretKey(key.replaceAll(CAMEL_BOUNDARY_RE, "_").replaceAll("-", "_"));

/**
 * Masks credentials in text quoted from a scanned file before it becomes
 * part of a diagnostic. Detection stays with the secrets rules. This only
 * keeps a value they would flag out of messages, reports and PR comments.
 */
export const redactSecrets = (text: string): string =>
  text
    .replaceAll(URL_USERINFO_RE, `$<scheme>${REDACTED}@`)
    .replaceAll(ASSIGNMENT_RE, (match, key: string, value: string) =>
      looksSecret(key) && isLiteralSecretValue(value)
        ? `${key}=${REDACTED}`
        : match
    )
    .replaceAll(
      SPACED_FLAG_RE,
      (match, flag: string, gap: string, value: string) =>
        looksSecret(flag) && isLiteralSecretValue(value)
          ? `${flag}${gap}${REDACTED}`
          : match
    );
