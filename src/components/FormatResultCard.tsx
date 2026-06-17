import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  STYLE_LABELS,
  type FormatIssue,
  type FormatResult,
  type Grade,
} from "@/lib/format-check";

const GRADE_META: Record<
  Grade,
  { label: string; icon: typeof CheckCircle2; classes: string; bar: string }
> = {
  green: {
    label: "Perfect",
    icon: CheckCircle2,
    classes:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    bar: "bg-emerald-500",
  },
  yellow: {
    label: "Needs improvement",
    icon: AlertTriangle,
    classes:
      "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
    bar: "bg-amber-500",
  },
  red: {
    label: "Very bad",
    icon: XCircle,
    classes: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    bar: "bg-red-500",
  },
};

interface Segment {
  text: string;
  severity: "minor" | "major" | null;
}

// Build highlighted segments by locating each issue snippet in the reference.
function buildSegments(reference: string, issues: FormatIssue[]): Segment[] {
  const marks: { start: number; end: number; severity: "minor" | "major" }[] = [];
  const lower = reference.toLowerCase();
  for (const issue of issues) {
    const snip = issue.snippet?.trim();
    if (!snip) continue;
    const idx = lower.indexOf(snip.toLowerCase());
    if (idx === -1) continue;
    marks.push({ start: idx, end: idx + snip.length, severity: issue.severity });
  }
  marks.sort((a, b) => a.start - b.start);

  const segments: Segment[] = [];
  let cursor = 0;
  for (const m of marks) {
    if (m.start < cursor) continue; // skip overlaps
    if (m.start > cursor) {
      segments.push({ text: reference.slice(cursor, m.start), severity: null });
    }
    segments.push({ text: reference.slice(m.start, m.end), severity: m.severity });
    cursor = m.end;
  }
  if (cursor < reference.length) {
    segments.push({ text: reference.slice(cursor), severity: null });
  }
  return segments;
}

export function FormatResultCard({ result }: { result: FormatResult }) {
  const meta = GRADE_META[result.grade];
  const GradeIcon = meta.icon;
  const segments = buildSegments(result.reference, result.issues);

  return (
    <Card className="overflow-hidden">
      <div className="flex">
        <div className={cn("w-1.5 shrink-0", meta.bar)} aria-hidden />
        <CardContent className="flex-1 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              #{result.n}
            </span>
            <Badge className={cn("gap-1 border-0", meta.classes)}>
              <GradeIcon className="h-3.5 w-3.5" />
              {meta.label}
            </Badge>
            <Badge variant="outline">{STYLE_LABELS[result.style]}</Badge>
          </div>

          <div className="mt-3">
            <p className="text-xs font-medium text-muted-foreground">
              Your reference
            </p>
            <p className="mt-1 text-sm leading-relaxed">
              {segments.map((seg, i) =>
                seg.severity ? (
                  <mark
                    key={i}
                    className={cn(
                      "rounded px-0.5",
                      seg.severity === "major"
                        ? "bg-red-200 text-red-900 dark:bg-red-900/60 dark:text-red-100"
                        : "bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100",
                    )}
                  >
                    {seg.text}
                  </mark>
                ) : (
                  <span key={i}>{seg.text}</span>
                ),
              )}
            </p>
          </div>

          <div className="mt-3">
            <p className="text-xs font-medium text-muted-foreground">
              Ideal {STYLE_LABELS[result.style]} format
            </p>
            <p className="mt-1 rounded-md bg-muted/50 p-2 text-sm leading-relaxed">
              {result.ideal}
            </p>
          </div>

          {result.issues.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs font-medium text-muted-foreground">
                {result.issues.length} issue
                {result.issues.length > 1 ? "s" : ""} found
              </p>
              <ul className="mt-1 space-y-1">
                {result.issues.map((issue, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span
                      className={cn(
                        "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                        issue.severity === "major"
                          ? "bg-red-500"
                          : "bg-amber-500",
                      )}
                      aria-hidden
                    />
                    <span>{issue.problem}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">
              No formatting problems detected for this style.
            </p>
          )}
        </CardContent>
      </div>
    </Card>
  );
}
