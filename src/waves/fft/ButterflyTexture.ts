import { createFloat32Texture } from '../../utils/TextureUtils';
import type { DataTexture } from 'three';

/**
 * Precomputes the butterfly lookup texture for Stockham FFT.
 *
 * Each texel at (stage, index) stores:
 *   R = top index (source element for butterfly)
 *   G = bottom index (source element for butterfly)
 *   B = twiddle factor real part: cos(-2*PI*k/N)
 *   A = twiddle factor imag part: sin(-2*PI*k/N)
 *
 * The texture has dimensions: (log2(N) stages) x N
 *
 * Stockham auto-sort FFT naturally ping-pongs between two buffers
 * without needing bit-reversal permutation.
 */
export function createButterflyTexture(N: number): DataTexture {
  const logN = Math.log2(N);
  if (!Number.isInteger(logN)) {
    throw new Error(`FFT size must be power of 2, got ${N}`);
  }

  const stages = logN;
  const data = new Float32Array(stages * N * 4); // RGBA per texel

  for (let stage = 0; stage < stages; stage++) {
    const butterflySpan = 1 << (stage + 1); // 2, 4, 8, ..., N
    const halfSpan = butterflySpan >> 1;     // 1, 2, 4, ..., N/2

    for (let index = 0; index < N; index++) {
      const texelOffset = (stage * N + index) * 4;

      // Which butterfly group and position within group
      const group = Math.floor(index / butterflySpan);
      const posInGroup = index % butterflySpan;
      const isBottom = posInGroup >= halfSpan;

      // Stockham addressing: source indices from previous stage's buffer
      // Top element and bottom element that participate in this butterfly
      let topIdx: number;
      let botIdx: number;

      if (!isBottom) {
        // Top wing
        topIdx = group * halfSpan + (posInGroup % halfSpan);
        botIdx = topIdx + N / 2;
      } else {
        // Bottom wing
        topIdx = group * halfSpan + (posInGroup % halfSpan);
        botIdx = topIdx + N / 2;
      }

      // Ensure indices are within bounds
      topIdx = topIdx % N;
      botIdx = botIdx % N;

      // Twiddle factor: W_N^k = exp(-2*PI*i*k/N)
      // k depends on position in butterfly
      const k = (posInGroup % halfSpan) * (N / butterflySpan);
      const angle = -2.0 * Math.PI * k / N;
      const twiddleReal = Math.cos(angle);
      const twiddleImag = Math.sin(angle);

      data[texelOffset + 0] = topIdx;
      data[texelOffset + 1] = botIdx;
      data[texelOffset + 2] = twiddleReal;
      data[texelOffset + 3] = twiddleImag;
    }
  }

  return createFloat32Texture(data, N, stages);
}
