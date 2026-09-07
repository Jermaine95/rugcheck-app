import { useState } from "react";
import { Search, ShieldAlert, ShieldCheck, ShieldQuestion, Lock, Unlock, Users, Clock, Flame, ChevronRight } from "lucide-react";

async function fetchGoPlusAnalysis(address) {
  const res = await fetch(`/api/check?address=${encodeURIComponent(address)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Check failed: ${res.status}`);
  }
  const json = await res.json();

  if (json.code !== 1 || !json.result) {
    throw new Error(json.message || "No result for this address");
  }
  const data = json.result[address.toLowerCase()] ?? json.result[address] ?? Object.values(json.result)[0];
  if (!data) throw new Error("No data returned for this address");

  const isTrusted = data.trusted_token === "1" || data.trusted_token === 1;
  // For trusted, well-known tokens (like USDC), an active mint/freeze authority
  // is normal and disclosed — not a rug signal. Only flag these as critical
  // risks for tokens that AREN'T on GoPlus's trusted list.
  const mintStatus = data.mintable?.status === "1" && !isTrusted;
  const freezeStatus = data.freezable?.status === "1" && !isTrusted;

  const holders = Array.isArray(data.holders) ? data.holders : [];
  const topHolderPct = Math.round(
    holders.slice(0, 10).reduce((sum, h) => sum + (parseFloat(h.percent) || 0) * 100, 0)
  );

  const dex = Array.isArray(data.dex) ? data.dex[0] : null;
  const lpHolders = dex && Array.isArray(dex.lp_holders) ? dex.lp_holders : [];
  const lpLockedPct = lpHolders.reduce(
    (sum, h) => sum + (h.is_locked === 1 || h.is_locked === "1" ? (parseFloat(h.percent) || 0) * 100 : 0),
    0
  );
  const lpLocked = (lpHolders.length > 0 && lpLockedPct >= 50) || isTrusted;

  const feeRateRaw = data.transfer_fee?.current_fee_rate?.fee_rate;
  const sellTax = feeRateRaw ? Math.round(parseFloat(feeRateRaw) / 100) : 0;
  const canSell = data.non_transferable !== "1";

  const checks = [
    {
      id: "lp",
      label: "Liquidity lock",
      pass: lpLocked,
      detail: isTrusted
        ? "Trusted token — liquidity risk not applicable in the same way"
        : dex
        ? lpLocked
          ? `~${lpLockedPct}% of LP locked`
          : "LP unlocked or lock not detected — can be pulled anytime"
        : "No DEX liquidity pool found for this token",
      critical: !isTrusted,
      icon: lpLocked ? Lock : Unlock,
    },
    {
      id: "freeze",
      label: "Freeze authority",
      pass: !freezeStatus,
      detail: isTrusted
        ? "Held by a recognized, trusted issuer — expected for this token"
        : !freezeStatus
        ? "Renounced"
        : "Deployer can freeze holder wallets",
      critical: !isTrusted,
      icon: !freezeStatus ? ShieldCheck : ShieldAlert,
    },
    {
      id: "mint",
      label: "Mint authority",
      pass: !mintStatus,
      detail: isTrusted
        ? "Held by a recognized, trusted issuer — expected for this token"
        : !mintStatus
        ? "Renounced — supply is fixed"
        : "Deployer can mint more supply",
      critical: !isTrusted,
      icon: !mintStatus ? ShieldCheck : ShieldAlert,
    },
    {
      id: "sell",
      label: "Transfer / sell tax",
      pass: canSell && sellTax < 10,
      detail: !canSell ? "Token marked non-transferable — cannot be sold" : `Transfer fee ~${sellTax}%`,
      critical: !canSell,
      icon: canSell ? ShieldCheck : ShieldAlert,
    },
    {
      id: "holders",
      label: "Holder concentration",
      pass: topHolderPct < 25 || isTrusted,
      detail: `Top 10 wallets hold ${topHolderPct}% of supply`,
      critical: topHolderPct >= 50 && !isTrusted,
      icon: topHolderPct >= 50 && !isTrusted ? ShieldAlert : Users,
    },
    {
      id: "age",
      label: "Contract age",
      pass: true,
      detail: "Not provided by this data source",
      critical: false,
      icon: Clock,
    },
  ];

  if (isTrusted) {
    checks.push({
      id: "trusted",
      label: "Trusted token status",
      pass: true,
      detail: "Recognized by GoPlus as a well-known, reputable token",
      critical: false,
      icon: ShieldCheck,
    });
  }

  const criticalFail = checks.some((c) => c.critical && !c.pass);
  const failCount = checks.filter((c) => !c.pass).length;
  let verdict = "green";
  if (criticalFail || failCount >= 3) verdict = "red";
  else if (failCount >= 1) verdict = "yellow";
  if (isTrusted && !criticalFail) verdict = "green";

  return { checks, verdict, address, source: "live", tokenName: data.metadata?.name, tokenSymbol: data.metadata?.symbol };
}

