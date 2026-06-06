import type { GerstnerWaveConfig } from '../../core/OceanConfig';
import { GRAVITY, MAX_GERSTNER_WAVES } from '../../core/constants';

/**
 * Compute angular frequency from wavelength using deep water dispersion relation.
 * omega = sqrt(g * k) where k = 2*PI / wavelength
 */
export function dispersionFrequency(wavelength: number): number {
  const k = (2 * Math.PI) / wavelength;
  return Math.sqrt(GRAVITY * k);
}

/**
 * Compute wave number from wavelength.
 * k = 2*PI / wavelength
 */
export function waveNumber(wavelength: number): number {
  return (2 * Math.PI) / wavelength;
}

/**
 * Pack GerstnerWaveConfig into a flat Float32Array for uniform upload.
 * Each wave: [dirX, dirZ, amplitude, frequency, steepness, speed, pad, pad] = 8 floats
 */
export function packGerstnerWaves(waves: GerstnerWaveConfig[]): Float32Array {
  const data = new Float32Array(MAX_GERSTNER_WAVES * 8);

  const count = Math.min(waves.length, MAX_GERSTNER_WAVES);
  for (let i = 0; i < count; i++) {
    const w = waves[i];
    const offset = i * 8;
    const dirX = Math.cos(w.direction);
    const dirZ = Math.sin(w.direction);
    const freq = dispersionFrequency(w.wavelength);

    data[offset + 0] = dirX;
    data[offset + 1] = dirZ;
    data[offset + 2] = w.amplitude;
    data[offset + 3] = freq;
    data[offset + 4] = w.steepness;
    data[offset + 5] = w.speed;
    data[offset + 6] = 0; // padding
    data[offset + 7] = 0; // padding
  }

  return data;
}
