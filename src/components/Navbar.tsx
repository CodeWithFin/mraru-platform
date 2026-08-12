"use client";

import React from "react";
import { ShieldCheck, Users, CheckCircle2, RefreshCw } from "lucide-react";

interface NavbarProps {
  activeTab: "wizard" | "governance" | "checklist" | "errors";
  setActiveTab: (tab: "wizard" | "governance" | "checklist" | "errors") => void;
  onSeedDemo: () => void;
}

export function Navbar({ activeTab, setActiveTab, onSeedDemo }: NavbarProps) {
  return (
    <nav className="sticky top-0 z-50 w-full bg-[#09090b]/90 backdrop-blur-md border-b border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full bg-[#ccf32f] lime-glow flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-black"></div>
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-white">Mraru</span>
            <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-[#ccf32f]/10 text-[#ccf32f] border border-[#ccf32f]/20">
              Onboarding v1.0
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="hidden md:flex items-center gap-2 bg-neutral-900/80 p-1.5 rounded-full border border-neutral-800">
          <button
            onClick={() => setActiveTab("wizard")}
            className={`px-5 py-2 rounded-full text-xs font-medium transition-all flex items-center gap-2 ${
              activeTab === "wizard"
                ? "bg-[#ccf32f] text-black font-semibold shadow-md"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Member Onboarding
          </button>

          <button
            onClick={() => setActiveTab("governance")}
            className={`px-5 py-2 rounded-full text-xs font-medium transition-all flex items-center gap-2 ${
              activeTab === "governance"
                ? "bg-[#ccf32f] text-black font-semibold shadow-md"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Secretary Queue
          </button>

          <button
            onClick={() => setActiveTab("checklist")}
            className={`px-5 py-2 rounded-full text-xs font-medium transition-all flex items-center gap-2 ${
              activeTab === "checklist"
                ? "bg-[#ccf32f] text-black font-semibold shadow-md"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Pre-Launch Checklist
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={onSeedDemo}
            className="bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-medium px-4 py-2 rounded-full border border-neutral-700 transition-colors flex items-center gap-1.5"
            title="Seed sample Chama and test members"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#ccf32f]" />
            <span>Seed Demo Data</span>
          </button>

          <div className="hidden sm:flex items-center gap-2 bg-[#ccf32f]/10 text-[#ccf32f] px-3 py-1.5 rounded-full text-xs font-mono border border-[#ccf32f]/20">
            <span className="w-2 h-2 rounded-full bg-[#ccf32f] animate-ping"></span>
            System Live
          </div>
        </div>
      </div>
    </nav>
  );
}
