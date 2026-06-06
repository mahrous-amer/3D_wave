import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';
import { OceanSystem } from 'three-ocean';

async function main() {
  // Renderer
  const renderer = new THREE.WebGPURenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  document.body.appendChild(renderer.domElement);
  await renderer.init();

  // Scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb); // Sky blue

  // Camera
  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.5,
    10000,
  );
  camera.position.set(60, 30, 60);

  // Controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.target.set(0, 0, 0);

  // Lights
  const sunLight = new THREE.DirectionalLight(0xfff5e6, 2.0);
  sunLight.position.set(100, 80, 50);
  scene.add(sunLight);

  const ambientLight = new THREE.AmbientLight(0x446688, 0.5);
  scene.add(ambientLight);

  // Hemisphere light for sky-ground gradient
  const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x0a3d6b, 0.4);
  scene.add(hemiLight);

  // Ocean
  const ocean = await OceanSystem.create(renderer, scene, camera, {
    size: 500,
    quality: 'high',
  });

  // GUI
  const gui = new GUI({ title: 'three-ocean' });

  // FFT controls
  const fftFolder = gui.addFolder('FFT Ocean');
  const fftParams = {
    windSpeed: 10,
    windDirection: 0,
    choppiness: 1.0,
    animationSpeed: 1.0,
  };
  fftFolder.add(fftParams, 'windSpeed', 1, 30, 0.5).name('Wind Speed (m/s)').onChange((v: number) => {
    ocean.setWaveConfig({ windSpeed: v });
  });
  fftFolder.add(fftParams, 'windDirection', -Math.PI, Math.PI, 0.01).name('Wind Direction').onChange((v: number) => {
    ocean.setWaveConfig({ windDirection: v });
  });
  fftFolder.add(fftParams, 'choppiness', 0, 3.0, 0.05).name('Choppiness').onChange((v: number) => {
    ocean.setWaveConfig({ choppiness: v });
  });
  fftFolder.add(fftParams, 'animationSpeed', 0.1, 5.0).name('Animation Speed').onChange((v: number) => {
    ocean.setWaveConfig({ animationSpeed: v });
  });

  // Gerstner wave controls
  const waveFolder = gui.addFolder('Gerstner Waves');
  const config = ocean.getConfig();
  const waves = [...config.waves.gerstnerWaves];
  for (let i = 0; i < Math.min(waves.length, 4); i++) {
    const folder = waveFolder.addFolder(`Wave ${i + 1}`);
    folder.add(waves[i], 'amplitude', 0, 3.0, 0.01).onChange(() => {
      ocean.setWaveConfig({ gerstnerWaves: waves });
    });
    folder.add(waves[i], 'wavelength', 2, 200, 1).onChange(() => {
      ocean.setWaveConfig({ gerstnerWaves: waves });
    });
    folder.add(waves[i], 'steepness', 0, 2.0, 0.01).onChange(() => {
      ocean.setWaveConfig({ gerstnerWaves: waves });
    });
    folder.add(waves[i], 'direction', -Math.PI, Math.PI, 0.01).name('direction (rad)').onChange(() => {
      ocean.setWaveConfig({ gerstnerWaves: waves });
    });
    folder.add(waves[i], 'speed', 0.1, 3.0, 0.01).onChange(() => {
      ocean.setWaveConfig({ gerstnerWaves: waves });
    });
    folder.close();
  }
  waveFolder.close();

  const materialFolder = gui.addFolder('Material');
  const matParams = { ...config.material };
  materialFolder.addColor(matParams, 'shallowColor').onChange((v: string) => {
    ocean.setMaterialConfig({ shallowColor: v });
  });
  materialFolder.addColor(matParams, 'deepColor').onChange((v: string) => {
    ocean.setMaterialConfig({ deepColor: v });
  });
  materialFolder.addColor(matParams, 'sssColor').onChange((v: string) => {
    ocean.setMaterialConfig({ sssColor: v });
  });
  materialFolder.add(matParams, 'sssIntensity', 0, 1, 0.01).onChange((v: number) => {
    ocean.setMaterialConfig({ sssIntensity: v });
  });
  materialFolder.add(matParams, 'fresnelPower', 1, 10, 0.1).onChange((v: number) => {
    ocean.setMaterialConfig({ fresnelPower: v });
  });
  materialFolder.add(matParams, 'opacity', 0, 1, 0.01).onChange((v: number) => {
    ocean.setMaterialConfig({ opacity: v });
  });
  materialFolder.close();

  // Resize handler
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Compile shaders
  await renderer.compileAsync(scene, camera);

  // Animation loop
  const clock = new THREE.Clock();

  async function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    controls.update();
    await ocean.update(dt);
    renderer.render(scene, camera);
  }

  animate();
}

main().catch(console.error);
