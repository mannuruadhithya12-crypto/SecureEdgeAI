# SecureEdgeAI

Offline AI-powered facial recognition and liveness detection system designed for remote workforce authentication in zero-network environments.

## Features
- Offline Face Recognition
- Liveness Detection
- Edge AI Optimization
- AWS Sync Mechanism
- React Native Cross-Platform Support

## Tech Stack
- React Native
- TensorFlow Lite
- MobileFaceNet
- BlazeFace
- SQLite
- AWS

## Repository Structure

- `mobile-app/SecureEdgeMobile/` - React Native mobile application.
- `mobile-app/SecureEdgeMobile/src/assets/models/` - canonical TFLite model files loaded by Metro and `react-native-fast-tflite`.
- `ai-models/` - model research, validation scripts, and model documentation.
- `scripts/` - repository-level setup and model utility scripts.
- `ENV_SETUP.md` and `requirements.txt` - Python/model tooling setup for the repository root.

## Model Asset Rule

Keep production mobile model assets in `mobile-app/SecureEdgeMobile/src/assets/models/`.
Do not duplicate the same `.tflite` files into Android native assets, root model folders, or nested mobile-side `ai-models` folders; Metro already bundles `.tflite` files from `src/assets/models`.
