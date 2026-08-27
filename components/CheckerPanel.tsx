"use client";

import type { Finding } from "@/lib/types";
import { RULES, summarise } from "@/lib/rules";

type Props = {
  findings: Finding[];
  /** Findings that belong to the whole project, not this one chapter — shown
   *  separately since they don't change when you switch chapters. */
  projectFindings: Finding[];
};

const SEVERITY_LABEL: Record<Finding["severity"], string> = {
  blocker: "Blocker",
  warning: "Warning",
  suggestion: "Suggestion",
};

function FindingRow({ f }: { f: Finding }) {
  return (
    <li className={`finding finding-${f.severity}`}>
      <span className={`sev-tag sev-${f.severity}`}>{SEVERITY_LABEL[f.severity]}</span>
      <div className="finding-body">
        <p className="finding-message">{f.message}</p>
        <p className="finding-why">{f.why}</p>
      </div>
    </li>
  );
}

/**
 * Re-runs on every render, which means on every keystroke. There is no "check"
 * button because there is no moment at which checking is a separate act.
 */
export default function CheckerPanel({ findings, projectFindings }: Props) {
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
            <FindingRow key={f.ruleId} f={f} />
          ))}
        </ul>
      )}

      {projectFindings.length > 0 && (
        <div className="checker-project">
          <p className="checker-project-label">Project-wide</p>
          <ul className="finding-list">
            {projectFindings.map((f) => (
              <FindingRow key={f.ruleId} f={f} />
            ))}
          </ul>
        </div>
      )}

      <p className="checker-footnote">
        Rule-based, not a language model. All {""}
        <strong>{RULES.length}</strong> per-chapter rules live in one file, <code>lib/rules.ts</code>
        , plus project-wide checks in the same file.
      </p>
    </section>
  );
}
