import { isLiteralSecretValue, isSecretKey } from "./secret-keywords";

const REDACTED = "***";

// The userinfo of any `scheme://user:password@host` URL. A bare token can
// sit in the user part (`https://<token>@github.com`), so a user name is
// masked even without a password. A scheme starts where a run of scheme
// characters starts, so a long run is tried once, not once per character.
const URL_USERINFO_RE =
  /(?<![a-z0-9+.-])(?<scheme>[0-9+.-]*[a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/giu;

// `KEY=value` as a shell assignment or a flag (`--password=value`). A value
// in quotes may contain spaces.
const ASSIGNMENT_RE =
  /(?<![^\s=;&|'"`])(?<key>[^\s=;&|'"`]+)=(?<value>"[^"]*"|'[^']*'|[^\s;&|]+)/gu;

const SPACED_FLAG_RE =
  /(?<flag>--[a-z][\w-]*)(?<gap>\s+)(?<value>[^\s;&|-][^\s;&|]*)/giu;

// A `scheme://host/path?query` URL up to whitespace, a quote, `#`, `;`, `|`,
// `<`, `>` or `&&`. Parentheses belong to the URL (`pkg(v1).tar.gz?token=`),
// so the `)` that closes a `$(curl url?x)` is masked with the query. A signed
// URL keeps its credential in the query (`?token=`, `X-Amz-Signature=`,
// `sig=`), under names the secret-key patterns do not know, so the whole
// query is masked. This matches every URL, not only those with a query, so
// a failed match never rescans text.
const URL_RE =
  /(?<![a-z0-9+.-])[0-9+.-]*[a-z][a-z0-9+.-]*:\/\/(?:&(?!&)|[^\s&#'"`;|<>])*/giu;

// `curl -u user:password`, `--user name:password`, `--proxy-user ...`.
const USER_FLAG_RE =
  /(?<![\w-])(?<flag>--proxy-user|--user|-u)(?<gap>\s+|=)(?<value>"[^"]*"|'[^']*'|[^\s;&|]+)/gu;

// `docker run -u 1000:1000` names a user and a group, not a credential.
const UID_GID_RE = /^\d+:\d+$/u;
const QUOTE_EDGES_RE = /^["']|["']$/gu;

// `"Authorization: Bearer <token>"` inside a shell string: a header name
// right after a quote, and a value up to the closing quote.
const HEADER_RE =
  /(?<open>["'])(?<name>[\w-]+)(?<sep>:[ \t]*)(?<value>(?:(?!\k<open>)[^\r\n])+)/gu;

// `POSTGRES_PASSWORD: value` as a YAML block mapping line, with an optional
// `- ` list marker or `# ` comment marker. A key at the start of the line
// keeps one match from swallowing a later key. The value is the rest of the
// line, so a trailing comment is masked with it.
const MAPPING_LINE_RE =
  /^(?<lead>[ \t]*(?:[-#][ \t]+)?)(?<key>[\w.-]+)(?<sep>:[ \t]+)(?<value>\S[^\r\n]*)/gmu;

// The old `ENV KEY value` form of a Dockerfile, without an equals sign.
// Docker still accepts it and `no-secrets-in-env` flags it. The value is the
// rest of the line.
const ENV_SPACE_FORM_RE =
  /^(?<lead>[ \t]*ENV[ \t]+)(?<key>[^\s=]+)(?<sep>[ \t]+)(?<value>\S[^\r\n]*)/gimu;

const TRAILING_COMMENT_RE = /[ \t]#.*$/u;

const AUTH_HEADER_RE = /^(?:proxy-)?authorization$/iu;
const WHITESPACE_RE = /\s+/u;

// Flags and npm keys spell words as `api-key`, `apiKey` or `_authToken`.
// The secret-key patterns expect `api_key` and an `_` before each word.
const CAMEL_BOUNDARY_RE = /(?<=[a-z0-9])(?=[A-Z])/gu;

const looksSecret = (key: string): boolean =>
  isSecretKey(key.replaceAll(CAMEL_BOUNDARY_RE, "_").replaceAll("-", "_"));

// `Authorization` and `Proxy-Authorization` carry a credential under a name
// the secret-key patterns do not match. Any other field needs a space after
// the colon, so an image reference such as `auth:1.2` stays visible.
const isSecretField = (name: string, sep: string): boolean =>
  AUTH_HEADER_RE.test(name) || (sep.length > 1 && looksSecret(name));

// The credential of `Bearer <token>` is its last word, so `Bearer $TOKEN`
// stays visible.
const isLiteralCredential = (value: string): boolean =>
  isLiteralSecretValue(value.trim().split(WHITESPACE_RE).at(-1) ?? value);

const maskQuery = (url: string): string => {
  const queryStart = url.indexOf("?");

  return queryStart === -1 || queryStart === url.length - 1
    ? url
    : `${url.slice(0, queryStart + 1)}${REDACTED}`;
};

const maskEnvSpaceForm = (
  match: string,
  lead: string,
  key: string,
  sep: string,
  value: string
): string =>
  looksSecret(key) && isLiteralSecretValue(value.trimEnd())
    ? `${lead}${key}${sep}${REDACTED}`
    : match;

const isUserCredential = (value: string): boolean => {
  const unquoted = value.replaceAll(QUOTE_EDGES_RE, "");

  return unquoted.includes(":") && !UID_GID_RE.test(unquoted);
};

const maskField = (
  match: string,
  lead: string,
  name: string,
  sep: string,
  value: string
): string =>
  isSecretField(name, sep) && isLiteralCredential(value)
    ? `${lead}${name}${sep}${REDACTED}`
    : match;

// A trailing `# comment` is not part of the value: `${DB_PASSWORD} # note`
// still names a variable.
const maskMapping = (
  match: string,
  lead: string,
  key: string,
  sep: string,
  rest: string
): string =>
  maskField(match, lead, key, sep, rest.replace(TRAILING_COMMENT_RE, ""));

/**
 * Masks credentials in text quoted from a scanned file before it becomes
 * part of a diagnostic. Detection stays with the secrets rules. This only
 * keeps a value they would flag out of messages, reports and PR comments.
 */
export const redactSecrets = (text: string): string =>
  text
    .replaceAll(URL_USERINFO_RE, `$<scheme>${REDACTED}@`)
    .replaceAll(URL_RE, maskQuery)
    .replaceAll(
      USER_FLAG_RE,
      (match, flag: string, gap: string, value: string) =>
        isUserCredential(value) ? `${flag}${gap}${REDACTED}` : match
    )
    .replaceAll(HEADER_RE, maskField)
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
    )
    .replaceAll(ENV_SPACE_FORM_RE, maskEnvSpaceForm)
    .replaceAll(MAPPING_LINE_RE, maskMapping);
