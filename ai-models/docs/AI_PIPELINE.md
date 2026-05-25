# AI Authentication Pipeline

1. **Camera Feed**: Active full-screen preview.
2. **Front BlazeFace**: Runs at 5 FPS to track if a face is present.
3. **Track Face**: Updates UI with "Tracking Face...".
4. **User Ready**: Triggers when the face is stable.
5. **Back BlazeFace**: High-resolution detection for precise alignment.
6. **Crop Face**: Normalizes face region for recognition.
7. **MobileFaceNet**: Generates embedding vector.
8. **Cosine Similarity**: Compares against local DB.
9. **Authentication Result**: Final pass/fail result.
