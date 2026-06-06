/**
 * Directional spreading functions for ocean wave spectra.
 *
 * The full 2D spectrum is: S(omega, theta) = S(omega) * D(theta)
 * where D(theta) is the directional spreading function.
 */

/**
 * Cosine-power directional spreading.
 * D(theta) = N(s) * cos((theta - theta_w) / 2)^(2*s)
 *
 * Higher s = more concentrated along wind direction.
 * Typical values: s=2 (broad swell), s=10 (focused wind sea), s=20+ (narrow swell)
 *
 * @param theta Wave direction (radians)
 * @param windDirection Wind direction (radians)
 * @param spreadPower Spreading exponent s (higher = narrower)
 * @returns Normalized spreading factor
 */
export function cosinePowerSpreading(
  theta: number,
  windDirection: number,
  spreadPower: number,
): number {
  const halfAngle = (theta - windDirection) / 2;
  const cosHalf = Math.cos(halfAngle);

  if (cosHalf <= 0) return 0;

  // D(theta) = cos^(2s)(halfAngle) * normalization
  // Normalization factor: Gamma(s+1) / (2*sqrt(PI)*Gamma(s+0.5))
  // For simplicity, we normalize numerically or use approximate formula
  const s = spreadPower;
  const value = Math.pow(cosHalf, 2 * s);

  // Approximate normalization: N(s) ≈ (2^(2s-1) / PI) * Gamma(s+1)^2 / Gamma(2s+1)
  // Use a simpler empirical normalization
  const norm = (s + 0.5) / Math.PI;

  return value * norm;
}

/**
 * Evaluate the full 2D spectrum value at a wave vector k = (kx, kz).
 * Combines 1D spectrum S(omega) with directional spreading D(theta).
 *
 * @param kx Wave number x component
 * @param kz Wave number z component
 * @param spectrumValue 1D spectrum S(omega) at this frequency
 * @param windDirection Wind direction in radians
 * @param spreadPower Directional spreading exponent
 * @param gravity Gravitational acceleration
 * @returns 2D spectral density
 */
export function directionalSpectrum(
  kx: number,
  kz: number,
  spectrumValue: number,
  windDirection: number,
  spreadPower: number,
  gravity: number,
): number {
  const k = Math.sqrt(kx * kx + kz * kz);
  if (k < 1e-8) return 0;

  const theta = Math.atan2(kz, kx);
  const spreading = cosinePowerSpreading(theta, windDirection, spreadPower);

  // Convert from S(omega) to S(k):
  // S(k) = S(omega) * |d_omega/d_k| / k
  // For deep water: omega = sqrt(g*k), d_omega/d_k = g / (2*omega)
  const omega = Math.sqrt(gravity * k);
  const dOmegaDk = gravity / (2 * omega);

  return spectrumValue * spreading * dOmegaDk / k;
}
