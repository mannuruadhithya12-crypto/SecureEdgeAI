# SecureEdgeAI - Presentation Pitch Outline

## Slide 1: Title & Team
- **Title**: SecureEdgeAI: Zero-Network Offline Biometric Authentication
- **Tagline**: Secure, low-latency, offline-first facial authentication on the edge.
- **Presenter/Team**: Member 1, Member 2, Member 3

## Slide 2: Problem Statement
- **The Challenge**: Remote workforces (construction sites, defense installations, offshore rigs) operate in zero-network/remote environments. Cloud-dependent authentication fails due to high latency or connectivity dropouts.
- **The Security Risk**: Offline password entry or RFID cards are vulnerable to buddy-punching or theft.
- **Solution**: SecureEdgeAI offers local, real-time facial verification directly on Android mobile devices with zero network dependencies.

## Slide 3: Architecture & Tech Stack
- **Biometric Front-end**: React Native + `react-native-vision-camera` + custom high performance JNI Kotlin/C++ bindings.
- **Offline ML Pipelines**: BlazeFace for face tracking and alignment; MobileFaceNet (quantized TFLite) for high performance feature embedding generation.
- **Biometric Vault**: Local SQLite database storing stringified template vectors with fallback key-value caches.
- **Security & Efficiency**: Running inference locally via CPU XNNPACK delegates, eliminating cloud server hosting costs.

## Slide 4: System Workflow
- **Enrollment Flow**: Capture face -> Local TFLite JSI execution -> Generate 192-dim vector -> Save to SQLite.
- **Verification Flow**: Input Employee ID -> Load template from SQLite -> Capture face -> Compare via Cosine Similarity on device -> Deny/Grant Access.

## Slide 5: Performance & Optimization
- **Execution Latency**: Biometric processing runs in <150ms.
- **Size footprint**: Quantized models keep the application binary under 25MB.
- **Accuracy**: MobileFaceNet provides a high verification accuracy with extremely low false acceptance rates.

## Slide 6: Summary & Future Roadmaps
- **Day 2 Achievements**: Full screen flow, active camera frame capture, navigation container, local database stubs.
- **Next Horizon**: Sync logs and templates to AWS Cognito/DynamoDB when connection is restored, enabling centralized edge coordination.
