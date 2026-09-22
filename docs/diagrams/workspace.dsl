workspace "SkillSwap" "Student skill marketplace for verified learners and verified student teachers" {

    model {
        // People (Actors)
        learner = person "Learner" "Student user who searches, books, pays, attends, and reviews classes"
        teacher = person "Teacher" "Student teacher who submits evidence, creates classes, teaches, and withdraws earnings"
        verifier = person "Verifier" "Reviews and verifies teacher skills"
        admin = person "Administrator" "Verifies students, manages verifiers, handles operations"

        // Primary System
        skillSwap = softwareSystem "SkillSwap System" "Student skill marketplace for verified learners and verified student teachers" {
            // Containers
            webApp = container "Web Application" "Frontend for learners, teachers, verifiers, and administrators" "TBD (React/Next.js/Vue)" "WebBrowser"
            backendApi = container "Backend API" "REST API handling business logic, authentication, and data access" "TBD (Node.js/Express/Python/FastAPI)" 
            database = container "Database" "Stores user accounts, classes, bookings, credits, reviews, and messages" "PostgreSQL" "Database"
        }

        // External Systems
        paymentGateway = softwareSystem "Payment Gateway" "Processes payments and transactions" "External"
        jitsi = softwareSystem "Jitsi" "Provides online classroom/video conferencing" "External"

        // Relationships: People -> System
        learner -> skillSwap "Search, book, pay, attend, review classes"
        teacher -> skillSwap "Submit evidence, create classes, teach, withdraw"
        verifier -> skillSwap "Review and verify teacher skills"
        admin -> skillSwap "Verify students, manage verifiers, handle operations"

        // Relationships: People -> Containers (direct interactions)
        learner -> webApp "Uses" "HTTPS"
        teacher -> webApp "Uses" "HTTPS"
        verifier -> webApp "Uses" "HTTPS"
        admin -> webApp "Uses" "HTTPS"

        // Relationships: People -> External (direct interactions)
        teacher -> jitsi "Teaches live class" "HTTPS/WebRTC"

        // Relationships: Containers -> Containers
        webApp -> backendApi "Makes API calls to" "REST/JSON"
        backendApi -> database "Reads from and writes to" "JDBC"

        // Relationships: System -> External
        skillSwap -> paymentGateway "Processes payments via" "REST/JSON"
        skillSwap -> jitsi "Online classroom access via" "HTTPS/WebRTC"

        // Relationships: Containers -> External (for dynamic views)
        backendApi -> paymentGateway "Processes payments via" "REST/JSON"
        backendApi -> jitsi "Creates/joins classroom via" "HTTPS/WebRTC"

        // Deployment (minimal - for context)
        deploymentEnvironment "Production" {
            deploymentNode "Cloud Provider" "AWS/Azure/GCP" "Cloud" {
                deploymentNode "Application Tier" "Container orchestration" "Kubernetes/ECS" {
                    containerInstance webApp
                    containerInstance backendApi
                }
                deploymentNode "Data Tier" "Managed database" "RDS/Cloud SQL" {
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
        deployment skillSwap "Production" "Deployment" "Production deployment architecture" {
            include *
            autoLayout
        }

        // Dynamic: Key flows
        dynamic skillSwap "BookingFlow" "Learner books and attends a class" {
            learner -> webApp "Searches & books class"
            webApp -> backendApi "POST /bookings"
            backendApi -> database "Persist booking"
            backendApi -> paymentGateway "Process payment"
            backendApi -> jitsi "Create/join classroom"
            autoLayout
        }

        dynamic skillSwap "TeachingFlow" "Teacher creates and teaches a class" {
            teacher -> webApp "Creates class listing"
            webApp -> backendApi "POST /classes"
            backendApi -> database "Persist class"
            backendApi -> jitsi "Start classroom session"
            teacher -> jitsi "Teaches live class"
            autoLayout
        }

        dynamic skillSwap "VerificationFlow" "Verifier reviews teacher skills" {
            verifier -> webApp "Reviews teacher evidence"
            webApp -> backendApi "GET /verifications"
            backendApi -> database "Read teacher skills"
            autoLayout
        }

        styles {
            element "Person" {
                shape Person
                background #08427B
                color #ffffff
            }
            element "Software System" {
                background #1168BD
                color #ffffff
            }
            element "Container" {
                background #438DD5
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
            element "External" {
                background #999999
                color #ffffff
            }
            element "Cloud" {
                background #FF9900
                color #ffffff
            }
        }
    }

}