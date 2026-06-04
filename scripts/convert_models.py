import os
import numpy as np
import tensorflow as tf

def representative_dataset_gen(input_shape=(1, 112, 112, 3), num_samples=100):
    """
    Generates representative data for INT8 calibration.
    For production, this should yield real preprocessed face images.
    """
    for _ in range(num_samples):
        # Generate representative face-like synthetic data normalized to [-1.0, 1.0]
        # In production: load LFW/CelebA images, resize, and normalize: (img - 127.5) / 127.5
        synthetic_face = np.random.uniform(-1.0, 1.0, input_shape).astype(np.float32)
        yield [synthetic_face]

def convert_to_fp16(saved_model_path, output_path):
    """
    Converts a saved model to FP16 quantized TFLite format.
    """
    print(f"Converting {saved_model_path} to FP16 TFLite...")
    converter = tf.lite.TFLiteConverter.from_saved_model(saved_model_path)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.target_spec.supported_types = [tf.float16]
    
    tflite_model = converter.convert()
    with open(output_path, 'wb') as f:
        f.write(tflite_model)
    print(f"FP16 model successfully saved to {output_path}")

def convert_to_int8(saved_model_path, output_path, input_shape=(1, 112, 112, 3)):
    """
    Converts a saved model to full INT8 quantized TFLite format.
    """
    print(f"Converting {saved_model_path} to INT8 TFLite...")
    converter = tf.lite.TFLiteConverter.from_saved_model(saved_model_path)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    
    # Set representative dataset for calibration
    converter.representative_dataset = lambda: representative_dataset_gen(input_shape)
    
    # Restrict to integer-only operations
    converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    converter.inference_input_type = tf.int8
    converter.inference_output_type = tf.int8
    
    tflite_model = converter.convert()
    with open(output_path, 'wb') as f:
        f.write(tflite_model)
    print(f"INT8 model successfully saved to {output_path}")

def validate_accuracy(original_tflite_path, quantized_tflite_path, input_shape=(1, 112, 112, 3), num_tests=50):
    """
    Validates accuracy by comparing similarity of outputs on synthetic inputs.
    """
    print(f"Validating accuracy between {original_tflite_path} and {quantized_tflite_path}...")
    
    interpreter_orig = tf.lite.Interpreter(model_path=original_tflite_path)
    interpreter_orig.allocate_tensors()
    input_details_orig = interpreter_orig.get_input_details()
    output_details_orig = interpreter_orig.get_output_details()
    
    interpreter_quant = tf.lite.Interpreter(model_path=quantized_tflite_path)
    interpreter_quant.allocate_tensors()
    input_details_quant = interpreter_quant.get_input_details()
    output_details_quant = interpreter_quant.get_output_details()
    
    cosine_similarities = []
    
    for _ in range(num_tests):
        # Generate random input in range [-1.0, 1.0] matching float32 model
        input_data = np.random.uniform(-1.0, 1.0, input_shape).astype(np.float32)
        
        # Run original float32 model
        interpreter_orig.set_tensor(input_details_orig[0]['index'], input_data)
        interpreter_orig.invoke()
        output_orig = interpreter_orig.get_tensor(output_details_orig[0]['index']).flatten()
        
        # Run quantized model (handle float32 interface or scale int8)
        if input_details_quant[0]['dtype'] == np.int8:
            # Scale float32 input to int8
            scale, zero_point = input_details_quant[0]['quantization']
            if scale == 0: scale = 1.0
            input_data_quant = (input_data / scale + zero_point).astype(np.int8)
        else:
            input_data_quant = input_data
            
        interpreter_quant.set_tensor(input_details_quant[0]['index'], input_data_quant)
        interpreter_quant.invoke()
        
        output_quant_raw = interpreter_quant.get_tensor(output_details_quant[0]['index']).flatten()
        
        if output_details_quant[0]['dtype'] == np.int8:
            # Descale int8 output to float32
            scale, zero_point = output_details_quant[0]['quantization']
            if scale == 0: scale = 1.0
            output_quant = (output_quant_raw.astype(np.float32) - zero_point) * scale
        else:
            output_quant = output_quant_raw
            
        # Calculate Cosine Similarity
        dot_product = np.dot(output_orig, output_quant)
        norm_orig = np.linalg.norm(output_orig)
        norm_quant = np.linalg.norm(output_quant)
        
        if norm_orig > 0 and norm_quant > 0:
            cos_sim = dot_product / (norm_orig * norm_quant)
            cosine_similarities.append(cos_sim)
            
    avg_similarity = np.mean(cosine_similarities)
    print(f"Validation completed. Average Cosine Similarity: {avg_similarity:.5f}")
    return avg_similarity

if __name__ == "__main__":
    print("TensorFlow Lite Model Quantization and Validation framework initialized.")
    # This script runs during model training/export phase.
