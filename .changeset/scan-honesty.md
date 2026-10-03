---
"@docker-doctor/cli": patch
---

A scan that finds no Dockerfile or Compose file now says so instead of printing "No issues found" and a 100/100 score. `--json` and `--score` keep their output and add a warning on stderr. When docker-doctor can't analyze a file, the terminal report no longer calls the project healthy or offers a share link, and it says how many files it left out. `ignore.files` accepts a trailing `/` for a whole directory, so `vendor/` means `vendor/**`, and ignores a leading `./`. The docs already used both spellings. The "Scanned N files" line no longer counts `.dockerignore` files. The bundled skill explains exit code 2 and no longer says `rules explain` needs the full rule key.
