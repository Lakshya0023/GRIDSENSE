import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Book, Code, Cpu, GitBranch, Network, Zap } from "lucide-react";
import Link from "next/link";

const TOPICS = [
  { icon: <Book className="w-5 h-5" />, title: "How GridSense Works", desc: "Platform overview, pipeline, and product philosophy.", href: "/about" },
  { icon: <Cpu className="w-5 h-5" />, title: "AI Model", desc: "GraphSAGE-based node prediction and root cause attribution.", href: "/intelligence" },
  { icon: <Network className="w-5 h-5" />, title: "Grid Simulation", desc: "Physics-informed power flow analysis and stress modeling.", href: "/dashboard" },
  { icon: <Zap className="w-5 h-5" />, title: "Risk Prediction", desc: "How individual node failure probability is computed.", href: "/analytics" },
  { icon: <GitBranch className="w-5 h-5" />, title: "Cascade Prediction", desc: "Multi-hop propagation model with time-horizon estimation.", href: "/map-explorer" },
  { icon: <Code className="w-5 h-5" />, title: "API Documentation", desc: "REST endpoints, request schemas, and response formats.", href: "http://127.0.0.1:8000/docs" },
];

export default function DocumentationPage() {
  return (
    <>
      <Navbar />
      <main className="pt-16 min-h-screen bg-white">
        <section className="bg-gs-gray-50 border-b border-gs-gray-200">
          <div className="container-official py-10">
            <div className="flex items-center gap-2 text-xs text-gs-gray-500 mb-3">
              <Link href="/" className="hover:text-gs-blue-600">Home</Link>
              <span>/</span>
              <span>Documentation</span>
            </div>
            <h1 className="text-4xl font-bold text-gs-gray-900 text-institutional">Resources</h1>
            <p className="text-gs-gray-600 mt-2">Technical documentation for GridSense platform.</p>
          </div>
        </section>

        <div className="container-official py-16">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {TOPICS.map((t) => (
              <a key={t.title} href={t.href} target={t.href.startsWith("http") ? "_blank" : undefined} rel={t.href.startsWith("http") ? "noreferrer" : undefined} className="group p-6 bg-white rounded-lg border border-gs-gray-200 hover:border-gs-blue-400 hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-md bg-gs-blue-50 text-gs-blue-600 flex items-center justify-center mb-4 group-hover:bg-gs-blue-100">
                  {t.icon}
                </div>
                <h3 className="font-semibold text-gs-gray-900 mb-1">{t.title}</h3>
                <p className="text-sm text-gs-gray-600">{t.desc}</p>
                <span className="mt-4 inline-block text-xs font-bold text-gs-blue-600">Open resource →</span>
              </a>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
