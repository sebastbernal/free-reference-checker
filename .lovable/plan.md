**Goal**: Keep the input card exactly as it is today (paste textarea, Try example, Upload button, all existing upload types), and additionally make the textarea/input area a drag-and-drop target for files.

**Scope**: Single file — `src/routes/index.tsx`. No backend or extraction-logic changes; dropped files go through the existing `handleFile(file, setText)` + `extractTextFromFile`.

**Changes**:

1. **Add drag-and-drop handlers** to the textarea (or a wrapper around it):
   - `onDragOver` (preventDefault, set a `dragging` highlight state)
   - `onDragLeave` (clear highlight)
   - `onDrop` (preventDefault, read `e.dataTransfer.files[0]`, clear highlight, call existing `handleFile(file, setText)`)

2. **Add a `dragging` state** (`const [dragging, setDragging] = useState(false)`) to drive a visual highlight (e.g. ring/border + subtle background) on the drop area while a file is dragged over it.

3. **Visual cue**: when dragging, show a brief overlay/border indicating "Drop file to upload". Keep the normal textarea visible/usable otherwise.

4. **Validation**: reuse the existing accepted types (.txt, .docx, .pdf). If a dropped file isn't one of these, show a toast ("Unsupported file type — use .txt, .docx or .pdf.") and ignore it.

**Unchanged**: paste behavior, Try example button, Upload button, file input `accept`, privacy note, verify/format flows.

**Technical notes**:
- Reuse existing `handleFile` and `fileInputRef`; no new extraction code.
- Guard the drop handler against empty `dataTransfer.files`.