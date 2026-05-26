const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function float32ArrayToBase64(array: Float32Array): string {
  const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  
  let result = '';
  let i = 0;
  const len = binary.length;
  for (i = 0; i < len - 2; i += 3) {
    const chunk = (binary.charCodeAt(i) << 16) | (binary.charCodeAt(i + 1) << 8) | binary.charCodeAt(i + 2);
    result += chars[(chunk >> 18) & 63] + chars[(chunk >> 12) & 63] + chars[(chunk >> 6) & 63] + chars[chunk & 63];
  }
  
  if (i < len) {
    const remaining = len - i;
    if (remaining === 1) {
      const chunk = binary.charCodeAt(i) << 16;
      result += chars[(chunk >> 18) & 63] + chars[(chunk >> 12) & 63] + '==';
    } else if (remaining === 2) {
      const chunk = (binary.charCodeAt(i) << 16) | (binary.charCodeAt(i + 1) << 8);
      result += chars[(chunk >> 18) & 63] + chars[(chunk >> 12) & 63] + chars[(chunk >> 6) & 63] + '=';
    }
  }
  return result;
}

export function base64ToFloat32Array(base64: string): Float32Array {
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }
  
  let bufferLength = base64.length * 0.75;
  if (base64[base64.length - 1] === '=') {
    bufferLength--;
    if (base64[base64.length - 2] === '=') {
      bufferLength--;
    }
  }
  
  const bytes = new Uint8Array(bufferLength);
  let p = 0;
  for (let i = 0; i < base64.length; i += 4) {
    const encoded1 = lookup[base64.charCodeAt(i)];
    const encoded2 = lookup[base64.charCodeAt(i + 1)];
    const encoded3 = lookup[base64.charCodeAt(i + 2)];
    const encoded4 = lookup[base64.charCodeAt(i + 3)];
    
    const bytes1 = (encoded1 << 2) | (encoded2 >> 4);
    const bytes2 = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    const bytes3 = ((encoded3 & 3) << 6) | (encoded4 & 63);
    
    if (p < bufferLength) {
      bytes[p++] = bytes1;
    }
    if (p < bufferLength) {
      bytes[p++] = bytes2;
    }
    if (p < bufferLength) {
      bytes[p++] = bytes3;
    }
  }
  
  const buffer = new ArrayBuffer(bytes.length);
  const view = new Uint8Array(buffer);
  view.set(bytes);
  return new Float32Array(buffer);
}

export function base64ToHex(base64: string): string {
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }
  
  let bufferLength = base64.length * 0.75;
  if (base64[base64.length - 1] === '=') {
    bufferLength--;
    if (base64[base64.length - 2] === '=') {
      bufferLength--;
    }
  }
  
  let p = 0;
  let hex = '';
  for (let i = 0; i < base64.length; i += 4) {
    const encoded1 = lookup[base64.charCodeAt(i)];
    const encoded2 = lookup[base64.charCodeAt(i + 1)];
    const encoded3 = lookup[base64.charCodeAt(i + 2)];
    const encoded4 = lookup[base64.charCodeAt(i + 3)];
    
    const bytes1 = (encoded1 << 2) | (encoded2 >> 4);
    const bytes2 = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    const bytes3 = ((encoded3 & 3) << 6) | (encoded4 & 63);
    
    if (p < bufferLength) {
      hex += bytes1.toString(16).padStart(2, '0');
      p++;
    }
    if (p < bufferLength) {
      hex += bytes2.toString(16).padStart(2, '0');
      p++;
    }
    if (p < bufferLength) {
      hex += bytes3.toString(16).padStart(2, '0');
      p++;
    }
  }
  return hex;
}

export function hexToBase64(hex: string): string {
  let binary = '';
  for (let i = 0; i < hex.length; i += 2) {
    binary += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
  }
  
  let result = '';
  let i = 0;
  const len = binary.length;
  for (i = 0; i < len - 2; i += 3) {
    const chunk = (binary.charCodeAt(i) << 16) | (binary.charCodeAt(i + 1) << 8) | binary.charCodeAt(i + 2);
    result += chars[(chunk >> 18) & 63] + chars[(chunk >> 12) & 63] + chars[(chunk >> 6) & 63] + chars[chunk & 63];
  }
  
  if (i < len) {
    const remaining = len - i;
    if (remaining === 1) {
      const chunk = binary.charCodeAt(i) << 16;
      result += chars[(chunk >> 18) & 63] + chars[(chunk >> 12) & 63] + '==';
    } else if (remaining === 2) {
      const chunk = (binary.charCodeAt(i) << 16) | (binary.charCodeAt(i + 1) << 8);
      result += chars[(chunk >> 18) & 63] + chars[(chunk >> 12) & 63] + chars[(chunk >> 6) & 63] + '=';
    }
  }
  return result;
}
