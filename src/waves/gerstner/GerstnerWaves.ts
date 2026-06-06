import { Vector3 } from 'three';
import type { GerstnerWaveConfig } from '../../core/OceanConfig';
import { GRAVITY, MAX_GERSTNER_WAVES } from '../../core/constants';
import { dispersionFrequency, waveNumber } from './GerstnerConfig';

/**
 * CPU-side Gerstner wave evaluator.
 * Used for buoyancy queries, debug visualization, and WebGL2 fallback.
 */
export class GerstnerWaves {
  private waves: GerstnerWaveConfig[] = [];

  setWaves(waves: GerstnerWaveConfig[]): void {
    this.waves = waves.slice(0, MAX_GERSTNER_WAVES);
  }

  getWaves(): readonly GerstnerWaveConfig[] {
    return this.waves;
  }

  /**
   * Evaluate Gerstner displacement at a world XZ position and time.
   * Returns the displacement vector (dx, dy, dz).
   */
  evaluateDisplacement(x: number, z: number, time: number, out?: Vector3): Vector3 {
    const result = out ?? new Vector3();
    result.set(0, 0, 0);

    for (const wave of this.waves) {
      const dirX = Math.cos(wave.direction);
      const dirZ = Math.sin(wave.direction);
      const omega = dispersionFrequency(wave.wavelength);
      const k = waveNumber(wave.wavelength);

      const phase = (dirX * x + dirZ * z) * k + omega * time * wave.speed;
      const sinP = Math.sin(phase);
      const cosP = Math.cos(phase);

      result.x += wave.steepness * wave.amplitude * dirX * sinP;
      result.y += wave.amplitude * cosP;
      result.z += wave.steepness * wave.amplitude * dirZ * sinP;
    }

    return result;
  }

  /**
   * Evaluate the surface height at a world XZ position.
   * Only returns the Y component of displacement.
   */
  getHeightAt(x: number, z: number, time: number): number {
    let height = 0;

    for (const wave of this.waves) {
      const dirX = Math.cos(wave.direction);
      const dirZ = Math.sin(wave.direction);
      const omega = dispersionFrequency(wave.wavelength);
      const k = waveNumber(wave.wavelength);

      const phase = (dirX * x + dirZ * z) * k + omega * time * wave.speed;
      height += wave.amplitude * Math.cos(phase);
    }

    return height;
  }

  /**
   * Evaluate the surface normal at a world XZ position.
   */
  getNormalAt(x: number, z: number, time: number, out?: Vector3): Vector3 {
    const result = out ?? new Vector3();
    result.set(0, 1, 0);

    for (const wave of this.waves) {
      const dirX = Math.cos(wave.direction);
      const dirZ = Math.sin(wave.direction);
      const omega = dispersionFrequency(wave.wavelength);
      const k = waveNumber(wave.wavelength);

      const phase = (dirX * x + dirZ * z) * k + omega * time * wave.speed;
      const sinP = Math.sin(phase);
      const cosP = Math.cos(phase);

      result.x -= dirX * wave.amplitude * k * wave.steepness * cosP;
      result.y -= wave.steepness * wave.amplitude * k * sinP;
      result.z -= dirZ * wave.amplitude * k * wave.steepness * cosP;
    }

    return result.normalize();
  }
}
