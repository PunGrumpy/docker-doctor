import { Composition } from "remotion";

import { DockerDoctor, DURATION, FPS, HEIGHT, WIDTH } from "./composition";
import {
  DURATION as SANDBOX_DURATION,
  FPS as SANDBOX_FPS,
  SandboxKit,
  SIZE as SANDBOX_SIZE,
} from "./sandbox-composition";

import "./index.css";

export const RemotionRoot = () => (
  <>
    <Composition
      component={DockerDoctor}
      durationInFrames={DURATION}
      fps={FPS}
      height={HEIGHT}
      id="DockerDoctor"
      width={WIDTH}
    />
    <Composition
      component={SandboxKit}
      durationInFrames={SANDBOX_DURATION}
      fps={SANDBOX_FPS}
      height={SANDBOX_SIZE}
      id="SandboxKit"
      width={SANDBOX_SIZE}
    />
  </>
);
