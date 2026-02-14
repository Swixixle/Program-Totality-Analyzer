# Nikodemus System Snapshot

Generated: 2026-01-23T07:19:58.207Z
Commit: 6ca74f2
Branch: main

---

## Framework & Runtime

- **Runtime**: Node.js (tsx for dev, node for prod)
- **Frontend**: React 19 + Vite + TypeScript
- **Backend**: Express 5
- **Storage**: Browser IndexedDB via idb (local-first architecture)
- **Build**: Vite (client) + esbuild (server)

---

## Repository Structure

```
./AUDIT_REPORT.md
./BOOK_OF_FIXES.md
./CHANGELOG.md
./client/src/App.tsx
./client/src/components/AssumptionsForm.tsx
./client/src/components/CashflowChart.tsx
./client/src/components/copy-id.tsx
./client/src/components/FlightPlanTable.tsx
./client/src/components/GapChart.tsx
./client/src/components/SavingsChart.tsx
./client/src/components/SovereigntyChart.tsx
./client/src/components/Stage1Checklist.tsx
./client/src/components/ui/accordion.tsx
./client/src/components/ui/alert-dialog.tsx
./client/src/components/ui/alert.tsx
./client/src/components/ui/aspect-ratio.tsx
./client/src/components/ui/avatar.tsx
./client/src/components/ui/badge.tsx
./client/src/components/ui/breadcrumb.tsx
./client/src/components/ui/button-group.tsx
./client/src/components/ui/button.tsx
./client/src/components/ui/calendar.tsx
./client/src/components/ui/card.tsx
./client/src/components/ui/carousel.tsx
./client/src/components/ui/chart.tsx
./client/src/components/ui/checkbox.tsx
./client/src/components/ui/collapsible.tsx
./client/src/components/ui/command.tsx
./client/src/components/ui/context-menu.tsx
./client/src/components/ui/dialog.tsx
./client/src/components/ui/drawer.tsx
./client/src/components/ui/dropdown-menu.tsx
./client/src/components/ui/empty.tsx
./client/src/components/ui/field.tsx
./client/src/components/ui/form.tsx
./client/src/components/ui/hover-card.tsx
./client/src/components/ui/input-group.tsx
./client/src/components/ui/input-otp.tsx
./client/src/components/ui/input.tsx
./client/src/components/ui/item.tsx
./client/src/components/ui/kbd.tsx
./client/src/components/ui/label.tsx
./client/src/components/ui/menubar.tsx
./client/src/components/ui/navigation-menu.tsx
./client/src/components/ui/pagination.tsx
./client/src/components/ui/popover.tsx
./client/src/components/ui/progress.tsx
./client/src/components/ui/radio-group.tsx
./client/src/components/ui/resizable.tsx
./client/src/components/ui/scroll-area.tsx
./client/src/components/ui/select.tsx
./client/src/components/ui/separator.tsx
./client/src/components/ui/sheet.tsx
./client/src/components/ui/sidebar.tsx
./client/src/components/ui/skeleton.tsx
./client/src/components/ui/slider.tsx
./client/src/components/ui/sonner.tsx
./client/src/components/ui/spinner.tsx
./client/src/components/ui/switch.tsx
./client/src/components/ui/table.tsx
./client/src/components/ui/tabs.tsx
./client/src/components/ui/textarea.tsx
./client/src/components/ui/toaster.tsx
./client/src/components/ui/toast.tsx
./client/src/components/ui/toggle-group.tsx
./client/src/components/ui/toggle.tsx
./client/src/components/ui/tooltip.tsx
./client/src/fixtures/advanced_tests.json
./client/src/fixtures/basic_test.json
./client/src/fixtures/metric_and_attribution_edge_cases.json
./client/src/hooks/use-mobile.tsx
./client/src/hooks/use-toast.ts
./client/src/lib/comparison-export.ts
./client/src/lib/comparison.ts
./client/src/lib/converters/extract_to_dossier.ts
./client/src/lib/defaultRamps.ts
./client/src/lib/export.ts
./client/src/lib/heuristics/enforcementMap.ts
./client/src/lib/heuristics/entities/entityExtractor.ts
./client/src/lib/heuristics/entities/entityTierer.ts
./client/src/lib/heuristics/fundingGravity.ts
./client/src/lib/heuristics/influenceHubs.ts
./client/src/lib/heuristics/metrics/metricNormalizer.ts
./client/src/lib/heuristics/segmenters/sentenceSegmenter.ts
./client/src/lib/heuristics/sensitivity.ts
./client/src/lib/heuristics/types.ts
./client/src/lib/integrity.ts
./client/src/lib/lanternExtract.ts
./client/src/lib/LIBRARY_STORAGE.md
./client/src/lib/migrations.ts
./client/src/lib/PHASE_3_BACKLOG.md
./client/src/lib/queryClient.ts
./client/src/lib/schema/pack_v1.ts
./client/src/lib/sovereigntyEngine.ts
./client/src/lib/storage.ts
./client/src/lib/tests/integration/m3_3_proof.test.ts
./client/src/lib/tests/unit/converter.test.ts
./client/src/lib/tests/unit/entityExtractor.test.ts
./client/src/lib/tests/unit/guardrails.test.ts
./client/src/lib/tests/unit/heuristics/enforcement.test.ts
./client/src/lib/tests/unit/heuristics/funding.test.ts
./client/src/lib/tests/unit/heuristics/influence.test.ts
./client/src/lib/tests/unit/importDedupe.test.ts
./client/src/lib/tests/unit/integrity.test.ts
./client/src/lib/tests/unit/migrations.test.ts
./client/src/lib/tests/unit/persistence.test.ts
./client/src/lib/tests/unit/provenance.test.ts
./client/src/lib/tests/unit/v1PackMigration.test.ts
./client/src/lib/utils.ts
./client/src/main.tsx
./client/src/pages/dashboard.tsx
./client/src/pages/dossier-comparison.tsx
./client/src/pages/dossier-editor.tsx
./client/src/pages/dossier-report.tsx
./client/src/pages/how-it-works.tsx
./client/src/pages/lantern-core.tsx
./client/src/pages/lantern-extract.tsx
./client/src/pages/library.tsx
./client/src/pages/not-found.tsx
./client/src/scripts/test-extract.ts
./client/src/scripts/test-provenance.ts
./client/src/scripts/test-segmenter.ts
./components.json
./docs/GOVERNANCE_AUDIT_2026_01_23.md
./docs/investor/01_NARRATIVE.md
./docs/investor/02_DECK_OUTLINE.md
./docs/investor/03_DEMO_SCRIPT.md
./docs/investor/04_NARRATIVE_GOVERNANCE.md
./docs/investor/05_DECK_OUTLINE_GOVERNANCE.md
./docs/investor/06_DEMO_SCRIPT_GOVERNANCE.md
./docs/investor/07_STRESS_TEST_QA.md
./docs/snapshots/CURRENT_SNAPSHOT.md
./docs/snapshots/SNAPSHOT_POLICY.md
./drizzle.config.ts
./LANTERN_CORE_BOUNDARY.md
./LANTERN_SYSTEM_SNAPSHOT.md
./M2_SUMMARY.md
./package.json
./package-lock.json
./PRODUCT_PLAN.md
./README.md
./replit.md
./script/build.ts
./script/generate-snapshot.ts
./script/smoke_test.ts
./server/index.ts
./server/routes.ts
./server/static.ts
./server/storage.ts
./server/vite.ts
./shared/schema.ts
./SYSTEM_MAP.md
./tsconfig.json
./UX_GOVERNANCE.md
./vite.config.ts
./vite-plugin-meta-images.ts
```

