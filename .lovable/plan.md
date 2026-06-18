Fix reference classification so journal articles without a DOI or URL are verified by title instead of being marked "offline".

**What changes:**
1. Add a `looksLikeJournalArticle(ref: string): boolean` helper just above the `extract()` function (around line 100). It detects journal signals:
   - volume(issue) pattern, e.g. "397(10269)"
   - page range pattern, e.g. "129–170"
   - "et al."/ellipsis together with a (year)
   - recognizable journal-venue words (Journal, Annals, Review, Lancet, Nature, etc.)

2. In the `extract()` function, change the final classification branch from:
   ```
   if (doi) kind = "academic";
   else if (url && !isDoiUrl) kind = "web";
   else if (url && isDoiUrl) kind = "academic";
   else kind = "offline";
   ```
   to:
   ```
   if (doi) kind = "academic";
   else if (url && !isDoiUrl) kind = "web";
   else if (url && isDoiUrl) kind = "academic";
   else if (looksLikeJournalArticle(ref)) kind = "academic"; // no link, but a journal article → verify by title
   else kind = "offline";
   ```

**Why:** A real journal article that has neither a DOI nor a URL currently falls into the final `else` branch and is classified "offline", which skips the CrossRef/OpenAlex/Semantic Scholar title search entirely and reports "no online trace" — a false red flag. Books and webpages will still classify correctly. The academic branch already does title search when there's no DOI, so routing these references to "academic" is enough to get them verified.