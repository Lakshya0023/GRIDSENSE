import type { Metadata } from "next";
import "./globals.css";
import { MockDataBanner } from "@/components/system/MockDataBanner";
import { RouteVeil } from "@/components/motion/RouteVeil";
import { ScrollProgress } from "@/components/motion/ScrollProgress";

export const metadata: Metadata = {
  title: "GridSense — AI-Powered Grid Intelligence Platform",
  description: "National electricity grid intelligence, prediction and resilience powered by AI.",
};

// The theme was previously applied only by <Navbar>'s effect. Any route that
// does not render the navbar (/login) therefore never got a data-theme at all,
// so the dark-surface rules never matched and it stayed on the light defaults.
// Setting it here, before paint, makes every route honour the saved choice and
// also removes the flash of the wrong theme on the routes that do have a navbar.
const THEME_BOOTSTRAP = `(function(){try{document.documentElement.dataset.theme=localStorage.getItem("gridsense-theme")==="light"?"light":"dark";}catch(e){document.documentElement.dataset.theme="dark";}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        <ScrollProgress />
        {children}
        <MockDataBanner />
        <RouteVeil />
      </body>
    </html>
  );
}
