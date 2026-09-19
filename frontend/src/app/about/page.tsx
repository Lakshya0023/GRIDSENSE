import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CheckCircle2, Award, Users, Globe } from "lucide-react";
import Link from "next/link";

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="pt-16 min-h-screen bg-white">
        {/* Hero */}
        <section className="bg-gradient-to-b from-gs-navy-950 to-gs-navy-900 py-20 text-white">
          <div className="container-official">
            <div className="max-w-3xl">
              <div className="inline-block text-xs font-semibold text-gs-cyan-400 uppercase tracking-widest mb-4">
                About GridSense
              </div>
              <h1 className="text-5xl md:text-6xl font-bold mb-6 text-institutional">
                Building the intelligence layer for national infrastructure.
              </h1>
              <p className="text-gs-gray-300 text-lg leading-relaxed">
                GridSense is a next-generation AI intelligence platform designed to give
                grid operators the foresight, explainability, and simulation tools
                needed to protect national electricity infrastructure.
              </p>
            </div>
          </div>
        </section>

        {/* Mission / Values */}
        <section className="py-20">
          <div className="container-official">
            <div className="grid md:grid-cols-3 gap-8">
              <div>
                <div className="w-12 h-12 rounded-md bg-gs-blue-100 text-gs-blue-600 flex items-center justify-center mb-4">
                  <Award className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-gs-gray-900 mb-3">Our Mission</h3>
                <p className="text-gs-gray-600 leading-relaxed">
                  To transform how grid operators anticipate, understand, and respond to
                  emerging risks in electricity infrastructure through explainable AI.
                </p>
              </div>
              <div>
                <div className="w-12 h-12 rounded-md bg-gs-cyan-100 text-gs-cyan-500 flex items-center justify-center mb-4">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-gs-gray-900 mb-3">Who We Serve</h3>
                <p className="text-gs-gray-600 leading-relaxed">
                  National utilities, regional load dispatch centers, transmission
                  authorities, and grid research institutions building resilient
                  infrastructure.
                </p>
              </div>
              <div>
                <div className="w-12 h-12 rounded-md bg-gs-green-100 text-gs-green-500 flex items-center justify-center mb-4">
                  <Globe className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-gs-gray-900 mb-3">Our Approach</h3>
                <p className="text-gs-gray-600 leading-relaxed">
                  Combining graph neural networks, physics-informed modelling and
                  operator-first UX to translate predictions into decisions.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* What we build */}
        <section className="bg-gs-gray-50 py-20 border-y border-gs-gray-200">
          <div className="container-official">
            <div className="max-w-3xl mb-12">
              <h2 className="text-4xl font-bold text-gs-gray-900 mb-4 text-institutional">
                What we build
              </h2>
              <p className="text-gs-gray-600 leading-relaxed">
                GridSense combines advanced machine learning with the physical
                understanding of electricity networks.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {[
                { title: "Graph Neural Networks", text: "Learn complex relationships between grid assets to predict failures across the network." },
                { title: "Physics-Informed Simulation", text: "Physical grid modelling for realistic what-if scenarios and cascade prediction." },
                { title: "Root Cause Analysis", text: "Attribution algorithms that separate initiating faults from downstream symptoms." },
                { title: "Cascade Prediction", text: "Multi-hop failure propagation modelling with time-horizon estimates." },
                { title: "Intervention Testing", text: "Simulate corrective actions before applying them to live infrastructure." },
                { title: "Operator-First UI", text: "Explainable, auditable AI outputs designed for control-room decision-making." },
              ].map((item) => (
                <div key={item.title} className="bg-white p-6 rounded-lg border border-gs-gray-200">
                  <div className="flex gap-3">
                    <CheckCircle2 className="w-5 h-5 text-gs-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-gs-gray-900 mb-1">{item.title}</h4>
                      <p className="text-sm text-gs-gray-600">{item.text}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-white">
          <div className="container-official text-center">
            <h2 className="text-4xl font-bold text-gs-gray-900 mb-4 text-institutional">
              Explore GridSense in action.
            </h2>
            <p className="text-gs-gray-600 mb-8 max-w-2xl mx-auto">
              Interact with our live simulation of the national grid.
            </p>
            <Link
              href="/map-explorer"
              className="inline-block px-8 py-3.5 bg-gs-blue-600 hover:bg-gs-blue-500 text-white font-semibold rounded-md transition-colors"
            >
              Open Map Explorer
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}