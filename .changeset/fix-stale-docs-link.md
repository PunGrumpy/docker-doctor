---
"@docker-doctor/cli": patch
---

Fixed the "Docs:" link printed after every scan. It previously pointed at `https://github.com/PunGrumpy/docker-doctor/docs`, which 404s (there is no `docs/` directory in the repository). It now points at `https://docker-doctor.vercel.app`, the project's actual documentation site.
