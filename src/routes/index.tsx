import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  FileText,
  Loader2,
  ScanSearch,
  ShieldCheck,
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const checkFn = useServerFn(checkReferences);

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
              <Button variant="outline" size="sm" onClick={downloadCsv}>
                <FileText className="h-4 w-4" />
                Export CSV
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {results!.map((r) => (
                <ReferenceResultCard key={r.n} result={r} />
              ))}
            </div>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              This tool may occasionally misclassify authentic references —
              always double-check flagged items manually.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
