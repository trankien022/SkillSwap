# SkillSwap C4 — current implementation

The maintained views are described in [checkpoint index and code traceability](../checkpoint/README.md). Source of truth: [workspace.dsl](source/workspace.dsl), exported by Structurizr to the six `source/structurizr-*.puml` files and rendered into `generated/` as SVG/PNG.

| View | SVG |
|---|---|
| C0 / System Context | [SystemContext](generated/structurizr-SystemContext.svg) |
| C1 / Containers | [Containers](generated/structurizr-Containers.svg) |
| Backend booking and settlement | [BookingFlow](generated/structurizr-BookingFlow.svg) |
| Publishing and room access | [TeachingFlow](generated/structurizr-TeachingFlow.svg) |
| Verifier claim and decision | [VerificationFlow](generated/structurizr-VerificationFlow.svg) |
| Local development topology | [Deployment](generated/structurizr-Deployment.svg) |

These views explicitly mark mock clients and payment adapters. Deployment shows local development, not proof of a production deployment.
