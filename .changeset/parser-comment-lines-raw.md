---
"@docker-doctor/cli": patch
---

Comment lines inside a line continuation no longer appear in an instruction's `raw` text. They made `sort-multiline-args` misread commented package lists as unsorted. Heredoc bodies keep their `#` lines, since those are shell content.
