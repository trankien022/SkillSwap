workspace "SkillSwap" "Current architecture of the student learning marketplace" {
    !impliedRelationships false
    model {
        learner = person "Learner" "Books classes and attends online lessons."
        teacher = person "Teacher" "Verified student with approved skills who publishes and teaches classes."
        verifier = person "Verifier" "Reviews teaching evidence within assigned expertise."
        admin = person "Administrator" "Reviews student proof and manages Verifier access."
        student = person "Student" "Learner or Teacher using the demonstration apps."
        apiUser = person "Backend user" "Learner, Teacher, Verifier or Administrator using an API client."
        skillSwap = softwareSystem "SkillSwap" "Helps students verify skills, book classes and pay with internal credits." {
            webApp = container "Web application" "Shows service status and demonstration bookings." "Next.js / TypeScript" "Demo"
            mobileApp = container "Mobile application" "Shows demonstration bookings using local data." "Expo / React Native" "Demo"
            gateway = container "API gateway" "Checks sign-in and forwards public requests." "NestJS / TypeScript"
            backendApi = container "Backend API" "Runs account, verification, class and wallet rules in one application." "NestJS / TypeScript"
            database = container "Business database" "Stores records in seven separately owned business schemas." "PostgreSQL / TypeORM" "Database"
            messageBroker = container "Business message broker" "Delivers saved business changes for background processing." "RabbitMQ" "Queue"
            storage = container "Private document store" "Stores student proof uploaded through temporary private links." "MinIO / S3-compatible API" "Database"
        }
        jitsi = softwareSystem "Online classroom" "Hosts live lessons for authorized Learners and Teachers." "External"
        learner -> skillSwap "Books classes and uses wallet credits"
        teacher -> skillSwap "Submits skills and manages teaching"
        verifier -> skillSwap "Reviews teaching evidence"
        admin -> skillSwap "Approves students and manages Verifiers"
        skillSwap -> jitsi "Authorizes access to booked lessons"
        learner -> jitsi "Attends booked lessons"
        teacher -> jitsi "Teaches booked lessons"
        student -> webApp "Views status and demo bookings" "Browser"
        student -> mobileApp "Tries demo bookings" "Native UI"
        apiUser -> gateway "Requests services allowed for their account" "HTTP / JSON (local development)"
        apiUser -> storage "Uploads owned student proof using a temporary link" "HTTP PUT (local development)"
        apiUser -> jitsi "Joins a booked lesson with a private invitation" "HTTPS / WebRTC"
        webApp -> gateway "Requests service status only" "HTTP / JSON (local development)"
        gateway -> backendApi "Forwards authenticated requests" "HTTP / JSON"
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
        systemContext skillSwap "SystemContext" "System context | SkillSwap | Current capabilities" {
            include learner teacher verifier admin skillSwap jitsi
            autoLayout lr
        }
        container skillSwap "Containers" "Containers | SkillSwap | Current implementation" {
            include student apiUser webApp mobileApp gateway backendApi database messageBroker storage jitsi
            autoLayout lr
        }
        deployment skillSwap "Development" "Deployment" "Deployment | SkillSwap | Local development only" {
            include *
            autoLayout lr
        }
        dynamic skillSwap "BookingFlow" "Booking and payment | FR-007/009 | BR-021–026/034–038" {
            apiUser -> gateway "Learner asks to book a class"
            gateway -> backendApi "Forward the booking request"
            backendApi -> database "Check booking rules and hold a seat for 15 minutes"
            gateway -> backendApi "Forward the Learner confirmation"
            backendApi -> database "Save confirmation and a request for payment processing"
            backendApi -> messageBroker "Publish the saved payment request"
            messageBroker -> backendApi "Deliver the request to the wallet handler"
            backendApi -> database "Deduct credits and allocate Teacher income and fee together"
            autoLayout lr
        }
        dynamic skillSwap "TeachingFlow" "Join an online class | FR-011 | BR-039–041" {
            apiUser -> gateway "Participant asks to join a booked class"
            gateway -> backendApi "Forward the verified participant identity"
            backendApi -> database "Read booking and class for participant and joining-time checks"
            apiUser -> jitsi "Enter the booked classroom using the invitation"
            autoLayout lr
        }
        dynamic skillSwap "VerificationFlow" "Review teaching skills | FR-004/005 | BR-008/011/015" {
            apiUser -> gateway "Verifier requests evidence within their expertise"
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
            element "Demo" {
                background #f1f5f9
                color #0f172a
                border dashed
            }
        }
    }
}
