// url-repair.ts
// ---------------------------------------------------------------------------
// Copy-paste from a PDF/Word document often DROPS the hyphen where a URL was
// wrapped across a line: "science-everyone" becomes "scienceeveryone". The text
// arrives already fused, with no hyphen, line break, or marker — so the parser
// cannot and should not try to restore it (many real URLs legitimately fuse
// words). The reliable place to recover is the VERIFICATION step, where the URL
// is checked against the live web: if the original 404s, try a few hyphenation
// repairs and keep whichever resolves.
//
// Tuned for a PUBLIC tool processing up to ~100 references: the candidate count
// is capped low and only the SINGLE longest fused segment is repaired, so one
// corrupted URL can never cost more than `maxVariants` pings. Combine with
// Promise.any at the call site so those pings run in parallel (≈ one round trip).
//
// Usage in the verification step's dead-link branch (before Wayback):
//   import { repairUrl } from "./url-repair";
//   const fixed = await repairUrl(url);          // null if nothing resolves
//   if (fixed) { /* reference is real; note the formatting error; use `fixed` */ }
//   else      { /* existing Wayback / no-trace fallback, unchanged */ }
//
// repairUrl is bounded (≤6 candidates, longest fused segment only) and probes
// them in parallel with a short HEAD-only request, so a dead URL adds roughly
// one extra round trip. Live URLs never reach this code, so they pay nothing.

export function urlRepairCandidates(url: string, maxVariants = 6): string[] {
  const out = [url];

  // Separate any ?query / #fragment so we only repair the path.
  const qIdx = url.search(/[?#]/);
  const base = qIdx === -1 ? url : url.slice(0, qIdx);
  const tail = qIdx === -1 ? "" : url.slice(qIdx);

  const m = base.match(/^(https?:\/\/[^/]+)(\/.*)$/i);
  if (!m) return out; // no path to repair

  const host = m[1];
  const segments = m[2].split("/");

  // Find the SINGLE longest path segment that looks like a fused word: a long,
  // pure-lowercase run with no existing hyphen. Paste-corruption produces
  // exactly one such fusion per URL in practice, so repairing only the longest
  // candidate keeps the work bounded and on-target.
  let targetIdx = -1;
  let targetLen = 0;
  for (let si = 0; si < segments.length; si++) {
    const seg = segments[si];
    if (seg.length >= 12 && !seg.includes("-") && /^[a-z]+$/.test(seg)) {
      if (seg.length > targetLen) {
        targetLen = seg.length;
        targetIdx = si;
      }
    }
  }
  if (targetIdx === -1) return out; // nothing repair-worthy → no extra cost

  const seg = segments[targetIdx];

  // Re-insert one hyphen at each interior boundary (skip the first/last few
  // chars — hyphens rarely sit at a word edge). Bounded by maxVariants.
  for (let i = 4; i <= seg.length - 4; i++) {
    if (out.length >= maxVariants) break;
    const segs = [...segments];
    segs[targetIdx] = seg.slice(0, i) + "-" + seg.slice(i);
    out.push(host + segs.join("/") + tail);
  }

  return out;
}

// ---------------------------------------------------------------------------
// Lightweight liveness probe for repair candidates only.
// ---------------------------------------------------------------------------
// Repair candidates are WRONG by construction (all but one 404), so the probe
// must fail fast and cheap: HEAD only (no GET fallback) and a short timeout, so
// a wrong candidate doesn't tie up a connection for the full 15s used by the
// main httpCheck. We only need a yes/no on existence, not response bodies.
async function probeLive(url: string, timeoutMs = 6000): Promise<boolean> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
    });
    return r.status < 400;
  } catch {
    return false;
  } finally {
    clearTimeout(id);
  }
}

// ---------------------------------------------------------------------------
// Drop-in helper: given a dead URL, try repairs in parallel, return the first
// live corrected URL or null. Use this in the verification step's dead-link
// branch BEFORE the Wayback fallback.
// ---------------------------------------------------------------------------
export async function repairUrl(url: string): Promise<string | null> {
  const candidates = urlRepairCandidates(url).slice(1); // drop original
  if (candidates.length === 0) return null;
  try {
    return await Promise.any(
      candidates.map(async (c) => {
        if (await probeLive(c)) return c;
        throw new Error("not live");
      }),
    );
  } catch {
    return null; // none resolved
  }
}
