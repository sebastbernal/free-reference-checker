# Show an upload/processing status overlay on the references textarea

When a file is dropped (or chosen via Upload), the textarea currently sits silent while `extractTextFromFile` runs — the placeholder hint stays visible and the user has no idea anything is happening. This adds a clear status overlay that covers the textarea while the file is being read and parsed, then disappears once the extracted text fills the box.

## Changes — `src/routes/index.tsx`

### 1. New state
Add a `processing` state holding the current file name (or `null` when idle):

```ts
const [processing, setProcessing] = useState<string | null>(null);
```

### 2. Drive the state from `handleFile`
Wrap the existing extraction flow so it flips `processing` on/off:

- Set `setProcessing(file.name)` at the start (before `extractTextFromFile`).
- Clear it with `setProcessing(null)` in a `finally` block so it always resets, on success or error.

The existing toast + `setter(extracted)` logic stays unchanged.

### 3. Status overlay over the textarea
Inside the existing `relative` drop container (alongside the `dragging` overlay), add a block rendered only while `processing` is truthy. It covers the textarea (`absolute inset-0`), hiding the placeholder, and shows:

- A spinner (the project already uses `lucide-react`; use `Loader2` with `animate-spin`).
- A primary line: `Processing "<filename>"…`
- A secondary line: `Reading and extracting references — this only takes a moment.`
- An indeterminate progress bar using the existing `@/components/ui/progress` component (or a simple animated bar) so it reads as a status bar.

Styling mirrors the current drag overlay (`rounded-md border bg-background/95`, centered column, muted text) so it stays on-theme and uses semantic tokens — no hardcoded colors.

While processing, the overlay sits on top, so the shadow/placeholder text is replaced by the status, exactly as requested.

## Technical notes
- Extraction runs in-browser and is fast for typical files, but the overlay guarantees feedback regardless of size; the `finally` reset prevents a stuck spinner if parsing throws.
- Both entry points (drag-and-drop `onDrop` and the hidden file `input onChange`) already funnel through `handleFile`, so a single change covers both.
- No backend, no business-logic, no parsing changes — purely a presentational state added to the existing component.
