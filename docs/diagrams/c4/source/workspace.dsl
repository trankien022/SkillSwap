workspace "SkillSwap" "Student marketplace backend; client booking mock; top-up uses in-process mock adapter" {

    model {
        // People (Actors)
        learner = person "Learner" "User acting as Learner (role=user): booking, wallet, verification; booking UI mocked"
        teacher = person "Teacher" "User acting as Teacher (role=user): verified student + approved skills to publish; no payout API"
        verifier = person "Verifier" "Provisioned role=verifier; active matching expertise and claim required"
        admin = person "Administrator" "Provisioned role=admin; student decisions, Verifier access status"

        // Primary System
        skillSwap = softwareSystem "SkillSwap System" "Student marketplace backend; client booking mock; top-up uses in-process mock adapter" {
            // Containers
            webApp = container "Web Application" "Web scaffold; HTTP health/status UI; booking UI uses local mock" "Next.js (React)" "WebBrowser"
            mobileApp = container "Mobile Application" "Expo client scaffold; booking UI uses local mock, not Backend API (ADR-015)" "Expo (React Native)" "MobileApp"
            gateway = container "Gateway" "Public REST entry point: JWT, trusted identity, rate limiting, HTTP proxy :4000" "NestJS (Node.js)"
            backendApi = container "Backend API" "Private NestJS modular monolith :4001; seven contexts; payment adapter is in-process mock" "NestJS (Node.js)"
            database = container "Database" "One skillswap database; seven module schemas, per-module credentials; no cross-schema joins/FKs" "PostgreSQL" "Database"
            messageBroker = container "Message Broker" "Topic exchange skillswap.events: transactional outbox relay, idempotent consumers, DLQ (ADR-013)" "RabbitMQ" "Queue"
        }

        // External Systems
        storage = softwareSystem "Private document storage" "S3-compatible MinIO in Docker; presigned uploads" "External"
        jitsi = softwareSystem "Jitsi (self-hosted)" "Self-hosted Jitsi Docker stack; room-scoped JWT; WebRTC media" "External"

        // Relationships: People -> System
        learner -> skillSwap "Booking, wallet, student verification and room-token APIs"
        teacher -> skillSwap "Evidence, class lifecycle and room-token APIs"
        verifier -> skillSwap "Review and verify teacher skills"
        admin -> skillSwap "Verify students, manage verifiers, handle operations"

        // Relationships: People -> Containers (direct interactions)
        learner -> webApp "Health/status UI and local mock booking" "Browser"
        teacher -> webApp "Web scaffold; role workflows incomplete" "Browser"
        verifier -> gateway "Queue, claim and decision via API client" "HTTPS/REST"
        admin -> gateway "Student decisions and Verifier status via API client" "HTTPS/REST"
        learner -> mobileApp "Local mock booking UI" "Native UI"
        teacher -> mobileApp "Native scaffold; role workflows incomplete" "Native UI"

        learner -> gateway "Booking, wallet and verification via API client" "HTTPS/REST"
        teacher -> gateway "Class and evidence commands via API client" "HTTPS/REST"
        learner -> storage "Upload document bytes using API-issued URL" "Presigned HTTPS PUT"

        // Relationships: People -> External (direct interactions)
        teacher -> jitsi "Teaches live class" "HTTPS/WebRTC"
        learner -> jitsi "Attends live class" "HTTPS/WebRTC"

        // Relationships: Containers -> Containers
        webApp -> gateway "Health/status HTTP calls only; booking uses local mock" "HTTPS/REST"
        // Mobile booking uses local mock; no API integration asserted
        gateway -> backendApi "Forwards requests to" "HTTP/JSON"
        backendApi -> database "Reads from and writes to" "TypeORM"
        backendApi -> messageBroker "Publishes integration events via outbox" "AMQP"

        // Relationships: System -> External
        skillSwap -> jitsi "Online classroom access via" "HTTPS/WebRTC"

        // Relationships: Containers -> External (for dynamic views)
        backendApi -> jitsi "Signs scoped JWT locally; client joins Jitsi" "HS256 JWT"

        skillSwap -> storage "Private verification documents" "Presigned HTTPS PUT"
        backendApi -> storage "Signs presigned upload URL locally" "S3 Signature V4"
        // API caller can upload to storage; web upload UI not implemented

        // Deployment is a local Docker topology, not a proven production deployment
        deploymentEnvironment "Development" {
            deploymentNode "Developer machine" "Local development; docker-compose.yml" "Docker / host processes" {
                deploymentNode "Application Tier" "Host processes" "pnpm dev" {
                    containerInstance webApp
                    containerInstance gateway
                    containerInstance backendApi
                }
                deploymentNode "Messaging Tier" "Message broker" "RabbitMQ" {
                    containerInstance messageBroker
                }
                infrastructureNode "MinIO storage" "Private document bucket; S3-compatible" "Docker MinIO"
                infrastructureNode "Jitsi video stack" "JWT-authenticated web, prosody, jicofo, jvb" "Docker Jitsi"
                deploymentNode "Data Tier" "Docker database" "PostgreSQL" {
                    containerInstance database
                }
            }
        }
    }

    views {
        // Level 1: System Context
        systemContext skillSwap "SystemContext" "System Context diagram for SkillSwap" {
            include *
            autoLayout
        }

        // Level 2: Container
        container skillSwap "Containers" "Container diagram showing the internal structure of SkillSwap" {
            include *
            autoLayout
        }

        // Deployment
        deployment skillSwap "Development" "Deployment" "Local development topology; not a proven production deployment" {
            include *
            autoLayout
        }

        // Dynamic: Key flows
        dynamic skillSwap "BookingFlow" "Current backend booking: confirmed precedes asynchronous settlement" {
            gateway -> backendApi "POST /api/classes/:id/bookings (API client)"
            backendApi -> database "Own live_class transaction: guard capacity, Pending hold 15 min"
            gateway -> backendApi "POST /api/classes/bookings/:bookingId/confirm"
            backendApi -> database "Confirmed + booking.confirmed outbox atomically"
            backendApi -> messageBroker "Shared relay publishes committed outbox; wallet consumer deduplicates"
            backendApi -> database "Own wallet_ledger transaction: debit, Teacher pending, fee"
            autoLayout
        }
        dynamic skillSwap "TeachingFlow" "Current backend publishing and room access" {
            gateway -> backendApi "POST /api/classes; authenticated user acting as Teacher"
            backendApi -> database "Read own teacher_verified + teacher_skill_approval; require verified and every skill approved; persist Published"
            gateway -> backendApi "POST /api/classes/bookings/:bookingId/room-access"
            backendApi -> database "Check confirmed booking, party and time window"
            backendApi -> jitsi "Issue locally signed short-lived room JWT"
            teacher -> jitsi "Join using issued room URL and JWT"
            autoLayout
        }
        dynamic skillSwap "VerificationFlow" "Current verifier claim and decision via API client" {
            gateway -> backendApi "GET /api/verifiers/me/queue (API caller)"
            backendApi -> database "Read expertise-filtered queue in skill_verification"
            gateway -> backendApi "POST /api/skill-evidence/:id/claim then /decision"
            backendApi -> database "Authorize claim holder; decision, level, audit and outbox transaction"
            backendApi -> messageBroker "Relay approval events; Live Class updates own publish-rights projections"
            autoLayout
        }

        styles {
            element "Person" {
                shape Person
                background #0f172a
                color #ffffff
            }
            element "Software System" {
                background #047857
                color #ffffff
            }
            element "Container" {
                background #475569
                color #ffffff
            }
            element "Database" {
                shape Cylinder
            }
            element "Queue" {
                shape Pipe
            }
            element "WebBrowser" {
                shape WebBrowser
            }
            element "MobileApp" {
                shape RoundedBox
            }
            element "External" {
                background #64748b
                color #ffffff
            }
            element "Cloud" {
                background #475569
                color #ffffff
            }
        }
    }

}
