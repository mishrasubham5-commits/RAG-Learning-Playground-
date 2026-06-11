[OPEN] Vercel API crash debug session

- Session ID: vercel-api-crash
- Symptom: `/api/status` and `/api/rag/run` fail on Vercel with `FUNCTION_INVOCATION_FAILED`
- Latest evidence:
  - `SyntaxError: Cannot use import statement outside a module`
  - `/var/task/api/index.js:1 import { createRequire } from "module";`
- Goal: make the Vercel API entry load successfully in production.

## Hypotheses

1. Vercel is treating the built API entry as CommonJS, but `api/index.ts` is being emitted with ESM syntax.
2. The custom `builds` setup is forcing a packaging path where `api/index.ts` is not bundled the same way as local `tsx server.ts`.
3. Importing another source file from the serverless entry (`../server` or compiled bundle indirection) is causing incompatible runtime resolution on Vercel.
4. A plain CommonJS API entrypoint will load correctly even if the rest of the app stays TypeScript/Express-based.

## Next step

- Add startup instrumentation to the API entry so the deployed runtime prints module-mode evidence before any app logic runs.
