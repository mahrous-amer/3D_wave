import { uniform, uniformArray } from 'three/tsl';
import { Vector4 } from 'three';
import type { WebGPURenderer, StorageTexture } from 'three/webgpu';
import type { WaveConfig, GerstnerWaveConfig } from '../core/OceanConfig';
import { DEFAULT_WAVE_CONFIG } from '../core/OceanConfig';
import { MAX_GERSTNER_WAVES } from '../core/constants';
import { GerstnerWaves } from './gerstner/GerstnerWaves';
import { packGerstnerWaves } from './gerstner/GerstnerConfig';
import { createGerstnerDisplacementNode, createGerstnerNormalNode } from './gerstner/GerstnerWaveNode';
import { FFTCompute } from './fft/FFTCompute';

/**
 * WaveEngine orchestrates all wave simulation (Gerstner + FFT).
 * Standalone-capable: can be used without OceanSystem for custom setups.
 */
export class WaveEngine {
  private config: WaveConfig;
  private elapsedTime = 0;

  /** CPU-side Gerstner evaluator for physics queries */
  readonly gerstner: GerstnerWaves;

  /** TSL uniforms exposed for material binding */
  readonly timeUniform: ReturnType<typeof uniform>;
  readonly waveCountUniform: ReturnType<typeof uniform>;
  readonly waveDataUniform: ReturnType<typeof uniformArray>;

  /** TSL node factories */
  readonly displacementNode: ReturnType<typeof createGerstnerDisplacementNode>;
  readonly normalNode: ReturnType<typeof createGerstnerNormalNode>;

  /** FFT compute pipeline (null until initFFT is called) */
  private fftCompute: FFTCompute | null = null;

  constructor(config?: Partial<WaveConfig>) {
    this.config = { ...DEFAULT_WAVE_CONFIG, ...config };

    this.gerstner = new GerstnerWaves();
    this.gerstner.setWaves(this.config.gerstnerWaves);

    // Create TSL uniforms
    this.timeUniform = uniform(0);
    this.waveCountUniform = uniform(Math.min(this.config.gerstnerWaves.length, MAX_GERSTNER_WAVES));

    // Pack wave data: 2 vec4s per wave = MAX_GERSTNER_WAVES * 2 vec4 entries
    const packedData = packGerstnerWaves(this.config.gerstnerWaves);
    const vec4Array: Vector4[] = [];
    for (let i = 0; i < MAX_GERSTNER_WAVES * 2; i++) {
      vec4Array.push(new Vector4(
        packedData[i * 4 + 0],
        packedData[i * 4 + 1],
        packedData[i * 4 + 2],
        packedData[i * 4 + 3],
      ));
    }
    this.waveDataUniform = uniformArray(vec4Array);

    // Create TSL nodes
    this.displacementNode = createGerstnerDisplacementNode(
      this.waveDataUniform,
      this.waveCountUniform,
      this.timeUniform,
    );

    this.normalNode = createGerstnerNormalNode(
      this.waveDataUniform,
      this.waveCountUniform,
      this.timeUniform,
    );
  }

  /**
   * Initialize the FFT compute pipeline.
   * Must be called before the material is created so the material can
   * bind to the FFT output textures.
   */
  initFFT(renderer: WebGPURenderer, fftSize: number): void {
    this.fftCompute?.dispose();
    this.fftCompute = new FFTCompute(
      renderer,
      fftSize,
      this.config.lengthScale,
      this.config.choppiness,
    );
    this.fftCompute.regenerateSpectrum(
      this.config.windSpeed,
      this.config.windDirection,
    );
  }

  get hasFFT(): boolean {
    return this.fftCompute !== null;
  }

  get fftDisplacementTexture(): StorageTexture | null {
    return this.fftCompute?.displacementTexture ?? null;
  }

  get fftNormalTexture(): StorageTexture | null {
    return this.fftCompute?.normalTexture ?? null;
  }

  async update(deltaTime: number): Promise<void> {
    this.elapsedTime += deltaTime * this.config.animationSpeed;
    this.timeUniform.value = this.elapsedTime;

    if (this.fftCompute) {
      await this.fftCompute.compute(this.elapsedTime);
    }
  }

  setConfig(config: Partial<WaveConfig>): void {
    const prevWind = this.config.windSpeed;
    const prevDir = this.config.windDirection;
    Object.assign(this.config, config);

    if (config.gerstnerWaves) {
      this.gerstner.setWaves(config.gerstnerWaves);
      this.updateGerstnerUniforms(config.gerstnerWaves);
    }

    if (config.choppiness !== undefined && this.fftCompute) {
      this.fftCompute.setChoppiness(config.choppiness);
    }

    // Regenerate spectrum if wind parameters changed
    if (this.fftCompute && (config.windSpeed !== undefined || config.windDirection !== undefined)) {
      if (this.config.windSpeed !== prevWind || this.config.windDirection !== prevDir) {
        this.fftCompute.regenerateSpectrum(
          this.config.windSpeed,
          this.config.windDirection,
        );
      }
    }
  }

  private updateGerstnerUniforms(waves: GerstnerWaveConfig[]): void {
    const count = Math.min(waves.length, MAX_GERSTNER_WAVES);
    this.waveCountUniform.value = count;

    const packedData = packGerstnerWaves(waves);
    for (let i = 0; i < MAX_GERSTNER_WAVES * 2; i++) {
      const vec = this.waveDataUniform.array[i] as Vector4;
      vec.set(
        packedData[i * 4 + 0],
        packedData[i * 4 + 1],
        packedData[i * 4 + 2],
        packedData[i * 4 + 3],
      );
    }
  }

  /** Get surface height at world position (CPU, uses Gerstner only) */
  getHeightAt(x: number, z: number): number {
    return this.gerstner.getHeightAt(x, z, this.elapsedTime);
  }

  getElapsedTime(): number {
    return this.elapsedTime;
  }

  dispose(): void {
    this.fftCompute?.dispose();
  }
}
