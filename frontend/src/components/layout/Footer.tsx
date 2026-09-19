import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-gs-bg-secondary text-gs-text-secondary border-t border-gs-border">
      <div className="container-official py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <img src="/gridsense-mark.svg" alt="GridSense" className="h-9 w-9 rounded-md" />
              <div>
                <div className="gs-display text-gs-text-primary text-lg font-bold uppercase">GridSense</div>
                <div className="text-[9px] uppercase tracking-widest text-gs-text-tertiary">
                  Grid Intelligence Platform
                </div>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-gs-text-tertiary">
              AI-powered intelligence for national electricity grid resilience,
              predictive analytics and infrastructure decision support.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gs-text-primary mb-4">
              Platform
            </h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="/" className="hover:text-gs-text-primary transition-colors">Home</Link></li>
              <li><Link href="/about" className="hover:text-gs-text-primary transition-colors">About</Link></li>
              <li><Link href="/map-explorer" className="hover:text-gs-text-primary transition-colors">Map Explorer</Link></li>
              <li><Link href="/intelligence" className="hover:text-gs-text-primary transition-colors">Intelligence</Link></li>
              <li><Link href="/analytics" className="hover:text-gs-text-primary transition-colors">Analytics</Link></li>
              <li><Link href="/alerts" className="hover:text-gs-text-primary transition-colors">Alerts</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gs-text-primary mb-4">
              Resources
            </h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="/documentation" className="hover:text-gs-text-primary transition-colors">Documentation</Link></li>
              <li><a href="#" className="hover:text-gs-text-primary transition-colors">Privacy</a></li>
              <li><a href="#" className="hover:text-gs-text-primary transition-colors">Security</a></li>
              <li><a href="#" className="hover:text-gs-text-primary transition-colors">Terms of Use</a></li>
              <li><a href="#" className="hover:text-gs-text-primary transition-colors">Accessibility</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gs-text-primary mb-4">
              System Status
            </h4>
            <ul className="space-y-2 text-xs">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-gs-green-500 animate-pulse-dot" />
                <span>Platform Operational</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-gs-green-500 animate-pulse-dot" />
                <span>API Online</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-gs-cyan-500 animate-pulse-dot" />
                <span>ML Model Active</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-gs-border flex flex-col md:flex-row justify-between gap-4">
          <p className="text-[11px] text-gs-text-muted">
            © 2026 GridSense - Grid Intelligence Platform. All rights reserved.
          </p>
          <p className="text-[11px] text-gs-text-muted font-mono">
            Version 2.1.0 · Model GraphSAGE-v2
          </p>
        </div>
      </div>
    </footer>
  );
}
