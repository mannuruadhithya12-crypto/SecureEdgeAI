# SecureEdgeAI Application Workflows

System workflows for offline enrollment and verification.

## 1. User Enrollment Workflow
```mermaid
sequenceFlow
    User -> LoginScreen: Inputs Name & Employee ID
    LoginScreen -> CameraScreen: Triggers Enrollment Mode
    CameraScreen -> CameraService: Captures raw face image
    CameraScreen -> ProcessingScreen: Transports image URI & metadata
    ProcessingScreen -> TFLiteEngine: Performs alignment + feature extraction
    TFLiteEngine -> ProcessingScreen: Returns 192-dimensional float embedding
    ProcessingScreen -> LocalDatabase: Writes User (name, id, embedding)
    ProcessingScreen -> ResultScreen: Displays success details & diagnostic latency
```

## 2. Biometric Verification Workflow
```mermaid
sequenceFlow
    User -> LoginScreen: Inputs Employee ID
    LoginScreen -> CameraScreen: Triggers Verification Mode
    CameraScreen -> CameraService: Captures face frame
    CameraScreen -> ProcessingScreen: Passes image URI
    ProcessingScreen -> LocalDatabase: Searches User by Employee ID
    LocalDatabase -> ProcessingScreen: Returns stored template embedding
    ProcessingScreen -> TFLiteEngine: Generates captured face embedding
    ProcessingScreen -> ProcessingScreen: Computes Cosine Similarity between stubs
    ProcessingScreen -> ResultScreen: Displays match confirmation & similarity metrics
```
