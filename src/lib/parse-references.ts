// Shared client-safe reference parsing used by both the authenticity verifier
// and the citation-style formatting checker.
//
// The implementation lives in ./parseReferences. This module re-exports it so
// existing callers keep importing from "./parse-references" unchanged.

export { parseReferences } from "./parseReferences";
