import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState, type RefObject } from "react";
import {
  AlertTriangle,
  ChevronDown,
  FileText,
  Heart,
  Info,
  ListChecks,
  Loader2,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ReferenceResultCard } from "@/components/ReferenceResultCard";
import { FormatResultCard } from "@/components/FormatResultCard";
import { extractTextFromFile } from "@/lib/file-extract";
import {
  checkReferences,
  type ReferenceResult,
  type Verdict,
} from "@/lib/reference-check.functions";
import {
  checkFormatting,
  ELEMENT_TYPE_LABELS,
  STYLE_LABELS,
  type CitationStyle,
  type ElementType,
  type FormatResult,
} from "@/lib/format-check";

const STORAGE_KEY = "reference-checker-state";

const VERSION = "1.0.0";
const BUILD_DATE = new Date().toLocaleDateString("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

type Filter = Verdict | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "real", label: "Real" },
  { value: "check", label: "Check" },
  { value: "no-trace", label: "No trace" },
  { value: "archived", label: "Archived" },
  { value: "offline", label: "Offline" },
  { value: "inconclusive", label: "Inconclusive" },
];

// Color each filter chip to match its verdict color in the result cards.
const FILTER_COLORS: Record<Filter, { active: string; inactive: string }> = {
  all: {
    active: "bg-foreground text-background hover:bg-foreground/90",
    inactive: "",
  },
  real: {
    active: "bg-emerald-500 text-white hover:bg-emerald-600 border-emerald-500",
    inactive:
      "border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950",
  },
  check: {
    active: "bg-amber-500 text-white hover:bg-amber-600 border-amber-500",
    inactive:
      "border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950",
  },
  "no-trace": {
    active: "bg-red-500 text-white hover:bg-red-600 border-red-500",
    inactive:
      "border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950",
  },
  archived: {
    active: "bg-sky-500 text-white hover:bg-sky-600 border-sky-500",
    inactive:
      "border-sky-300 text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950",
  },
  offline: {
    active: "bg-muted-foreground text-background hover:bg-muted-foreground/90",
    inactive: "text-muted-foreground",
  },
  inconclusive: {
    active: "bg-muted-foreground text-background hover:bg-muted-foreground/90",
    inactive: "text-muted-foreground",
  },
};

// Source-type filter for the authenticity view.
type TypeFilter = ReferenceResult["type"] | "all";

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "academic", label: "Academic" },
  { value: "web", label: "Web" },
  { value: "offline", label: "Offline" },
];

// Element-type filter for the formatting view (built from detected types).
type ElementFilter = ElementType | "all";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Reference Checker — authenticity & citation format" },
      {
        name: "description",
        content:
          "Verify references for authenticity against CrossRef, Semantic Scholar, OpenAlex, arXiv and DBLP, check web links for liveness, and validate citation formatting against APA, MLA, Harvard and Chicago styles.",
      },
      { property: "og:title", content: "Reference Checker" },
      {
        property: "og:description",
        content:
          "Detect likely-fabricated references and check citation formatting. Verifies DOIs and titles across scholarly databases, live URLs and the Internet Archive, plus APA, MLA, Harvard and Chicago formatting.",
      },
    ],
  }),
  component: Index,
});

const EXAMPLE = `Vaswani, A., Shazeer, N., Parmar, N., et al. (2017). Attention is all you need. Advances in Neural Information Processing Systems. https://arxiv.org/abs/1706.03762
Smith, J., & Doe, A. (2021). A completely fabricated study on quantum widgets. Journal of Imaginary Science. https://doi.org/10.1234/not-a-real-doi-9999
IPCC (2023). Climate change synthesis report. https://www.ipcc.ch/report/ar6/syr/
World Health Organization (2009). Pandemic influenza preparedness archived page. https://www.who.int/this-page-no-longer-exists-12345
Kahneman, D. (2011). Thinking, fast and slow. Farrar, Straus and Giroux.`;


const STYLE_OPTIONS: { value: CitationStyle; label: string }[] = [
  { value: "apa7", label: STYLE_LABELS.apa7 },
  { value: "mla9", label: STYLE_LABELS.mla9 },
  { value: "harvard", label: STYLE_LABELS.harvard },
  { value: "chicago17", label: STYLE_LABELS.chicago17 },
];

const VERDICT_ORDER: Record<string, number> = {
  "no-trace": 0,
  check: 1,
  archived: 2,
  inconclusive: 3,
  real: 4,
  offline: 5,
};

