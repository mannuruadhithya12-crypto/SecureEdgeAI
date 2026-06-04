import tensorflow as tf
import os

def inspect_model(model_path):
    print(f"\n--- Inspecting {os.path.basename(model_path)} ---")
    try:
        interpreter = tf.lite.Interpreter(model_path=model_path)
        interpreter.allocate_tensors()
        
        # Get input/output details
        inputs = interpreter.get_input_details()
        outputs = interpreter.get_output_details()
        
        print("Inputs:")
        for idx, i in enumerate(inputs):
            print(f"  [{idx}] Name: {i['name']}, Shape: {i['shape']}, Type: {i['dtype']}")
            
        print("Outputs:")
        for idx, o in enumerate(outputs):
            print(f"  [{idx}] Name: {o['name']}, Shape: {o['shape']}, Type: {o['dtype']}")
            
        # Get all operators
        # In newer TF versions, we can access operations through _get_ops_details()
        if hasattr(interpreter, '_get_ops_details'):
            ops = interpreter._get_ops_details()
            op_names = sorted(list(set(op['op_name'] for op in ops)))
            print(f"Operators used ({len(op_names)}):")
            for op in op_names:
                print(f"  - {op}")
        else:
            # Fallback if _get_ops_details is not available
            # Let's inspect the flatbuffer directly using the schema or a simpler check
            print("Operators: _get_ops_details not available. Will extract using helper.")
    except Exception as e:
        print(f"Error inspecting model: {e}")

models_dir = r"c:\Users\mannu\StudioProjects\SecureEdgeAI\src\assets\models"
models = ["blazeface_front.tflite", "blazeface_back.tflite", "mobilefacenet.tflite"]

for m in models:
    inspect_model(os.path.join(models_dir, m))
