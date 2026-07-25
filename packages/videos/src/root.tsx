import { Composition } from "remotion";

import { DockerDoctor, DURATION, FPS, HEIGHT, WIDTH } from "./composition";

import "./index.css";

export const RemotionRoot = () => (
  <Composition
    component={DockerDoctor}
    durationInFrames={DURATION}
    fps={FPS}
    height={HEIGHT}
    id="DockerDoctor"
    width={WIDTH}
  />
);