const GRADE_ORDER: Record<string, number> = {
  red: 0,
  yellow: 1,
  green: 2,
};

function toCsv(rows: ReferenceResult[]): string {
  const headers = [
    "n",
    "reference",
    "type",
    "verdict",
    "source",
    "doi",
    "url",
    "cited_title",
    "matched_title",
    "title_match_%",
    "http_status",
    "wayback",
    "notes",
  ];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [
      r.n,
      r.reference,
      r.type,
      r.verdict,
      r.source,
      r.doi,
      r.url,
      r.citedTitle,
      r.matchedTitle,
      r.titleScore ?? "",
      r.httpStatus,
      r.wayback,
      r.notes,
    ]
      .map(esc)
      .join(","),
  );
  return [headers.join(","), ...lines].join("\n");
}

function Index() {
  const [text, setText] = useState("");
  const [results, setResults] = useState<ReferenceResult[] | null>(null);
  const [verifiedText, setVerifiedText] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [elementFilter, setElementFilter] = useState<ElementFilter>("all");
  const [formatStyle, setFormatStyle] = useState<CitationStyle>("apa7");
  const [formatResults, setFormatResults] = useState<FormatResult[] | null>(
    null,
  );
  const [formattedText, setFormattedText] = useState("");
  const [activeView, setActiveView] = useState<"verify" | "format" | null>(
    null,
  );
  const [formatStep, setFormatStep] = useState<"idle" | "selecting" | "done">(
    "idle",
  );
  const [restored, setRestored] = useState(false);
  const [showHow, setShowHow] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const verifyResultsRef = useRef<HTMLDivElement>(null);
  const formatResultsRef = useRef<HTMLDivElement>(null);
  const checkFn = useServerFn(checkReferences);

  // Restore previous session state after mount (avoids SSR mismatch).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as {
          text?: string;
          results?: ReferenceResult[] | null;
          verifiedText?: string;
          filter?: Filter;
          typeFilter?: TypeFilter;
          elementFilter?: ElementFilter;
          formatStyle?: CitationStyle;
          formatResults?: FormatResult[] | null;
          formattedText?: string;
          activeView?: "verify" | "format" | null;
          formatStep?: "idle" | "selecting" | "done";
        };
        if (typeof saved.text === "string") setText(saved.text);
        if (Array.isArray(saved.results)) setResults(saved.results);
        if (typeof saved.verifiedText === "string")
          setVerifiedText(saved.verifiedText);
        if (saved.filter) setFilter(saved.filter);
        if (saved.typeFilter) setTypeFilter(saved.typeFilter);
        if (saved.elementFilter) setElementFilter(saved.elementFilter);
        if (saved.formatStyle) setFormatStyle(saved.formatStyle);
        if (Array.isArray(saved.formatResults))
          setFormatResults(saved.formatResults);
        if (typeof saved.formattedText === "string")
          setFormattedText(saved.formattedText);
        if (saved.activeView) setActiveView(saved.activeView);
        if (saved.formatStep) {
          setFormatStep(saved.formatStep);
        } else if (saved.activeView === "format") {
          setFormatStep(
            Array.isArray(saved.formatResults) && saved.formatResults.length
              ? "done"
              : "selecting",
          );
        }
      }
    } catch {
      // ignore corrupt storage
    }
    setRestored(true);
  }, []);

  // Persist state across reloads once restored.
  useEffect(() => {
    if (!restored) return;
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          text,
          results,
          verifiedText,
          filter,
          formatStyle,
          formatResults,
          formattedText,
          activeView,
          formatStep,
        }),
      );
    } catch {
      // ignore quota / serialization errors
    }
  }, [
    restored,
    text,
    results,
    verifiedText,
    filter,
    formatStyle,
    formatResults,
    formattedText,
    activeView,
    formatStep,
  ]);

  const scrollToResults = (ref: RefObject<HTMLDivElement | null>) => {
    requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const mutation = useMutation({
    mutationFn: (input: string) => checkFn({ data: { text: input } }),
    onSuccess: (data, input) => {
      const sorted = [...data.results].sort(
        (a, b) => VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict],
      );
      setResults(sorted);
      setVerifiedText(input);
      if (!data.results.length) {
        toast.error("No references found in the text.");
      } else {
        scrollToResults(verifyResultsRef);
      }
    },
    onError: (err) => {
      toast.error(`Check failed: ${(err as Error).message}`);
    },
  });

  const handleCheck = () => {
    if (!text.trim()) {
      toast.error("Paste or upload some references first.");
      return;
    }
    setActiveView("verify");
    setFormatStep("idle");
    // If we already have results for this exact text, just switch back to the
    // view and show them — don't clear or re-run.
    if (results && text === verifiedText) {
      scrollToResults(verifyResultsRef);
      return;
    }
    setResults(null);
    setFilter("all");
    mutation.mutate(text);
  };

  const handleFile = async (
    file: File,
    setter: (value: string) => void,
  ) => {
    try {
      const extracted = await extractTextFromFile(file);
      if (!extracted.trim()) {
        toast.error("Couldn't extract any text from that file.");
        return;
      }
      setter(extracted);
      toast.success(`Loaded ${file.name}`);
    } catch (e) {
      toast.error(`Failed to read file: ${(e as Error).message}`);
    }
  };

  const handleCheckFormat = () => {
    if (!text.trim()) {
      toast.error("Paste or upload some references first.");
      return;
    }
    setActiveView("format");
    // If we already have formatting results for this exact text, switch back to
    // the view and keep the chosen style highlighted — don't clear or reset.
    if (formatResults && text === formattedText) {
      setFormatStep("done");
      scrollToResults(formatResultsRef);
      return;
    }
    setFormatResults(null);
    setFormatStep("selecting");
  };

  const handleSelectStyle = (style: CitationStyle) => {
    setFormatStyle(style);
    const out = checkFormatting(text, style);
    setFormatResults(out);
    setFormattedText(text);
    setFormatStep("done");
    if (!out.length) {
      toast.error("No references found in the text.");
    } else {
      toast.success("Formatting checked — see results below.");
      scrollToResults(formatResultsRef);
    }
  };

  const downloadCsv = () => {
    if (!results?.length) return;
    const blob = new Blob([toCsv(results)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reference-check.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearAll = () => {
    setResults(null);
    setVerifiedText("");
    setFilter("all");
    setText("");
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const clearFormat = () => {
    setFormatResults(null);
    setFormattedText("");
    setFormatStep("selecting");
  };

  const formatCounts = formatResults
    ? {
        total: formatResults.length,
        green: formatResults.filter((r) => r.grade === "green").length,
        yellow: formatResults.filter((r) => r.grade === "yellow").length,
        red: formatResults.filter((r) => r.grade === "red").length,
      }
    : null;

  const counts = results
    ? {
        total: results.length,
        real: results.filter((r) => r.verdict === "real").length,
        flagged: results.filter((r) =>
          ["check", "no-trace", "archived", "inconclusive"].includes(r.verdict),
        ).length,
        offline: results.filter((r) => r.verdict === "offline").length,
      }
    : null;

  const verdictCounts = results
    ? results.reduce<Record<string, number>>((acc, r) => {
        acc[r.verdict] = (acc[r.verdict] ?? 0) + 1;
        return acc;
      }, {})
    : {};

  const filteredResults = results
    ? filter === "all"
      ? results
      : results.filter((r) => r.verdict === filter)
    : [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-muted/30">
        <div className="mx-auto max-w-4xl px-4 py-10">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-6 w-6" />
            <span className="text-sm font-semibold uppercase tracking-wide">
              Reference Checker
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Check reference authenticity and citation format
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Paste a reference list or upload a file. Citations are verified for
            authenticity against CrossRef, Semantic Scholar, OpenAlex, arXiv and
            DBLP, and web links are checked for liveness and against the Internet
            Archive — then validate their formatting against APA, MLA, Harvard
            and Chicago styles.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 pb-24">
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="refs" className="text-sm font-medium">
                Paste reference(s)
              </label>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setText(EXAMPLE)}
                >
                  Try example
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Upload
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.docx,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f, setText);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
            <Textarea
              id="refs"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                "One reference per entry. APA, numbered or plain text all work, e.g.\n\nSmith, J. (2024). Title of the article. Journal Name. https://doi.org/10.xxxx/xxxx"
              }
              className="min-h-48 font-mono text-sm"
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Supports .txt, .docx and .pdf uploads · up to 100 references.
            </p>


            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button
                className="flex-1"
                variant={activeView === "verify" ? "default" : "outline"}
                onClick={handleCheck}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                {mutation.isPending ? "Checking…" : "Verify authenticity"}
              </Button>
              <Button
                className="flex-1"
                variant={activeView === "format" ? "default" : "outline"}
                onClick={handleCheckFormat}
              >
                <ListChecks className="h-4 w-4" />
                Check formatting
              </Button>
            </div>

            {activeView === "format" &&
              (formatStep === "selecting" || formatStep === "done") && (
                <div className="mt-4 rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm font-medium">
                    Select a citation style to run the formatting check
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {STYLE_OPTIONS.map((s) => (
                      <Button
                        key={s.value}
                        variant={
                          formatStep === "done" && formatStyle === s.value
                            ? "default"
                            : "outline"
                        }
                        size="sm"
                        onClick={() => handleSelectStyle(s.value)}
                      >
                        {s.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
          </CardContent>
        </Card>

        {activeView === "verify" && (mutation.isPending || results) && (
          <div className="mt-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              This tool may occasionally misclassify authentic references —
              always double-check flagged items manually.
            </p>
          </div>
        )}

        {activeView === "format" &&
          (formatStep === "selecting" || formatResults) && (
            <div className="mt-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <p>
                Formatting checks are heuristic and can't see italics in pasted
                text — treat the ideal version as a guide, not a final answer.
              </p>
            </div>
          )}

        {activeView === "verify" && mutation.isPending && (
          <p className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verifying references across databases and live links…
          </p>
        )}

        {activeView === "verify" && counts && (
          <div ref={verifyResultsRef} className="mt-8 scroll-mt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="flex items-center gap-1.5 font-medium">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Authenticity
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="font-medium">{counts.total} checked</span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  {counts.real} real
                </span>
                <span className="text-amber-600 dark:text-amber-400">
                  {counts.flagged} flagged
                </span>
                {counts.offline > 0 && (
                  <span className="text-muted-foreground">
                    {counts.offline} offline
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={downloadCsv}>
                  <FileText className="h-4 w-4" />
                  Export CSV
                </Button>
                <Button variant="ghost" size="sm" onClick={clearAll}>
                  <Trash2 className="h-4 w-4" />
                  Clear
                </Button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {FILTERS.map((f) => {
                const count =
                  f.value === "all"
                    ? counts.total
                    : verdictCounts[f.value] ?? 0;
                if (f.value !== "all" && count === 0) return null;
                const active = filter === f.value;
                const color = FILTER_COLORS[f.value];
                return (
                  <Button
                    key={f.value}
                    variant={active ? "default" : "outline"}
                    size="sm"
                    className={cn(active ? color.active : color.inactive)}
                    onClick={() => setFilter(f.value)}
                  >
                    {f.label}
                    <span className={cn("ml-1", active ? "opacity-80" : "opacity-70")}>
                      {count}
                    </span>
                  </Button>
                );
              })}
            </div>

            <div className="mt-4 space-y-3">
              {filteredResults.map((r) => (
                <ReferenceResultCard key={r.n} result={r} />
              ))}
              {filteredResults.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No references match this filter.
                </p>
              )}
            </div>
          </div>
        )}

        {activeView === "format" && formatCounts && (
          <div ref={formatResultsRef} className="mt-8 scroll-mt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="flex items-center gap-1.5 font-medium">
                  <ListChecks className="h-4 w-4 text-primary" />
                  {STYLE_LABELS[formatStyle]} formatting
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="font-medium">
                  {formatCounts.total} checked
                </span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  {formatCounts.green} perfect
                </span>
                <span className="text-amber-600 dark:text-amber-400">
                  {formatCounts.yellow} need work
                </span>
                <span className="text-red-600 dark:text-red-400">
                  {formatCounts.red} bad
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={clearFormat}>
                <Trash2 className="h-4 w-4" />
                Clear
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {formatResults
                ?.slice()
                .sort((a, b) => GRADE_ORDER[a.grade] - GRADE_ORDER[b.grade])
                .map((r) => (
                  <FormatResultCard key={r.n} result={r} />
                ))}
              {formatResults?.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No references found in the text.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="mt-10 rounded-lg border px-4">
          <button
            type="button"
            onClick={() => setShowHow((v) => !v)}
            aria-expanded={showHow}
            aria-controls="how-it-works"
            className="flex w-full items-center justify-between py-4 text-left text-sm font-medium"
          >
            <span className="flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              How it works — what happens behind the scenes
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                showHow ? "rotate-180" : ""
              }`}
            />
          </button>
          {showHow && (
            <div
              id="how-it-works"
              className="space-y-4 pb-4 text-sm text-muted-foreground"
            >
              {activeView === "format" ? (
                <>
                  <p>
                    The formatting checker compares each reference against the
                    rules of the citation style you select. It is a heuristic,
                    rule-based check — it does{" "}
                    <span className="font-medium">not use any AI</span> or large
                    language model, so it can miss nuances and may not be very
                    accurate. Treat the results as a helpful guide rather than a
                    definitive verdict.
                  </p>

                  <div>
                    <h3 className="font-medium text-foreground">1. Parsing</h3>
                    <p>
                      Your pasted text is split into individual references. The
                      parser looks for author names, years, titles, journal
                      names, volume / issue numbers, page ranges and URLs.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-medium text-foreground">
                      2. Rule checking
                    </h3>
                    <p>
                      Each reference is scored against the style you chose (e.g.
                      APA 7th, MLA 9th, Harvard, Chicago 17th). Typical checks
                      include:
                    </p>
                    <ul className="ml-4 mt-1 list-disc space-y-1">
                      <li>
                        <span className="font-medium text-foreground">
                          Author formatting
                        </span>{" "}
                        — order, initials and punctuation between names.
                      </li>
                      <li>
                        <span className="font-medium text-foreground">
                          Year placement
                        </span>{" "}
                        — inside parentheses or inline, depending on the style.
                      </li>
                      <li>
                        <span className="font-medium text-foreground">
                          Title casing
                        </span>{" "}
                        — sentence case vs. title case (italics rules are noted
                        but not visible in pasted plain text).
                      </li>
                      <li>
                        <span className="font-medium text-foreground">
                          Source details
                        </span>{" "}
                        — journal / publisher, volume, issue, page range and DOI
                        formatting.
                      </li>
                      <li>
                        <span className="font-medium text-foreground">
                          Punctuation
                        </span>{" "}
                        — periods, commas, colons and ampersands in the right
                        positions.
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-medium text-foreground">3. Grading</h3>
                    <ul className="ml-4 mt-1 list-disc space-y-1">
                      <li>
                        <span className="font-medium text-foreground">
                          Perfect (green)
                        </span>{" "}
                        — the reference follows most of the style rules.
                      </li>
                      <li>
                        <span className="font-medium text-foreground">
                          Needs work (yellow)
                        </span>{" "}
                        — elements are present but out of order or missing minor
                        punctuation.
                      </li>
                      <li>
                        <span className="font-medium text-foreground">
                          Bad (red)
                        </span>{" "}
                        — major components are missing or the structure doesn't
                        match the selected style.
                      </li>
                    </ul>
                  </div>

                  <p className="text-xs">
                    Because this check is rule-based and can't see formatting
                    such as italics or hanging indents in pasted plain text, the
                    results are approximate — always compare against the official
                    style manual.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    This tool tries to detect references that may have been
                    fabricated or that point to dead links. Nothing is stored on
                    a server — each reference is checked live against public
                    databases when you press{" "}
                    <span className="font-medium">Verify authenticity</span>.
                  </p>

                  <div>
                    <h3 className="font-medium text-foreground">1. Parsing</h3>
                    <p>
                      Your pasted text — or the text extracted from an uploaded{" "}
                      <code>.txt</code>, <code>.docx</code> or <code>.pdf</code> —
                      is split into individual references. For uploaded documents,
                      only the{" "}
                      <span className="font-medium">
                        References / Bibliography
                      </span>{" "}
                      section at the end of the document is used.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-medium text-foreground">
                      2. Classification
                    </h3>
                    <p>
                      Each entry is sorted into one of three types based on what
                      it contains:
                    </p>
                    <ul className="ml-4 mt-1 list-disc space-y-1">
                      <li>
                        <span className="font-medium text-foreground">
                          Academic
                        </span>{" "}
                        — has a DOI or links to a scholarly source (e.g. arXiv).
                      </li>
                      <li>
                        <span className="font-medium text-foreground">Web</span> —
                        a regular website link with no DOI.
                      </li>
                      <li>
                        <span className="font-medium text-foreground">
                          Offline
                        </span>{" "}
                        — e.g. a printed book, with no link to verify.
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-medium text-foreground">
                      3. Verification
                    </h3>
                    <ul className="ml-4 mt-1 list-disc space-y-1">
                      <li>
                        <span className="font-medium text-foreground">
                          Academic:
                        </span>{" "}
                        the DOI is resolved first (CrossRef, then OpenAlex). If
                        there is no DOI, the title is searched across{" "}
                        <span className="font-medium">
                          CrossRef, OpenAlex, Semantic Scholar, arXiv and DBLP
                        </span>
                        . A title-similarity score then decides whether it is a
                        confident match.
                      </li>
                      <li>
                        <span className="font-medium text-foreground">Web:</span>{" "}
                        the link is fetched to confirm it is live (HTTP status).
                        Dead links are looked up in the{" "}
                        <span className="font-medium">
                          Internet Archive (Wayback)
                        </span>{" "}
                        to see if a snapshot ever existed.
                      </li>
                      <li>
                        <span className="font-medium text-foreground">
                          Offline:
                        </span>{" "}
                        flagged as not automatically verifiable.
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-medium text-foreground">
                      Verdict legend
                    </h3>
                    <ul className="ml-4 mt-1 list-disc space-y-1">
                      <li>
                        <span className="font-medium text-foreground">Real</span>{" "}
                        — confidently matched in a database or a live link.
                      </li>
                      <li>
                        <span className="font-medium text-foreground">Check</span>{" "}
                        — needs a manual look: a partial title match, a live page
                        that looks outdated, or a link that responds but blocks
                        automated verification.
                      </li>
                      <li>
                        <span className="font-medium text-foreground">
                          No trace
                        </span>{" "}
                        — unreachable and never archived; possibly fabricated.
                      </li>
                      <li>
                        <span className="font-medium text-foreground">
                          Archived
                        </span>{" "}
                        — the live link is dead, but an Internet Archive snapshot
                        exists.
                      </li>
                      <li>
                        <span className="font-medium text-foreground">
                          Offline
                        </span>{" "}
                        — a source (e.g. a book) that cannot be auto-verified.
                      </li>
                      <li>
                        <span className="font-medium text-foreground">
                          Inconclusive
                        </span>{" "}
                        — the checks could not reach a clear answer.
                      </li>
                    </ul>
                  </div>

                  <p className="text-xs">
                    Results are heuristic and can occasionally be wrong — always
                    double-check anything flagged before acting on it.
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 rounded-lg border px-4">
          <button
            type="button"
            onClick={() => setShowAbout((v) => !v)}
            aria-expanded={showAbout}
            aria-controls="about-credits"
            className="flex w-full items-center justify-between py-4 text-left text-sm font-medium"
          >
            <span className="flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              About &amp; credits
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                showAbout ? "rotate-180" : ""
              }`}
            />
          </button>
          {showAbout && (
            <div
              id="about-credits"
              className="space-y-4 pb-4 text-sm text-muted-foreground"
            >
              <p>
                Reference Checker helps you spot references that may have been
                fabricated or that point to dead links. Every check runs live
                against public databases and the open web — nothing you paste or
                upload is stored on a server.
              </p>

              <div>
                <h3 className="font-medium text-foreground">Credits</h3>
                <ul className="ml-4 mt-1 list-disc space-y-1">
                  <li>
                    The academic verification approach is inspired by{" "}
                    <a
                      href="https://zabbonat.github.io/References-Validation/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary underline underline-offset-2"
                    >
                      checkifexist
                    </a>
                    .
                  </li>
                  <li>
                    The web-page liveness and Internet Archive (Wayback) checking
                    is an original creation by the author.
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-medium text-foreground">Author &amp; license</h3>
                <p>
                  Built by{" "}
                  <a
                    href="https://www.linkedin.com/in/sebastianbernalgarcia/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary underline underline-offset-2"
                  >
                    Sebastian Bernal Garcia
                  </a>
                  . Released under the MIT License.
                </p>
              </div>
            </div>
          )}
        </div>

        <footer className="mt-10 border-t pt-6 pb-2 text-center text-xs text-muted-foreground">
          Built by{" "}
          <a
            href="https://www.linkedin.com/in/sebastianbernalgarcia/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline underline-offset-2"
          >
            Sebastian Bernal Garcia
          </a>{" "}
          · MIT License · 2026
          <br />
          v{VERSION} · Updated {BUILD_DATE}
        </footer>

      </main>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center pb-4">
        <div className="pointer-events-auto inline-flex items-center gap-3 rounded-full bg-rose-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-rose-600/30">
          <span className="flex items-center gap-2">
            <Heart className="h-4 w-4 animate-pulse fill-current" />
            Support this tool
          </span>
          <span className="h-5 w-px bg-white/30" aria-hidden="true" />
          <div className="flex items-center gap-2">
            <a
              href="https://paypal.me/sebastbernal"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full px-2 py-0.5 underline-offset-2 transition-colors hover:bg-white/15 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200"
            >
              PayPal
            </a>
            <span className="text-white/50" aria-hidden="true">
              ·
            </span>
            <a
              href="https://buymeacoffee.com/sebastbernal"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full px-2 py-0.5 underline-offset-2 transition-colors hover:bg-white/15 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200"
            >
              Card
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