---

## Dependencies

### Production (69)
- @hookform/resolvers
- @jridgewell/trace-mapping
- @radix-ui/react-accordion
- @radix-ui/react-alert-dialog
- @radix-ui/react-aspect-ratio
- @radix-ui/react-avatar
- @radix-ui/react-checkbox
- @radix-ui/react-collapsible
- @radix-ui/react-context-menu
- @radix-ui/react-dialog
- @radix-ui/react-dropdown-menu
- @radix-ui/react-hover-card
- @radix-ui/react-label
- @radix-ui/react-menubar
- @radix-ui/react-navigation-menu
- @radix-ui/react-popover
- @radix-ui/react-progress
- @radix-ui/react-radio-group
- @radix-ui/react-scroll-area
- @radix-ui/react-select
- @radix-ui/react-separator
- @radix-ui/react-slider
- @radix-ui/react-slot
- @radix-ui/react-switch
- @radix-ui/react-tabs
- @radix-ui/react-toast
- @radix-ui/react-toggle
- @radix-ui/react-toggle-group
- @radix-ui/react-tooltip
- @tanstack/react-query
- class-variance-authority
- clsx
- cmdk
- connect-pg-simple
- date-fns
- drizzle-orm
- drizzle-zod
- embla-carousel-react
- express
- express-session
- fake-indexeddb
- framer-motion
- html2canvas
- idb
- input-otp
- jspdf
- lucide-react
- memorystore
- next-themes
- passport
- passport-local
- pg
- react
- react-day-picker
- react-dom
- react-hook-form
- react-resizable-panels
- recharts
- sonner
- tailwind-merge
- tailwindcss-animate
- tw-animate-css
- uuid
- vaul
- vitest
- wouter
- ws
- zod
- zod-validation-error

