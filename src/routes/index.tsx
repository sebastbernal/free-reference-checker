import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState, type RefObject } from "react";
import {
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
  STYLE_LABELS,
  type CitationStyle,
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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Reference Checker — detect fabricated citations" },
      {
        name: "description",
        content:
          "Verify references against CrossRef, Semantic Scholar, OpenAlex, arXiv and DBLP, and check web links for liveness and Wayback archives.",
      },
      { property: "og:title", content: "Reference Checker" },
      {
        property: "og:description",
        content:
          "Detect likely-fabricated references. Checks DOIs and titles across scholarly databases plus live URLs and the Internet Archive.",
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
  const [filter, setFilter] = useState<Filter>("all");
  const [formatStyle, setFormatStyle] = useState<CitationStyle>("apa7");
  const [formatResults, setFormatResults] = useState<FormatResult[] | null>(
    null,
  );
  const [activeView, setActiveView] = useState<"verify" | "format" | null>(
    null,
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
          filter?: Filter;
          formatStyle?: CitationStyle;
          formatResults?: FormatResult[] | null;
          activeView?: "verify" | "format" | null;
        };
        if (typeof saved.text === "string") setText(saved.text);
        if (Array.isArray(saved.results)) setResults(saved.results);
        if (saved.filter) setFilter(saved.filter);
        if (saved.formatStyle) setFormatStyle(saved.formatStyle);
        if (Array.isArray(saved.formatResults))
          setFormatResults(saved.formatResults);
        if (saved.activeView) setActiveView(saved.activeView);
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
          filter,
          formatStyle,
          formatResults,
          activeView,
        }),
      );
    } catch {
      // ignore quota / serialization errors
    }
  }, [
    restored,
    text,
    results,
    filter,
    formatStyle,
    formatResults,
    activeView,
  ]);

  const scrollToResults = (ref: RefObject<HTMLDivElement | null>) => {
    requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const mutation = useMutation({
    mutationFn: (input: string) => checkFn({ data: { text: input } }),
    onSuccess: (data) => {
      const sorted = [...data.results].sort(
        (a, b) => VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict],
      );
      setResults(sorted);
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
    const out = checkFormatting(text, formatStyle);
    setFormatResults(out);
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
            Detect likely-fabricated references
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Paste a reference list or upload a file. Academic citations are
            verified against CrossRef, Semantic Scholar, OpenAlex, arXiv and
            DBLP; web links are checked for liveness and against the Internet
            Archive.
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

            <div className="mt-4 border-t pt-4">
              <p className="text-sm font-medium">Citation style (for formatting check)</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {STYLE_OPTIONS.map((s) => (
                  <Button
                    key={s.value}
                    variant={formatStyle === s.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFormatStyle(s.value)}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button
                className="flex-1"
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
                variant="secondary"
                onClick={handleCheckFormat}
              >
                <ListChecks className="h-4 w-4" />
                Check formatting
              </Button>
            </div>
          </CardContent>
        </Card>

        {mutation.isPending && (
          <p className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verifying references across databases and live links…
          </p>
        )}

        {counts && (
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
                return (
                  <Button
                    key={f.value}
                    variant={active ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter(f.value)}
                  >
                    {f.label}
                    <span
                      className={
                        active
                          ? "ml-1 text-primary-foreground/80"
                          : "ml-1 text-muted-foreground"
                      }
                    >
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

            <p className="mt-6 text-center text-xs text-muted-foreground">
              This tool may occasionally misclassify authentic references —
              always double-check flagged items manually.
            </p>
          </div>
        )}

        {formatCounts && (
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
              {formatResults?.map((r) => (
                <FormatResultCard key={r.n} result={r} />
              ))}
              {formatResults?.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No references found in the text.
                </p>
              )}
            </div>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Formatting checks are heuristic and can't see italics in pasted
              text — treat the ideal version as a guide, not a final answer.
            </p>
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
              <p>
                This tool tries to detect references that may have been
                fabricated or that point to dead links. Nothing is stored on a
                server — each reference is checked live against public databases
                when you press <span className="font-medium">Check references</span>.
              </p>

              <div>
                <h3 className="font-medium text-foreground">1. Parsing</h3>
                <p>
                  Your pasted text — or the text extracted from an uploaded{" "}
                  <code>.txt</code>, <code>.docx</code> or <code>.pdf</code> — is
                  split into individual references. For uploaded documents, only
                  the <span className="font-medium">References / Bibliography</span>{" "}
                  section at the end of the document is used.
                </p>
              </div>

              <div>
                <h3 className="font-medium text-foreground">2. Classification</h3>
                <p>
                  Each entry is sorted into one of three types based on what it
                  contains:
                </p>
                <ul className="ml-4 mt-1 list-disc space-y-1">
                  <li>
                    <span className="font-medium text-foreground">Academic</span>{" "}
                    — has a DOI or links to a scholarly source (e.g. arXiv).
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Web</span> — a
                    regular website link with no DOI.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Offline</span>{" "}
                    — e.g. a printed book, with no link to verify.
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-medium text-foreground">3. Verification</h3>
                <ul className="ml-4 mt-1 list-disc space-y-1">
                  <li>
                    <span className="font-medium text-foreground">Academic:</span>{" "}
                    the DOI is resolved first (CrossRef, then OpenAlex). If there
                    is no DOI, the title is searched across{" "}
                    <span className="font-medium">
                      CrossRef, OpenAlex, Semantic Scholar, arXiv and DBLP
                    </span>
                    . A title-similarity score then decides whether it is a
                    confident match.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Web:</span> the
                    link is fetched to confirm it is live (HTTP status). Dead
                    links are looked up in the{" "}
                    <span className="font-medium">Internet Archive (Wayback)</span>{" "}
                    to see if a snapshot ever existed.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Offline:</span>{" "}
                    flagged as not automatically verifiable.
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-medium text-foreground">Verdict legend</h3>
                <ul className="ml-4 mt-1 list-disc space-y-1">
                  <li>
                    <span className="font-medium text-foreground">Real</span> —
                    confidently matched in a database or a live link.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Check</span> —
                    found but the title only partly matches; verify manually.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">No trace</span>{" "}
                    — unreachable and never archived; possibly fabricated.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Archived</span>{" "}
                    — the live link is dead, but an Internet Archive snapshot
                    exists.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Offline</span> —
                    a source (e.g. a book) that cannot be auto-verified.
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
