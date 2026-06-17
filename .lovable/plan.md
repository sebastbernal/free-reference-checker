## Plan: Add a Stop button to cancel verification

### Problem
After clicking **Verify authenticity**, the check runs against many databases and the Internet Archive with no way to cancel. The button just shows "Checking…" and the user must wait it out.

### Approach
Wire an `AbortController` into the verification call and turn the running button into a Stop control. TanStack server functions forward an `AbortSignal`, so aborting the client request stops the in-flight network call and immediately returns the UI to its idle state.

### Changes (all in `src/routes/index.tsx`)

1. **Add an abort controller ref**
   - `const abortRef = useRef<AbortController | null>(null);`

2. **Pass the signal into the server call** in the `useMutation` `mutationFn`:
   - Create a fresh `AbortController`, store it in `abortRef`, and call `checkFn({ data: { text: input }, signal: controller.signal })`.

3. **Handle abort cleanly**
   - In `onError`, detect an abort (`err.name === "AbortError"` / signal aborted) and skip the error toast for that case (show a neutral "Verification stopped" toast instead).
   - Add a `handleStop()` that calls `abortRef.current?.abort()` and `mutation.reset()` so the UI leaves the pending state.

4. **Turn the running button into Stop**
   - While `mutation.isPending`, render a second **Stop** button (red/destructive variant, `X` icon) next to / replacing the disabled "Checking…" button so the user can cancel. The "Checking…" indicator stays but is no longer a dead end.

### Result
During verification the user sees a Stop button; clicking it aborts the request, clears the loading state, and returns to the input view with no results lost.

### Note
Aborting cancels the client request immediately. The server may briefly finish in-flight lookups before noticing the disconnect, but no results are returned and the UI is fully responsive again.