function mockAnalyze(address) {
  let h = 5381;
  for (let i = 0; i < address.length; i++) {
    h = ((h << 5) + h + address.charCodeAt(i)) >>> 0;
  }
  const seed = h;
  const rand = (n) => {
    const x = Math.sin(seed + n * 999983) * 10000;
    return x - Math.floor(x);
  };

  const lpLocked = rand(1) > 0.55;
  const freezeRenounced = rand(2) > 0.5;
  const mintRenounced = rand(3) > 0.5;
  const topHolderPct = Math.round(5 + rand(4) * 55);
  const ageDays = Math.round(rand(5) * 90);
  const sellTax = Math.round(rand(6) * 20);
  const canSell = rand(7) > 0.08;

  const checks = [
    {
      id: "lp",
      label: "Liquidity lock",
      pass: lpLocked,
      detail: lpLocked ? "LP tokens locked" : "LP unlocked — can be pulled anytime",
      critical: true,
      icon: lpLocked ? Lock : Unlock,
    },
    {
      id: "freeze",
      label: "Freeze authority",
      pass: freezeRenounced,
      detail: freezeRenounced ? "Renounced" : "Deployer can freeze holder wallets",
      critical: true,
      icon: freezeRenounced ? ShieldCheck : ShieldAlert,
    },
    {
      id: "mint",
      label: "Mint authority",
      pass: mintRenounced,
      detail: mintRenounced ? "Renounced — supply is fixed" : "Deployer can mint more supply",
      critical: true,
      icon: mintRenounced ? ShieldCheck : ShieldAlert,
    },
    {
      id: "sell",
      label: "Sell simulation",
      pass: canSell && sellTax < 10,
      detail: !canSell ? "Sell blocked — likely honeypot" : `Sell tax ~${sellTax}%`,
      critical: !canSell,
      icon: canSell ? ShieldCheck : ShieldAlert,
    },
    {
      id: "holders",
      label: "Holder concentration",
      pass: topHolderPct < 25,
      detail: `Top 10 wallets hold ${topHolderPct}% of supply`,
      critical: topHolderPct >= 50,
      icon: topHolderPct >= 50 ? ShieldAlert : Users,
    },
    {
      id: "age",
      label: "Contract age",
      pass: ageDays > 14,
      detail: `Deployed ${ageDays} day${ageDays === 1 ? "" : "s"} ago`,
      critical: false,
      icon: Clock,
    },
  ];

  const criticalFail = checks.some((c) => c.critical && !c.pass);
  const failCount = checks.filter((c) => !c.pass).length;

  let verdict = "green";
  if (criticalFail || failCount >= 3) verdict = "red";
  else if (failCount >= 1) verdict = "yellow";

  return { checks, verdict, address, source: "mock" };
}

