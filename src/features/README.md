# Features

The `features/` directory groups files by product feature rather than by file
type. Each feature is self-contained so it can be owned by a single team and
reasoned about in isolation.

## Current features

| Feature | Path | Audience | Status |
|---------|------|----------|--------|
| auth | `features/auth/` | shared | Implemented |
| datasets | `features/datasets/` | tenant | Implemented |
| analytics | `features/analytics/` | tenant | Implemented |
| dashboards | `features/dashboards/` | tenant | stub API (Phase 3) |
| reports | `features/reports/` | tenant | stub API (Phase 3) |
| alerts | `features/alerts/` | tenant | stub API (Phase 3) |
| notifications | `features/notifications/` | tenant | stub API (Phase 3) |
| api-keys | `features/api-keys/` | tenant | stub API (Phase 3) |
| embed | `features/embed/` | tenant | stub API (Phase 3) |
| admin | `features/admin/` | admin | stub API (Phase 3) |

## Layout

Every feature follows the same internal structure:

```
features/<feature>/
  api/         – per-feature HTTP modules (one index.ts per resource)
  components/  – feature-specific React components (optional)
  hooks/       – feature-specific React hooks (optional)
  types.ts     – feature-specific types (optional)
  index.ts     – public surface (optional)
```

## Boundaries

- Features must NOT import from each other unless the dependency is explicit and
  documented. Cross-feature access should be mediated by `lib/api/*` or a
  shared `lib/`.
- Routes under `src/routes/` are not feature-scoped because TanStack Start uses
  file-based routing. Each route file owns the route-specific glue (params,
  guards, breadcrumbs) and delegates presentation to features.
- Shared HTTP primitives live in `src/lib/api/` (`client.ts`, `types.ts`).
