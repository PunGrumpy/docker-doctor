# videos

Remotion project for the Docker Doctor launch video, built on the visual system of [blume's launch videos](https://github.com/haydenbleasel/blume/tree/main/packages/video): a gradient backdrop, white Geist type, frosted-glass terminal cards, and a derived timeline. The structure mirrors blume's `AuditVideo` — the closest analogue to what docker-doctor does — with docker-doctor's real CLI output and brand (Instrument Serif wordmark, ASCII mascot).

Seven scenes, ~35s:

> **Tagline** "Your containers run. / But are they healthy?" → **Report** frosted terminal: `docker-doctor .` prints findings + 45/100 scorecard → **Question** "But who wants to fix / all that by hand?" → **Agent** `claude` banner + echoed fix prompt + spinner, re-scan goes 100/100 → **Features** five snap claims → **CTA** typewriter `bunx @docker-doctor/cli` → **Logo** brand mark + serif wordmark.

## Commands

```bash
bun run dev      # open Remotion Studio to scrub/preview
bun run render   # render out/docker-doctor.mp4 (1920x1080, H.264, ~35s)
bun run still -- out/frame.png --frame=255   # render a single frame
bun run typecheck
```

## Layout

```
src/
  Root.tsx              registers the DockerDoctor composition (1080p @ 30fps)
  DockerDoctor.tsx      the composition: backdrop + 1280x720 stage scaled up,
                        scene timeline derived from the terminal script lengths
  fonts.ts              Geist / Geist Mono / Instrument Serif
  components/
    Backdrop.tsx        CSS mesh-gradient stand-in for blume's background.jpg
    remocn/             ports of blume's motion primitives:
                        soft-blur-in (per-char), shared-axis-y (word-level
                        step cut), typewriter (cps + caret)
  scenes/
    scan-terminal.tsx   script compiler + frosted terminal card; the report
                        and agent scripts (modeled on blume audit-terminal)
    logo.tsx            brand mark + Instrument Serif wordmark sign-off
                        (Mark.tsx copies the SVG from apps/web/components/logo.tsx)
```

The terminal scripts mirror the real CLI: rule keys and help strings come from `packages/core/src/rules` (30 rules), and the scorecard is the CLI's ASCII mascot + meter. If the CLI output changes shape, update the scripts.
