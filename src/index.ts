// Core
export { OceanSystem } from './core/OceanSystem';
export { getQualitySettings, QUALITY_PRESETS } from './core/QualityLevel';
export type { QualitySettings } from './core/QualityLevel';

// Config
export type {
  OceanConfig,
  WaveConfig,
  WaterMaterialConfig,
  GerstnerWaveConfig,
  QualityPreset,
  SpectrumType,
} from './core/OceanConfig';
export {
  DEFAULT_OCEAN_CONFIG,
  DEFAULT_WAVE_CONFIG,
  DEFAULT_MATERIAL_CONFIG,
} from './core/OceanConfig';

// Constants
export {
  GRAVITY,
  MAX_GERSTNER_WAVES,
  MAX_CASCADES,
  MAX_BUOYANCY_SAMPLES,
} from './core/constants';

// Waves
export { WaveEngine } from './waves/WaveEngine';
export { GerstnerWaves } from './waves/gerstner/GerstnerWaves';
export { FFTCompute } from './waves/fft/FFTCompute';
export { SpectrumGenerator } from './waves/fft/SpectrumGenerator';
export { JONSWAPSpectrum } from './waves/spectra/JONSWAPSpectrum';

// Material
export { WaterMaterial } from './material/WaterMaterial';

// Mesh
export { WaterMesh } from './mesh/WaterMesh';

// Utils
export { detectBackend, isWebGPUAvailable } from './utils/RendererDetect';
export type { RenderBackend } from './utils/RendererDetect';
export { DisposableGroup } from './utils/DisposableGroup';