### Development (22)
- @replit/vite-plugin-cartographer
- @replit/vite-plugin-dev-banner
- @replit/vite-plugin-runtime-error-modal
- @tailwindcss/vite
- @types/connect-pg-simple
- @types/express
- @types/express-session
- @types/node
- @types/passport
- @types/passport-local
- @types/react
- @types/react-dom
- @types/ws
- @vitejs/plugin-react
- autoprefixer
- drizzle-kit
- esbuild
- postcss
- tailwindcss
- tsx
- typescript
- vite

---

## API Routes

- `GET /__boot`
- `GET /__health`

---

## Client Pages

- dashboard
- dossier-comparison
- dossier-editor
- dossier-report
- how-it-works
- lantern-core
- lantern-extract
- library
- not-found

---

## Heuristic Entrypoints

- heuristics/enforcementMap.ts
- heuristics/entities/entityCanonicalizer.ts
- heuristics/entities/entityExtractor.ts
- heuristics/entities/entityTierer.ts
- heuristics/fundingGravity.ts
- heuristics/influenceHubs.ts
- heuristics/metrics/metricNormalizer.ts
- heuristics/segmenters/sentenceSegmenter.ts
- heuristics/sensitivity.ts
- heuristics/types.ts

---

## Schema Definitions

- pack_v1.ts
- shared/schema.ts (Drizzle)

---

## Governance Documents

- UX_GOVERNANCE.md
- SYSTEM_MAP.md
- LANTERN_CORE_BOUNDARY.md
- docs/investor/*.md

---

## Excluded from Snapshot (Security)

The following are explicitly excluded:
- `attached_assets/` — User uploads, potentially sensitive
- `.local/` — Local state, may contain tokens
- `.cache/` — Build cache
- `node_modules/` — Dependencies (use package.json)
- `dist/` — Build output
- `.git/` — Git internals
- `.env`, `.env.*` — Environment variables/secrets
- Any file containing "Canon", "formula", "threshold" values

---

## Verification

To verify this snapshot is current:
```bash
git rev-parse --short HEAD
# Should match: 6ca74f2
```

To regenerate:
```bash
npx tsx script/generate-snapshot.ts
```

---

*This snapshot is safe for external review. It contains structure and wiring only — no secrets, protected parameters, or Canon content.*
