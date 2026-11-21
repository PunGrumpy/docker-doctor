---
"@docker-doctor/cli": patch
---

Compose files that merge one anchor into more than 100 services are scanned again instead of being refused as an alias attack, and a file that uses aliases 100,000 times scans in about a second instead of more than a minute. Docker Doctor still refuses a file whose aliases repeat more of its values than Compose's YAML decoder allows, and a file that expands to more than 1,000,000 values.
