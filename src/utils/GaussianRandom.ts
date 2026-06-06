/**
 * Box-Muller transform: generate pairs of independent standard normal random numbers.
 * Returns a Float32Array of Gaussian random numbers for FFT spectrum initialization.
 *
 * Each pair of uniform randoms [u1, u2] produces two Gaussian randoms:
 *   z0 = sqrt(-2*ln(u1)) * cos(2*PI*u2)
 *   z1 = sqrt(-2*ln(u1)) * sin(2*PI*u2)
 */
export function generateGaussianNoise(count: number, seed: number = 42): Float32Array {
  const data = new Float32Array(count);
  let state = seed;

  // Simple xorshift PRNG for reproducibility
  function xorshift(): number {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296; // [0, 1)
  }

  for (let i = 0; i < count; i += 2) {
    let u1 = xorshift();
    const u2 = xorshift();

    // Avoid log(0)
    if (u1 < 1e-10) u1 = 1e-10;

    const mag = Math.sqrt(-2.0 * Math.log(u1));
    const angle = 2.0 * Math.PI * u2;

    data[i] = mag * Math.cos(angle);
    if (i + 1 < count) {
      data[i + 1] = mag * Math.sin(angle);
    }
  }

  return data;
}

/**
 * Generate a texture-sized array of Gaussian random pairs (real, imag) for spectrum init.
 * Returns RGBA float data: [gaussR, gaussI, gaussR2, gaussI2] per texel.
 */
export function generateSpectrumNoise(size: number, seed: number = 42): Float32Array {
  const count = size * size * 4; // RGBA per texel
  return generateGaussianNoise(count, seed);
}
