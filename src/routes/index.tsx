import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  FileText,
  Info,
  Loader2,
  ScanSearch,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ReferenceResultCard } from "@/components/ReferenceResultCard";
import { extractTextFromFile } from "@/lib/file-extract";
import {
  checkReferences,
  type ReferenceResult,
  type Verdict,
} from "@/lib/reference-check.functions";

const STORAGE_KEY = "reference-checker-state";

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
  const [restored, setRestored] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
        };
        if (typeof saved.text === "string") setText(saved.text);
        if (Array.isArray(saved.results)) setResults(saved.results);
        if (saved.filter) setFilter(saved.filter);
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
        JSON.stringify({ text, results, filter }),
      );
    } catch {
      // ignore quota / serialization errors
    }
  }, [restored, text, results, filter]);

  const mutation = useMutation({
    mutationFn: (input: string) => checkFn({ data: { text: input } }),
    onSuccess: (data) => {
      const sorted = [...data.results].sort(
        (a, b) => VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict],
      );
      setResults(sorted);
      if (!data.results.length) {
        toast.error("No references found in the text.");
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

  const handleFile = async (file: File) => {
    try {
      const extracted = await extractTextFromFile(file);
      if (!extracted.trim()) {
        toast.error("Couldn't extract any text from that file.");
        return;
      }
      setText(extracted);
      toast.success(`Loaded ${file.name}`);
    } catch (e) {
      toast.error(`Failed to read file: ${(e as Error).message}`);
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

      <main className="mx-auto max-w-4xl px-4 py-8">
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
                    if (f) handleFile(f);
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
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Supports .txt, .docx and .pdf uploads · up to 100 references.
              </p>
              <Button onClick={handleCheck} disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ScanSearch className="h-4 w-4" />
                )}
                {mutation.isPending ? "Checking…" : "Check references"}
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
          <div className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-4 text-sm">
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
                  f.value === "all" ? counts.total : verdictCounts[f.value] ?? 0;
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

        <Accordion type="single" collapsible className="mt-10">
          <AccordionItem value="how" className="rounded-lg border px-4">
            <AccordionTrigger className="text-sm font-medium">
              <span className="flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                How it works — what happens behind the scenes
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 text-sm text-muted-foreground">
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
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </main>
    </div>
  );
}
