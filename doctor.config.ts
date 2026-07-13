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
};

export default config;
