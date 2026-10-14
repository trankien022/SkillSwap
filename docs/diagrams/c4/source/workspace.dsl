workspace "SkillSwap" "Current architecture of the student learning marketplace" {
    !impliedRelationships false
    model {
        user = person "User" "A student account that can learn and, when eligible, teach."
        verifier = person "Verifier" "Reviews teaching evidence within assigned expertise."
        admin = person "Admin" "Reviews student proof and manages Verifier access."
        accountHolder = person "Account holder" "Uses the web or mobile client, or role-authorized API services."
        skillSwap = softwareSystem "SkillSwap" "Helps students verify skills, book classes and pay with internal credits." {
            webApp = container "Web application" "Learns, publishes classes, manages the wallet and submits verification evidence." "Next.js / TypeScript"
            mobileApp = container "Mobile application" "The same learner and teacher screens as the web client." "Expo / React Native"
            gateway = container "API gateway" "Checks sign-in and forwards public requests." "NestJS / TypeScript"
            backendApi = container "Backend API" "Runs account, verification, class and wallet rules in one application." "NestJS / TypeScript"
            database = container "Business database" "Stores records in seven separately owned business schemas." "PostgreSQL / TypeORM" "Database"
            messageBroker = container "Business message broker" "Delivers saved business changes for background processing." "RabbitMQ" "Queue"
            storage = container "Private document store" "Stores student proof uploaded through temporary private links." "MinIO / S3-compatible API" "Database"
        }
        jitsi = softwareSystem "Online classroom" "Hosts live lessons for users who are learning or teaching." "External"
        paymentGateway = softwareSystem "SePay Payment Gateway" "Processes cash top-ups through a hosted checkout page and reports the outcome by IPN. Payout is not implemented." "External"
        user -> skillSwap "Learns, books classes and may publish or teach when eligible"
        verifier -> skillSwap "Reviews teaching evidence"
        admin -> skillSwap "Approves students and manages Verifiers"
        skillSwap -> jitsi "Authorizes access to booked lessons"
        user -> jitsi "Attends or teaches a booked lesson"
        skillSwap -> paymentGateway "Starts top-ups and receives the outcome notification"
        accountHolder -> webApp "Learns, teaches and manages the wallet" "Browser"
        accountHolder -> mobileApp "Uses the same learner and teacher screens" "Native UI"
        accountHolder -> gateway "Requests services allowed for their account" "HTTP / JSON (local development)"
        accountHolder -> storage "Uploads owned student proof using a temporary link" "HTTP PUT (local development)"
        accountHolder -> jitsi "Joins a booked lesson with a private invitation" "HTTPS / WebRTC"
        webApp -> gateway "Sends every feature request" "HTTP / JSON (local development)"
        gateway -> backendApi "Forwards authenticated requests" "HTTP / JSON"
        paymentGateway -> gateway "Reports the payment outcome" "HTTPS / IPN (IP allow-list)"
        backendApi -> paymentGateway "Starts top-ups through the PaymentGateway port" "HTTPS / signed checkout form"
        backendApi -> database "Reads and saves owned business records" "PostgreSQL protocol / TypeORM"
        backendApi -> messageBroker "Publishes saved business changes" "AMQP"
        messageBroker -> backendApi "Delivers changes to background handlers" "AMQP"
        // Classroom invitations and upload links are signed locally.
        // There is no backend network call to Jitsi or MinIO in these flows.
        deploymentEnvironment "Development" {
            deploymentNode "Developer machine" "Local development environment" "macOS / Docker" {
                deploymentNode "Application processes" "Started on the host" "Node.js / pnpm" {
                    containerInstance webApp
                    containerInstance gateway
                    containerInstance backendApi
                }
                deploymentNode "Docker services" "Local supporting services" "Docker Compose" {
                    containerInstance database
                    containerInstance messageBroker
                    containerInstance storage
                    deploymentNode "Jitsi services" "Web, signaling and video services" "Jitsi / Docker" {
                        softwareSystemInstance jitsi
                    }
                }
            }
        }
    }
    views {
        systemContext skillSwap "SystemContext" "C4-L0 | System context | SkillSwap | Current capabilities" {
            include user verifier admin skillSwap jitsi paymentGateway
            autoLayout lr
        }
        container skillSwap "Containers" "C4-L1 | Containers | SkillSwap | Current implementation" {
            include accountHolder webApp mobileApp gateway backendApi database messageBroker storage jitsi paymentGateway
            autoLayout lr
        }
        deployment skillSwap "Development" "Deployment" "Deployment | SkillSwap | Local development only" {
            include *
            autoLayout lr
        }
        dynamic skillSwap "BookingFlow" "Booking and payment | FR-007/009 | BR-021–026/034–038" {
            accountHolder -> gateway "User asks to book a class"
            gateway -> backendApi "Forward the booking request"
            backendApi -> database "Check booking rules and hold a seat for 15 minutes"
            gateway -> backendApi "Forward the User confirmation"
            backendApi -> database "Save confirmation and a request for payment processing"
            backendApi -> messageBroker "Publish the saved payment request"
            messageBroker -> backendApi "Deliver the request to the wallet handler"
            backendApi -> database "Deduct credits and allocate teaching-user income and fee together"
            autoLayout lr
        }
        dynamic skillSwap "TeachingFlow" "Join an online class | FR-011 | BR-039–041" {
            accountHolder -> gateway "Participant asks to join a booked class"
            gateway -> backendApi "Forward the verified participant identity"
            backendApi -> database "Read booking and class for participant and joining-time checks"
            accountHolder -> jitsi "Enter the booked classroom using the invitation"
            autoLayout lr
        }
        dynamic skillSwap "VerificationFlow" "Review teaching skills | FR-004/005 | BR-008/011/015" {
            accountHolder -> gateway "Verifier requests evidence within their expertise"
            gateway -> backendApi "Forward the review request"
            backendApi -> database "Read matching evidence awaiting review"
            gateway -> backendApi "Forward the Verifier claim and decision"
            backendApi -> database "Check assigned Verifier and save decision, level and history"
            backendApi -> messageBroker "Publish the saved approval change"
            messageBroker -> backendApi "Deliver the change to teaching eligibility handlers"
            backendApi -> database "Update teaching permissions in the class records"
            autoLayout lr
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
                background #047857
                color #ffffff
            }
            element "External" {
                background #64748b
                color #ffffff
            }
            element "Database" {
                shape Cylinder
            }
            element "Queue" {
                shape Pipe
            }
        }
    }
}
