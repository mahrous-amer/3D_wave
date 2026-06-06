import {
  Mesh,
  PlaneGeometry,
} from 'three/webgpu';
import type { WaterMaterial } from '../material/WaterMaterial';

/**
 * Water mesh: a PlaneGeometry with sufficient segments for wave displacement.
 * Phase 1: simple plane. Phase 6: will be replaced by ClipmapGeometry.
 */
export class WaterMesh {
  private readonly mesh: Mesh;
  private readonly geometry: PlaneGeometry;

  constructor(size: number, segments: number, waterMaterial: WaterMaterial) {
    this.geometry = new PlaneGeometry(size, size, segments, segments);
    this.geometry.rotateX(-Math.PI / 2); // Lay flat on XZ plane

    this.mesh = new Mesh(this.geometry, waterMaterial.material);
    this.mesh.frustumCulled = false; // Water should always render
  }

  getObject(): Mesh {
    return this.mesh;
  }

  setSize(size: number, segments: number): void {
    this.geometry.dispose();
    const newGeometry = new PlaneGeometry(size, size, segments, segments);
    newGeometry.rotateX(-Math.PI / 2);
    this.mesh.geometry = newGeometry;
  }

  dispose(): void {
    this.geometry.dispose();
  }
}
