"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export function ErrorLookupTable() {
  const errorMap = [
    {
      failure: "OTP expired",
      message: '"That code expired — we\'ve sent a new one"',
      recovery: "Auto-resend, no extra tap",
      code: "OTP_EXPIRED",
    },
    {
      failure: "OTP wrong ×3",
      message: '"Too many attempts — try again in 15 minutes"',
      recovery: "Countdown timer, resume link via SMS",
      code: "OTP_LOCKED",
    },
    {
      failure: "Phone already registered (this chama)",
      message: '"This number is already registered — log in instead?"',
      recovery: "Link to login",
      code: "PHONE_REGISTERED",
    },
    {
      failure: "National ID duplicate (this chama)",
      message: "Route to Secretary review, don't block silently",
      recovery: "Flag in governance queue, not member-facing block",
      code: "ID_DUPLICATE",
    },
    {
      failure: "Didit declined — retriable (expired doc, blurry scan)",
      message: '"We couldn\'t verify that — let\'s try again"',
      recovery: "New session button",
      code: "DIDIT_RETRIABLE",
    },
    {
      failure: "Didit declined — non-retriable",
      message: '"We need the Secretary to look at this"',
      recovery: "Route to Secretary queue, member sees \"under review\"",
      code: "DIDIT_TERMINAL",
    },
    {
      failure: "Didit session expired before completion",
      message: "Silent — auto-generate new session",
      recovery: "No user-facing error at all",
      code: "DIDIT_SESSION_EXPIRED",
    },
    {
      failure: "Network drop mid-KYC-redirect",
      message: '"Verification in progress — check back or we\'ll SMS you"',
      recovery: "Poll + webhook will resolve it regardless",
      code: "NETWORK_DROP",
    },
    {
      failure: "Join code invalid/expired",
      message: '"That code isn\'t valid — ask your Secretary for a new link"',
      recovery: "No dead-end, always an escape hatch",
      code: "INVITE_INVALID",
    },
  ];

  return (
    <div className="bg-neutral-50 border border-neutral-100 rounded-[2rem] p-6 shadow-sm font-sans text-neutral-900">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-[#ccf32f] text-black flex items-center justify-center font-bold">
          <AlertTriangle className="w-5 h-5 text-black" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-neutral-900 tracking-tight">Explicit Error Handler Mapping</h3>
          <p className="text-xs text-neutral-500">Section 7 lookup table enforcing structured failure recoveries</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-neutral-200 text-neutral-400 font-mono uppercase tracking-wider">
              <th className="py-3 px-4">Failure Condition</th>
              <th className="py-3 px-4">User-facing Message</th>
              <th className="py-3 px-4">System Recovery Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200/60">
            {errorMap.map((err, idx) => (
              <tr key={idx} className="hover:bg-white transition-colors">
                <td className="py-3.5 px-4 font-semibold text-neutral-900 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ccf32f]"></span>
                  {err.failure}
                </td>
                <td className="py-3.5 px-4 text-neutral-800 font-mono bg-white rounded border border-neutral-100">
                  {err.message}
                </td>
                <td className="py-3.5 px-4 text-neutral-600">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ccf32f]/30 text-black font-semibold border border-[#ccf32f]/50">
                    <RefreshCw className="w-3 h-3" />
                    {err.recovery}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
