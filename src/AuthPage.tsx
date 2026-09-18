import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Link2,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import type { AuthUser } from "../shared/auth";
import { ApiError, api } from "./lib";
import { useAuth } from "./auth";

const FALCON_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260813_052122_e77a27e6-17f1-4794-889b-3ceaa0e9e8cb.mp4";

type AuthMode = "login" | "verify" | "forgot" | "reset";
type CodeResponse = {
  ok: boolean;
  message: string;
  requestId?: string;
  developmentCode?: string;
};

const safeNext = (value: string | null) =>
  value?.startsWith("/") && !value.startsWith("//") ? value : "/workspace";

function Brand() {
  return (
    <Link className="auth-brand" to="/" aria-label="ClaimChain home">
      <span>
        <Link2 size={20} strokeWidth={2.4} />
      </span>
      ClaimChain<i>.</i>
    </Link>
  );
}

export function AuthPage({ mode }: { mode: AuthMode }) {
  const { user, refresh } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [identifier, setIdentifier] = useState(params.get("identifier") || "");
  const [requestId, setRequestId] = useState(params.get("requestId") || "");
  const [developmentCode, setDevelopmentCode] = useState(
    params.get("code") || "",
  );
  const next = safeNext(params.get("next"));

  useEffect(() => {
    document.title = `${mode === "login" ? "Sign in" : mode === "verify" ? "Verify email" : mode === "forgot" ? "Recover access" : "Choose password"} | ClaimChain`;
  }, [mode]);

  const copy = useMemo(
    () =>
      ({
        login: [
          "Welcome back",
          "Enter the workspace where evidence becomes action.",
        ],
        verify: [
          "Verify your email",
          "Use the six-digit code sent to your account.",
        ],
        forgot: [
          "Recover your access",
          "We will send a short-lived reset code to your verified email.",
        ],
        reset: [
          "Set a new password",
          "Choose a strong password and return to your recovery work.",
        ],
      })[mode],
    [mode],
  );

  if (user && mode === "login") return <Navigate to={next} replace />;

  const sendCode = async (type: "verify" | "forgot") => {
    if (!identifier.trim()) {
      toast.error("Enter your email or username first");
      return;
    }
    setBusy(true);
    try {
      const result = await api<CodeResponse>(
        type === "verify" ? "/auth/verify/send" : "/auth/forgot",
        "POST",
        { identifier },
      );
      if (result.requestId) setRequestId(result.requestId);
      if (result.developmentCode) setDevelopmentCode(result.developmentCode);
      toast.success(result.message);
      if (type === "forgot" && result.requestId) {
        const query = new URLSearchParams({
          identifier,
          requestId: result.requestId,
          ...(result.developmentCode ? { code: result.developmentCode } : {}),
        });
        navigate(`/reset-password?${query}`);
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true);
    try {
      if (mode === "login") {
        await api<{ user: AuthUser }>("/auth/login", "POST", {
          identifier: values.get("identifier"),
          password: values.get("password"),
        });
        await refresh();
        navigate(next, { replace: true });
      } else if (mode === "verify") {
        if (!requestId) throw new Error("Send a verification code first");
        await api("/auth/verify/confirm", "POST", {
          identifier,
          requestId,
          code: values.get("code"),
        });
        toast.success("Email verified. You can now sign in.");
        navigate(`/login?identifier=${encodeURIComponent(identifier)}`, {
          replace: true,
        });
      } else if (mode === "forgot") {
        await sendCode("forgot");
      } else {
        await api("/auth/reset", "POST", {
          requestId: values.get("requestId"),
          code: values.get("code"),
          password: values.get("password"),
        });
        toast.success("Password changed. Sign in with your new password.");
        navigate(`/login?identifier=${encodeURIComponent(identifier)}`, {
          replace: true,
        });
      }
    } catch (error) {
      if (error instanceof ApiError && error.code === "VERIFICATION_REQUIRED") {
        navigate(
          `/verify?identifier=${encodeURIComponent(identifier)}&next=${encodeURIComponent(next)}`,
        );
      } else toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-visual" aria-label="ClaimChain recovery network">
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        >
          <source src={FALCON_VIDEO} type="video/mp4" />
        </video>
        <div className="auth-visual-shade" />
        <Brand />
        <div className="auth-story">
          <span className="auth-eyebrow">
            <ShieldCheck size={15} /> Controlled recovery operations
          </span>
          <h1>
            Move with clarity.
            <br />
            Recover with proof.
          </h1>
          <p>
            One accountable command surface for cases, stock, evidence, and
            every consequential handoff.
          </p>
        </div>
        <div className="auth-visual-foot">
          <span>ClaimChain Operations</span>
          <span>Evidence to action</span>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-mobile-brand">
          <Brand />
        </div>
        <div className="auth-card">
          <div className="auth-icon">
            <LockKeyhole size={22} />
          </div>
          <header>
            <p>SECURE WORKSPACE</p>
            <h2>{copy[0]}</h2>
            <span>{copy[1]}</span>
          </header>

          <form onSubmit={submit}>
            {(mode === "login" || mode === "verify" || mode === "forgot") && (
              <label className="auth-field">
                <span>Email or username</span>
                <div>
                  <Mail size={17} />
                  <input
                    name="identifier"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    autoComplete="username"
                    required
                    autoFocus
                    placeholder="you@company.com"
                  />
                </div>
              </label>
            )}
            {mode === "login" && (
              <label className="auth-field">
                <span>Password</span>
                <div>
                  <LockKeyhole size={17} />
                  <input
                    name="password"
                    type={passwordVisible ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    placeholder="Your password"
                  />
                  <button
                    type="button"
                    aria-label={
                      passwordVisible ? "Hide password" : "Show password"
                    }
                    title={passwordVisible ? "Hide password" : "Show password"}
                    onClick={() => setPasswordVisible((value) => !value)}
                  >
                    {passwordVisible ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </label>
            )}
            {mode === "verify" && (
              <>
                <label className="auth-field">
                  <span>Verification code</span>
                  <div>
                    <ShieldCheck size={17} />
                    <input
                      name="code"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      defaultValue={developmentCode}
                      required
                      placeholder="000000"
                    />
                  </div>
                </label>
                {!requestId && (
                  <button
                    className="auth-secondary"
                    type="button"
                    disabled={busy}
                    onClick={() => void sendCode("verify")}
                  >
                    Send verification code
                  </button>
                )}
                {requestId && (
                  <button
                    className="auth-text-button"
                    type="button"
                    disabled={busy}
                    onClick={() => void sendCode("verify")}
                  >
                    Send a new code
                  </button>
                )}
              </>
            )}
            {mode === "reset" && (
              <>
                <input type="hidden" name="requestId" value={requestId} />
                <label className="auth-field">
                  <span>Reset code</span>
                  <div>
                    <ShieldCheck size={17} />
                    <input
                      name="code"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      defaultValue={developmentCode}
                      required
                      placeholder="000000"
                      autoFocus
                    />
                  </div>
                </label>
                <label className="auth-field">
                  <span>New password</span>
                  <div>
                    <LockKeyhole size={17} />
                    <input
                      name="password"
                      type={passwordVisible ? "text" : "password"}
                      autoComplete="new-password"
                      minLength={12}
                      required
                      placeholder="12+ characters"
                    />
                    <button
                      type="button"
                      aria-label={
                        passwordVisible ? "Hide password" : "Show password"
                      }
                      title={
                        passwordVisible ? "Hide password" : "Show password"
                      }
                      onClick={() => setPasswordVisible((value) => !value)}
                    >
                      {passwordVisible ? (
                        <EyeOff size={17} />
                      ) : (
                        <Eye size={17} />
                      )}
                    </button>
                  </div>
                </label>
                <p className="password-hint">
                  Use uppercase, lowercase, a number, and a symbol.
                </p>
              </>
            )}

            {mode === "login" && (
              <Link className="auth-forgot" to="/forgot-password">
                Forgot password?
              </Link>
            )}
            {(mode !== "verify" || requestId) && (
              <button className="auth-submit" disabled={busy}>
                {busy ? (
                  <LoaderCircle className="spin" size={18} />
                ) : mode === "login" ? (
                  <ArrowRight size={18} />
                ) : mode === "verify" ? (
                  <Check size={18} />
                ) : mode === "forgot" ? (
                  <Mail size={18} />
                ) : (
                  <ShieldCheck size={18} />
                )}
                {mode === "login"
                  ? "Enter workspace"
                  : mode === "verify"
                    ? "Verify email"
                    : mode === "forgot"
                      ? "Send reset code"
                      : "Update password"}
              </button>
            )}
          </form>

          {developmentCode && (
            <div className="dev-code">
              <span>LOCAL DEVELOPMENT CODE</span>
              <strong>{developmentCode}</strong>
            </div>
          )}
          <footer>
            <Link to={mode === "login" ? "/" : "/login"}>
              <ArrowLeft size={15} />
              {mode === "login" ? "Back to ClaimChain" : "Back to sign in"}
            </Link>
          </footer>
        </div>
        <p className="auth-legal">
          Protected by scoped access, short-lived recovery codes, and audited
          sessions.
        </p>
      </section>
    </main>
  );
}
