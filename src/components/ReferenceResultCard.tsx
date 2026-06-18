import {
  AlertTriangle,
  Archive,
  Bot,
  BookOpen,
  CheckCircle2,
  Globe,
  GraduationCap,
  HelpCircle,
  Search,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { buildSearchLinks } from "@/lib/search-links";
import type { ReferenceResult, Verdict } from "@/lib/reference-check.functions";

export const VERDICT_META: Record<
  Verdict,
  { label: string; icon: typeof CheckCircle2; classes: string; bar: string }
> = {
  real: {
    label: "Real",
    icon: CheckCircle2,
    classes: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    bar: "bg-emerald-500",
  },
  archived: {
    label: "Dead link · archived",
    icon: Archive,
    classes: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
    bar: "bg-sky-500",
  },
  check: {
    label: "Check",
    icon: AlertTriangle,
    classes: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
    bar: "bg-amber-500",
  },
  "no-trace": {
    label: "No trace",
    icon: XCircle,
    classes: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    bar: "bg-red-500",
  },
  offline: {
    label: "Offline source",
    icon: BookOpen,
    classes: "bg-muted text-muted-foreground",
    bar: "bg-muted-foreground/40",
  },
  inconclusive: {
    label: "Inconclusive",
    icon: HelpCircle,
    classes: "bg-muted text-muted-foreground",
    bar: "bg-muted-foreground/40",
  },
};

const TYPE_META = {
  academic: { label: "Academic", icon: GraduationCap },
  web: { label: "Web", icon: Globe },
  offline: { label: "Offline", icon: BookOpen },
};

export function ReferenceResultCard({ result }: { result: ReferenceResult }) {
  const meta = VERDICT_META[result.verdict];
  const VerdictIcon = meta.icon;
  const typeMeta = TYPE_META[result.type];
  const TypeIcon = typeMeta.icon;

  return (
    <Card className="overflow-hidden">
      <div className="flex">
        <div className={cn("w-1.5 shrink-0", meta.bar)} aria-hidden />
        <CardContent className="flex-1 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                #{result.n}
              </span>
              <Badge className={cn("gap-1 border-0", meta.classes)}>
                <VerdictIcon className="h-3.5 w-3.5" />
                {meta.label}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <TypeIcon className="h-3.5 w-3.5" />
                {typeMeta.label}
              </Badge>
              {result.source && (
                <Badge variant="secondary">{result.source}</Badge>
              )}
              {result.aiTrace && (
                <Badge className="gap-1 border-0 bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                  <Bot className="h-3.5 w-3.5" />
                  AI trace
                </Badge>
              )}
            </div>
            {result.titleScore !== null && (
              <span className="text-xs text-muted-foreground">
                title match {result.titleScore}%
              </span>
            )}
          </div>

          <p className="mt-2 text-sm leading-relaxed">{result.reference}</p>

          <p className="mt-2 text-sm text-muted-foreground">{result.notes}</p>

          <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
            {result.matchedTitle && (
              <div className="sm:col-span-2">
                <dt className="inline font-medium">Matched title: </dt>
                <dd className="inline">{result.matchedTitle}</dd>
              </div>
            )}
            {result.aiTrace && (
              <div className="sm:col-span-2">
                <dt className="inline font-medium text-amber-700 dark:text-amber-400">
                  AI trace:{" "}
                </dt>
                <dd className="inline break-all text-amber-700 dark:text-amber-400">
                  {result.aiTrace}
                </dd>
              </div>
            )}
            {result.doi && (
              <div>
                <dt className="inline font-medium">DOI: </dt>
                <dd className="inline break-all">{result.doi}</dd>
              </div>
            )}
            {result.url && (
              <div className="truncate">
                <dt className="inline font-medium">URL: </dt>
                <dd className="inline">
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline-offset-2 hover:underline break-all"
                  >
                    {result.url}
                  </a>
                </dd>
              </div>
            )}
            {result.httpStatus && (
              <div>
                <dt className="inline font-medium">HTTP: </dt>
                <dd className="inline">{result.httpStatus}</dd>
              </div>
            )}
            {result.wayback && (
              <div>
                <dt className="inline font-medium">Archive: </dt>
                <dd className="inline">{result.wayback}</dd>
              </div>
            )}
          </dl>

          {["check", "no-trace", "offline", "inconclusive"].includes(result.verdict) && (() => {
            const links = buildSearchLinks(result.reference, result.citedTitle);
            const btn =
              "inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground/80 hover:bg-muted hover:text-foreground transition-colors no-underline";
            const openSearch = (url: string) =>
              window.open(url, "_blank", "noopener,noreferrer");
            return (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Search className="h-3.5 w-3.5" />
                  Couldn't auto-verify — search manually:
                </span>
                <button type="button" onClick={() => openSearch(links.scholar)} className={btn}>
                  Google Scholar
                </button>
                <button type="button" onClick={() => openSearch(links.books)} className={btn}>
                  Google Books
                </button>
                <button type="button" onClick={() => openSearch(links.google)} className={btn}>
                  Google
                </button>
              </div>
            );
          })()}
        </CardContent>
      </div>
    </Card>
  );
}
