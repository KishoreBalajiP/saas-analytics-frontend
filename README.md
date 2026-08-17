# Insight Builder

Build the complete production frontend for this SaaS Analytics Platform using the attached/provided lovable-master-prompt.md as the implementation specification.

IMPORTANT: Before writing code, read src/docs/backend/frontend-api-contract.md and src/docs/backend/lovable-master-prompt.md completely. The backend implementation is the source of truth.

Do not invent APIs, response fields, permissions, connector types, widget types, authentication flows, or backend capabilities.

Build the frontend in phases internally, but do not stop and ask me for permission between phases. Continue until the frontend is fully implemented and integrated with the backend.

Start with:

API client and typed backend contracts

Tenant authentication/session handling

Admin authentication/session handling

Protected routing/RBAC UX

Tenant dashboard

Connectors/datasets

Analytics

Dashboard builder/viewer

Reports

Alerts

Notifications

API keys

Embed management/viewer

Admin dashboard and administration pages

Security/error/loading/empty states

End-to-end integration verification

Use real backend APIs throughout. No mock data or fake API implementations.

If a backend endpoint returns 501, render the documented Coming Soon state rather than implementing fake functionality.

For every implementation issue, first inspect the backend contract and actual API behavior, then make the smallest correct frontend change.

Do not rewrite working backend code from the frontend project.

Continue autonomously until all implementable frontend functionality described in the master prompt is complete.

At the end, run the frontend build/type checks/tests available in the project and report:

pages completed

API integrations completed

authentication flows verified

tenant flows verified

admin flows verified

dashboard/widget flows verified

connector flows verified

API-key flow verified

embed flow verified

security checks performed

remaining backend limitations

any frontend issues that genuinely remain

Do not declare success merely because the UI builds. Verify the important API flows against the real backend.

Final state should be: FRONTEND IMPLEMENTED AND BACKEND-INTEGRATED.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/172e2615-2df8-44d7-a8d6-6ca25f9610e4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
