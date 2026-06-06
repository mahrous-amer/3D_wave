import { Spectrum, type SpectrumParams } from './Spectrum';

/**
 * JONSWAP (Joint North Sea Wave Project) spectrum.
 *
 * Extends Pierson-Moskowitz with a peak enhancement factor gamma.
 * S(omega) = (alpha * g^2 / omega^5) * exp(-5/4 * (omega_p/omega)^4) * gamma^r
 * where r = exp(-(omega - omega_p)^2 / (2 * sigma^2 * omega_p^2))
 *
 * This is the most widely used oceanographic spectrum for wind-driven waves.
 */
export class JONSWAPSpectrum extends Spectrum {
  readonly name = 'jonswap';

  peakFrequency(params: SpectrumParams): number {
    const { windSpeed, gravity } = params;
    // Peak frequency: omega_p = 0.855 * g / U (Pierson-Moskowitz relation)
    return 0.855 * gravity / windSpeed;
  }

  evaluate(omega: number, params: SpectrumParams): number {
    const { windSpeed, gravity } = params;
    const gamma = params.gamma ?? 3.3;

    if (omega <= 0) return 0;

    const omegaP = this.peakFrequency(params);

    // Phillips constant (alpha)
    // Use Hasselmann et al. relation: alpha = 0.076 * (U^2 / (F*g))^0.22
    // Simplified: alpha = 0.0081 (standard PM value as default)
    const alpha = 0.0081;

    // Pierson-Moskowitz base spectrum
    const omegaRatio = omegaP / omega;
    const pm = (alpha * gravity * gravity / Math.pow(omega, 5)) *
      Math.exp(-1.25 * Math.pow(omegaRatio, 4));

    // JONSWAP peak enhancement
    const sigma = omega <= omegaP ? 0.07 : 0.09;
    const r = Math.exp(
      -Math.pow(omega - omegaP, 2) /
      (2 * sigma * sigma * omegaP * omegaP),
    );
    const peakEnhancement = Math.pow(gamma, r);

    return pm * peakEnhancement;
  }
}
