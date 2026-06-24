import {
  StorageTexture,
  DataTexture,
} from 'three/webgpu';
import { HalfFloatType, LinearFilter } from 'three';
import {
  Fn,
  float,
  int,
  uint,
  vec4,
  uniform,
  textureLoad,
  textureStore,
  instanceIndex,
  uvec2,
  sin,
  cos,
  sqrt,
  clamp,
} from 'three/tsl';
import type { WebGPURenderer } from 'three/webgpu';
import { GRAVITY, TWO_PI } from '../../core/constants';
import { SpectrumGenerator } from './SpectrumGenerator';

/**
 * GPU-accelerated FFT ocean simulation using Three.js TSL compute shaders.
 *
 * Uses a radix-2 Cooley-Tukey DIT FFT with pre-built ping-pong compute nodes
 * for each stage. Each stage reads from one texture and writes to another,
 * with even stages going A->B and odd stages B->A.
 *
 * Pipeline per frame:
 *   1. Time evolution: h0(k) -> h(k,t) for height, Dx, Dz components
 *   2. 2D IFFT for each component (horizontal then vertical passes)
 *   3. Assemble displacement vector and compute normals
 *
 * Outputs readable by materials:
 *   - displacementTexture: vec4(dx, dy, dz, 0) in spatial domain
 *   - normalTexture: vec4(nx, ny, nz, 0) surface normals
 */
export class FFTCompute {
  readonly size: number;
  readonly lengthScale: number;

  readonly displacementTexture: StorageTexture;
  readonly normalTexture: StorageTexture;

  private readonly renderer: WebGPURenderer;
  private h0Texture: DataTexture;

  // 3 pairs of ping-pong textures, one per displacement component (Dy, Dx, Dz)
  private readonly bufA: StorageTexture[] = [];
  private readonly bufB: StorageTexture[] = [];

  private readonly timeUniform = uniform(0);
  private readonly choppinessUniform: ReturnType<typeof uniform>;

  // Pre-built compute nodes
  private timeEvolutionNode: any;
  // [component][stage] - separate nodes for horizontal and vertical passes
  private hPassNodes: any[][] = [[], [], []]; // 3 components
  private vPassNodes: any[][] = [[], [], []];
  private assembleNode: any;

  private spectrumGenerator: SpectrumGenerator;
  private readonly logN: number;

  constructor(
    renderer: WebGPURenderer,
    size: number,
    lengthScale: number,
    choppiness: number = 1.0,
  ) {
    this.renderer = renderer;
    this.size = size;
    this.lengthScale = lengthScale;
    this.logN = Math.log2(size);
    this.choppinessUniform = uniform(choppiness);

    this.spectrumGenerator = new SpectrumGenerator(size, lengthScale);

    // 3 component pairs (Dy, Dx, Dz) each with ping-pong textures
    for (let i = 0; i < 3; i++) {
      const a = new StorageTexture(size, size);
      a.type = HalfFloatType;
      this.bufA.push(a);
      const b = new StorageTexture(size, size);
      b.type = HalfFloatType;
      this.bufB.push(b);
    }

    this.displacementTexture = new StorageTexture(size, size);
    this.displacementTexture.type = HalfFloatType;
    this.displacementTexture.minFilter = LinearFilter;
    this.displacementTexture.magFilter = LinearFilter;

    this.normalTexture = new StorageTexture(size, size);
    this.normalTexture.type = HalfFloatType;
    this.normalTexture.minFilter = LinearFilter;
    this.normalTexture.magFilter = LinearFilter;

    this.h0Texture = this.spectrumGenerator.generate({
      windSpeed: 10,
      windDirection: 0,
    });

    this.buildAllNodes();
  }

  regenerateSpectrum(windSpeed: number, windDirection: number, seed?: number): void {
    this.h0Texture.dispose();
    this.h0Texture = this.spectrumGenerator.generate(
      { windSpeed, windDirection },
      seed,
    );
    this.buildTimeEvolutionNode();
  }

  setChoppiness(value: number): void {
    this.choppinessUniform.value = value;
  }

