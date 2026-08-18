"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Shield, Camera, FileCheck, CheckCircle2, ArrowRight, XCircle } from "lucide-react";

function KycSimulatorContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id") || "didit_sess_demo";
  const memberId = searchParams.get("member_id") || "mem_demo";

  const [step, setStep] = useState<"id_doc" | "liveness" | "processing" | "done">("id_doc");
  const [outcome, setOutcome] = useState<"Approved" | "Declined" | "In Review">("Approved");
  const [submitting, setSubmitting] = useState(false);

  const handleCompleteVerification = async (selectedOutcome: "Approved" | "Declined" | "In Review") => {
    setStep("processing");
    setSubmitting(true);

    setTimeout(async () => {
      try {
        await fetch("/api/simulator/didit-webhook", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            session_id: sessionId,
            vendor_data: memberId,
            status: selectedOutcome,
            decline_reason: selectedOutcome === "Declined" ? "Document expired or unreadable scan" : null,
            retriable: selectedOutcome === "Declined",
          }),
        });
        setOutcome(selectedOutcome);
        setStep("done");
      } catch (err) {
        console.error(err);
      } finally {
        setSubmitting(false);
      }
    }, 1500);
  };

  return (
    <div className="max-w-md w-full bg-white border border-neutral-100 rounded-[2.5rem] p-8 shadow-2xl space-y-6 text-neutral-900 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#C8F169] text-black flex items-center justify-center font-bold">
            <Shield className="w-4 h-4 text-black" />
          </div>
          <div>
            <span className="text-sm font-bold tracking-tight text-neutral-900">Didit Identity Verification</span>
            <p className="text-[10px] font-mono text-neutral-400">Hosted Sandbox v3</p>
          </div>
        </div>
        <span className="text-[10px] font-mono bg-neutral-100 px-2.5 py-1 rounded text-black font-semibold border border-neutral-200">
          {sessionId.slice(0, 16)}...
        </span>
      </div>

      {step === "id_doc" && (
        <div className="space-y-6 text-center">
          <div className="w-16 h-16 rounded-full bg-[#C8F169] text-black mx-auto flex items-center justify-center shadow-md">
            <FileCheck className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-neutral-900">Step 1: Upload Government ID</h3>
            <p className="text-xs text-neutral-500 mt-1">
              Scan Kenyan National ID Card or Passport. Image documents remain hosted on Didit&apos;s EU servers.
            </p>
          </div>

          <button
            onClick={() => setStep("liveness")}
            className="w-full bg-[#C8F169] text-black font-semibold py-3.5 rounded-full hover:bg-[#b4e150] transition-transform hover:scale-[1.01] flex items-center justify-center gap-2 shadow-sm"
          >
            <span>Capture ID Document</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {step === "liveness" && (
        <div className="space-y-6 text-center">
          <div className="w-24 h-24 rounded-full bg-neutral-50 border-2 border-dashed border-[#C8F169] mx-auto flex items-center justify-center relative overflow-hidden">
            <Camera className="w-8 h-8 text-black animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-neutral-900">Step 2: Biometric Liveness Check</h3>
            <p className="text-xs text-neutral-500 mt-1">
              Center your face in the oval frame and blink slowly to verify liveness.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] text-neutral-500 font-mono">Select simulated decision outcome:</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleCompleteVerification("Approved")}
                className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold py-3 rounded-xl shadow-sm"
              >
                Approve (0.99)
              </button>
              <button
                onClick={() => handleCompleteVerification("In Review")}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold py-3 rounded-xl shadow-sm"
              >
                In Review
              </button>
              <button
                onClick={() => handleCompleteVerification("Declined")}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold py-3 rounded-xl shadow-sm"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "processing" && (
        <div className="space-y-6 text-center py-8">
          <div className="w-12 h-12 border-4 border-[#C8F169] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div>
            <h3 className="text-base font-semibold text-neutral-900">Processing Verification & Signing HMAC Webhook...</h3>
            <p className="text-xs text-neutral-500 mt-1">Evaluating document OCR, face match, and liveness score...</p>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="space-y-6 text-center py-4">
          <div
            className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center ${
              outcome === "Approved"
                ? "bg-green-500 text-white"
                : outcome === "In Review"
                ? "bg-amber-500 text-white"
                : "bg-red-500 text-white"
            }`}
          >
            {outcome === "Approved" ? (
              <CheckCircle2 className="w-10 h-10" />
            ) : (
              <XCircle className="w-10 h-10" />
            )}
          </div>

          <div>
            <h3 className="text-xl font-bold text-neutral-900">Verification Submitted: {outcome}</h3>
            <p className="text-xs text-neutral-500 mt-1">
              HMAC Signed webhook x-signature-v2 dispatched to Mraru endpoint.
            </p>
          </div>

          <button
            onClick={() => window.close()}
            className="w-full bg-black hover:bg-neutral-800 text-white font-semibold py-3 rounded-full text-xs shadow-md"
          >
            Return to Mraru Platform
          </button>
        </div>
      )}
    </div>
  );
}

export default function KycSimulatorPage() {
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900 flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-black text-sm font-semibold">Loading KYC Sandbox...</div>}>
        <KycSimulatorContent />
      </Suspense>
    </main>
  );
}
