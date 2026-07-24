import { Architecture } from "@/components/sections/architecture";
import { Hero } from "@/components/sections/hero";
import { Installer } from "@/components/sections/installer";
import { TerminalDemo } from "@/components/sections/terminal-demo";

const Home = () => (
  <>
    <Hero />
    <Installer />
    <TerminalDemo />
    <Architecture />
  </>
);

export default Home;
