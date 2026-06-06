import type { QualityPreset } from './OceanConfig';

export interface QualitySettings {
  /** FFT grid size (power of 2) */
  fftSize: 128 | 256 | 512;
  /** Number of FFT cascades */
  cascadeCount: 1 | 2 | 3 | 4;
  /** Water mesh segments per side */
  meshSegments: number;
  /** Enable foam rendering */
  foamEnabled: boolean;
  /** Enable subsurface scattering */
  sssEnabled: boolean;
  /** Enable screen-space reflections */
  ssrEnabled: boolean;
  /** Enable underwater caustics */
  causticsEnabled: boolean;
  /** Enable screen refraction */
  refractionEnabled: boolean;
}

export const QUALITY_PRESETS: Record<QualityPreset, QualitySettings> = {
  low: {
    fftSize: 128,
    cascadeCount: 1,
    meshSegments: 128,
    foamEnabled: false,
    sssEnabled: false,
    ssrEnabled: false,
    causticsEnabled: false,
    refractionEnabled: false,
  },
  medium: {
    fftSize: 256,
    cascadeCount: 2,
    meshSegments: 256,
    foamEnabled: true,
    sssEnabled: false,
    ssrEnabled: false,
    causticsEnabled: false,
    refractionEnabled: false,
  },
  high: {
    fftSize: 256,
    cascadeCount: 3,
    meshSegments: 256,
    foamEnabled: true,
    sssEnabled: true,
    ssrEnabled: true,
    causticsEnabled: true,
    refractionEnabled: true,
  },
  ultra: {
    fftSize: 512,
    cascadeCount: 4,
    meshSegments: 512,
    foamEnabled: true,
    sssEnabled: true,
    ssrEnabled: true,
    causticsEnabled: true,
    refractionEnabled: true,
  },
};

export function getQualitySettings(preset: QualityPreset): QualitySettings {
  return QUALITY_PRESETS[preset];
}
