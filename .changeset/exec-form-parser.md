---
"@docker-doctor/cli": patch
---

Fix `use-exec-form` missing bracket-wrapped `CMD`/`ENTRYPOINT` args that are not valid JSON. `CMD [node, index.js]` was accepted as exec form because the rule only checked for a leading `[` and a trailing `]`, but Docker treats anything that is not a JSON string array as shell form and runs it under `/bin/sh -c` — exactly what the rule exists to flag. Single-quoted elements and trailing commas were missed the same way.

Exec-form detection now lives in one place, `parseExecForm` in `parsers/`, which `use-exec-form` and `use-pipefail` both use, so the two rules can no longer disagree about what exec form is. This surfaces new warnings on Dockerfiles that previously passed; the fix is to quote the elements (`CMD ["node", "index.js"]`).
