Add a hardcoded version number and an auto-generated build date to the existing footer in `src/routes/index.tsx`.

1. Near the top of the component/module scope, add two constants:
   - `const VERSION = "1.0.0";` (hardcoded — update manually when desired)
   - `const BUILD_DATE = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });` (evaluated once at module load, giving a stable build-time date)

2. Update the footer element (currently lines 619–624) to include the version and last-updated info, e.g.:
   `Sebastian Bernal Garcia · MIT License · 2026 · v1.0.0 · Updated Jun 17, 2026`

Keep existing footer styling and layout intact.