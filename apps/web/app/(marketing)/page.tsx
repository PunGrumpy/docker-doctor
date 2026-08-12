import { ActionDemo } from "@/components/sections/action-demo";
import { Architecture } from "@/components/sections/architecture";
import { Hero } from "@/components/sections/hero";
import { Installer } from "@/components/sections/installer";
import { Sandboxes } from "@/components/sections/sandboxes";
import { TerminalDemo } from "@/components/sections/terminal-demo";

const Home = () => (
  <>
    <Hero />
    <Installer />
    <TerminalDemo />
    <ActionDemo />
    <Sandboxes />
    <Architecture />
  </>
);

export default Home;
