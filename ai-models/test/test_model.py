import os
import numpy as np
import tensorflow as tf

# Resolve model path relative to this script so it works from any CWD
model_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'recognition', 'mobilefacenet.tflite'))
if not os.path.exists(model_path):
    raise FileNotFoundError(f"TFLite model not found: {model_path}")

# Load model
interpreter = tf.lite.Interpreter(model_path=model_path)
interpreter.allocate_tensors()

# Get input/output
input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()

# Print details
print("Input shape:", input_details[0]['shape'])
print("Output shape:", output_details[0]['shape'])

# Create dummy input
input_data = np.random.rand(1, 112, 112, 3).astype(np.float32)

# Run inference
interpreter.set_tensor(input_details[0]['index'], input_data)
interpreter.invoke()

output_data = interpreter.get_tensor(output_details[0]['index'])

print("Embedding:", output_data)
