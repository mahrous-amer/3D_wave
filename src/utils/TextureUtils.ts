import {
  DataTexture,
  FloatType,
  RGBAFormat,
  NearestFilter,
  RepeatWrapping,
} from 'three';

/**
 * Create a DataTexture from a Float32Array (RGBA, float32).
 * Used for uploading CPU-computed data (h0 spectrum, butterfly LUT) to GPU.
 */
export function createFloat32Texture(
  data: Float32Array,
  width: number,
  height: number,
): DataTexture {
  const texture = new DataTexture(data, width, height, RGBAFormat, FloatType);
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Create an empty Float32 DataTexture of given dimensions.
 */
export function createEmptyFloat32Texture(width: number, height: number): DataTexture {
  const data = new Float32Array(width * height * 4);
  return createFloat32Texture(data, width, height);
}
