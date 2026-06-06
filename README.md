# 3D Wave

An ocean for Three.js. Mostly the kind you get when you want big rolling swell *and* tiny chop on top, without writing the FFT plumbing yourself.

Runs on WebGPU through Three's `three/webgpu` build, with the wave field synthesized on the GPU via TSL compute shaders. Wraps a JONSWAP spectrum + IFFT for the small-scale detail, and stacks a handful of Gerstner waves on top for the long-wavelength stuff you can actually steer a boat through.

> Status: early days. The API works and the demo runs, but expect things to move around between 0.x versions.

## What it does

- FFT ocean built from a JONSWAP spectrum, evaluated each frame in compute shaders.
- A small bank of Gerstner waves layered on top for art-directed swell.
- A water material with Fresnel, depth-based color, sub-surface tint, foam and sun sparkle.
- A `getHeightAt(x, z)` query on the CPU side so you can float things on the surface (uses the Gerstner waves, not the FFT — fast and good enough for buoyancy).
- Quality presets from `low` to `ultra` that swap the FFT grid size, the mesh tessellation, and which post-effects are on.

## What you need

- A browser with WebGPU. Chrome and Edge are fine on desktop; Safari Technology Preview also works. WebGL-only browsers are not supported right now.
- Three.js `>= 0.181.0` (peer dependency).
- Node 18+ if you want to build it from source.

## Install

This is not on npm yet. Clone the repo and link it, or point your `package.json` at a tarball.

```bash
git clone git@github.com:mahrous-amer/3D_wave.git
cd 3D_wave
npm install
npm run build
```

## Try the demo

```bash
npm run dev
```

Opens a Vite dev server. You'll get an ocean and a `lil-gui` panel on the right with the wind, the Gerstner waves, and the material parameters.

## Use it in your scene

The whole thing hangs off a single `OceanSystem.create(...)` call. You give it your renderer, scene and camera, and it adds a water plane to the scene.

```ts
import * as THREE from 'three/webgpu';
import { OceanSystem } from '3d-wave';

const renderer = new THREE.WebGPURenderer({ antialias: true });
await renderer.init();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.5, 10000);

const ocean = await OceanSystem.create(renderer, scene, camera, {
  size: 500,
  quality: 'high',
  waves: {
    windSpeed: 12,
    windDirection: 0.3,
    choppiness: 1.2,
  },
});

const clock = new THREE.Clock();
async function frame() {
  requestAnimationFrame(frame);
  await ocean.update(clock.getDelta());
  renderer.render(scene, camera);
}
frame();
```

Tweak things at runtime:

```ts
ocean.setWaveConfig({ windSpeed: 18, choppiness: 1.8 });
ocean.setMaterialConfig({ shallowColor: '#0fa', foamIntensity: 1.0 });
```

Throw away when you're done:

```ts
ocean.dispose();
```

### Floating something on the surface

```ts
const y = ocean.waves.getHeightAt(boat.position.x, boat.position.z);
boat.position.y = y;
```

This only uses the Gerstner waves — those exist on the CPU. The FFT field lives on the GPU and isn't read back. For most boats, buoys, and debris that's the right trade.

## Quality presets

| preset  | FFT grid | mesh segs | foam | SSS | reflections | refraction | caustics |
|---------|----------|-----------|------|-----|-------------|------------|----------|
| low     | 128      | 128       |      |     |             |            |          |
| medium  | 256      | 256       | yes  |     |             |            |          |
| high    | 256      | 256       | yes  | yes | yes         | yes        | yes      |
| ultra   | 512      | 512       | yes  | yes | yes         | yes        | yes      |

If you want to override individual bits (e.g. keep `high` but bump the mesh density), pass `meshSegments` on the config.

## How it's put together

```
src/
  core/          OceanSystem, config, quality presets, shared constants
  waves/
    fft/         JONSWAP spectrum, butterfly LUT, the actual compute IFFT
    gerstner/    Gerstner wave bank (CPU evaluator + TSL node)
    spectra/     wave spectra, directional spreading
  material/      WaterMaterial, Fresnel and depth-color nodes
  mesh/          WaterMesh wrapper
  utils/         disposables, RNG, texture helpers, backend detection
```

The FFT side is a radix-2 Cooley-Tukey IFFT in compute, ping-ponging between two storage textures across `log2(N)` stages. Three components — height, horizontal X displacement, horizontal Z displacement — are inverted in parallel, then assembled into a displacement texture and a normal texture that the water material samples.

The Gerstner waves are packed into a `uniformArray` (two `vec4` per wave) and evaluated in the vertex stage. The CPU side runs the same math so heights you read out match what you see on screen, up to FFT contribution.

## Building

```bash
npm run build         # library bundle into dist/
npm run build:demo    # demo build into dist-demo/
npm run typecheck
```

## Roadmap-ish

Things I want to get to, in no particular order:

- WebGL2 fallback path (the TSL nodes will compile, the compute shaders won't — needs a transform-feedback or RTT path for the IFFT).
- Wakes / interaction from moving objects.
- Asynchronous GPU readback so buoyancy can use the full FFT field on objects that need it.
- A proper docs site rather than just this README.

## License

MIT. See `LICENSE`.
