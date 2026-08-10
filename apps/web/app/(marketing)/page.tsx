import { ActionDemo } from "@/components/sections/action-demo";
import { Architecture } from "@/components/sections/architecture";
import { Hero } from "@/components/sections/hero";
import { Installer } from "@/components/sections/installer";
import { TerminalDemo } from "@/components/sections/terminal-demo";

const Home = () => (
  <>
    <Hero />
    <Installer />
    <TerminalDemo />
    <ActionDemo />
    <Architecture />
  </>
);

export default Home;
