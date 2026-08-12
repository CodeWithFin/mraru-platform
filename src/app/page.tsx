"use client";

import React, { useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  Box,
  Check,
  CheckCircle2,
  Coins,
  Headset,
  LayoutGrid,
  MoreHorizontal,
  Music,
  Search as SearchIcon,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Users,
  Wind,
  X,
  Zap,
  Sparkles,
  Building,
  TrendingUp,
} from "lucide-react";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { GovernanceQueue } from "@/components/GovernanceQueue";
import { TestChecklistRunner } from "@/components/TestChecklistRunner";
import { ErrorLookupTable } from "@/components/ErrorLookupTable";
import { OnboardingState } from "@/lib/types";

export default function Home() {
  const [showModal, setShowModal] = useState<boolean>(false);
  const [modalTab, setModalTab] = useState<"wizard" | "governance" | "checklist" | "errors">("wizard");
  const [currentState, setCurrentState] = useState<OnboardingState>("started");

  const openModule = (tab: "wizard" | "governance" | "checklist" | "errors") => {
    setModalTab(tab);
    setShowModal(true);
  };

  const handleSeedDemo = async () => {
    try {
      const res = await fetch("/api/simulator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed_demo_data" }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(
          `Mraru Chama Demo Data Seeded!\n\nChama: Tumaini Women Chama\nInvite Code: ${data.inviteCode}\nQueue populated with sample candidates!`
        );
      }
    } catch (e: any) {
      alert("Error seeding demo data: " + e.message);
    }
  };

  return (
    <div className="bg-white text-neutral-900 antialiased selection:bg-[#ccf32f] selection:text-black font-sans min-h-screen">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-neutral-100">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => openModule("wizard")}>
            <div className="w-4 h-4 rounded-full bg-[#ccf32f]"></div>
            <span className="text-lg font-medium tracking-tight text-black">Mraru Chama</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-base font-medium text-neutral-500">
            <a href="#about" className="hover:text-black transition-colors">
              About Us
            </a>
            <a href="#features" className="hover:text-black transition-colors">
              Features
            </a>
            <a href="#advantages" className="hover:text-black transition-colors">
              Advantages
            </a>
            <button onClick={() => openModule("governance")} className="hover:text-black transition-colors">
              Governance
            </button>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => openModule("governance")}
              className="hidden sm:block text-base font-medium hover:text-neutral-600 transition-colors"
            >
              Log In
            </button>
            <button
              onClick={() => openModule("wizard")}
              className="bg-black text-white text-sm font-medium px-5 py-2.5 rounded-full hover:bg-neutral-800 transition-colors flex items-center gap-2 shadow-sm"
            >
              <ShieldCheck className="w-4 h-4 text-[#ccf32f]" />
              <span>Start Onboarding</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="w-full overflow-hidden">
        {/* Hero Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-4">
          <div className="relative bg-[#ccf32f] rounded-[2.5rem] p-8 md:p-16 overflow-hidden min-h-[600px] md:min-h-[700px] flex flex-col md:block">
            {/* Hero Content */}
            <div className="relative z-10 max-w-xl mt-8 md:mt-16">
              <h1 className="text-5xl md:text-7xl font-medium tracking-tight leading-[1.1] mb-6 text-black">
                Invest for <br />
                the Future
                <span className="inline-block relative top-[-20px] ml-2">
                  <Star className="w-10 h-10 text-black/80 fill-current inline" />
                </span>
              </h1>
              <p className="text-xl md:text-2xl font-normal text-neutral-800 mb-10 max-w-md leading-relaxed">
                Work with all the necessary information and tools to boost money flow from your capital investment using Mraru Chama!
              </p>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <button
                  onClick={() => openModule("wizard")}
                  className="bg-black text-white text-base font-medium px-7 py-3.5 rounded-full hover:bg-neutral-800 transition-transform hover:scale-105 flex items-center gap-2 shadow-lg"
                >
                  <ShieldCheck className="w-5 h-5 text-[#ccf32f]" />
                  <span>Start Onboarding</span>
                </button>
                <a href="#features" className="text-base font-medium flex items-center gap-2 group text-black">
                  Find Out More
                  <ArrowDown className="w-4 h-4 group-hover:translate-y-1 transition-transform" />
                </a>
              </div>

              {/* Decorative Arrow */}
              <div className="absolute right-0 top-1/4 hidden md:block">
                <svg width="120" height="120" viewBox="0 0 100 100" fill="none" stroke="black" strokeWidth="1.5">
                  <path d="M10,10 Q50,10 50,50 T90,90" strokeLinecap="round" />
                  <path d="M80,90 L90,90 L90,80" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>

            {/* Hero Phones Mockup (CSS Only) */}
            <div className="relative md:absolute md:top-12 md:-right-20 mt-12 md:mt-0 flex justify-center md:block transform scale-90 md:scale-100">
              {/* Back Phone */}
              <div className="absolute top-0 -left-20 md:-left-32 w-[280px] h-[580px] bg-white rounded-[3rem] border-[8px] border-white shadow-2xl rotate-[-6deg] overflow-hidden hidden lg:block opacity-90 z-0 text-neutral-900">
                {/* Header */}
                <div className="px-6 py-6 bg-neutral-50 border-b border-neutral-100">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xl font-medium tracking-tight">Chama Pools</span>
                    <SlidersHorizontal className="w-5 h-5 text-neutral-400" />
                  </div>
                  <div className="w-full bg-white h-10 rounded-xl border border-neutral-200 flex items-center px-3 gap-2">
                    <SearchIcon className="w-4 h-4 text-neutral-400" />
                    <span className="text-sm text-neutral-400">Find Chama assets...</span>
                  </div>
                </div>
                {/* Content */}
                <div className="p-4 space-y-4">
                  <div className="bg-black text-white p-4 rounded-2xl">
                    <span className="text-xs text-neutral-400 uppercase">Dividend Strategy</span>
                    <div className="flex justify-between items-end mt-2">
                      <span className="text-2xl font-medium tracking-tight">+14.48%</span>
                      <div className="flex -space-x-2">
                        <div className="w-6 h-6 rounded-full bg-blue-400"></div>
                        <div className="w-6 h-6 rounded-full bg-red-400"></div>
                        <div className="w-6 h-6 rounded-full bg-white text-[8px] flex items-center justify-center text-black font-bold">
                          +2
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* List Items */}
                  <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-neutral-100">
                        <Building className="w-5 h-5 text-black" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Nairobi Land Pool</p>
                        <p className="text-xs text-neutral-500">KES 132,150</p>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-green-600">+1.2%</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white">
                        <TrendingUp className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Agribusiness Pool</p>
                        <p className="text-xs text-neutral-500">KES 292,920</p>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-green-600">+2.4%</span>
                  </div>
                </div>
              </div>

              {/* Front Phone */}
              <div className="relative w-[300px] h-[600px] bg-black rounded-[3.5rem] border-[10px] border-black shadow-2xl z-10 overflow-hidden">
                {/* Notch area */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-b-2xl z-20"></div>

                {/* Screen Content */}
                <div className="w-full h-full bg-black text-white pt-10 px-6 flex flex-col">
                  {/* Header */}
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-black">
                        <Building className="w-5 h-5 text-black" />
                      </div>
                      <div>
                        <h3 className="text-lg font-medium leading-none">Mraru Capital</h3>
                        <span className="text-xs text-neutral-500">MRARU</span>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-full border border-neutral-800 flex items-center justify-center">
                      <Star className="w-4 h-4 text-neutral-400" />
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    <h2 className="text-3xl font-medium tracking-tight">KES 1,321,500</h2>
                    <span className="text-green-400 text-sm font-medium">+12.5% (+KES 173,000)</span>
                  </div>

                  {/* Chart Visualization */}
                  <div className="relative h-48 w-full mb-6">
                    {/* Grid lines */}
                    <div className="absolute inset-0 grid grid-rows-4 gap-4 opacity-10">
                      <div className="border-t border-white w-full"></div>
                      <div className="border-t border-white w-full"></div>
                      <div className="border-t border-white w-full"></div>
                      <div className="border-t border-white w-full"></div>
                    </div>
                    {/* Candles */}
                    <div className="absolute bottom-0 left-0 right-0 h-full flex items-end justify-between px-2 gap-1">
                      <div className="w-2 h-[40%] bg-red-500 rounded-sm"></div>
                      <div className="w-2 h-[60%] bg-green-500 rounded-sm"></div>
                      <div className="w-2 h-[55%] bg-green-500 rounded-sm"></div>
                      <div className="w-2 h-[45%] bg-red-500 rounded-sm"></div>
                      <div className="w-2 h-[70%] bg-green-500 rounded-sm"></div>
                      <div className="w-2 h-[85%] bg-green-500 rounded-sm"></div>
                      <div className="w-2 h-[75%] bg-red-500 rounded-sm"></div>
                      <div className="w-2 h-[90%] bg-green-500 rounded-sm shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                      <div className="w-2 h-[60%] bg-green-500 opacity-30 rounded-sm"></div>
                      <div className="w-2 h-[40%] bg-red-500 opacity-30 rounded-sm"></div>
                    </div>
                  </div>

                  {/* Timeframe Selector */}
                  <div className="flex justify-between bg-neutral-900 rounded-xl p-1 mb-6">
                    <button className="text-xs font-medium text-neutral-500 py-1.5 px-3">1H</button>
                    <button className="text-xs font-medium text-neutral-500 py-1.5 px-3">4H</button>
                    <button className="text-xs font-medium text-black bg-white rounded-lg py-1.5 px-3 shadow-sm">
                      Day
                    </button>
                    <button className="text-xs font-medium text-neutral-500 py-1.5 px-3">Week</button>
                    <button className="text-xs font-medium text-neutral-500 py-1.5 px-3">Month</button>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-mono">Open Pool</p>
                      <p className="text-sm font-medium">KES 1,304,200</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-mono">High Pool</p>
                      <p className="text-sm font-medium">KES 1,330,000</p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-auto pb-8 flex gap-3">
                    <button
                      onClick={() => openModule("governance")}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-3 rounded-xl transition-colors text-xs"
                    >
                      Withdraw
                    </button>
                    <button
                      onClick={() => openModule("wizard")}
                      className="flex-1 bg-[#ccf32f] hover:bg-[#bce325] text-black font-medium py-3 rounded-xl transition-colors text-xs"
                    >
                      Contribute
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features Split Section */}
        <section id="features" className="max-w-7xl mx-auto px-6 py-24">
          <h2 className="text-3xl md:text-5xl font-medium tracking-tight mb-16 max-w-lg">
            Get the Most Out <br /> of Your Investments
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Card 1 */}
            <div className="bg-neutral-50 rounded-[2rem] p-10 relative overflow-hidden group hover:shadow-lg transition-shadow duration-300">
              <div className="relative z-10 max-w-sm">
                <h3 className="text-xl font-medium mb-3">Unlimited Portfolio Accounts</h3>
                <p className="text-lg text-neutral-500 mb-8 leading-relaxed">
                  Manage all your financial assets from one place smoothly.
                </p>
                <button
                  onClick={() => openModule("wizard")}
                  className="inline-flex items-center gap-2 text-sm font-medium hover:gap-3 transition-all text-black"
                >
                  Read More <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              {/* Abstract Doodle */}
              <div className="absolute -bottom-10 -right-10 w-48 h-48">
                <div className="absolute bottom-0 right-0 w-32 h-32 bg-[#ccf32f] rounded-full mix-blend-multiply opacity-80"></div>
                <div className="absolute bottom-4 right-16 w-24 h-40 bg-black rounded-full mix-blend-multiply opacity-90 rotate-12"></div>
                <svg
                  className="absolute bottom-10 right-4 w-20 h-20 text-black z-20"
                  viewBox="0 0 100 100"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M10,50 C30,20 70,80 90,50" />
                  <circle cx="85" cy="45" r="5" fill="none" />
                </svg>
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-neutral-50 rounded-[2rem] p-10 relative overflow-hidden group hover:shadow-lg transition-shadow duration-300">
              <div className="relative z-10 max-w-sm">
                <h3 className="text-xl font-medium mb-3">Full Analytics in Your App</h3>
                <p className="text-lg text-neutral-500 mb-8 leading-relaxed">
                  Analyze the results and try different strategies for more income.
                </p>
                <button
                  onClick={() => openModule("checklist")}
                  className="inline-flex items-center gap-2 text-sm font-medium hover:gap-3 transition-all text-black"
                >
                  Read More <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              {/* Abstract Chart */}
              <div className="absolute bottom-8 right-8 w-40 h-40">
                <div className="absolute inset-0 border-[12px] border-red-400/20 rounded-full border-t-red-400 border-r-transparent rotate-45"></div>
                <div className="absolute inset-0 border-[12px] border-[#ccf32f]/20 rounded-full border-l-[#ccf32f] border-b-transparent -rotate-12 scale-75"></div>
                <svg
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-12 text-black"
                  viewBox="0 0 100 50"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline
                    points="0,50 20,40 40,45 60,10 80,20 100,5"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
          </div>
        </section>

        {/* Advantages Section */}
        <section id="advantages" className="max-w-7xl mx-auto px-6 mb-24">
          <h2 className="text-3xl md:text-5xl font-medium tracking-tight mb-6">Advantages</h2>
          <p className="text-lg text-neutral-500 max-w-md mb-16 leading-relaxed">
            We listen to our customers and work with them to improve the user experience of our platform.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-16">
            {/* Item 1 */}
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#ccf32f] flex items-center justify-center">
                <Zap className="w-6 h-6 text-black" />
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">Smooth Start</h3>
                <p className="text-lg text-neutral-500 leading-relaxed mb-4">
                  Without a visit to the office, we will set up your Chama account in 5 minutes.
                </p>
                <button
                  onClick={() => openModule("wizard")}
                  className="bg-neutral-100 hover:bg-neutral-200 px-4 py-2 rounded-lg text-xs font-medium transition-colors text-black"
                >
                  Open an Account
                </button>
              </div>
            </div>

            {/* Item 2 */}
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#ccf32f]/40 flex items-center justify-center">
                <Headset className="w-6 h-6 text-black" />
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">24/7 Support</h3>
                <p className="text-lg text-neutral-500 leading-relaxed mb-4">
                  Our support team is always available to answer questions and resolve any issues.
                </p>
                <button
                  onClick={() => openModule("errors")}
                  className="bg-neutral-100 hover:bg-neutral-200 px-4 py-2 rounded-lg text-xs font-medium transition-colors text-black"
                >
                  Ask a Question
                </button>
              </div>
            </div>

            {/* Item 3 */}
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#ccf32f]/40 flex items-center justify-center">
                <Coins className="w-6 h-6 text-black" />
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">Low Commissions</h3>
                <p className="text-lg text-neutral-500 leading-relaxed mb-4">
                  We give you the best rate we can for any kind of transactions. No extra fees.
                </p>
                <button
                  onClick={() => openModule("governance")}
                  className="bg-neutral-100 hover:bg-neutral-200 px-4 py-2 rounded-lg text-xs font-medium transition-colors text-black"
                >
                  Explore Prices
                </button>
              </div>
            </div>

            {/* Item 4 */}
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#ccf32f]/40 flex items-center justify-center">
                <Check className="w-6 h-6 text-black" />
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">Invest Any Amount</h3>
                <p className="text-lg text-neutral-500 leading-relaxed mb-4">
                  You don&apos;t have to have large sums to start investing, start small.
                </p>
                <button
                  onClick={() => openModule("wizard")}
                  className="bg-neutral-100 hover:bg-neutral-200 px-4 py-2 rounded-lg text-xs font-medium transition-colors text-black"
                >
                  Start Now
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Partners */}
        <section className="max-w-7xl mx-auto px-6 mb-24 text-center">
          <h3 className="text-2xl font-medium mb-2">Our Partners</h3>
          <p className="text-neutral-500 mb-10 text-lg">
            The largest banks, funds and exchanges from <br /> all over the world cooperate with us
          </p>

          <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-60 grayscale">
            <div className="w-12 h-12 bg-neutral-100 rounded-full flex items-center justify-center p-3">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 22h20L12 2zm0 4l6 14H6l6-14z" />
              </svg>
            </div>
            <div className="w-12 h-12 bg-neutral-100 rounded-full flex items-center justify-center p-3">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <circle cx="8" cy="12" r="6" />
                <circle cx="16" cy="12" r="6" opacity="0.5" />
              </svg>
            </div>
            <div className="w-12 h-12 bg-neutral-100 rounded-full flex items-center justify-center p-3">
              <span className="font-bold text-xs">CITI</span>
            </div>
            <div className="w-12 h-12 bg-neutral-100 rounded-full flex items-center justify-center p-3">
              <span className="font-bold text-xs italic">VISA</span>
            </div>
            <div className="w-12 h-12 bg-neutral-100 rounded-full flex items-center justify-center p-3">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M2 12l10-10 10 10-10 10L2 12zm2 0l8 8 8-8-8-8-8 8z" />
              </svg>
            </div>
          </div>
        </section>

        {/* Dark Pulse Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 mb-24">
          <div className="bg-black rounded-[2.5rem] p-8 md:p-20 relative overflow-hidden flex flex-col md:flex-row items-center justify-between min-h-[400px]">
            <div className="relative z-10 w-full md:w-1/2">
              <svg className="absolute -top-16 left-0 w-32 h-10 text-white/20" viewBox="0 0 100 20" fill="none" stroke="currentColor">
                <path d="M0,20 Q20,0 50,10 T100,20" />
              </svg>
              <h2 className="text-3xl md:text-5xl font-medium text-white tracking-tight mb-8 leading-tight">
                Keep Your Finger on the <br />
                Investment Market Pulse
              </h2>
              <button
                onClick={() => openModule("wizard")}
                className="bg-white text-black text-sm font-medium px-6 py-3 rounded-full hover:bg-neutral-200 transition-colors flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 fill-current text-black" />
                <span>Start Onboarding</span>
              </button>
            </div>

            {/* Floating UI Card */}
            <div className="relative z-10 mt-12 md:mt-0 w-full max-w-xs transform md:translate-x-10 text-neutral-900">
              <div className="bg-white rounded-3xl p-5 shadow-2xl relative">
                <div className="text-center mb-4">
                  <span className="text-xs text-neutral-400 uppercase tracking-widest">Total Balance</span>
                  <h3 className="text-3xl font-medium tracking-tight">KES 1,698,831</h3>
                  <span className="inline-block bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-semibold mt-1">
                    +KES 124,723 23.8%
                  </span>
                </div>
                <div className="bg-black rounded-xl p-4 mb-4 text-white">
                  <div className="flex justify-between items-center text-white mb-2">
                    <span className="text-xs font-medium">Chama Account</span>
                    <MoreHorizontal className="w-4 h-4 text-neutral-500" />
                  </div>
                  <div className="text-white text-lg font-medium">KES 573,870</div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => openModule("governance")}
                      className="flex-1 bg-neutral-800 text-white text-[10px] py-1.5 rounded-lg border border-neutral-700"
                    >
                      Governance
                    </button>
                    <button
                      onClick={() => openModule("wizard")}
                      className="flex-1 bg-[#ccf32f] text-black text-[10px] py-1.5 rounded-lg font-bold"
                    >
                      Onboard
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-neutral-100 flex items-center justify-center">
                        <Building className="w-3 h-3 text-black" />
                      </div>
                      <span className="text-xs font-medium">Real Estate Pool</span>
                    </div>
                    <span className="text-xs font-medium text-green-600">+KES 18,825</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                        <TrendingUp className="w-3 h-3" />
                      </div>
                      <span className="text-xs font-medium">Agribusiness Pool</span>
                    </div>
                    <span className="text-xs font-medium text-green-600">+KES 140,271</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Background Abstract */}
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black to-neutral-900">
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-neutral-800/30 rounded-full blur-3xl"></div>
            </div>
          </div>
        </section>

        {/* Feature: Real Time */}
        <section className="max-w-7xl mx-auto px-6 mb-32 flex flex-col md:flex-row items-center gap-16">
          <div className="w-full md:w-1/2 relative">
            <div className="absolute -top-4 -left-4 w-full h-full bg-[#ccf32f] rounded-[2rem] transform -rotate-2"></div>
            <div className="relative bg-neutral-950 rounded-[2rem] p-6 text-white shadow-xl h-64 overflow-hidden flex flex-col justify-end">
              <span className="absolute top-4 right-6 text-xs text-neutral-400 font-mono">
                135.76 <br /> <span className="text-green-400">+1.25%</span>
              </span>
              <svg viewBox="0 0 300 100" className="w-full h-full opacity-90 overflow-visible">
                <defs>
                  <linearGradient id="gradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#4ade80" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#4ade80" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,80 L20,70 L40,85 L60,60 L80,65 L100,40 L120,55 L140,30 L160,45 L180,20 L200,35 L220,15 L240,25 L300,5"
                  fill="none"
                  stroke="#e5e5e5"
                  strokeWidth="1"
                />
                <path
                  d="M0,80 L20,70 L40,85 L60,60 L80,65 L100,40 L120,55 L140,30 L160,45 L180,20 L200,35 L220,15 L240,25 L300,5 V100 H0 Z"
                  fill="url(#gradient)"
                />
              </svg>
            </div>
          </div>
          <div className="w-full md:w-1/2">
            <h2 className="text-3xl md:text-5xl font-medium tracking-tight mb-6">Trade in Real Time</h2>
            <p className="text-lg text-neutral-500 leading-relaxed">
              No more waiting. Your orders are executed immediately, the price of your securities is updated every second and ProFinance always has the most relevant information.
            </p>
          </div>
        </section>

        {/* Feature: Stonks */}
        <section className="max-w-7xl mx-auto px-6 mb-32 flex flex-col-reverse md:flex-row items-center gap-16">
          <div className="w-full md:w-1/2">
            <h2 className="text-3xl md:text-5xl font-medium tracking-tight mb-6">
              100,000+ <br /> Stonks in Your App
            </h2>
            <p className="text-lg text-neutral-500 leading-relaxed mb-6">
              Trade through ProFinance and you&apos;ll gain access to thousands of financial markets from around the world, using a wide range of investment tools.
            </p>
            <p className="text-lg text-neutral-500 leading-relaxed">
              We are sure you will find the paper that&apos;s right for your investment strategy.
            </p>
            <div className="mt-8 hidden md:block">
              <svg width="200" height="100" viewBox="0 0 200 100" fill="none" stroke="black" strokeWidth="1">
                <path d="M10,10 Q100,100 190,50" />
              </svg>
            </div>
          </div>

          <div className="w-full md:w-1/2 relative h-[400px]">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-[#ccf32f] rounded-full opacity-80"></div>

            <div className="absolute top-10 left-10 bg-white p-3 rounded-xl shadow-lg flex items-center gap-3 w-48 animate-bounce text-neutral-900">
              <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center">
                <Building className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold">Agribusiness Pool</p>
                <p className="text-[10px] text-neutral-500 font-mono">AGRI-01</p>
              </div>
              <div className="ml-auto text-xs font-semibold">KES 188,203</div>
            </div>

            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-3 rounded-xl shadow-lg flex items-center gap-3 w-56 z-10 text-neutral-900">
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                <LayoutGrid className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold">Table Banking Pool</p>
                <p className="text-[10px] text-neutral-500 font-mono">TBL-POOL</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-xs font-semibold">KES 140,271</p>
                <p className="text-[10px] text-red-500">-3.2%</p>
              </div>
            </div>

            <div className="absolute bottom-20 right-10 bg-white p-3 rounded-xl shadow-lg flex items-center gap-3 w-48 animate-bounce text-neutral-900">
              <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center">
                <Box className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-semibold">Real Estate Pool</p>
                <p className="text-[10px] text-neutral-500 font-mono">LAND-KEN</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-xs font-semibold">KES 669,120</p>
                <p className="text-[10px] text-green-500">+11.7%</p>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="max-w-7xl mx-auto px-6 mb-24 text-center">
          <h2 className="text-3xl md:text-5xl font-medium tracking-tight mb-8">
            Get the App for Free <br /> and Start Now
          </h2>
          <button
            onClick={() => openModule("wizard")}
            className="bg-black text-white text-base font-medium px-8 py-4 rounded-full hover:bg-neutral-800 transition-colors inline-flex items-center gap-2 shadow-xl"
          >
            <ShieldCheck className="w-5 h-5 text-[#ccf32f]" />
            <span>Start Onboarding</span>
          </button>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-black text-white pt-20 pb-10 rounded-t-[3rem] mt-10">
        <div className="max-w-7xl mx-auto px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 border-b border-neutral-800 pb-16">
            <div className="col-span-1">
              <div className="flex items-center gap-2 mb-8">
                <div className="w-4 h-4 rounded-full bg-[#ccf32f]"></div>
                <span className="text-lg font-medium text-white">Mraru Chama</span>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white mb-6">Resources</h4>
              <ul className="space-y-4 text-sm text-neutral-400">
                <li>
                  <button onClick={() => openModule("wizard")} className="hover:text-white transition-colors">
                    Member Registration
                  </button>
                </li>
                <li>
                  <button onClick={() => openModule("governance")} className="hover:text-white transition-colors">
                    Secretary Queue
                  </button>
                </li>
                <li>
                  <button onClick={() => openModule("checklist")} className="hover:text-white transition-colors">
                    Test Suite
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white mb-6">Company</h4>
              <ul className="space-y-4 text-sm text-neutral-400">
                <li>
                  <a href="#features" className="hover:text-white transition-colors">
                    About Mraru
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Terms of Governance
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white mb-6">Subscribe to News</h4>
              <div className="relative">
                <input
                  type="email"
                  placeholder="Your e-mail"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-full py-3 pl-5 pr-12 text-sm text-white focus:outline-none focus:border-[#ccf32f]"
                />
                <button className="absolute right-2 top-1.5 w-9 h-9 bg-[#ccf32f] rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform">
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-8 text-neutral-500 text-sm">
            <p>&copy; 2026 Mraru Chama Inc. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Onboarding & Governance Fullscreen Interactive Modal (Pro Finance Light Aesthetic) */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white border border-neutral-100 text-neutral-900 rounded-[2.5rem] p-6 sm:p-10 max-w-5xl w-full my-auto space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto font-sans">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-3.5 h-3.5 rounded-full bg-[#ccf32f]"></div>
                <span className="text-lg font-bold text-neutral-900 tracking-tight">Mraru Chama Engine</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModalTab("wizard")}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    modalTab === "wizard"
                      ? "bg-[#ccf32f] text-black shadow-sm"
                      : "bg-neutral-100 text-neutral-600 hover:text-black"
                  }`}
                >
                  Onboarding
                </button>
                <button
                  onClick={() => setModalTab("governance")}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    modalTab === "governance"
                      ? "bg-[#ccf32f] text-black shadow-sm"
                      : "bg-neutral-100 text-neutral-600 hover:text-black"
                  }`}
                >
                  Governance Queue
                </button>
                <button
                  onClick={() => setModalTab("checklist")}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    modalTab === "checklist"
                      ? "bg-[#ccf32f] text-black shadow-sm"
                      : "bg-neutral-100 text-neutral-600 hover:text-black"
                  }`}
                >
                  12-Test Suite
                </button>

                <button
                  onClick={() => setShowModal(false)}
                  className="w-9 h-9 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-600 hover:text-black ml-4 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div>
              {modalTab === "wizard" && (
                <div className="space-y-8">
                  <OnboardingWizard onStateChange={(st) => setCurrentState(st)} />
                  <ErrorLookupTable />
                </div>
              )}

              {modalTab === "governance" && <GovernanceQueue />}

              {modalTab === "checklist" && (
                <div className="space-y-8">
                  <TestChecklistRunner />
                  <ErrorLookupTable />
                </div>
              )}

              {modalTab === "errors" && <ErrorLookupTable />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