const verdictConfig = {
  green: {
    label: "Looks clean",
    sub: "No major red flags detected",
    color: "#3fb950",
    bg: "#0d2818",
    border: "#1a4d2e",
    Icon: ShieldCheck,
  },
  yellow: {
    label: "Proceed with caution",
    sub: "Some risk signals present",
    color: "#e3a008",
    bg: "#2a2008",
    border: "#4d3d10",
    Icon: ShieldQuestion,
  },
  red: {
    label: "High rug risk",
    sub: "Critical red flags detected",
    color: "#f85149",
    bg: "#2a0e0e",
    border: "#4d1a1a",
    Icon: ShieldAlert,
  },
};

const SAMPLE_ADDRESSES = [
  "3WRMw...VpJK",
  "7WHAg...zgUs",
  "mraHc...72i6",
];

export default function RugChecker() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scanLine, setScanLine] = useState(0);
  const [apiError, setApiError] = useState(null);

  const handleScan = async (addr) => {
    const target = addr ?? input;
    if (!target.trim()) return;
    setLoading(true);
    setResult(null);
    setApiError(null);
    setScanLine(0);

    const steps = 6;
    let i = 0;
    const tick = setInterval(() => {
      i = Math.min(i + 1, steps - 1);
      setScanLine(i);
    }, 180);

    try {
      const live = await fetchGoPlusAnalysis(target.trim());
      clearInterval(tick);
      setScanLine(steps);
      setResult(live);
    } catch (err) {
      clearInterval(tick);
      setScanLine(steps);
      setApiError(err.message || "Could not reach the check service — showing demo data instead");
      setResult(mockAnalyze(target.trim()));
    } finally {
      setLoading(false);
    }
  };

  const vc = result ? verdictConfig[result.verdict] : null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0b0d",
        color: "#e6e6e6",
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        padding: "0",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700;800&family=Space+Grotesk:wght@500;700&display=swap');
        * { box-sizing: border-box; }
        .grotesk { font-family: 'Space Grotesk', sans-serif; }
        .scanline { animation: pulse 1s ease-in-out infinite; }
        @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
        .grid-bg {
          background-image:
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 32px 32px;
        }
        input:focus { outline: none; }
        .sample-btn:hover { border-color: #f85149 !important; color: #f85149 !important; }
        .scan-btn:hover { background: #ff6b5f !important; }
        ::selection { background: #f85149; color: #0a0b0d; }
      `}</style>

      <div className="grid-bg" style={{ borderBottom: "1px solid #1c1f24", padding: "48px 24px 40px", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, letterSpacing: "0.15em", color: "#f85149", marginBottom: 20, border: "1px solid #4d1a1a", background: "#1a0a0a", padding: "6px 14px", borderRadius: 4 }}>
          <Flame size={13} />
          BUILT BY PEOPLE WHO GOT RUGGED
        </div>
        <h1 className="grotesk" style={{ fontSize: "clamp(32px, 6vw, 56px)", fontWeight: 700, margin: "0 0 12px", letterSpacing: "-0.02em", lineHeight: 1.05 }}>
          Check it before you ape.
        </h1>
        <p style={{ color: "#8b8f96", fontSize: 15, maxWidth: 480, margin: "0 auto", lineHeight: 1.6 }}>
          Paste a token contract address. We check the stuff that actually gets people rugged —
          before your money finds out the hard way.
        </p>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px 24px" }}>
        <div style={{ display: "flex", gap: 10, background: "#111317", border: "1px solid #22262c", borderRadius: 8, padding: 6 }}>
          <div style={{ display: "flex", alignItems: "center", paddingLeft: 10, color: "#565b64" }}>
            <Search size={16} />
          </div>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleScan()}
            placeholder="Paste a Solana token contract address..."
            style={{ flex: 1, background: "transparent", border: "none", color: "#e6e6e6", fontFamily: "inherit", fontSize: 14, padding: "10px 4px" }}
          />
          <button
            className="scan-btn"
            onClick={() => handleScan()}
            disabled={loading}
            style={{ background: "#f85149", color: "#0a0b0d", border: "none", borderRadius: 5, padding: "0 22px", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1, transition: "background 0.15s" }}
          >
            {loading ? "SCANNING" : "SCAN"}
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#565b64" }}>DEMO (fake addresses):</span>
          {SAMPLE_ADDRESSES.map((a) => (
            <button
              key={a}
              className="sample-btn"
              onClick={() => { setInput(a); handleScan(a); }}
              style={{ background: "transparent", border: "1px solid #22262c", color: "#8b8f96", borderRadius: 4, padding: "4px 10px", fontSize: 11, fontFamily: "inherit", cursor: "pointer", transition: "all 0.15s" }}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "8px 24px 40px" }}>
          <div style={{ border: "1px solid #22262c", borderRadius: 8, padding: 24, background: "#0d0f12" }}>
            {["Checking liquidity lock", "Checking freeze authority", "Checking mint authority", "Simulating sell", "Analyzing holder distribution", "Checking contract age"].map((label, idx) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", fontSize: 13, color: idx < scanLine ? "#8b8f96" : idx === scanLine ? "#f85149" : "#33383f" }}>
                <span className={idx === scanLine ? "scanline" : ""} style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", flexShrink: 0 }} />
                {label}
                {idx < scanLine && <span style={{ marginLeft: "auto", color: "#3fb950" }}>done</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {result && vc && (
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "8px 24px 80px" }}>
          {apiError && (
            <div style={{ background: "#2a2008", border: "1px solid #4d3d10", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#e3a008", marginBottom: 12 }}>
              Live check unavailable ({apiError}) — showing demo data below, not real results.
            </div>
          )}
          {!apiError && result.source === "live" && (
            <div style={{ fontSize: 11, color: "#3fb950", marginBottom: 12, letterSpacing: "0.05em" }}>
              ● LIVE DATA — GoPlus Solana Token Security API
              {result.tokenSymbol ? ` — ${result.tokenSymbol}` : ""}
            </div>
          )}
          <div style={{ border: `1px solid ${vc.border}`, background: vc.bg, borderRadius: 10, padding: 24, marginBottom: 16, display: "flex", alignItems: "flex-start", gap: 16 }}>
            <vc.Icon size={32} color={vc.color} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div className="grotesk" style={{ fontSize: 20, fontWeight: 700, color: vc.color, marginBottom: 4 }}>{vc.label}</div>
              <div style={{ fontSize: 13, color: "#b8bcc2" }}>{vc.sub}</div>
              <div style={{ fontSize: 11, color: "#565b64", marginTop: 10, fontFamily: "monospace" }}>{result.address}</div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {result.checks.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "#111317", border: "1px solid #22262c", borderRadius: 8 }}>
                <c.icon size={18} color={c.pass ? "#3fb950" : c.critical ? "#f85149" : "#e3a008"} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#e6e6e6" }}>{c.label}</div>
                  <div style={{ fontSize: 12, color: "#8b8f96", marginTop: 2 }}>{c.detail}</div>
                </div>
                {c.critical && !c.pass && (
                  <span style={{ fontSize: 10, color: "#f85149", border: "1px solid #4d1a1a", padding: "2px 8px", borderRadius: 3, flexShrink: 0 }}>CRITICAL</span>
                )}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20, padding: "14px 16px", fontSize: 12, color: "#565b64", lineHeight: 1.6, display: "flex", gap: 8 }}>
            <ChevronRight size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            This is a risk signal, not a guarantee. Always size positions like you might be wrong.
          </div>
        </div>
      )}

      <div style={{ borderTop: "1px solid #1c1f24", padding: "24px", textAlign: "center", fontSize: 11, color: "#3a3e44" }}>
        Live checks powered by GoPlus Security, via our own backend. Falls back to demo data if a check can't be reached.
      </div>
    </div>
  );
    }
