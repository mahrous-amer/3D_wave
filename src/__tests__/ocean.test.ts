import { describe, it, expect } from 'vitest';
import { JONSWAPSpectrum } from '../waves/spectra/JONSWAPSpectrum';
import { GerstnerWaves } from '../waves/gerstner/GerstnerWaves';
import { directionalSpectrum } from '../waves/spectra/DirectionalSpreading';

const GRAVITY = 9.81;

// ── Spectrum ─────────────────────────────────────────────────────────────────

describe('JONSWAPSpectrum', () => {
  const spectrum = new JONSWAPSpectrum();

  it('returns zero at zero frequency', () => {
    expect(spectrum.evaluate(0, { windSpeed: 10, windDirection: 0, gravity: GRAVITY })).toBe(0);
  });

  it('returns a positive value at peak frequency', () => {
    // peak omega ≈ 0.877 * g / U  (JONSWAP empirical)
    const U = 10;
    const omegaPeak = 0.877 * GRAVITY / U;
    const S = spectrum.evaluate(omegaPeak, { windSpeed: U, windDirection: 0, gravity: GRAVITY });
    expect(S).toBeGreaterThan(0);
  });

  it('higher wind speed yields more energy', () => {
    const omegaPeak = 0.877 * GRAVITY / 20;
    const S_low = spectrum.evaluate(omegaPeak, { windSpeed: 10, windDirection: 0, gravity: GRAVITY });
    const S_high = spectrum.evaluate(omegaPeak, { windSpeed: 20, windDirection: 0, gravity: GRAVITY });
    expect(S_high).toBeGreaterThan(S_low);
  });
});

describe('directionalSpectrum', () => {
  it('returns zero for k=0', () => {
    expect(directionalSpectrum(0, 0, 1, 0, 6, GRAVITY)).toBe(0);
  });

  it('upwind direction has maximum spreading', () => {
    const S_aligned = directionalSpectrum(1, 0, 1, 0, 6, GRAVITY);
    const S_cross = directionalSpectrum(0, 1, 1, 0, 6, GRAVITY);
    expect(S_aligned).toBeGreaterThan(S_cross);
  });
});

// ── Gerstner ─────────────────────────────────────────────────────────────────

describe('GerstnerWaves', () => {
  const waves = new GerstnerWaves();
  waves.setWaves([
    { wavelength: 20, amplitude: 1.0, steepness: 0.0, direction: 0, speed: 1.0 },
  ]);

  it('height at t=0, x=0 equals amplitude (cosine wave at crest)', () => {
    // phase = 0 => cos(0) = 1 => y = amplitude
    const h = waves.getHeightAt(0, 0, 0);
    expect(h).toBeCloseTo(1.0, 4);
  });

  it('height at half-wavelength is -amplitude (trough)', () => {
    const h = waves.getHeightAt(10, 0, 0); // x = λ/2 => phase = π => cos(π) = -1
    expect(h).toBeCloseTo(-1.0, 3);
  });

  it('normal points upward at flat wave (steepness=0)', () => {
    const n = waves.getNormalAt(0, 0, 0);
    // For a pure height wave with no lateral displacement, normals won't be straight up
    // but the y component should be dominant
    expect(n.y).toBeGreaterThan(0);
    expect(Math.abs(n.x * n.x + n.y * n.y + n.z * n.z) - 1).toBeLessThan(1e-5);
  });

  it('displacement is zero when amplitude is zero', () => {
    const w2 = new GerstnerWaves();
    w2.setWaves([{ wavelength: 20, amplitude: 0, steepness: 0.5, direction: 0, speed: 1.0 }]);
    const d = w2.evaluateDisplacement(5, 5, 1);
    expect(d.x).toBeCloseTo(0);
    expect(d.y).toBeCloseTo(0);
    expect(d.z).toBeCloseTo(0);
  });
});

// ── FFT ping-pong index math ──────────────────────────────────────────────────

describe('FFT ping-pong buffer selection', () => {
  // Even stage reads bufA, writes bufB. Odd stage reads bufB, writes bufA.
  // After logN horizontal passes, result is in bufA if logN is even, bufB if odd.
  function finalBuffer(logN: number): 'A' | 'B' {
    return logN % 2 === 0 ? 'A' : 'B';
  }

  it('N=256 (logN=8, even) → result in A after horizontal passes', () => {
    expect(finalBuffer(8)).toBe('A');
  });

  it('N=128 (logN=7, odd) → result in B after horizontal passes', () => {
    expect(finalBuffer(7)).toBe('B');
  });

  it('N=512 (logN=9, odd) → result in B after horizontal passes', () => {
    expect(finalBuffer(9)).toBe('B');
  });

  // After both H and V passes (2*logN total), result always ends in A
  function finalBufferAfterBoth(logN: number): 'A' | 'B' {
    return (2 * logN) % 2 === 0 ? 'A' : 'B';
  }

  it('result always in A after both H+V passes (2*logN is always even)', () => {
    for (const n of [7, 8, 9, 10]) {
      expect(finalBufferAfterBoth(n)).toBe('A');
    }
  });
});
