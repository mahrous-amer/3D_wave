import {
  MeshPhysicalNodeMaterial,
  Color,
} from 'three/webgpu';
import {
  vec3,
  vec4,
  float,
  uniform,
  normalView,
  positionViewDirection,
  positionLocal,
  mix,
  max,
  dot,
  pow,
  normalize,
  cameraPosition,
  positionWorld,
  texture,
  uv,
} from 'three/tsl';
import type { WaveEngine } from '../waves/WaveEngine';
import type { WaterMaterialConfig } from '../core/OceanConfig';
import { DEFAULT_MATERIAL_CONFIG } from '../core/OceanConfig';
import { createFresnelNode } from './FresnelNode';
import { createDepthColorNode } from './DepthColorNode';

/**
 * Water surface material built on MeshPhysicalNodeMaterial with TSL nodes.
 *
 * Sets positionNode for Gerstner/FFT displacement and colorNode for
 * the full water surface appearance (Fresnel, depth color, SSS, foam).
 */
export class WaterMaterial {
  readonly material: MeshPhysicalNodeMaterial;

  private readonly shallowColorUniform: ReturnType<typeof uniform>;
  private readonly deepColorUniform: ReturnType<typeof uniform>;
  private readonly sssColorUniform: ReturnType<typeof uniform>;
  private readonly sssIntensityUniform: ReturnType<typeof uniform>;
  private readonly fresnelPowerUniform: ReturnType<typeof uniform>;
  private readonly opacityUniform: ReturnType<typeof uniform>;
  private readonly foamColorUniform: ReturnType<typeof uniform>;
  private readonly foamIntensityUniform: ReturnType<typeof uniform>;

  constructor(waves: WaveEngine, config?: Partial<WaterMaterialConfig>) {
    const cfg = { ...DEFAULT_MATERIAL_CONFIG, ...config };

    // Create uniforms
    this.shallowColorUniform = uniform(new Color(cfg.shallowColor));
    this.deepColorUniform = uniform(new Color(cfg.deepColor));
    this.sssColorUniform = uniform(new Color(cfg.sssColor));
    this.sssIntensityUniform = uniform(cfg.sssIntensity);
    this.fresnelPowerUniform = uniform(cfg.fresnelPower);
    this.opacityUniform = uniform(cfg.opacity);
    this.foamColorUniform = uniform(new Color(cfg.foamColor));
    this.foamIntensityUniform = uniform(cfg.foamIntensity);

    // Create material
    this.material = new MeshPhysicalNodeMaterial();
    this.material.transparent = true;
    this.material.side = 2; // DoubleSide

    // Position displacement: Gerstner + optional FFT
    const gerstnerDisp = waves.displacementNode();
    let totalDisp = gerstnerDisp;

    if (waves.hasFFT && waves.fftDisplacementTexture) {
      const fftDisp = texture(waves.fftDisplacementTexture, uv()).xyz;
      totalDisp = gerstnerDisp.add(fftDisp);
    }

    this.material.positionNode = positionLocal.add(totalDisp);

    // Normal: blend Gerstner + FFT normals
    if (waves.hasFFT && waves.fftNormalTexture) {
      const fftNorm = texture(waves.fftNormalTexture, uv()).xyz;
      const gerstnerNorm = waves.normalNode();
      this.material.normalNode = normalize(
        fftNorm.add(gerstnerNorm).sub(vec3(0, 1, 0)),
      );
    } else {
      this.material.normalNode = waves.normalNode();
    }

    // Color: Fresnel-blended shallow/deep + SSS + foam
    this.material.colorNode = this.buildColorNode(
      waves.hasFFT && waves.fftDisplacementTexture ? waves.fftDisplacementTexture : null,
    );

    // PBR properties for realistic water
    this.material.metalness = 0;
    this.material.roughness = 0.1;
    // Note: transmission is intentionally omitted -- it causes per-frame
    // framebuffer copies (copyFramebufferToTexture) which is expensive.
    // We handle refraction/transparency through our own colorNode instead.
  }

  private buildColorNode(fftDisplacementTexture: import('three/webgpu').StorageTexture | null = null) {
    const fresnelPower = this.fresnelPowerUniform;
    const shallowColor = this.shallowColorUniform;
    const deepColor = this.deepColorUniform;
    const sssColor = this.sssColorUniform;
    const sssIntensity = this.sssIntensityUniform;
    const opacity = this.opacityUniform;
    const foamColor = this.foamColorUniform;
    const foamIntensity = this.foamIntensityUniform;

    // Fresnel factor
    const viewDir = normalize(cameraPosition.sub(positionWorld));
    const normal = normalView;
    const cosTheta = max(dot(normal, positionViewDirection.negate()), 0.0);
    const fresnel = float(0.02).add(
      float(0.98).mul(pow(float(1.0).sub(cosTheta), fresnelPower)),
    );

    // Depth-based color
    const waterColor = mix(shallowColor, deepColor, fresnel);

    // SSS
    const sssFactor = pow(max(cosTheta, 0.0), 2.0).mul(sssIntensity);
    let finalColor = mix(waterColor, sssColor, sssFactor);

    // Foam: read from displacement texture w channel (Jacobian-based mask)
    if (fftDisplacementTexture) {
      const foamMask = texture(fftDisplacementTexture, uv()).w.mul(foamIntensity);
      finalColor = mix(finalColor, foamColor, foamMask) as typeof finalColor;
    }

    return vec4(finalColor, opacity);
  }

  setConfig(config: Partial<WaterMaterialConfig>): void {
    if (config.shallowColor !== undefined) {
      (this.shallowColorUniform.value as Color).set(config.shallowColor);
    }
    if (config.deepColor !== undefined) {
      (this.deepColorUniform.value as Color).set(config.deepColor);
    }
    if (config.sssColor !== undefined) {
      (this.sssColorUniform.value as Color).set(config.sssColor);
    }
    if (config.sssIntensity !== undefined) {
      this.sssIntensityUniform.value = config.sssIntensity;
    }
    if (config.fresnelPower !== undefined) {
      this.fresnelPowerUniform.value = config.fresnelPower;
    }
    if (config.opacity !== undefined) {
      this.opacityUniform.value = config.opacity;
    }
    if (config.foamColor !== undefined) {
      (this.foamColorUniform.value as Color).set(config.foamColor);
    }
    if (config.foamIntensity !== undefined) {
      this.foamIntensityUniform.value = config.foamIntensity;
    }
  }

  dispose(): void {
    this.material.dispose();
  }
}