  async compute(time: number): Promise<void> {
    this.timeUniform.value = time;

    // Collect all passes into one array for a single GPU submission
    const nodes: any[] = [this.timeEvolutionNode];

    for (let comp = 0; comp < 3; comp++) {
      for (let stage = 0; stage < this.logN; stage++) {
        nodes.push(this.hPassNodes[comp][stage]);
      }
      for (let stage = 0; stage < this.logN; stage++) {
        nodes.push(this.vPassNodes[comp][stage]);
      }
    }

    nodes.push(this.assembleNode);

    await this.renderer.computeAsync(nodes);
  }

  private buildAllNodes(): void {
    this.buildTimeEvolutionNode();
    this.buildIFFTNodes();
    this.buildAssembleNode();
  }

  private buildTimeEvolutionNode(): void {
    const N = this.size;
    const h0Tex = this.h0Texture;
    const outDy = this.bufA[0];
    const outDx = this.bufA[1];
    const outDz = this.bufA[2];
    const timeU = this.timeUniform;
    const L = this.lengthScale;

    const fn = Fn(() => {
      const idx = int(instanceIndex);
      const x = idx.modInt(N);
      const y = idx.div(N);
      const coord = uvec2(uint(x), uint(y));

      const h0Data = textureLoad(h0Tex, coord, int(0));
      const h0R = h0Data.x;
      const h0I = h0Data.y;
      const h0cR = h0Data.z;
      const h0cI = h0Data.w;

      // Wave vector
      const halfN = float(N).mul(0.5);
      const kx = float(x).sub(halfN).mul(TWO_PI).div(L);
      const kz = float(y).sub(halfN).mul(TWO_PI).div(L);
      const kLen = sqrt(kx.mul(kx).add(kz.mul(kz))).max(0.0001);

      // Dispersion: omega = sqrt(g * |k|)
      const omega = sqrt(float(GRAVITY).mul(kLen));
      const phase = omega.mul(timeU);
      const cP = cos(phase);
      const sP = sin(phase);

      // h(k,t) = h0 * exp(i*omega*t) + h0conj * exp(-i*omega*t)
      const htR = h0R.mul(cP).sub(h0I.mul(sP)).add(h0cR.mul(cP)).add(h0cI.mul(sP));
      const htI = h0R.mul(sP).add(h0I.mul(cP)).sub(h0cR.mul(sP)).add(h0cI.mul(cP));

      // Dy (height)
      textureStore(outDy, coord, vec4(htR, htI, 0, 0)).toWriteOnly();

      // Dx: multiply by -i * kx/|k|  =>  (htI*kx/|k|, -htR*kx/|k|)
      const kxN = kx.div(kLen);
      textureStore(outDx, coord, vec4(htI.mul(kxN), htR.negate().mul(kxN), 0, 0)).toWriteOnly();

      // Dz: multiply by -i * kz/|k|
      const kzN = kz.div(kLen);
      textureStore(outDz, coord, vec4(htI.mul(kzN), htR.negate().mul(kzN), 0, 0)).toWriteOnly();
    });

    this.timeEvolutionNode = fn().compute(N * N);
  }

  private buildIFFTNodes(): void {
    const N = this.size;

    for (let comp = 0; comp < 3; comp++) {
      this.hPassNodes[comp] = [];
      this.vPassNodes[comp] = [];

      for (let stage = 0; stage < this.logN; stage++) {
        const readTex = stage % 2 === 0 ? this.bufA[comp] : this.bufB[comp];
        const writeTex = stage % 2 === 0 ? this.bufB[comp] : this.bufA[comp];

        this.hPassNodes[comp].push(
          this.buildButterflyNode(readTex, writeTex, stage, 0, N),
        );
      }

      // After horizontal passes, result is in bufA or bufB depending on logN parity
      const hResult = this.logN % 2 === 0 ? this.bufA[comp] : this.bufB[comp];
      const hOther = this.logN % 2 === 0 ? this.bufB[comp] : this.bufA[comp];

      for (let stage = 0; stage < this.logN; stage++) {
        const readTex = stage % 2 === 0 ? hResult : hOther;
        const writeTex = stage % 2 === 0 ? hOther : hResult;

        this.vPassNodes[comp].push(
          this.buildButterflyNode(readTex, writeTex, stage, 1, N),
        );
      }
    }
  }

