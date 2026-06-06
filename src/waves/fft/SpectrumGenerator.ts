import { DataTexture } from 'three';
import { GRAVITY, TWO_PI } from '../../core/constants';
import { JONSWAPSpectrum } from '../spectra/JONSWAPSpectrum';
import { directionalSpectrum } from '../spectra/DirectionalSpreading';
import type { SpectrumParams } from '../spectra/Spectrum';
import type { Spectrum } from '../spectra/Spectrum';
import { generateGaussianNoise } from '../../utils/GaussianRandom';
import { createFloat32Texture } from '../../utils/TextureUtils';

/**
 * Generates the initial frequency-domain amplitude textures h0(k) and h0*(-k)
 * on the CPU, then uploads as DataTextures.
 *
 * Each texel stores a complex number [real, imag, conjReal, conjImag]:
 *   RG channels: h0(k)  = (1/sqrt(2)) * (xi_r + i*xi_i) * sqrt(S(k))
 *   BA channels: h0*(-k) = conjugate of h0 at mirrored wave vector
 *
 * This is run once at init and whenever spectrum parameters change.
 */
export class SpectrumGenerator {
  private spectrum: Spectrum;
  private size: number;
  private lengthScale: number;

  constructor(size: number, lengthScale: number, spectrum?: Spectrum) {
    this.size = size;
    this.lengthScale = lengthScale;
    this.spectrum = spectrum ?? new JONSWAPSpectrum();
  }

  /**
   * Generate h0 texture containing initial complex amplitudes.
   * Returns a DataTexture with RGBA float32 data:
   *   R,G = h0(k).real, h0(k).imag
   *   B,A = h0*(-k).real, h0*(-k).imag
   */
  generate(params: Omit<SpectrumParams, 'gravity'>, seed: number = 42): DataTexture {
    const N = this.size;
    const L = this.lengthScale;
    const g = GRAVITY;

    const fullParams: SpectrumParams = { ...params, gravity: g };
    const spreadPower = params.spreadPower ?? 6;

    // Generate Gaussian noise: 4 random values per texel (for h0 and h0_conj)
    const noise = generateGaussianNoise(N * N * 4, seed);
    const data = new Float32Array(N * N * 4);

    for (let m = 0; m < N; m++) {
      for (let n = 0; n < N; n++) {
        // Wave vector: k = 2*PI*n / L
        // Centered: n goes from -N/2 to N/2-1
        const kx = TWO_PI * (n - N / 2) / L;
        const kz = TWO_PI * (m - N / 2) / L;
        const k = Math.sqrt(kx * kx + kz * kz);

        let h0Real = 0;
        let h0Imag = 0;
        let h0ConjReal = 0;
        let h0ConjImag = 0;

        if (k > 1e-6) {
          // Deep water dispersion: omega = sqrt(g * k)
          const omega = Math.sqrt(g * k);

          // Evaluate 1D spectrum at this frequency
          const S1D = this.spectrum.evaluate(omega, fullParams);

          // Apply directional spreading to get 2D spectrum
          const S2D = directionalSpectrum(
            kx, kz, S1D,
            params.windDirection,
            spreadPower,
            g,
          );

          // h0(k) = (1/sqrt(2)) * (xi_r + i*xi_i) * sqrt(S(k))
          const sqrtS = Math.sqrt(Math.max(0, S2D));
          const invSqrt2 = 1 / Math.sqrt(2);

          const idx = (m * N + n) * 4;
          const xi0 = noise[idx + 0]; // Gaussian for h0
          const xi1 = noise[idx + 1];
          const xi2 = noise[idx + 2]; // Gaussian for h0_conj
          const xi3 = noise[idx + 3];

          h0Real = invSqrt2 * xi0 * sqrtS;
          h0Imag = invSqrt2 * xi1 * sqrtS;

          // For h0*(-k), we use the mirrored position
          // In practice, h0_conj(-k) uses separate noise
          // but conjugate symmetry is enforced in time evolution
          const mirrorM = (N - m) % N;
          const mirrorN = (N - n) % N;
          const mirrorKx = TWO_PI * (mirrorN - N / 2) / L;
          const mirrorKz = TWO_PI * (mirrorM - N / 2) / L;
          const mirrorK = Math.sqrt(mirrorKx * mirrorKx + mirrorKz * mirrorKz);

          if (mirrorK > 1e-6) {
            const mirrorOmega = Math.sqrt(g * mirrorK);
            const mirrorS1D = this.spectrum.evaluate(mirrorOmega, fullParams);
            const mirrorS2D = directionalSpectrum(
              mirrorKx, mirrorKz, mirrorS1D,
              params.windDirection,
              spreadPower,
              g,
            );
            const mirrorSqrtS = Math.sqrt(Math.max(0, mirrorS2D));
            // h0*(-k) = conjugate of h0 at -k
            h0ConjReal = invSqrt2 * xi2 * mirrorSqrtS;
            h0ConjImag = -invSqrt2 * xi3 * mirrorSqrtS; // conjugate: negate imag
          }
        }

        const texelIdx = (m * N + n) * 4;
        data[texelIdx + 0] = h0Real;
        data[texelIdx + 1] = h0Imag;
        data[texelIdx + 2] = h0ConjReal;
        data[texelIdx + 3] = h0ConjImag;
      }
    }

    return createFloat32Texture(data, N, N);
  }
}
