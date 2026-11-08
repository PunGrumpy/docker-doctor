# docker-doctor-kit

## 0.2.0

### Minor Changes

- 5470203: The kit now publishes as a Kit Specification v3 image, so it composes with the built-in agents of Docker Sandboxes 0.51 and later. It ships the pinned CLI with its own Node runtime, so the base image no longer needs Node and sandbox creation no longer reaches npm. Docker Sandboxes now places the bundled skill for the agents whose kits declare a skills directory, which today means Claude Code and Codex. Other agents are pointed at the skill's file. On sbx older than 0.51, use `docker.io/pungrumpy/docker-doctor-kit:0.1.14`.

### Patch Changes

- Updated dependencies [a554274]
- Updated dependencies [53e911e]
- Updated dependencies [dd5a33a]
- Updated dependencies [af17870]
- Updated dependencies [2f9659d]
- Updated dependencies [e4c5ca7]
- Updated dependencies [45dd097]
- Updated dependencies [d69e199]
- Updated dependencies [09721ae]
- Updated dependencies [0d1831c]
  - @docker-doctor/cli@0.10.0

## 0.1.14

### Patch Changes

- Updated dependencies [e76b2ea]
- Updated dependencies [935de53]
- Updated dependencies [e76b2ea]
- Updated dependencies [562f174]
- Updated dependencies [d112e09]
  - @docker-doctor/cli@0.9.1

## 0.1.13

### Patch Changes

- Updated dependencies [dd6fd5a]
  - @docker-doctor/cli@0.9.0

## 0.1.12

### Patch Changes

- Updated dependencies [0e6fbc9]
- Updated dependencies [497266c]
- Updated dependencies [d9b100b]
- Updated dependencies [c76f7f3]
- Updated dependencies [eb5d0c0]
- Updated dependencies [497266c]
- Updated dependencies [475045e]
  - @docker-doctor/cli@0.8.0

## 0.1.11

### Patch Changes

- Updated dependencies [c752e18]
  - @docker-doctor/cli@0.7.0

## 0.1.10

### Patch Changes

- Updated dependencies [d3ffd60]
- Updated dependencies [9f98188]
- Updated dependencies [1adb12a]
- Updated dependencies [9d5a558]
- Updated dependencies [2930957]
- Updated dependencies [d35a759]
  - @docker-doctor/cli@0.6.1

## 0.1.9

### Patch Changes

- Updated dependencies [23deed0]
- Updated dependencies [478cc64]
- Updated dependencies [f3a15f8]
- Updated dependencies [632961c]
  - @docker-doctor/cli@0.6.0

## 0.1.8

### Patch Changes

- Updated dependencies [f538085]
  - @docker-doctor/cli@0.5.3

## 0.1.7

### Patch Changes

- Updated dependencies [590ea75]
- Updated dependencies [66816aa]
- Updated dependencies [5b03d3d]
- Updated dependencies [61264f3]
- Updated dependencies [d9b9a43]
- Updated dependencies [c30dd7f]
  - @docker-doctor/cli@0.5.2

## 0.1.6

### Patch Changes

- Updated dependencies [8bded00]
- Updated dependencies [fed7f98]
  - @docker-doctor/cli@0.5.1
