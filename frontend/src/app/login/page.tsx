"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Zap, ArrowRight } from "lucide-react";
import { startRouteVeil } from "@/components/motion/RouteVeil";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      // Raise the veil first: this redirect is not a link click, so the
      // veil would not otherwise pick it up and the jump would be abrupt.
      startRouteVeil("/map-explorer");
      router.push("/map-explorer");
    }, 500);
  };

  return (
    <div className="min-h-screen flex bg-white">
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-gs-navy-950 to-gs-navy-800 p-16 items-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: "linear-gradient(rgba(34,211,238,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.15) 1px, transparent 1px)",
          backgroundSize: "40px 40px"
        }} />
        <div className="relative text-white max-w-md">
          <Link href="/" className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-md bg-gradient-to-br from-gs-blue-600 to-gs-cyan-500 flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-lg font-bold">GridSense</div>
              <div className="text-[10px] uppercase tracking-widest text-gs-gray-400">Grid Intelligence Platform</div>
            </div>
          </Link>
          <h2 className="text-4xl font-bold mb-4 text-institutional">Grid Intelligence Portal</h2>
          <p className="text-gs-gray-300 leading-relaxed">
            Secure access for authorized grid operators, transmission authorities and
            infrastructure decision-makers.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gs-gray-900 mb-2 text-institutional">Sign in</h1>
            <p className="text-sm text-gs-gray-600">Access the operational command center.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gs-gray-700 uppercase tracking-widest mb-1.5">
                Official ID / Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-gs-gray-300 rounded-md focus:outline-none focus:border-gs-blue-500 focus:ring-2 focus:ring-gs-blue-100"
                placeholder="operator@grid.gov.in"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gs-gray-700 uppercase tracking-widest mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gs-gray-300 rounded-md focus:outline-none focus:border-gs-blue-500 focus:ring-2 focus:ring-gs-blue-100"
                placeholder="••••••••"
                required
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gs-gray-600">
                <input type="checkbox" className="rounded border-gs-gray-300" />
                Remember me
              </label>
              <a href="#" className="text-sm text-gs-blue-600 hover:underline">Forgot password?</a>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gs-blue-600 hover:bg-gs-blue-500 text-white font-semibold rounded-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Login"}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <p className="text-xs text-gs-gray-500 text-center mt-6">
            Need access?{" "}
            <a href="#" className="text-gs-blue-600 hover:underline">
              Contact administrator
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}