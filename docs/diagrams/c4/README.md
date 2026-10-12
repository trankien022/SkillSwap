# SkillSwap C4 architecture

Revised 2026-10-12 against the current backend and Docker configuration. All labels are in English. The [Structurizr model](source/workspace.dsl) owns the elements, system boundaries, relationships and numbered interactions. The six PlantUML views carry presentation styling and layout hints; generated SVG/PNG files are derived artifacts.

## Submission order

| View | Purpose | Editable source | SVG | PNG |
|---|---|---|---|---|
| C4-L0 — System Context (standard C4 Level 1) | User, Verifier, Admin, SkillSwap and its classroom and payment dependencies | [Source](source/structurizr-SystemContext.puml) | [SVG](generated/structurizr-SystemContext.svg) | [PNG](generated/structurizr-SystemContext.png) |
| C4-L1 — Container (standard C4 Level 2) | One account-holder actor, applications, data stores, payment gateway, responsibilities and protocols | [Source](source/structurizr-Containers.puml) | [SVG](generated/structurizr-Containers.svg) | [PNG](generated/structurizr-Containers.png) |
| Dynamic — Booking and payment | FR-007/009; BR-021–026, BR-034–038 | [Source](source/structurizr-BookingFlow.puml) | [SVG](generated/structurizr-BookingFlow.svg) | [PNG](generated/structurizr-BookingFlow.png) |
| Dynamic — Join an online class | FR-011; BR-039–041 | [Source](source/structurizr-TeachingFlow.puml) | [SVG](generated/structurizr-TeachingFlow.svg) | [PNG](generated/structurizr-TeachingFlow.png) |
| Dynamic — Review teaching skills | FR-004/005; BR-008, BR-011, BR-015 | [Source](source/structurizr-VerificationFlow.puml) | [SVG](generated/structurizr-VerificationFlow.svg) | [PNG](generated/structurizr-VerificationFlow.png) |
| Deployment — Development | Host application processes and supporting Docker services | [Source](source/structurizr-Deployment.puml) | [SVG](generated/structurizr-Deployment.svg) | [PNG](generated/structurizr-Deployment.png) |

Submission labels follow the course naming: **C4-L0** is System Context and **C4-L1** is Container. In standard C4 terminology these are **Level 1 System Context** and **Level 2 Container**. Dynamic and Deployment are supporting views, not Component or Code levels. A container here is an application or data store; it does not mean a Docker container.

## How to explain the diagrams

Start with C4-L0: one `user` account can learn and, when eligible, teach; `verifier` and `admin` are the other account roles. The classroom and third-party payment gateway are external dependencies. The payment provider is not selected yet.

Then zoom into C4-L1. The Backend API is one modular application with seven business areas; they are not seven deployed microservices. The gateway checks identity and forwards requests over HTTP. PostgreSQL stores seven separately owned schemas; TypeORM is the backend persistence adapter. RabbitMQ carries saved changes in both directions between the publishing and consuming parts of the same backend. MinIO is a SkillSwap-owned private document store, inside its system boundary. One account-holder actor covers role-authorized access without duplicating the person for demo apps and API calls.

The Container view shows the payment gateway as an external dependency for cash top-ups and payouts, including signed callbacks. The current backend binds `PaymentGateway` to a mock adapter; the external box documents the intended provider boundary and does not claim that a real provider is configured. Web only calls service-status endpoints; mobile booking has no backend connection. A light client box denotes local demonstration booking data, with the same meaning in the legend.

For Dynamic views, follow the interaction numbers. Booking confirmation is saved before wallet processing, a current gap against BR-022/BR-026. The wallet records the full debit, Teacher allocation and platform fee together; repeat processing does not charge again. Teaching evidence decisions update publishing rights in the background. Joining a class requires the right participant, a confirmed booking and the permitted time window.

The backend signs room invitations and document upload links locally. It does not call Jitsi or MinIO to create them, so the Container view has no fictitious backend-to-provider network arrows. A participant uploads proof directly to MinIO and joins Jitsi directly. Context's authorization relationship is a business dependency, not a claim of a backend network call.

Deployment describes local development only: application processes run on the host, PostgreSQL/RabbitMQ/MinIO run in Docker, and the external classroom system has a local Jitsi deployment. The PaymentGateway port uses a mock adapter, so no real provider deployment or live payment call is claimed. Production ingress requires HTTPS under ARCHITECTURE.md; HTTP in these diagrams describes the local configuration.

## Notation and evidence

Each view has its own type/scope title, short responsibility descriptions, explicit element types and a legend. Container relationships name the protocol and the action. Dynamic interactions are numbered; all arrows are unidirectional. Database and queue shapes supplement labels. Notes explain implementation boundaries without filling architecture boxes with source-code names.

The organization follows the official C4 guidance for [System Context](https://c4model.com/diagrams/system-context), [Container](https://c4model.com/diagrams/container), [notation](https://c4model.com/diagrams/notation), and [Dynamic diagrams](https://c4model.com/diagrams/dynamic). Source-level API and persistence evidence is in the [checkpoint traceability table](../checkpoint/README.md).

## Regenerate and verify

1. Validate `source/workspace.dsl` using Structurizr.
2. Export the six keys listed above with the C4-PlantUML exporter. Preserve presentation additions: explicit types, Campus Emerald/slate colors, demo tags, compact titles, layout hints and explanatory footers. The bundled PlantUML C4 library does not export Structurizr custom styling, so these additions are kept in the editable PlantUML views.
3. Render with the installed PlantUML executable (the Windows-only renderer referenced in AGENTS.md is unavailable on this Mac):

```sh
plantuml -tsvg -o ../generated docs/diagrams/c4/source/structurizr-*.puml
plantuml -tpng -o ../generated docs/diagrams/c4/source/structurizr-*.puml
git diff --check
pnpm verify
```

Use SVG for zooming and report export; use PNG for inserting a fixed image. Neither source inspection nor a successful render proves end-to-end deployment.
