"use client";

import React, { useState, useEffect } from "react";
import {
  Phone,
  Lock,
  User,
  ShieldCheck,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Upload,
  Sparkles,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { OnboardingState } from "@/lib/types";

interface OnboardingWizardProps {
  onStateChange?: (state: OnboardingState) => void;
}

export function OnboardingWizard({ onStateChange }: OnboardingWizardProps) {
  // Path Selection: Path A (Founder) vs Path B (Member Invitee)
  const [path, setPath] = useState<"founder" | "member">("member");

  // Flow State
  const [onboardingState, setOnboardingState] = useState<OnboardingState>("started");
  const [memberId, setMemberId] = useState<string>("");
  const [chamaId, setChamaId] = useState<string>("");
  const [resumeToken, setResumeToken] = useState<string>("");

  // Step 1 Form: Phone & OTP
  const [phone, setPhone] = useState<string>("+254712345678");
  const [otpCode, setOtpCode] = useState<string>("");
  const [demoOtp, setDemoOtp] = useState<string>("");
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [lockoutTimer, setLockoutTimer] = useState<number>(0);
  const [otpError, setOtpError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  // Step 2 Form (Path A Founder Chama Setup)
  const [chamaName, setChamaName] = useState<string>("Mraru Wealth Club");
  const [county, setCounty] = useState<string>("Nairobi");
  const [chamaType, setChamaType] = useState<string>("Investment & Savings");
  const [minContribution, setMinContribution] = useState<number>(5000);
  const [contributionDueDay, setContributionDueDay] = useState<number>(5);

  // Step 2 Form (Path B Member Invite)
  const [inviteCode, setInviteCode] = useState<string>("TUMAINI-2026");

  // Step 3 Form: Personal & Next of Kin Details
  const [fullName, setFullName] = useState<string>("Jane Doe Wanjiku");
  const [email, setEmail] = useState<string>("jane.wanjiku@example.co.ke");
  const [nationalId, setNationalId] = useState<string>("32849102");
  const [nextOfKinName, setNextOfKinName] = useState<string>("David Wanjiku");
  const [nextOfKinPhone, setNextOfKinPhone] = useState<string>("+254722334455");
  const [nextOfKinRelationship, setNextOfKinRelationship] = useState<string>("Spouse");
  const [profileImageUrl, setProfileImageUrl] = useState<string>(
    "https://ik.imagekit.io/mraru/profiles/demo_user.jpg"
  );
  const [duplicateIdAlert, setDuplicateIdAlert] = useState<boolean>(false);

  // Step 4 Form: Didit KYC Hosted Session
  const [kycSessionUrl, setKycSessionUrl] = useState<string>("");
  const [kycSessionId, setKycSessionId] = useState<string>("");
  const [kycStatus, setKycStatus] = useState<string>("not_started");
  const [kycDeclineReason, setKycDeclineReason] = useState<string>("");
  const [kycRetriable, setKycRetriable] = useState<boolean>(true);

  // Step 5 Form: Constitution
  const [constitutionContent, setConstitutionContent] = useState<string>("");
  const [hasScrolledConstitution, setHasScrolledConstitution] = useState<boolean>(false);

  // Feedback notifications
  const [toastMessage, setToastMessage] = useState<string>("");
  const [copiedToken, setCopiedToken] = useState<boolean>(false);

  useEffect(() => {
    if (onStateChange) onStateChange(onboardingState);
  }, [onboardingState, onStateChange]);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutTimer <= 0) return;
    const interval = setInterval(() => {
      setLockoutTimer((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutTimer]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  // Step 1: Send OTP
  const handleSendOtp = async () => {
    setLoading(true);
    setOtpError("");
    try {
      const res = await fetch("/api/onboarding/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, isFounder: path === "founder", chamaId: path === "member" ? chamaId : null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOtpError(data.error);
        if (data.lockoutRemainingSec) setLockoutTimer(data.lockoutRemainingSec);
      } else {
        setOtpSent(true);
        setDemoOtp(data.demoCode || "");
        setOtpCode(data.demoCode || "");
        setMemberId(data.memberId);
        showToast("OTP sent via Tilil SMS!");
      }
    } catch (e: any) {
      setOtpError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Verify OTP
  const handleVerifyOtp = async () => {
    setLoading(true);
    setOtpError("");
    try {
      const res = await fetch("/api/onboarding/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: otpCode, memberId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOtpError(data.error);
        if (data.locked) setLockoutTimer(data.lockoutRemainingSec || 900);
      } else {
        setResumeToken(data.resumeToken);
        setOnboardingState(path === "founder" ? "chama_config_pending" : "details_submitted");
        showToast("Phone verified! Issued signed resume token.");
      }
    } catch (e: any) {
      setOtpError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 2 (Founder Path A): Create Chama Config
  const handleCreateChamaConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding/chama-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          chamaName,
          county,
          chamaType,
          minContributionAmount: minContribution,
          contributionDueDay,
          lendingEnabled: true,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setChamaId(data.chama.id);
        setOnboardingState("details_submitted");
        showToast("Chama configured! Proceed to personal details.");
      } else {
        showToast(data.error || "Failed to create chama");
      }
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Submit Personal & Next of Kin Details
  const handleSubmitDetails = async () => {
    setLoading(true);
    setDuplicateIdAlert(false);
    try {
      const res = await fetch("/api/onboarding/details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          fullName,
          email,
          nationalId,
          nextOfKinName,
          nextOfKinPhone,
          nextOfKinRelationship,
          profileImageUrl,
          inviteCode: path === "member" ? inviteCode : null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.duplicateFlagged) {
          setDuplicateIdAlert(true);
        }
        await handleStartKyc();
      } else {
        showToast(data.error || "Failed to submit details");
      }
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Start Didit KYC
  const handleStartKyc = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding/kyc/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      const data = await res.json();
      if (res.ok) {
        setKycSessionUrl(data.url);
        setKycSessionId(data.sessionId);
        setKycStatus("pending_review");
        setOnboardingState("kyc_pending");
        showToast("Didit KYC Session created!");
      }
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Simulate Didit Webhook Outcome
  const handleSimulateKycOutcome = async (outcomeStatus: "Approved" | "Declined" | "In Review") => {
    setLoading(true);
    try {
      const res = await fetch("/api/webhooks/didit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-signature-v2": "mock_signature",
        },
        body: JSON.stringify({
          session_id: kycSessionId || "didit_sess_mock_1",
          vendor_data: memberId,
          status: outcomeStatus,
          decline_reason: outcomeStatus === "Declined" ? "Document expired or unreadable scan" : null,
          retriable: outcomeStatus === "Declined",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (outcomeStatus === "Approved") {
          setKycStatus("approved");
          setOnboardingState("constitution_pending");
          showToast("KYC Approved! Advanced to Constitution acceptance.");
        } else if (outcomeStatus === "Declined") {
          setKycStatus("rejected");
          setOnboardingState("kyc_declined");
          setKycDeclineReason("Document expired or unreadable scan");
          setKycRetriable(true);
          showToast("KYC Declined (Retriable)");
        } else if (outcomeStatus === "In Review") {
          setKycStatus("in_review");
          setOnboardingState("kyc_in_review");
          showToast("KYC Routed to Secretary Governance Queue");
        }
      }
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 5: Accept Constitution
  const handleAcceptConstitution = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding/constitution/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, constitutionId: "const_101" }),
      });
      const data = await res.json();
      if (res.ok) {
        setOnboardingState("awaiting_governance_approval");
        showToast("Constitution accepted! Submitted to Secretary queue.");
      }
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 6: Simulate Governance Approval
  const handleSimulateSecretaryApproval = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/governance/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          action: "approve",
          secretaryMemberId: "sec_101",
        }),
      });
      if (res.ok) {
        setOnboardingState("active");
        showToast("Welcome to Mraru! Membership Approved.");
      }
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setLoading(false);
    }
  };

  const copyResumeLink = () => {
    const link = `${window.location.origin}/api/onboarding/resume?token=${resumeToken}`;
    navigator.clipboard.writeText(link);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 3000);
    showToast("Resume link copied to clipboard!");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 font-sans text-neutral-900">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#C8F169] text-black px-5 py-3 rounded-full font-semibold shadow-2xl flex items-center gap-2 border border-black/10 animate-bounce">
          <Sparkles className="w-4 h-4 fill-black" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Path Switcher Header Card (Pro Finance Style: bg-neutral-50, border-neutral-100) */}
      <div className="bg-neutral-50 border border-neutral-100 rounded-[2rem] p-6 sm:p-8 relative overflow-hidden shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-neutral-500 font-bold">
              ONBOARDING STATE MACHINE
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-neutral-900 mt-1 tracking-tight">
              {path === "founder" ? "Path A: Chama Founder Setup" : "Path B: Member Join via Invite"}
            </h2>
            <p className="text-xs text-neutral-500 mt-1">
              Current Driving Field:{" "}
              <span className="font-mono text-black font-semibold bg-[#C8F169]/40 px-2.5 py-0.5 rounded-full border border-[#C8F169]/60">
                {onboardingState}
              </span>
            </p>
          </div>

          {/* Path Toggle */}
          <div className="bg-white p-1.5 rounded-full border border-neutral-200 flex items-center gap-1 shadow-sm">
            <button
              onClick={() => {
                setPath("founder");
                setOnboardingState("started");
                setOtpSent(false);
              }}
              className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${
                path === "founder"
                  ? "bg-mraru-forest text-white font-medium shadow-md"
                  : "text-neutral-500 hover:text-black"
              }`}
            >
              Founder (Path A)
            </button>
            <button
              onClick={() => {
                setPath("member");
                setOnboardingState("started");
                setOtpSent(false);
              }}
              className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${
                path === "member"
                  ? "bg-[#C8F169] text-black font-semibold shadow-sm"
                  : "text-neutral-500 hover:text-black"
              }`}
            >
              Member Join (Path B)
            </button>
          </div>
        </div>

        {/* Signed Resume Token Banner */}
        {resumeToken && (
          <div className="mt-6 pt-4 border-t border-neutral-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-neutral-100">
            <div className="flex items-center gap-2 overflow-hidden">
              <Lock className="w-4 h-4 text-black shrink-0" />
              <div>
                <p className="text-xs font-semibold text-neutral-900">Signed Resumability Token Active</p>
                <p className="text-[10px] text-neutral-500 font-mono truncate max-w-md">
                  {resumeToken}
                </p>
              </div>
            </div>
            <button
              onClick={copyResumeLink}
              className="bg-neutral-100 hover:bg-neutral-200 text-neutral-900 text-xs font-medium px-3.5 py-1.5 rounded-full transition-colors flex items-center gap-1.5 shrink-0"
            >
              {copiedToken ? <Check className="w-3.5 h-3.5 text-black" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedToken ? "Copied Link!" : "Copy Resume Link"}
            </button>
          </div>
        )}
      </div>

      {/* Main Wizard Form Card (Pro Finance Style: bg-neutral-50, border-neutral-100) */}
      <div className="bg-neutral-50 border border-neutral-100 rounded-[2rem] p-6 sm:p-10 shadow-sm relative text-neutral-900">
        {/* STEP 1: Phone & Tilil OTP Verification */}
        {onboardingState === "started" || onboardingState === "phone_verified" ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-mraru-lime text-mraru-forest flex items-center justify-center font-bold text-lg shadow-sm">
                1
              </div>
              <div>
                <h3 className="text-xl font-semibold text-neutral-900 tracking-tight">Phone & OTP Verification</h3>
                <p className="text-xs text-neutral-500">Powered by Tilil SMS Service</p>
              </div>
            </div>

            {otpError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{otpError}</span>
              </div>
            )}

            {lockoutTimer > 0 && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl text-xs flex items-center gap-2 font-mono">
                <Clock className="w-4 h-4 shrink-0 animate-spin" />
                <span>Lockout active — try again in {Math.floor(lockoutTimer / 60)}m {lockoutTimer % 60}s</span>
              </div>
            )}

            {!otpSent ? (
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                    Phone Number (Kenyan Format)
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-2xl py-3 pl-10 pr-4 text-sm text-neutral-900 font-medium focus:outline-none focus:border-[#C8F169] focus:ring-2 focus:ring-[#C8F169]/20"
                      placeholder="+254712345678"
                    />
                  </div>
                </div>

                {path === "member" && (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                      Chama Invite Code
                    </label>
                    <input
                      type="text"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                      className="w-full bg-white border border-neutral-200 rounded-2xl py-3 px-4 text-sm font-mono text-neutral-900 font-semibold focus:outline-none focus:border-[#C8F169] focus:ring-2 focus:ring-[#C8F169]/20"
                      placeholder="TUMAINI-2026"
                    />
                  </div>
                )}

                <button
                  onClick={handleSendOtp}
                  disabled={loading || lockoutTimer > 0}
                  className="w-full bg-mraru-forest text-white font-medium py-3.5 rounded-full transition-transform hover:scale-[1.03] flex items-center justify-center gap-2 disabled:opacity-50 shadow-md"
                >
                  {loading ? "Sending SMS..." : "Send Verification Code"}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-4 max-w-md">
                <div className="bg-white p-4 rounded-2xl border border-neutral-200 text-xs text-neutral-700 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-neutral-900">SMS Sent to {phone}</span>
                    <span className="text-[10px] text-green-600 font-semibold uppercase">Tilil Delivered</span>
                  </div>
                  {demoOtp && (
                    <p className="font-mono text-black font-semibold pt-1">
                      [Demo Code: <strong className="text-mraru-lime bg-mraru-forest px-1.5 py-0.5 rounded">{demoOtp}</strong>]
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                    Enter 6-Digit OTP Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    className="w-full bg-white border border-neutral-200 rounded-2xl py-3 px-4 text-center text-xl tracking-[0.5em] font-mono text-neutral-900 font-bold focus:outline-none focus:border-[#C8F169] focus:ring-2 focus:ring-[#C8F169]/20"
                    placeholder="000000"
                  />
                </div>

                <button
                  onClick={handleVerifyOtp}
                  disabled={loading || lockoutTimer > 0}
                  className="w-full bg-mraru-lime text-mraru-forest font-semibold py-3.5 rounded-full transition-transform hover:scale-[1.03] flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
                >
                  {loading ? "Verifying..." : "Verify Code & Proceed"}
                  <CheckCircle className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ) : null}

        {/* STEP 2 (PATH A): Founder Chama Configuration */}
        {onboardingState === "chama_config_pending" && path === "founder" ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-mraru-lime text-mraru-forest flex items-center justify-center font-bold text-lg shadow-sm">
                2
              </div>
              <div>
                <h3 className="text-xl font-semibold text-neutral-900 tracking-tight">Chama Configuration (Founder Path A)</h3>
                <p className="text-xs text-neutral-500">Setup Chama parameters before member KYC</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Chama Name</label>
                <input
                  type="text"
                  value={chamaName}
                  onChange={(e) => setChamaName(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-2xl py-3 px-4 text-sm text-neutral-900 font-medium focus:outline-none focus:border-[#C8F169]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">County</label>
                <input
                  type="text"
                  value={county}
                  onChange={(e) => setCounty(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-2xl py-3 px-4 text-sm text-neutral-900 font-medium focus:outline-none focus:border-[#C8F169]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Chama Type</label>
                <select
                  value={chamaType}
                  onChange={(e) => setChamaType(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-2xl py-3 px-4 text-sm text-neutral-900 font-medium focus:outline-none focus:border-[#C8F169]"
                >
                  <option>Investment & Savings</option>
                  <option>Merry-Go-Round</option>
                  <option>Table Banking</option>
                  <option>Real Estate Syndicate</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  Monthly Min Contribution (KES)
                </label>
                <input
                  type="number"
                  value={minContribution}
                  onChange={(e) => setMinContribution(Number(e.target.value))}
                  className="w-full bg-white border border-neutral-200 rounded-2xl py-3 px-4 text-sm text-neutral-900 font-medium focus:outline-none focus:border-[#C8F169]"
                />
              </div>
            </div>

            <button
              onClick={handleCreateChamaConfig}
              disabled={loading}
              className="bg-mraru-forest text-white font-medium px-8 py-3.5 rounded-full transition-transform hover:scale-[1.03] flex items-center gap-2 shadow-md"
            >
              Save Chama Config & Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : null}

        {/* STEP 3: Personal & Next of Kin Details */}
        {onboardingState === "details_submitted" ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-mraru-lime text-mraru-forest flex items-center justify-center font-bold text-lg shadow-sm">
                3
              </div>
              <div>
                <h3 className="text-xl font-semibold text-neutral-900 tracking-tight">Personal & Next of Kin Details</h3>
                <p className="text-xs text-neutral-500">Persisted immediately to DB on submit</p>
              </div>
            </div>

            {duplicateIdAlert && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl text-xs flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  National ID matches existing record in this chama. Flagged for Secretary review (not blocked).
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-2xl py-3 px-4 text-sm text-neutral-900 font-medium focus:outline-none focus:border-[#C8F169]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">National ID Number</label>
                <input
                  type="text"
                  value={nationalId}
                  onChange={(e) => setNationalId(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-2xl py-3 px-4 text-sm text-neutral-900 font-medium focus:outline-none focus:border-[#C8F169]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-2xl py-3 px-4 text-sm text-neutral-900 font-medium focus:outline-none focus:border-[#C8F169]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Next of Kin Full Name</label>
                <input
                  type="text"
                  value={nextOfKinName}
                  onChange={(e) => setNextOfKinName(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-2xl py-3 px-4 text-sm text-neutral-900 font-medium focus:outline-none focus:border-[#C8F169]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Next of Kin Phone</label>
                <input
                  type="text"
                  value={nextOfKinPhone}
                  onChange={(e) => setNextOfKinPhone(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-2xl py-3 px-4 text-sm text-neutral-900 font-medium focus:outline-none focus:border-[#C8F169]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Relationship</label>
                <input
                  type="text"
                  value={nextOfKinRelationship}
                  onChange={(e) => setNextOfKinRelationship(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-2xl py-3 px-4 text-sm text-neutral-900 font-medium focus:outline-none focus:border-[#C8F169]"
                />
              </div>
            </div>

            {/* Profile Photo ImageKit Direct Upload */}
            <div className="bg-white p-4 rounded-2xl border border-neutral-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={profileImageUrl}
                  alt="Profile"
                  className="w-12 h-12 rounded-full object-cover border-2 border-[#C8F169]"
                />
                <div>
                  <p className="text-xs font-semibold text-neutral-900">Profile Photo Upload (ImageKit)</p>
                  <p className="text-[10px] text-neutral-500">
                    Direct client upload via /api/imagekit/auth (Never routes ID photos)
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="bg-neutral-100 hover:bg-neutral-200 text-xs font-semibold text-neutral-900 px-4 py-2 rounded-full transition-colors flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5 text-black" />
                Upload Image
              </button>
            </div>

            <button
              onClick={handleSubmitDetails}
              disabled={loading}
              className="bg-mraru-forest text-white font-medium px-8 py-3.5 rounded-full transition-transform hover:scale-[1.03] flex items-center gap-2 shadow-md"
            >
              Submit Details & Create KYC Session
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : null}

        {/* STEP 4: Didit KYC Hosted Session */}
        {onboardingState === "kyc_pending" ||
        onboardingState === "kyc_in_review" ||
        onboardingState === "kyc_declined" ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-mraru-lime text-mraru-forest flex items-center justify-center font-bold text-lg shadow-sm">
                4
              </div>
              <div>
                <h3 className="text-xl font-semibold text-neutral-900 tracking-tight">Didit Identity Verification (KYC)</h3>
                <p className="text-xs text-neutral-500">ID Verification + Liveness + Face Match</p>
              </div>
            </div>

            {/* Session Card */}
            <div className="bg-white p-6 rounded-2xl border border-neutral-200 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500 font-medium">Didit Session ID:</span>
                <span className="font-mono text-xs font-bold text-neutral-900">{kycSessionId || "didit_sess_pending"}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500 font-medium">KYC Status:</span>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#C8F169]/40 text-black border border-[#C8F169]/60 uppercase">
                  {kycStatus}
                </span>
              </div>

              {/* Retry / Exception messaging */}
              {onboardingState === "kyc_declined" && (
                <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-2xl text-xs space-y-2">
                  <p className="font-semibold">Verification Could Not Be Completed</p>
                  <p>{kycDeclineReason || "Document image unclear or expired."}</p>
                  {kycRetriable && (
                    <button
                      onClick={handleStartKyc}
                      className="bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-full text-xs transition-colors"
                    >
                      Start Fresh Verification Session
                    </button>
                  )}
                </div>
              )}

              {onboardingState === "kyc_in_review" && (
                <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-2xl text-xs space-y-1">
                  <p className="font-semibold">Identity Under Human Review</p>
                  <p>Your document was flagged for Secretary review. We will notify you via SMS once resolved.</p>
                </div>
              )}

              {/* Didit Hosted Session Redirect Button */}
              {kycSessionUrl && onboardingState === "kyc_pending" && (
                <div className="space-y-4 pt-2">
                  <a
                    href={kycSessionUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full bg-mraru-lime text-mraru-forest font-semibold py-3.5 rounded-full flex items-center justify-center gap-2 transition-transform hover:scale-[1.03] shadow-sm"
                  >
                    <span>Launch Didit Hosted KYC Window</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>

                  {/* Webhook Outcome Simulation Bar */}
                  <div className="pt-4 border-t border-neutral-200">
                    <p className="text-[11px] font-mono text-neutral-500 mb-2">
                      [DEMO WEBHOOK SIMULATOR - Trigger Didit Event]
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleSimulateKycOutcome("Approved")}
                        className="bg-green-600 hover:bg-green-700 text-white text-xs py-2 rounded-xl font-medium"
                      >
                        Simulate Approved
                      </button>
                      <button
                        onClick={() => handleSimulateKycOutcome("In Review")}
                        className="bg-amber-600 hover:bg-amber-700 text-white text-xs py-2 rounded-xl font-medium"
                      >
                        Simulate In Review
                      </button>
                      <button
                        onClick={() => handleSimulateKycOutcome("Declined")}
                        className="bg-red-600 hover:bg-red-700 text-white text-xs py-2 rounded-xl font-medium"
                      >
                        Simulate Declined
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* STEP 5: Constitution Review & Scroll-to-Accept */}
        {onboardingState === "constitution_pending" ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-mraru-lime text-mraru-forest flex items-center justify-center font-bold text-lg shadow-sm">
                5
              </div>
              <div>
                <h3 className="text-xl font-semibold text-neutral-900 tracking-tight">Chama Constitution & Bylaws</h3>
                <p className="text-xs text-neutral-500">Scroll to the bottom to accept terms</p>
              </div>
            </div>

            <div
              onScroll={(e) => {
                const target = e.currentTarget;
                if (target.scrollHeight - target.scrollTop <= target.clientHeight + 50) {
                  setHasScrolledConstitution(true);
                }
              }}
              className="bg-white p-6 rounded-2xl border border-neutral-200 max-h-72 overflow-y-auto font-mono text-xs text-neutral-800 leading-relaxed space-y-4 shadow-inner"
            >
              <h4 className="text-sm font-bold text-black border-b border-neutral-100 pb-2">
                MRARU CHAMA CONSTITUTION AGREEMENT v1.0
              </h4>
              <p>
                1. MEMBERSHIP OBLIGATIONS: By joining Mraru Chama, all members agree to adhere strictly to monthly contribution deadlines and voting outcomes.
              </p>
              <p>
                2. FINANCIAL INTEGRITY: Contributions must be paid in full on or before the 5th day of every calendar month. Late payments incur a mandatory 5% fee.
              </p>
              <p>
                3. GOVERNANCE & VOTING: Governance decisions are rendered under an equal share voting system. The Chairperson and Secretary hold final administrative approval.
              </p>
              <p>
                4. KYC & COMPLIANCE: Identity records are verified against national identity registries. Fraudulent representations result in immediate ejection.
              </p>
              <p className="text-neutral-400 pt-8">--- END OF CONSTITUTION DOCUMENT ---</p>
            </div>

            <button
              onClick={handleAcceptConstitution}
              disabled={loading || !hasScrolledConstitution}
              className="w-full bg-mraru-lime text-mraru-forest font-semibold py-3.5 rounded-full transition-transform hover:scale-[1.03] flex items-center justify-center gap-2 disabled:opacity-40 shadow-sm"
            >
              {hasScrolledConstitution ? "I Accept Chama Constitution" : "Scroll down to enable Accept button"}
              <CheckCircle className="w-4 h-4" />
            </button>
          </div>
        ) : null}

        {/* STEP 6: Governance Approval Pending */}
        {onboardingState === "awaiting_governance_approval" ? (
          <div className="space-y-6 text-center py-6">
            <div className="w-16 h-16 rounded-full bg-[#C8F169] text-black mx-auto flex items-center justify-center shadow-md animate-pulse">
              <Clock className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-display text-2xl font-extrabold text-neutral-900 tracking-tight">Awaiting Governance Approval</h3>
              <p className="text-sm text-neutral-500 max-w-md mx-auto mt-2">
                Your KYC identity and constitution acceptance are complete. You are now in the Secretary approval queue.
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-neutral-200 max-w-md mx-auto text-xs text-neutral-700 text-left space-y-2">
              <div className="flex justify-between">
                <span className="text-neutral-500">KYC Clearance:</span>
                <span className="text-green-600 font-semibold">Approved</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Constitution:</span>
                <span className="text-green-600 font-semibold">Accepted</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Queue Status:</span>
                <span className="text-black font-mono font-bold">Pending Secretary Action</span>
              </div>
            </div>

            {/* Quick Demo Unlock Button */}
            <div className="pt-4 border-t border-neutral-200">
              <button
                onClick={handleSimulateSecretaryApproval}
                className="bg-neutral-100 hover:bg-neutral-200 text-neutral-900 text-xs font-semibold px-6 py-2.5 rounded-full border border-neutral-200 transition-colors"
              >
                [DEMO ONLY] Simulate 1-Tap Secretary Approval
              </button>
            </div>
          </div>
        ) : null}

        {/* STEP 7: Active Member Success Dashboard */}
        {onboardingState === "active" ? (
          <div className="space-y-6 text-center py-6">
            <div className="w-20 h-20 rounded-full bg-[#C8F169] text-black mx-auto flex items-center justify-center shadow-xl">
              <Sparkles className="w-10 h-10 fill-black" />
            </div>

            <div>
              <span className="px-3 py-1 rounded-full bg-mraru-lime/40 text-mraru-forest text-xs font-mono font-bold border border-mraru-lime/60 uppercase">
                Active Member
              </span>
              <h3 className="font-display text-3xl font-extrabold text-neutral-900 tracking-tight mt-3">Welcome to Mraru Chama!</h3>
              <p className="text-sm text-neutral-500 max-w-md mx-auto mt-2">
                Your Chama account is fully activated. You are ready to contribute, vote, and access lending pools.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto text-left">
              <div className="bg-white p-4 rounded-2xl border border-neutral-200">
                <p className="text-[10px] text-neutral-500 uppercase font-mono">Chama Status</p>
                <p className="text-base font-bold text-black">Active</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-neutral-200">
                <p className="text-[10px] text-neutral-500 uppercase font-mono">KYC Verification</p>
                <p className="text-base font-bold text-green-600">Verified</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
