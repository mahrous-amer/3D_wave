import {
  Fn,
  vec3,
  float,
  Loop,
  uniform,
  uniformArray,
  sin,
  cos,
  positionLocal,
} from 'three/tsl';
import { GRAVITY } from '../../core/constants';

/**
 * Creates the TSL position displacement node for Gerstner waves.
 *
 * Gerstner wave equation:
 *   x' = x + sum( steepness * A * dx * sin(dot(D, [x,z]) * k + omega * t) )
 *   y' = sum( A * cos(dot(D, [x,z]) * k + omega * t) )
 *   z' = z + sum( steepness * A * dz * sin(dot(D, [x,z]) * k + omega * t) )
 *
 * No artificial clamping on steepness -- full artistic control.
 */
export function createGerstnerDisplacementNode(
  waveDataUniform: ReturnType<typeof uniformArray>,
  waveCountUniform: ReturnType<typeof uniform>,
  timeUniform: ReturnType<typeof uniform>,
) {
  const gerstnerDisplacement = Fn(() => {
    const pos = positionLocal.toVar();
    const displacement = vec3(0, 0, 0).toVar();

    Loop(waveCountUniform, ({ i }: any) => {
      const baseIdx = i.mul(2); // 2 vec4s per wave (8 floats = 2 x vec4)
      const data0 = waveDataUniform.element(baseIdx);  // dirX, dirZ, amplitude, frequency
      const data1 = waveDataUniform.element(baseIdx.add(1)); // steepness, speed, pad, pad

      const dirX = data0.x;
      const dirZ = data0.y;
      const amplitude = data0.z;
      const frequency = data0.w;

      const steepness = data1.x;
      const speed = data1.y;

      // Phase: dot(D, P) * k + omega * t * speed
      // Since frequency = omega = sqrt(g*k), and we use frequency directly in the sin/cos,
      // we need to derive k from frequency: k = omega^2 / g
      // But it's simpler: phase = (dirX*x + dirZ*z) * k + omega * t
      // where k = omega^2 / g
      const omega = frequency;
      const k = omega.mul(omega).div(GRAVITY);
      const phase = dirX.mul(pos.x).add(dirZ.mul(pos.z)).mul(k).add(omega.mul(timeUniform).mul(speed));

      const sinPhase = sin(phase);
      const cosPhase = cos(phase);

      // Gerstner displacement (no clamping on steepness)
      displacement.x.addAssign(steepness.mul(amplitude).mul(dirX).mul(sinPhase));
      displacement.y.addAssign(amplitude.mul(cosPhase));
      displacement.z.addAssign(steepness.mul(amplitude).mul(dirZ).mul(sinPhase));
    });

    return displacement;
  });

  return gerstnerDisplacement;
}

/**
 * Creates the TSL normal computation node from Gerstner waves.
 * Analytically derived from the displacement equations.
 */
export function createGerstnerNormalNode(
  waveDataUniform: ReturnType<typeof uniformArray>,
  waveCountUniform: ReturnType<typeof uniform>,
  timeUniform: ReturnType<typeof uniform>,
) {
  const gerstnerNormal = Fn(() => {
    const pos = positionLocal.toVar();
    const normal = vec3(0, 1, 0).toVar();

    Loop(waveCountUniform, ({ i }: any) => {
      const baseIdx = i.mul(2);
      const data0 = waveDataUniform.element(baseIdx);
      const data1 = waveDataUniform.element(baseIdx.add(1));

      const dirX = data0.x;
      const dirZ = data0.y;
      const amplitude = data0.z;
      const frequency = data0.w;
      const steepness = data1.x;
      const speed = data1.y;

      const omega = frequency;
      const k = omega.mul(omega).div(GRAVITY);
      const phase = dirX.mul(pos.x).add(dirZ.mul(pos.z)).mul(k).add(omega.mul(timeUniform).mul(speed));

      const sinPhase = sin(phase);
      const cosPhase = cos(phase);

      // Partial derivatives for normal computation
      normal.x.subAssign(dirX.mul(amplitude).mul(k).mul(steepness).mul(cosPhase));
      normal.y.subAssign(steepness.mul(amplitude).mul(k).mul(sinPhase));
      normal.z.subAssign(dirZ.mul(amplitude).mul(k).mul(steepness).mul(cosPhase));
    });

    return normal.normalize();
  });

  return gerstnerNormal;
}
