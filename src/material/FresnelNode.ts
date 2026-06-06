import {
  Fn,
  float,
  vec3,
  dot,
  max,
  pow,
  normalView,
  positionViewDirection,
} from 'three/tsl';

/**
 * Schlick's Fresnel approximation TSL node.
 *
 * F = R0 + (1 - R0) * (1 - cos(theta))^power
 *
 * Where theta is the angle between view direction and surface normal.
 * R0 for water (IOR ~1.333) is approximately 0.02.
 */
export function createFresnelNode(
  fresnelPower: ReturnType<typeof float>,
  r0: number = 0.02,
) {
  const fresnelNode = Fn(([normal, viewDir]: any[]) => {
    const cosTheta = max(dot(normal, viewDir), 0.0);
    const fresnel = float(r0).add(
      float(1.0 - r0).mul(pow(float(1.0).sub(cosTheta), fresnelPower)),
    );
    return fresnel;
  });

  return fresnelNode;
}
