import {
  Fn,
  float,
  vec3,
  vec4,
  mix,
  smoothstep,
  uniform,
} from 'three/tsl';
import { Color } from 'three';

/**
 * Creates a TSL node that blends between shallow and deep water colors
 * based on a depth/fresnel factor.
 */
export function createDepthColorNode(
  shallowColorUniform: ReturnType<typeof uniform>,
  deepColorUniform: ReturnType<typeof uniform>,
) {
  const depthColorNode = Fn(([depthFactor]: any[]) => {
    const blended = mix(
      shallowColorUniform,
      deepColorUniform,
      smoothstep(0.0, 1.0, depthFactor),
    );
    return blended;
  });

  return depthColorNode;
}
