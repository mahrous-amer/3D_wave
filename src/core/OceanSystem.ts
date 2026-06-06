import {
  Scene,
  PerspectiveCamera,
  WebGPURenderer,
} from 'three/webgpu';

import { WaveEngine } from '../waves/WaveEngine';
import { WaterMesh } from '../mesh/WaterMesh';
import { WaterMaterial } from '../material/WaterMaterial';
import { DisposableGroup } from '../utils/DisposableGroup';
import {
  OceanConfig,
  DEFAULT_OCEAN_CONFIG,
  WaveConfig,
  WaterMaterialConfig,
} from './OceanConfig';
import { getQualitySettings } from './QualityLevel';
import type { QualityPreset } from './OceanConfig';

export class OceanSystem {
  readonly waves: WaveEngine;
  readonly mesh: WaterMesh;
  readonly material: WaterMaterial;

  private readonly renderer: WebGPURenderer;
  private readonly scene: Scene;
  private readonly camera: PerspectiveCamera;
  private readonly disposables: DisposableGroup;
  private config: OceanConfig;

  private constructor(
    renderer: WebGPURenderer,
    scene: Scene,
    camera: PerspectiveCamera,
    config: OceanConfig,
    waves: WaveEngine,
    material: WaterMaterial,
    mesh: WaterMesh,
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.config = config;
    this.waves = waves;
    this.material = material;
    this.mesh = mesh;
    this.disposables = new DisposableGroup();

    this.disposables.add(material);
    this.disposables.add(mesh);
  }

  static async create(
    renderer: WebGPURenderer,
    scene: Scene,
    camera: PerspectiveCamera,
    config: Partial<OceanConfig> = {},
  ): Promise<OceanSystem> {
    const fullConfig: OceanConfig = {
      ...DEFAULT_OCEAN_CONFIG,
      ...config,
      waves: { ...DEFAULT_OCEAN_CONFIG.waves, ...config.waves },
      material: { ...DEFAULT_OCEAN_CONFIG.material, ...config.material },
    };

    const quality = getQualitySettings(fullConfig.quality);
    const segments = fullConfig.meshSegments ?? quality.meshSegments;

    const waves = new WaveEngine(fullConfig.waves);

    // Initialize FFT compute pipeline before creating the material
    // so the material can bind to the FFT output textures
    waves.initFFT(renderer, quality.fftSize);

    const material = new WaterMaterial(waves, fullConfig.material);
    const mesh = new WaterMesh(fullConfig.size, segments, material);

    scene.add(mesh.getObject());

    return new OceanSystem(
      renderer,
      scene,
      camera,
      fullConfig,
      waves,
      material,
      mesh,
    );
  }

  async update(deltaTime: number): Promise<void> {
    await this.waves.update(deltaTime);
  }

  setQuality(preset: QualityPreset): void {
    this.config.quality = preset;
  }

  setWaveConfig(config: Partial<WaveConfig>): void {
    Object.assign(this.config.waves, config);
    this.waves.setConfig(this.config.waves);
  }

  setMaterialConfig(config: Partial<WaterMaterialConfig>): void {
    Object.assign(this.config.material, config);
    this.material.setConfig(this.config.material);
  }

  getConfig(): Readonly<OceanConfig> {
    return this.config;
  }

  addToScene(scene: Scene): void {
    scene.add(this.mesh.getObject());
  }

  removeFromScene(scene: Scene): void {
    scene.remove(this.mesh.getObject());
  }

  dispose(): void {
    this.removeFromScene(this.scene);
    this.waves.dispose();
    this.disposables.dispose();
  }
}