  /**
   * Build a single butterfly pass compute node.
   */
  private buildButterflyNode(
    readTex: StorageTexture,
    writeTex: StorageTexture,
    stage: number,
    direction: number, // 0=horizontal, 1=vertical
    N: number,
  ): any {
    const butterflySpan = 1 << (stage + 1);
    const halfSpan = 1 << stage;

    const fn = Fn(() => {
      const idx = int(instanceIndex);
      const x = idx.modInt(N);
      const y = idx.div(N);

      // Butterfly index depends on pass direction
      const bIdx = direction === 0 ? x : y;

      // Position within butterfly group
      const posInGroup = bIdx.modInt(butterflySpan);
      const isBottom = posInGroup.greaterThanEqual(halfSpan);

      // Source indices
      const withinHalf = posInGroup.modInt(halfSpan);
      const groupStart = bIdx.sub(posInGroup);
      const topSrcIdx = groupStart.add(withinHalf);
      const botSrcIdx = topSrcIdx.add(halfSpan);

      // Twiddle factor for IFFT (positive exponent)
      const twiddleK = float(withinHalf).mul(N / butterflySpan);
      const angle = float(TWO_PI).mul(twiddleK).div(N);
      const twR = cos(angle);
      const twI = sin(angle);

      // Load source elements
      const topCoord = direction === 0
        ? uvec2(uint(topSrcIdx), uint(y))
        : uvec2(uint(x), uint(topSrcIdx));
      const botCoord = direction === 0
        ? uvec2(uint(botSrcIdx), uint(y))
        : uvec2(uint(x), uint(botSrcIdx));

      const topVal = textureLoad(readTex, topCoord, int(0));
      const botVal = textureLoad(readTex, botCoord, int(0));

      // Complex multiply: twiddle * bottom
      const tBR = twR.mul(botVal.x).sub(twI.mul(botVal.y));
      const tBI = twR.mul(botVal.y).add(twI.mul(botVal.x));

      // Butterfly: top +/- tw*bot
      const sign = isBottom.select(float(-1), float(1));
      const outR = topVal.x.add(tBR.mul(sign));
      const outI = topVal.y.add(tBI.mul(sign));

      const outCoord = uvec2(uint(x), uint(y));
      textureStore(writeTex, outCoord, vec4(outR, outI, 0, 0)).toWriteOnly();
    });

    return fn().compute(N * N);
  }

