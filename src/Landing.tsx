import { ArrowRight, Link2, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

const navItems = [
  { label: "Workspace", to: "/login?next=/workspace" },
  { label: "Recovery", to: "/login?next=/cases" },
  { label: "Stock exchange", to: "/login?next=/stock" },
  { label: "Security", to: "/login?next=/access" },
];

export function Landing() {
  return (
    <div className="landing">
      <img
        className="landing-art"
        src="/assets/claimchain-hands.png"
        alt="Two halftone hands reaching toward one another"
      />
      <div className="landing-bloom" aria-hidden="true" />

      <header className="landing-nav">
        <Link
          className="landing-brand landing-rise delay-0"
          to="/"
          aria-label="ClaimChain home"
        >
          <span className="landing-mark" aria-hidden="true">
            <Link2 size={20} strokeWidth={2.4} />
          </span>
          ClaimChain<span>.</span>
        </Link>

        <nav className="landing-links" aria-label="Landing navigation">
          {navItems.map((item, index) => (
            <Link
              className={`landing-rise delay-${index + 1}`}
              key={item.to}
              to={item.to}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link className="landing-nav-cta landing-rise delay-5" to="/login">
          Enter workspace
          <ArrowRight size={15} />
        </Link>
      </header>

      <main className="landing-hero">
        <div className="landing-kicker landing-rise delay-6">
          <span />
          Recovery, reconciled
          <span />
        </div>
        <h1 className="landing-rise delay-7">
          <span>Turn scattered proof</span>
          <strong>into a path forward.</strong>
        </h1>
        <p className="landing-copy landing-rise delay-8">
          ClaimChain brings evidence, payments, follow-ups, and stock handoffs
          into one accountable recovery workspace.
        </p>
        <Link className="landing-primary landing-rise delay-9" to="/login">
          Open ClaimChain
          <ArrowRight size={18} />
        </Link>
      </main>

      <div className="landing-caption landing-caption-left landing-rise delay-10">
        <ShieldCheck size={14} />
        Evidence to action.
      </div>
      <div className="landing-caption landing-caption-right landing-rise delay-10">
        Every step, accounted for.
      </div>
    </div>
  );
}
