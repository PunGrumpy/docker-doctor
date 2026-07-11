---
"@docker-doctor/cli": minor
---

Replace `readline/promises` text input with fully interactive keyboard-driven prompts.

- `askConfirm`: vertical Yes/No layout with arrow keys, vim keys (h/j/k/l), and y/n shortcuts
- `askSelect`: vertical option list with up/down / j/k navigation
- Hidden cursor during prompts; restored on exit, Ctrl+C, SIGINT, and SIGTERM
- Falls back gracefully to default values in non-TTY (CI/pipe) environments
