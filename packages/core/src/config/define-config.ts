import type { DockerDoctorConfig } from "../types/index";

// Identity helper for typed docker-doctor.config.ts files. Note for docs: this
// is a runtime import, so configs using it require @docker-doctor/cli as a
// devDependency — npx-only users should use the DockerDoctorConfig type with
// `satisfies` instead.
export const defineConfig = (config: DockerDoctorConfig): DockerDoctorConfig =>
  config;
