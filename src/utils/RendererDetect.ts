/**
 * Detect whether the current renderer is using WebGPU or WebGL2 backend.
 */
export type RenderBackend = 'webgpu' | 'webgl2';

export function detectBackend(renderer: any): RenderBackend {
  // WebGPURenderer in Three.js will have a backend property
  if (renderer.backend?.isWebGPUBackend) {
    return 'webgpu';
  }
  return 'webgl2';
}

export async function isWebGPUAvailable(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  if (!('gpu' in navigator)) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}
