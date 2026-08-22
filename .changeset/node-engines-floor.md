---
"@docker-doctor/cli": patch
---

Declare `engines.node >= 20.11.0`. The CLI already required Node 20.11+ at runtime (`Array.prototype.toSorted`, `import.meta.dirname`); npm now warns at install time instead of crashing at first run on older Node.
