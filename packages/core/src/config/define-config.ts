import type { DockerDoctorConfig } from "../types/index";

// Identity helper for typed docker-doctor.config.ts files. Unlike a type-only
// import of DockerDoctorConfig, a config using this must be able to resolve
// @docker-doctor/cli at load time.
export const defineConfig = (config: DockerDoctorConfig): DockerDoctorConfig =>
  config;
