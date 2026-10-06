import { ActionDemo } from "@/components/sections/action-demo";
import { Architecture } from "@/components/sections/architecture";
import { Hero } from "@/components/sections/hero";
import { Installer } from "@/components/sections/installer";
import { Sandboxes } from "@/components/sections/sandboxes";
import { TerminalDemo } from "@/components/sections/terminal-demo";
import { url } from "@/lib/url";

const structuredData = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  applicationCategory: "DeveloperApplication",
  author: {
    "@type": "Person",
    name: "Noppakorn Kaewsalabnil",
    url: "https://www.pungrumpy.com",
  },
  description:
    "Static analysis for Dockerfile and Docker Compose files, with a health score and fix guidance for coding agents.",
  downloadUrl: "https://www.npmjs.com/package/@docker-doctor/cli",
  license: "https://opensource.org/licenses/MIT",
  name: "Docker Doctor",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  operatingSystem: "Linux, macOS, Windows",
  sameAs: ["https://github.com/PunGrumpy/docker-doctor"],
  url,
});

const Home = () => (
  <>
    <script type="application/ld+json">{structuredData}</script>
    <Hero />
    <Installer />
    <TerminalDemo />
    <ActionDemo />
    <Sandboxes />
    <Architecture />
  </>
);

export default Home;
