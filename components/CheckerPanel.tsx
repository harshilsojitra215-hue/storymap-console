"use client";

import { useEffect, useRef, useState } from "react";
import type { Finding } from "@/lib/types";
import { RULES, summarise } from "@/lib/rules";

type Props = {
  findings: Finding[];
  /** Findings that belong to the whole project, not this one chapter — shown
   *  separately since they don't change when you switch chapters. */
  projectFindings: Finding[];
  /** Which chapter `findings` belongs to. A change here means "different
   *  chapter, different findings entirely" — snap instantly, no clearing
   *  animation. Anything else means "the same chapter's findings shrank," the
   *  case the animation below exists for. */
  chapterId: string;
};

type LingeringFinding = Finding & { clearing: boolean };

/**
 * Keeps a finding on screen, mid-fade, for a moment after it drops out of
 * the live list — so fixing the thing the finding was complaining about is
 * something you see happen, not just infer from its sudden absence. Resets
 * instantly (no animation) whenever `resetKey` changes, since that means the
 * whole context changed (a different chapter), not that something resolved.
 */
function useLingeringFindings(findings: Finding[], resetKey: string): LingeringFinding[] {
  const [display, setDisplay] = useState<LingeringFinding[]>(() =>
    findings.map((f) => ({ ...f, clearing: false })),
  );
  const prevResetKey = useRef(resetKey);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    if (resetKey !== prevResetKey.current) {
      prevResetKey.current = resetKey;
      timers.current.forEach(clearTimeout);
      timers.current.clear();
      setDisplay(findings.map((f) => ({ ...f, clearing: false })));
      return;
    }

    setDisplay((prev) => {
      const liveIds = new Set(findings.map((f) => f.ruleId));
      const next: LingeringFinding[] = [];

      for (const f of prev) {
        if (liveIds.has(f.ruleId) || f.clearing) {
          // Still present, or already fading out from an earlier pass — leave
          // it alone (refresh its content in case the message text changed).
          const fresh = findings.find((nf) => nf.ruleId === f.ruleId);
          next.push(fresh ? { ...fresh, clearing: false } : f);
          continue;
        }
        // Just dropped out of the live list for the first time: start its exit.
        next.push({ ...f, clearing: true });
        const timer = setTimeout(() => {
          setDisplay((d) => d.filter((x) => x.ruleId !== f.ruleId));
          timers.current.delete(f.ruleId);
        }, 420);
        timers.current.set(f.ruleId, timer);
      }

      for (const f of findings) {
        if (!next.some((x) => x.ruleId === f.ruleId)) next.push({ ...f, clearing: false });
      }

      return next;
    });
  }, [findings, resetKey]);

  return display;
}

const SEVERITY_LABEL: Record<Finding["severity"], string> = {
  blocker: "Blocker",
  warning: "Warning",
  suggestion: "Suggestion",
};

function FindingRow({ f }: { f: LingeringFinding }) {
  return (
    <li className={f.clearing ? `finding finding-${f.severity} finding-clearing` : `finding finding-${f.severity}`}>
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
export default function CheckerPanel({ findings, projectFindings, chapterId }: Props) {
  const displayed = useLingeringFindings(findings, chapterId);
  const displayedProject = useLingeringFindings(projectFindings, "project");

  // The reward state waits for any still-fading finding to actually finish —
  // otherwise it would replace the last blocker mid-fade instead of following it.
  const stillClearing = displayed.some((f) => f.clearing);
  const clean = findings.length === 0 && !stillClearing;
  const accessibilityFindings = displayed.filter((f) => f.category === "accessibility");
  const generalFindings = displayed.filter((f) => f.category !== "accessibility");

  return (
    <section className="checker" aria-live="polite">
      <div className="panel-head">
        <h2 className="panel-title">Checker</h2>
        {/* Derived from `displayed`, not `findings` — so the header still
            names the fading finding instead of jumping to "Nothing to fix"
            a beat before the body actually shows nothing left. */}
        <span className={clean ? "summary is-clean" : "summary"}>{summarise(displayed)}</span>
      </div>

      {clean ? (
        <div className="checker-clean" role="status">
          <span className="checker-clean-mark" aria-hidden="true">
            ✓
          </span>
          <div>
            <p className="checker-clean-headline">Nothing to fix</p>
            <p className="checker-clean-detail">
              This chapter passes every rule in the list — content, camera and accessibility alike.
            </p>
          </div>
        </div>
      ) : (
        <>
          {generalFindings.length > 0 && (
            <ul className="finding-list">
              {generalFindings.map((f) => (
                <FindingRow key={f.ruleId} f={f} />
              ))}
            </ul>
          )}

          {accessibilityFindings.length > 0 && (
            <div className="checker-group">
              <p className="checker-group-label">Accessibility</p>
              <ul className="finding-list">
                {accessibilityFindings.map((f) => (
                  <FindingRow key={f.ruleId} f={f} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {displayedProject.length > 0 && (
        <div className="checker-project">
          <p className="checker-project-label">Project-wide</p>
          <ul className="finding-list">
            {displayedProject.map((f) => (
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
