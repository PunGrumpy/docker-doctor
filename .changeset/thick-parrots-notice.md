---
"@docker-doctor/cli": minor
---

Replace the saturating score formula with a monotonic, asymptotic curve.

The score used to be `100 - penalty` (floored at 0), which meant any project with roughly 10 errors or 25 warnings scored exactly 0 and stayed there no matter how much worse it got — the score became inert on messy repos, and score-regression checks (e.g. "re-scan, confirm the score did not drop") stopped working once a project hit the floor.

The score is now `round(100 * e^(-penalty / 70))`, using the same per-severity penalty weights as before (error 10, warning 4, info 1). This curve approaches 0 without ever getting stuck there, so the score keeps moving and stays meaningful across the whole range.

**Breaking:**

- Score values have changed. A given set of diagnostics will now produce a different numeric score than before (e.g. a single error used to score 90, now scores ~87; a project that used to floor at 0 will now show a small nonzero number that keeps decreasing as issues pile up).
- Existing badges, dashboards, or stored scores will show different numbers after upgrading — this is expected, not a regression.
- The `Excellent 🏆` / `Good ✅` / `Needs Work ⚠️` / `Critical 🚨` label thresholds (>=90 / >=75 / >=50 / below) are unchanged.
- The JSON report now includes a `schemaVersion` field (currently `2`) to make future score/shape changes detectable.
