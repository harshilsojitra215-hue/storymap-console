"use client";

import type { Finding } from "@/lib/types";
import { summarise } from "@/lib/rules";

type Props = { findings: Finding[] };

const SEVERITY_LABEL: Record<Finding["severity"], string> = {
  blocker: "Blocker",
  warning: "Warning",
  suggestion: "Suggestion",
};

/**
 * Re-runs on every render, which means on every keystroke. There is no "check"
 * button because there is no moment at which checking is a separate act.
 */
export default function CheckerPanel({ findings }: Props) {
  const clean = findings.length === 0;

  return (
    <section className="checker" aria-live="polite">
      <div className="panel-head">
        <h2 className="panel-title">Checker</h2>
        <span className={clean ? "summary is-clean" : "summary"}>{summarise(findings)}</span>
      </div>

      {clean ? (
        <p className="checker-clean">
          This chapter passes every rule in the list. Nothing here needs fixing before it ships.
        </p>
      ) : (
        <ul className="finding-list">
          {findings.map((f) => (
            <li key={f.ruleId} className={`finding finding-${f.severity}`}>
              <span className={`sev-tag sev-${f.severity}`}>{SEVERITY_LABEL[f.severity]}</span>
              <div className="finding-body">
                <p className="finding-message">{f.message}</p>
                <p className="finding-why">{f.why}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="checker-footnote">
        Rule-based, not a language model. All {""}
        <strong>10</strong> rules live in one file, <code>lib/rules.ts</code>.
      </p>
    </section>
  );
}
