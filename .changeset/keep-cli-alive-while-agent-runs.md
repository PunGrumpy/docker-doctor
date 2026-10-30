---
"@docker-doctor/cli": patch
---

A coding agent launched from the post-scan handoff no longer outlives docker-doctor. Pressing Ctrl-C while the agent worked used to close docker-doctor, which left the agent running and competing with your shell for the terminal. docker-doctor now keeps waiting until the agent exits and leaves Ctrl-C to the agent. A SIGTERM sent to docker-doctor is passed on to the agent, and docker-doctor then exits with code 143 as before once the agent has exited. On Linux, copying the handoff prompt no longer crashes docker-doctor when `wl-copy` exits before it reads the prompt, as it does without a Wayland session. docker-doctor now tries `xclip` and `xsel` next, and prints the prompt when none of them works.
