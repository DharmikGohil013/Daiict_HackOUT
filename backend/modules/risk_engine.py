"""
GreenShield risk engine — combines the rule engine, the AI engine and the crypto engine
into one transparent 0–100 score.

                 CLAIM
                   ↓
       ┌───────────┼───────────┐
     RULES         AI       CRYPTO
       └───────────┼───────────┘
             RISK ENGINE  →  score, level, findings, fraud type

Components (weights configurable via RISK_WEIGHTS):
  generation   /40  claimed vs AI-expected generation
  historical   /20  claimed vs the plant's own recent history
  weather      /20  weather-adjusted expectation vs claim
  certificate  /10  crypto / ledger / claim-state result
  capacity     /10  claimed vs metered actual and physical capacity
"""

from typing import Dict, List, Optional

from config import risk_thresholds, risk_weights

# certificate engine outcome → points (out of the certificate weight) and fraud type
CERT_POINTS = {
    "VALID": 0.0,
    "NOT_PROVIDED": 0.3,
    "NOT_FOUND": 0.8,
    "DUPLICATE": 1.0,
    "TAMPERED": 1.0,
    "ID_TAMPERED": 1.0,
    "REVOKED": 1.0,
}
CERT_FRAUD_TYPE = {
    "TAMPERED": "tampered_certificate",
    "ID_TAMPERED": "certificate_id_tampering",
    "DUPLICATE": "duplicate_claim",
    "NOT_FOUND": "unregistered_certificate",
    "REVOKED": "revoked_certificate",
}

# claimed/expected deviation at which the generation component saturates
GENERATION_SATURATION_PCT = 40.0
HISTORICAL_SATURATION_PCT = 40.0
WEATHER_SATURATION_PCT = 40.0
CAPACITY_SATURATION_PCT = 60.0


def _clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def level_for(score: int) -> str:
    t = risk_thresholds()
    if score <= t["LOW"]:
        return "LOW"
    if score <= t["MEDIUM"]:
        return "MEDIUM"
    if score <= t["HIGH"]:
        return "HIGH"
    return "CRITICAL"


def _pct(a: float, b: float) -> float:
    return (a - b) / max(b, 1.0) * 100.0


