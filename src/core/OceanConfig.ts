import type { Color } from 'three';

export type QualityPreset = 'low' | 'medium' | 'high' | 'ultra';

export type SpectrumType = 'jonswap' | 'pierson-moskowitz' | 'tma';

export interface GerstnerWaveConfig {
  wavelength: number;
  amplitude: number;
  steepness: number;
  direction: number; // radians
  speed: number;
}

export interface WaveConfig {
  /** Wind speed in m/s (affects FFT spectrum energy) */
  windSpeed: number;
  /** Wind direction in radians */
  windDirection: number;
  /** Choppiness multiplier for horizontal displacement (no clamping) */
  choppiness: number;
  /** FFT animation speed multiplier */
  animationSpeed: number;
  /** Physical size of the FFT ocean patch in meters */
  lengthScale: number;
  /** Gerstner swell wave definitions (up to 16) */
  gerstnerWaves: GerstnerWaveConfig[];
}

export interface WaterMaterialConfig {
  /** Shallow water color */
  shallowColor: string;
  /** Deep water color */
  deepColor: string;
  /** Subsurface scattering color */
  sssColor: string;
  /** Subsurface scattering intensity (0-1) */
  sssIntensity: number;
  /** Fresnel power exponent */
  fresnelPower: number;
  /** Foam color */
  foamColor: string;
  /** Foam intensity (0-1) */
  foamIntensity: number;
  /** Sun sparkle intensity (0-1) */
  sparkleIntensity: number;
  /** Reflection strength (0-1) */
  reflectionStrength: number;
  /** Opacity (0-1) */
  opacity: number;
}

export interface OceanConfig {
  /** Quality preset controlling resolution and features */
  quality: QualityPreset;
  /** Wave simulation parameters */
  waves: WaveConfig;
  /** Water surface material parameters */
  material: WaterMaterialConfig;
  /** Water plane size in world units */
  size: number;
  /** Mesh segment count (overrides quality default if set) */
  meshSegments?: number;
}

export const DEFAULT_WAVE_CONFIG: WaveConfig = {
  windSpeed: 10,
  windDirection: 0,
  choppiness: 1.0,
  animationSpeed: 1.0,
  lengthScale: 500,
  gerstnerWaves: [
    { wavelength: 60, amplitude: 0.6, steepness: 0.4, direction: 0, speed: 1.0 },
    { wavelength: 30, amplitude: 0.3, steepness: 0.5, direction: 0.4, speed: 1.2 },
    { wavelength: 18, amplitude: 0.15, steepness: 0.3, direction: -0.3, speed: 0.9 },
    { wavelength: 10, amplitude: 0.08, steepness: 0.6, direction: 0.8, speed: 1.1 },
  ],
};

export const DEFAULT_MATERIAL_CONFIG: WaterMaterialConfig = {
  shallowColor: '#1ca3d8',
  deepColor: '#0a3d6b',
  sssColor: '#47c9af',
  sssIntensity: 0.4,
  fresnelPower: 5.0,
  foamColor: '#ffffff',
  foamIntensity: 0.8,
  sparkleIntensity: 0.6,
  reflectionStrength: 0.8,
  opacity: 0.95,
};

export const DEFAULT_OCEAN_CONFIG: OceanConfig = {
  quality: 'high',
  waves: DEFAULT_WAVE_CONFIG,
  material: DEFAULT_MATERIAL_CONFIG,
  size: 500,
};
