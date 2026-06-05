# Security Policy

## Supported Versions
Currently, we only apply security patches to the latest release of the main branch.

## Threat Model
SecureEdgeMobile operates in fully offline, untrusted physical environments. Our primary threat vector is local tampering and presentation attacks (spoofing).

### Threat Scenarios
1. **Presentation Attacks (Spoofing)**
   - **Photo Attacks:** Prevented via depth analysis, texture mapping, and edge detection.
   - **Replay Attacks (Video):** Prevented via challenge-response liveness (e.g., specific blinking sequences) and temporal noise variance checks.
   - **3D Masks:** Mitigated through advanced liveness checks and specific specular reflection analysis.

2. **Device Level Tampering**
   - **Rooting/Jailbreaking:** Root detection mechanisms actively prevent the app from running on compromised devices.
   - **Memory Hooking:** Frida detection and anti-tamper mechanisms are implemented in the native code layer.
   - **App Repackaging:** Keystore validation and strict ProGuard obfuscation are applied.

3. **Data Security**
   - **Biometric Templates:** Raw images are NEVER stored. Only non-reversible facial embeddings (floating-point arrays) are saved to the SQLite database.
   - **Offline Storage Encryption:** Local SQLite databases are encrypted at rest using SQLCipher.

## Audit Logging
All security events, including failed authentications, liveness rejections, and detected tampering attempts, are immutably written to a local encrypted audit log. This log can only be exported by authorized administrators.

## Reporting a Vulnerability
If you discover a security vulnerability, please DO NOT report it via public GitHub issues. Instead, send an email to security@secureedge.local. We aim to respond within 48 hours.