def score_claim(
    claimed_kwh: float,
    expected_kwh: Optional[float],
    actual_kwh: Optional[float],
    capacity_mw: float,
    period_days: int,
    historical_expected_kwh: Optional[float] = None,
    expected_upper_kwh: Optional[float] = None,
    certificate_status: str = "NOT_PROVIDED",
    energy_type: str = "Solar",
) -> Dict:
    """Return the full, explainable risk assessment for a claim."""
    w = risk_weights()
    claimed = float(claimed_kwh)
    expected = float(expected_kwh) if expected_kwh else None
    actual = float(actual_kwh) if actual_kwh else None
    hist = float(historical_expected_kwh) if historical_expected_kwh else None
    findings: List[Dict] = []
    checks = [
        "Weather data analyzed",
        "Historical generation analyzed",
        "Plant capacity analyzed",
        "Actual generation analyzed",
        "Claim compared against expected output",
        "Certificate cryptography and ledger checked",
    ]

    # ── 1. generation deviation (AI engine) ─────────────────
    gen_pts = 0.0
    dev_expected = None
    if expected:
        dev_expected = _pct(claimed, expected)
        if dev_expected > 0:
            gen_pts = _clamp(dev_expected / GENERATION_SATURATION_PCT) * w["generation"]
        if dev_expected > 40:
            findings.append({"severity": "HIGH", "text": f"Claim is {dev_expected:.1f}% above AI expected generation."})
        elif dev_expected > 15:
            findings.append(
                {"severity": "MEDIUM", "text": f"Claim is {dev_expected:.1f}% above AI expected generation."}
            )
        elif dev_expected < -40:
            findings.append(
                {
                    "severity": "LOW",
                    "text": f"Claim is {abs(dev_expected):.1f}% below AI expected generation (under-reporting).",
                }
            )
        else:
            findings.append(
                {"severity": "OK", "text": f"Claim is within {abs(dev_expected):.1f}% of AI expected generation."}
            )
        if expected_upper_kwh and claimed > float(expected_upper_kwh):
            findings.append(
                {"severity": "MEDIUM", "text": "Claim lies outside the model's 10–90% prediction interval."}
            )

    # ── 2. historical anomaly ───────────────────────────────
    hist_pts = 0.0
    dev_hist = None
    if hist:
        dev_hist = _pct(claimed, hist)
        if dev_hist > 0:
            hist_pts = _clamp(dev_hist / HISTORICAL_SATURATION_PCT) * w["historical"]
        if dev_hist > 30:
            findings.append(
                {
                    "severity": "HIGH",
                    "text": f"Claim is {dev_hist:.1f}% above the plant's recent historical generation.",
                }
            )
        elif dev_hist > 15:
            findings.append(
                {
                    "severity": "MEDIUM",
                    "text": f"Claim is {dev_hist:.1f}% above the plant's recent historical generation.",
                }
            )
        else:
            findings.append({"severity": "OK", "text": "Claim is consistent with historical generation."})

    # ── 3. weather inconsistency ────────────────────────────
    weather_pts = 0.0
    if expected and dev_expected is not None and dev_expected > 0:
        weather_factor = (
            1.0 if (hist and expected <= hist * 1.05) else 0.6
        )  # weather below par makes the excess less plausible
        weather_pts = _clamp(dev_expected / WEATHER_SATURATION_PCT) * w["weather"] * weather_factor
        if hist and expected < hist * 0.95:
            findings.append(
                {
                    "severity": "MEDIUM",
                    "text": f"Weather conditions indicate lower generation potential ({_pct(expected, hist):.1f}% vs typical).",
                }
            )

    # ── 4. certificate anomaly (crypto engine) ──────────────
    cert_status = (certificate_status or "NOT_PROVIDED").upper()
    cert_pts = CERT_POINTS.get(cert_status, 0.5) * w["certificate"]
    cert_text = {
        "VALID": ("OK", "Certificate is authentic, registered and not previously claimed."),
        "NOT_PROVIDED": ("LOW", "No certificate file was supplied; ledger record checked by ID only."),
        "NOT_FOUND": ("HIGH", "Certificate ID is not registered in the REC ledger."),
        "DUPLICATE": ("HIGH", "Certificate has already been claimed — duplicate claim."),
        "TAMPERED": ("HIGH", "Certificate payload hash does not match — document was tampered."),
        "ID_TAMPERED": ("HIGH", "Certificate ID does not match the signed payload — identifier tampering."),
        "REVOKED": ("HIGH", "Certificate has been revoked by the regulator."),
    }.get(cert_status, ("MEDIUM", f"Certificate status {cert_status}."))
    findings.append({"severity": cert_text[0], "text": cert_text[1]})

    # ── 5. capacity / actual consistency (rule engine) ──────
    cap_pts = 0.0
    dev_actual = None
    max_possible = capacity_mw * 1000.0 * 24.0 * max(period_days, 1)
    if actual:
        dev_actual = _pct(claimed, actual)
        if dev_actual > 0:
            cap_pts = _clamp(dev_actual / CAPACITY_SATURATION_PCT) * w["capacity"]
        if dev_actual > 25:
            findings.append(
                {
                    "severity": "HIGH",
                    "text": f"Actual metered generation is {dev_actual:.1f}% below the claimed amount.",
                }
            )
        elif dev_actual > 10:
            findings.append(
                {
                    "severity": "MEDIUM",
                    "text": f"Actual metered generation is {dev_actual:.1f}% below the claimed amount.",
                }
            )
        else:
            findings.append({"severity": "OK", "text": "Claim is consistent with actual metered generation."})
    if claimed > max_possible:
        cap_pts = float(w["capacity"])
        findings.append(
            {
                "severity": "HIGH",
                "text": f"Claim exceeds the physical maximum for a {capacity_mw} MW plant over {period_days} days ({max_possible:,.0f} kWh).",  # noqa: E501
            }
        )
    else:
        util = claimed / max(max_possible, 1.0)
        realistic = {"Solar": 0.32, "Wind": 0.55, "Hydro": 0.85, "Biomass": 0.85}.get(energy_type, 0.7)
        if util > realistic:
            cap_pts = max(cap_pts, _clamp((util - realistic) / (1 - realistic)) * w["capacity"])
            findings.append(
                {
                    "severity": "HIGH",
                    "text": f"Implied capacity factor {util * 100:.0f}% exceeds what {energy_type} plants achieve (~{realistic * 100:.0f}%).",  # noqa: E501
                }
            )

    components = {
        "generation": int(round(gen_pts)),
        "historical": int(round(hist_pts)),
        "weather": int(round(weather_pts)),
        "certificate": int(round(cert_pts)),
        "capacity": int(round(cap_pts)),
    }
    total = int(min(100, sum(components.values())))
    thresholds = risk_thresholds()
    if claimed > max_possible:  # physically impossible claims are critical regardless of other signals
        total = max(total, thresholds["HIGH"] + 10)
    if cert_status in ("TAMPERED", "ID_TAMPERED", "DUPLICATE"):
        # A forged, altered or re-used certificate is fraud on its own: the crypto engine overrides
        # the additive score so the verdict is CRITICAL even when the energy numbers look plausible.
        total = max(total, thresholds["HIGH"] + 10)
    elif cert_status in ("NOT_FOUND", "REVOKED"):
        total = max(total, thresholds["MEDIUM"] + 10)
    total = int(min(100, total))
    level = level_for(total)

    # fraud type — certificate problems take precedence over generation anomalies
    fraud_type = CERT_FRAUD_TYPE.get(cert_status)
    if fraud_type is None:
        fraud_type = "inflated_generation" if level in ("HIGH", "CRITICAL") else "none"

    severity_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2, "OK": 3}
    findings.sort(key=lambda f: severity_order.get(f["severity"], 9))

    return {
        "total_score": total,
        "risk_level": level,
        "components": components,
        "weights": w,
        "thresholds": risk_thresholds(),
        "findings": findings,
        "checks": checks,
        "fraud_type": fraud_type,
        "metrics": {
            "claimed_kwh": round(claimed, 1),
            "expected_kwh": round(expected, 1) if expected else None,
            "actual_kwh": round(actual, 1) if actual else None,
            "historical_expected_kwh": round(hist, 1) if hist else None,
            "deviation_vs_expected_pct": round(dev_expected, 1) if dev_expected is not None else None,
            "deviation_vs_historical_pct": round(dev_hist, 1) if dev_hist is not None else None,
            "deviation_vs_actual_pct": round(dev_actual, 1) if dev_actual is not None else None,
            "capacity_max_kwh": round(max_possible, 1),
            "certificate_status": cert_status,
        },
    }
