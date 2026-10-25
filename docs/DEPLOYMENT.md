# Flare production deployment

Verified on October 23, 2026. Public app: https://flare-grounded.vercel.app

- Independent Vercel project: `flare-grounded`, ID `prj_FQGpF3zXpEXo2OOc5V3yNtwI01H6`, team `vendraft`.
- Production deployment: `dpl_4v6DbVdCSabD8LzF9D2GG3c82TuB`, confirmed READY. The public domain resolves to this deployment.
- Framework/runtime: Next.js 16.4.3, Node.js 24.x. Gemini credentials are server-only, sensitive production environment variables. The configured model is `gemini-4-argon`.
- Uploaded from local files based on commit `510216d9aed26f9c1078740a0dadd9e2d779b85b`, including uncommitted changes. No Git push or automatic Git deployment was configured.
- The original sibling `part-explode` checkout remained clean and was not deployed or changed.

## Verification

The updated source passed 194 tests; one opt-in provider test remained skipped. TypeScript and local and Vercel production builds passed. Production dependency audit: zero reported vulnerabilities after updating Next.js and jsPDF. The development-only Vitest dependency chain still has two critical and one moderate advisory; those test tools are not application runtime dependencies.

Before promotion, an authenticated request to the production build sent a 75-part source Corne assembly and eight full source documents to live Gemini 4 Argon. The streaming endpoint returned a ready proposal with 17 checks passing, no failed checks and two explicitly unverified engineering checks. Native PDF extraction returned the actual five pages and source hash.

After promotion, the public site was opened without Vercel authentication. Its 3D model rendered, the design study opened, and the manufacturer PDF uploaded through the browser. A real browser conversation proposed the wireless conversion with the original case, USB charging at 100 mA and a battery height limit of 4 mm. The answer cited the uploaded datasheet's 4.2 V charging specification on page 2. Apply changed the assembly from 75 to 76 parts; Undo restored 75; Redo restored 76. No browser errors or Vercel error/fatal runtime logs were observed during these checks.

The public status and source-manifest endpoints returned HTTP 200. Public-domain resolution was checked against the exact deployment ID. Historical local verification reports remain unchanged.

These checks establish the hosted software flow. Physical fit, wiring, battery operation, firmware, RF and manufacturing tolerances remain engineering verification work. Native Arduino compilation was not tested on Vercel.

Local release evidence is stored in the parent `outputs` directory as `Flare Vercel deployment.json` and `Flare live on Vercel.png`. Detailed API response files are in the task's `work` directory. These files contain no credentials.