  private buildAssembleNode(): void {
    const N = this.size;
    const L = this.lengthScale;
    const dispTex = this.displacementTexture;
    const normTex = this.normalTexture;
    const chop = this.choppinessUniform;

    const dyFinal = this.bufA[0];
    const dxFinal = this.bufA[1];
    const dzFinal = this.bufA[2];

    // Grid spacing: each texel covers L/N metres in world space
    const texelScale = N / L;

    const fn = Fn(() => {
      const idx = int(instanceIndex);
      const x = idx.modInt(N);
      const y = idx.div(N);
      const coord = uvec2(uint(x), uint(y));

      const dyRaw = textureLoad(dyFinal, coord, int(0)).x;
      const dxRaw = textureLoad(dxFinal, coord, int(0)).x;
      const dzRaw = textureLoad(dzFinal, coord, int(0)).x;

      // Sign correction for centered spectrum (fftshift): (-1)^(x+y)
      const parity = float(x.add(y).modInt(2));
      const sign = float(1).sub(parity.mul(2));

      const dy = dyRaw.mul(sign).div(N * N);
      const dx = dxRaw.mul(sign).mul(chop).div(N * N);
      const dz = dzRaw.mul(sign).mul(chop).div(N * N);

      // Jacobian of horizontal displacement field for foam detection.
      // J = (1 + dDx/dx)(1 + dDz/dz) - dDx/dz * dDz/dx
      // Foam appears where J < threshold (wave crest folding).
      const xp1 = x.add(1).modInt(N);
      const yp1 = y.add(1).modInt(N);
      const xm1 = x.add(N - 1).modInt(N);
      const ym1 = y.add(N - 1).modInt(N);

      const parityXp = float(xp1.add(y).modInt(2));
      const parityXm = float(xm1.add(y).modInt(2));
      const parityYp = float(x.add(yp1).modInt(2));
      const parityYm = float(x.add(ym1).modInt(2));

      const dxXp = textureLoad(dxFinal, uvec2(uint(xp1), uint(y)), int(0)).x.mul(float(1).sub(parityXp.mul(2))).mul(chop).div(N * N);
      const dxXm = textureLoad(dxFinal, uvec2(uint(xm1), uint(y)), int(0)).x.mul(float(1).sub(parityXm.mul(2))).mul(chop).div(N * N);
      const dzYp = textureLoad(dzFinal, uvec2(uint(x), uint(yp1)), int(0)).x.mul(float(1).sub(parityYp.mul(2))).mul(chop).div(N * N);
      const dzYm = textureLoad(dzFinal, uvec2(uint(x), uint(ym1)), int(0)).x.mul(float(1).sub(parityYm.mul(2))).mul(chop).div(N * N);
      const dxYp = textureLoad(dxFinal, uvec2(uint(x), uint(yp1)), int(0)).x.mul(float(1).sub(parityYp.mul(2))).mul(chop).div(N * N);
      const dxYm = textureLoad(dxFinal, uvec2(uint(x), uint(ym1)), int(0)).x.mul(float(1).sub(parityYm.mul(2))).mul(chop).div(N * N);
      const dzXp = textureLoad(dzFinal, uvec2(uint(xp1), uint(y)), int(0)).x.mul(float(1).sub(parityXp.mul(2))).mul(chop).div(N * N);
      const dzXm = textureLoad(dzFinal, uvec2(uint(xm1), uint(y)), int(0)).x.mul(float(1).sub(parityXm.mul(2))).mul(chop).div(N * N);

      const dDxdx = dxXp.sub(dxXm).mul(texelScale * 0.5);
      const dDzdz = dzYp.sub(dzYm).mul(texelScale * 0.5);
      const dDxdz = dxYp.sub(dxYm).mul(texelScale * 0.5);
      const dDzdx = dzXp.sub(dzXm).mul(texelScale * 0.5);

      const Jxx = float(1).add(dDxdx);
      const Jzz = float(1).add(dDzdz);
      const J = Jxx.mul(Jzz).sub(dDxdz.mul(dDzdx));

      // Store foam factor in w channel: saturate(1 - J) clamped to [0,1]
      const foam = clamp(float(1).sub(J), float(0), float(1));

      textureStore(dispTex, coord, vec4(dx, dy, dz, foam)).toWriteOnly();

      // Normals from finite differences
      const rCoord = uvec2(uint(xp1), uint(y));
      const uCoord = uvec2(uint(x), uint(yp1));

      const parityR = float(xp1.add(y).modInt(2));
      const signR = float(1).sub(parityR.mul(2));
      const parityU = float(x.add(yp1).modInt(2));
      const signU = float(1).sub(parityU.mul(2));

      const dyR = textureLoad(dyFinal, rCoord, int(0)).x.mul(signR).div(N * N);
      const dyU = textureLoad(dyFinal, uCoord, int(0)).x.mul(signU).div(N * N);

      const dydx = dyR.sub(dy).mul(texelScale);
      const dydz = dyU.sub(dy).mul(texelScale);

      const nx = dydx.negate();
      const ny = float(1.0);
      const nz = dydz.negate();
      const len = sqrt(nx.mul(nx).add(ny.mul(ny)).add(nz.mul(nz)));

      textureStore(normTex, coord, vec4(nx.div(len), ny.div(len), nz.div(len), 0)).toWriteOnly();
    });

    this.assembleNode = fn().compute(N * N);
  }

  dispose(): void {
    this.h0Texture.dispose();
    for (let i = 0; i < 3; i++) {
      this.bufA[i].dispose();
      this.bufB[i].dispose();
    }
    this.displacementTexture.dispose();
    this.normalTexture.dispose();
  }
}
