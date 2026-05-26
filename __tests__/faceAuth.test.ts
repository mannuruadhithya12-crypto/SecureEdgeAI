import { cosineSimilarity, normalizeEmbedding } from '../src/utils/cosineSimilarity';
import { authenticateFace } from '../src/services/authenticateFace';

describe('Cosine Similarity & Normalization tests', () => {
  it('should L2 normalize Float32Arrays correctly', () => {
    const vector = new Float32Array([3, 4]); // length = sqrt(9 + 16) = 5
    const normalized = normalizeEmbedding(vector);
    
    expect(normalized[0]).toBeCloseTo(0.6);
    expect(normalized[1]).toBeCloseTo(0.8);
    
    // Norm of normalized vector should be 1
    const norm = Math.sqrt(normalized[0] * normalized[0] + normalized[1] * normalized[1]);
    expect(norm).toBeCloseTo(1.0);
  });

  it('should handle zero vector normalization gracefully', () => {
    const zero = new Float32Array([0, 0]);
    const normalized = normalizeEmbedding(zero);
    expect(normalized[0]).toBe(0);
    expect(normalized[1]).toBe(0);
  });

  it('should calculate raw cosine similarity between vectors', () => {
    const v1 = new Float32Array([1, 0]);
    const v2 = new Float32Array([0, 1]); // Orthogonal
    const v3 = new Float32Array([1, 0]); // Identical
    
    expect(cosineSimilarity(v1, v2)).toBeCloseTo(0.0);
    expect(cosineSimilarity(v1, v3)).toBeCloseTo(1.0);
    
    const v4 = new Float32Array([1, 1]); // 45 degrees
    expect(cosineSimilarity(v1, v4)).toBeCloseTo(Math.sqrt(2) / 2); // 0.707
  });
});

describe('Face Authentication tests', () => {
  const profileA = new Float32Array([1, 0, 0]);
  const profileB = new Float32Array([0, 1, 0]);
  const storedProfiles = {
    'userA': profileA,
    'userB': profileB,
  };

  it('should grant access to similar faces above threshold', () => {
    const liveFace = new Float32Array([0.9, 0.1, 0.0]); // Close to userA
    const result = authenticateFace(liveFace, storedProfiles, 0.85);
    
    expect(result.success).toBe(true);
    expect(result.userId).toBe('userA');
    expect(result.score).toBeGreaterThan(0.85);
  });

  it('should deny access to faces below threshold', () => {
    const unknownFace = new Float32Array([0.5, 0.5, 0.5]);
    const result = authenticateFace(unknownFace, storedProfiles, 0.85);
    
    expect(result.success).toBe(false);
    expect(result.score).toBeLessThan(0.85);
  });
});
