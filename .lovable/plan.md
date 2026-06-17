## Add feedback email section below the verify disclaimer

Add a small, friendly feedback section immediately below the amber disclaimer box that appears when `activeView === "verify" && (mutation.isPending || results)`.

### UI details
- Same rounded-lg card style with a subtle border, but using a softer blue/grey tone (not amber) to distinguish it from the warning above.
- Text: "Not what you expected? Disappointed? Send me an email to sebast.bernal.garcia@gmail.com" with the email address as a clickable `mailto:` link.
- Small margin-top (`mt-3`) to sit snugly below the disclaimer.

### Technical details
- Edit `src/routes/index.tsx`.
- Insert the new block right after the closing `</div>` of the disclaimer at line ~650.
- Import `Mail` icon from `lucide-react` if a small icon is desired, or keep it text-only for simplicity.
