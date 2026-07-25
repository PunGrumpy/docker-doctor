import type { ReactDoctorConfig } from "react-doctor/api";

const config: ReactDoctorConfig = {
  ignore: {
    overrides: [
      {
        files: ["components/file-tree-view.tsx"],
        rules: ["react-doctor/no-impure-state-updater"],
      },
    ],
  },
  // Scan only the real React surfaces. `videos` is deliberately absent:
  // it's a Remotion project full of registry-vendored components that
  // react-doctor's app rules aren't written for.
  projects: ["web"],
};

export default config;
