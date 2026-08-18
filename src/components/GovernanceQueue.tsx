"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Clock,
  ExternalLink,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  MessageSquare,
} from "lucide-react";

const SESSION_TOKEN_KEY = "mraru_session_token";

export function GovernanceQueue() {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");

  // Secretary/Chairperson session — governance decisions require a real role
  // token now (server re-validates it), not a hardcoded member id.
  const [token, setToken] = useState<string | null>(null);
  const [loginPhone, setLoginPhone] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);

  // Reject Modal state
  const [rejectingMember, setRejectingMember] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [rejectError, setRejectError] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    setToken(window.localStorage.getItem(SESSION_TOKEN_KEY));
  }, []);

  const authHeaders = (): Record<string, string> =>
    token ? { Authorization: `Bearer ${token}` } : {};

  const signOut = () => {
    window.localStorage.removeItem(SESSION_TOKEN_KEY);
    setToken(null);
    setQueue([]);
  };

  const sendLoginOtp = async () => {
    setLoginBusy(true);
    setLoginError("");
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: loginPhone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || "Could not send login code");
        return;
      }
      setOtpSent(true);
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setLoginBusy(false);
    }
  };

  const verifyLogin = async () => {
    setLoginBusy(true);
    setLoginError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: loginPhone, code: loginCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || "Could not sign in");
        return;
      }
      window.localStorage.setItem(SESSION_TOKEN_KEY, data.token);
      setToken(data.token);
      setOtpSent(false);
      setLoginCode("");
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setLoginBusy(false);
    }
  };

  const fetchQueue = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/governance/queue", { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) {
        setQueue(data.queue || []);
      } else if (res.status === 401 || res.status === 403) {
        signOut();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleApprove = async (memberId: string) => {
    try {
      const res = await fetch("/api/governance/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ memberId, action: "approve" }),
      });
      if (res.ok) {
        fetchQueue();
      } else if (res.status === 401 || res.status === 403) {
        signOut();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectingMember) return;
    if (rejectionReason.trim().length < 10) {
      setRejectError("Rejection reason is mandatory and must be at least 10 characters long.");
      return;
    }

    setSubmitting(true);
    setRejectError("");
    try {
      const res = await fetch("/api/governance/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          memberId: rejectingMember.id,
          action: "reject",
          rejectionReason,
        }),
      });
      if (res.ok) {
        setRejectingMember(null);
        setRejectionReason("");
        fetchQueue();
      } else {
        const data = await res.json();
        if (res.status === 401 || res.status === 403) signOut();
        setRejectError(data.error);
      }
    } catch (err: any) {
      setRejectError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredQueue = queue.filter(
    (item) =>
      item.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      item.phone?.includes(search)
  );

  if (!token) {
    return (
      <div className="max-w-sm mx-auto bg-neutral-50 border border-neutral-100 rounded-[2rem] p-6 sm:p-8 space-y-4 shadow-sm text-neutral-900 font-sans">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-neutral-500 font-bold">
            SECTION 9 GOVERNANCE MODULE
          </span>
          <h2 className="text-xl font-bold text-neutral-900 mt-1 tracking-tight">Secretary / Chairperson Sign In</h2>
          <p className="text-xs text-neutral-500 mt-1">
            Governance decisions require a role-verified session — sign in with your registered phone.
          </p>
        </div>

        {loginError && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs">
            {loginError}
          </div>
        )}

        <input
          type="tel"
          placeholder="Phone number (e.g. 0712345678)"
          value={loginPhone}
          onChange={(e) => setLoginPhone(e.target.value)}
          disabled={otpSent}
          className="w-full bg-white border border-neutral-200 rounded-full py-2.5 px-4 text-sm focus:outline-none focus:border-[#ccf32f] disabled:opacity-50"
        />

        {otpSent && (
          <input
            type="text"
            placeholder="6-digit code"
            value={loginCode}
            onChange={(e) => setLoginCode(e.target.value)}
            className="w-full bg-white border border-neutral-200 rounded-full py-2.5 px-4 text-sm focus:outline-none focus:border-[#ccf32f]"
          />
        )}

        <button
          onClick={otpSent ? verifyLogin : sendLoginOtp}
          disabled={loginBusy || !loginPhone || (otpSent && loginCode.length < 6)}
          className="w-full bg-black text-white font-semibold py-2.5 rounded-full text-sm hover:bg-neutral-800 transition-transform hover:scale-105 disabled:opacity-40"
        >
          {loginBusy ? "Please wait..." : otpSent ? "Verify & Sign In" : "Send Code"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-neutral-900 font-sans">
      {/* Header Card (Pro Finance Style) */}
      <div className="bg-neutral-50 border border-neutral-100 rounded-[2rem] p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-neutral-500 font-bold">
            SECTION 9 GOVERNANCE MODULE
          </span>
          <h2 className="text-2xl font-bold text-neutral-900 mt-1 tracking-tight">Secretary / Chairperson Approval Queue</h2>
          <p className="text-xs text-neutral-500 mt-1">
            Review candidates awaiting membership clearance. Aging indicator flags items &gt;48h.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-white border border-neutral-200 rounded-full py-2 pl-9 pr-4 text-xs text-neutral-900 focus:outline-none focus:border-[#ccf32f]"
            />
          </div>

          <button
            onClick={fetchQueue}
            className="bg-white hover:bg-neutral-100 p-2.5 rounded-full border border-neutral-200 text-black transition-colors shadow-sm"
            title="Refresh queue"
          >
            <RefreshCw className="w-4 h-4 text-black" />
          </button>

          <button
            onClick={signOut}
            className="bg-white hover:bg-neutral-100 px-4 py-2.5 rounded-full border border-neutral-200 text-black text-xs font-semibold transition-colors shadow-sm"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Queue List Table */}
      <div className="bg-neutral-50 border border-neutral-100 rounded-[2rem] p-6 shadow-sm">
        {loading ? (
          <div className="text-center py-12 text-neutral-500 text-xs font-mono">
            Loading governance candidates...
          </div>
        ) : filteredQueue.length === 0 ? (
          <div className="text-center py-12 text-neutral-500">
            <Users className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
            <p className="text-base font-semibold text-neutral-900">Queue Clear!</p>
            <p className="text-xs text-neutral-500 mt-1">No pending candidates requiring governance approval.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-400 font-mono uppercase tracking-wider">
                  <th className="py-3.5 px-4">Candidate Details</th>
                  <th className="py-3.5 px-4">KYC Clearance</th>
                  <th className="py-3.5 px-4">Time in Queue (Aging)</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/60">
                {filteredQueue.map((item) => (
                  <tr key={item.id} className="hover:bg-white transition-colors">
                    {/* Candidate */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-neutral-900 text-white flex items-center justify-center font-bold">
                          {item.fullName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-neutral-900">{item.fullName}</p>
                          <p className="text-xs font-mono text-neutral-500">{item.phone}</p>
                        </div>
                      </div>
                    </td>

                    {/* KYC Badge */}
                    <td className="py-4 px-4">
                      <div className="space-y-1">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase ${
                            item.kycStatus === "approved"
                              ? "bg-green-100 text-green-800 border border-green-200"
                              : "bg-amber-100 text-amber-800 border border-amber-200"
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                          {item.kycStatus}
                        </span>

                        {item.diditConsoleUrl && (
                          <div>
                            <a
                              href={item.diditConsoleUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-black font-semibold hover:underline inline-flex items-center gap-1 font-mono"
                            >
                              Didit Console Case <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Time in Queue aging indicator */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <Clock className={`w-4 h-4 ${item.isAgingWarning ? "text-red-500 animate-bounce" : "text-neutral-400"}`} />
                        <span
                          className={`font-mono text-xs px-2.5 py-1 rounded-md ${
                            item.isAgingWarning
                              ? "bg-red-100 text-red-800 font-bold border border-red-200"
                              : "bg-white text-neutral-800 border border-neutral-200"
                          }`}
                        >
                          {item.hoursInQueue}h in queue
                          {item.isAgingWarning && " (>48h Warning)"}
                        </span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleApprove(item.id)}
                          className="bg-black text-white font-medium px-4 py-2 rounded-full text-xs hover:bg-neutral-800 transition-transform hover:scale-105 flex items-center gap-1.5 shadow-sm"
                        >
                          <CheckCircle className="w-3.5 h-3.5 text-[#ccf32f]" />
                          Approve
                        </button>

                        <button
                          onClick={() => {
                            setRejectingMember(item);
                            setRejectionReason("");
                            setRejectError("");
                          }}
                          className="bg-red-50 hover:bg-red-100 text-red-700 font-semibold px-4 py-2 rounded-full text-xs border border-red-200 transition-colors flex items-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mandatory Rejection Reason Modal */}
      {rejectingMember && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-100 rounded-[2rem] p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center border border-red-200">
                  <XCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900">Reject Candidate Application</h3>
                  <p className="text-xs text-neutral-500">Candidate: {rejectingMember.fullName}</p>
                </div>
              </div>
            </div>

            {rejectError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{rejectError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-2">
                Mandatory Rejection Reason (Minimum 10 characters)
              </label>
              <textarea
                rows={4}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="State clear reason (e.g. Identity document name mismatch with Chama registration record)..."
                className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl p-4 text-xs text-neutral-900 focus:outline-none focus:border-red-500 font-sans"
              />
              <p className="text-[10px] text-neutral-500 mt-1">
                This reason will be logged in audit_log and dispatched to candidate via SMS.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setRejectingMember(null)}
                className="bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold px-5 py-2.5 rounded-full"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={submitting || rejectionReason.trim().length < 10}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-6 py-2.5 rounded-full disabled:opacity-40 transition-colors shadow-sm"
              >
                {submitting ? "Submitting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
