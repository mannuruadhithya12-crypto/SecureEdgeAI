# SecureEdgeAI Biometric Security Specification

Offline-first face authentication template protection and security controls.

## 1. Local Storage Security (AES-256-GCM & Android Keystore)
* **Database Isolation**: The facial templates and employee ID records are isolated inside a sandboxed SQLite instance (`SecureEdgeAI.db`) located within the application's secure data directory.
* **AES-256-GCM Cryptographic Strategy**: Biometric records and sensitive tokens are encrypted at rest using AES-256-GCM (Galois/Counter Mode). Each record is encrypted with a unique initialization vector (IV) to prevent frequency-analysis attacks.
* **Android Keystore System**: The master AES key is generated and stored securely inside the hardware-backed Android Keystore. This key never enters the application process memory in plaintext and cannot be extracted, even on rooted devices.

## 2. Biometric Template Protection
* **Irreversibility**: Facial embeddings (192 float arrays) represent highly abstract spatial features extracted by MobileFaceNet. These vectors are mathematically one-way; it is computationally impossible to reconstruct the original pixel-level face image from an embedding vector.
* **Zero Image Storage**: Live frames used in processing are stored in transient cache files and immediately cleaned up after execution, minimizing exposure of physical photos.

## 3. Brute Force Mitigation (Lockout Strategy)
To prevent brute-force presentation attacks or identity guessing:
* **Failure Counter**: The system monitors consecutive failed authentication attempts in the active session.
* **Lockout Period**: After **3 consecutive failed matching attempts**, the application enforces a **30-second lockout timer** during which the camera stream is disabled.
* **Cool-off Progression**: If failures continue after the cool-off period, subsequent lockouts escalate exponentially (e.g., 5 minutes, 15 minutes).

## 4. Presentation Attack Detection (Anti-Spoofing)
* **Liveness Validation**: Live stream processing integrates a classification model to verify liveness before generating feature vectors, preventing printed photos or screen playbacks from matching.
* **Eye-Blink & Texture Filters**: The system measures micro-texture anomalies (analyzing screen moiré patterns and print reflections) and checks for active blinking/movement to confirm a live physical subject is present.

## 5. Authentication Threshold Controls
Matches are evaluated using Cosine Similarity calculation. To prevent spoofing and template mismatches, the following matching thresholds are enforced:

| Threshold Scope | Match Decision | Action taken | Security Risk |
| :--- | :--- | :--- | :--- |
| **$\ge 0.85$** | **Valid (Success)** | Confirms identity and logs terminal access | Extremely low false acceptance |
| **$0.70 \le S < 0.85$** | **Uncertain** | Prompts user to retry or triggers manual review | High false matches, locked out |
| **$< 0.70$** | **Reject (Failure)** | Denies entry, blocks access token generation | Rejects unauthorized actors |
