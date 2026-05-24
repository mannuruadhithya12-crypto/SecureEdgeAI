This folder contains model documentation, validation tests, and research utilities.
The app-bundled TFLite model files live in `mobile-app/SecureEdgeMobile/src/assets/models`.

To run the test:

1. Install dependencies: `pip install -r requirements.txt`
2. From repo root: `python test_model.py`

Expected: the test script loads `mobilefacenet.tflite` from the mobile app asset folder, then prints input/output shapes and an embedding vector.
