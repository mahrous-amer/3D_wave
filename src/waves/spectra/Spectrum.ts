/**
 * Parameters for ocean spectrum generation.
 */
export interface SpectrumParams {
  /** Wind speed in m/s */
  windSpeed: number;
  /** Wind direction in radians */
  windDirection: number;
  /** Gravitational acceleration (m/s^2) */
  gravity: number;
  /** Fetch distance in meters (for JONSWAP) */
  fetch?: number;
  /** Water depth in meters (for TMA) */
  depth?: number;
  /** JONSWAP peak enhancement factor (default 3.3) */
  gamma?: number;
  /** Directional spreading exponent (cosine-power) */
  spreadPower?: number;
}

/**
 * Abstract base for ocean wave spectra.
 * Implementations evaluate the spectral energy density S(omega) at a given frequency.
 */
export abstract class Spectrum {
  abstract readonly name: string;

  /**
   * Evaluate the one-dimensional spectrum S(omega).
   * @param omega Angular frequency (rad/s)
   * @param params Spectrum parameters
   * @returns Spectral energy density (m^2 * s)
   */
  abstract evaluate(omega: number, params: SpectrumParams): number;

  /**
   * Compute peak angular frequency omega_p from parameters.
   */
  abstract peakFrequency(params: SpectrumParams): number;
}
