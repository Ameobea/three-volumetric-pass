import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import Stats from 'three/examples/jsm/libs/stats.module';
import GUI from 'lil-gui';

import { VolumetricPass, type VolumetricPassParams } from '../src/index';
import { EffectComposer, RenderPass } from 'postprocessing';

// You would import like this in your own project:
// import { VolumetricPass, type VolumetricPassParams } from 'three-volumetric-pass';

console.log('three.js version:', THREE.REVISION);

const canvas = document.createElement('canvas');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
canvas.style.backgroundColor = 'black';
document.body.appendChild(canvas);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
camera.near = 0.5;
camera.far = 50_000;
camera.updateProjectionMatrix();
camera.position.set(120, 200, 120);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});

const stats = new Stats();
stats.dom.style.position = 'absolute';
stats.dom.style.top = '0px';
document.body.appendChild(stats.dom);

const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });

const params: VolumetricPassParams = {
  fogDensityMultiplier: 0.086,
  fogMinY: -100,
  fogMaxY: 240,
  fogFadeOutRangeY: 70,
  fogFadeOutPow: 0.5,
  baseMaxRayLength: 1600,
  baseRaymarchStepCount: 280,
  maxRaymarchStepCount: 5000,
  noiseBias: 0.2,
  noisePow: 6,
  heightFogFactor: 0.1,
  heightFogStartY: 0,
  heightFogEndY: 190,
  halfRes: true,
  globalScale: 0.38,
  fogColorLowDensity: new THREE.Vector3(250 / 255, 132 / 255, 201 / 255),
  fogColorHighDensity: new THREE.Vector3(0.32, 0.35, 0.38),
  noiseMovementPerSecond: new THREE.Vector2(20.0, 20.0),
};
const volumetricPass = new VolumetricPass(scene, camera, params);

composer.addPass(new RenderPass(scene, camera));
composer.addPass(volumetricPass);

const gui = new GUI({
  width: window.innerWidth > 500 ? 400 : window.innerWidth - 12,
  title: '`three-volumetric-pass` Demo Controls',
});
gui.$title.innerHTML =
  '<a href="https://github.com/ameobea/three-volumetric-pass" style="color: #ccc" target="_blank"><code>three-volumetric-pass</code></a> Demo Controls';
const link = document.querySelector('.title a')! as HTMLAnchorElement;
// prevent link click from propagating to the title which causes the gui to close
link.addEventListener('click', e => e.stopPropagation());

const folder = gui.addFolder('VolumetricPass Params');

const colorVec3ToHexString = (vec3: THREE.Vector3) => {
  const color = new THREE.Color(vec3.x, vec3.y, vec3.z);
  return `#${color.getHexString()}`;
};

const internalParams = {
  noiseMovementPerSecondX: params.noiseMovementPerSecond!.x,
  noiseMovementPerSecondY: params.noiseMovementPerSecond!.y,
  fogColorLowDensity: colorVec3ToHexString(params.fogColorLowDensity!),
  fogColorHighDensity: colorVec3ToHexString(params.fogColorHighDensity!),
};

folder.add(params, 'fogDensityMultiplier').min(0).max(0.2);
folder.add(params, 'fogMinY', params.fogMinY).min(-100).max(1000);
folder.add(params, 'fogMaxY', params.fogMaxY).min(-100).max(1000);
folder.add(params, 'fogFadeOutRangeY', params.fogFadeOutRangeY).min(0).max(500);
folder.add(params, 'fogFadeOutPow').min(0.05).max(6);
folder.add(params, 'baseMaxRayLength').min(1).max(20_000);
folder.add(params, 'baseRaymarchStepCount').min(20).max(600);
folder.add(params, 'noiseBias').min(0).max(1);
folder.add(params, 'noisePow').min(0.1).max(12);
folder.add(params, 'heightFogFactor').min(0).max(1);
folder.add(params, 'heightFogStartY').min(-100).max(1000);
folder.add(params, 'heightFogEndY').min(-100).max(1000);
// folder.add(params, 'halfRes');
folder.add(params, 'globalScale').min(0.05).max(2);
folder
  .add(internalParams, 'noiseMovementPerSecondX')
  .min(-100)
  .max(100)
  .onChange(val => {
    params.noiseMovementPerSecond!.x = val;
  });
folder
  .add(internalParams, 'noiseMovementPerSecondY')
  .min(-100)
  .max(100)
  .onChange(val => {
    params.noiseMovementPerSecond!.y = val;
  });

folder.addColor(internalParams, 'fogColorLowDensity').onChange(val => {
  const color = new THREE.Color(val);
  params.fogColorLowDensity!.set(color.r, color.g, color.b);
});
folder.addColor(internalParams, 'fogColorHighDensity').onChange(val => {
  const color = new THREE.Color(val);
  params.fogColorHighDensity!.set(color.r, color.g, color.b);
});

const dirLight = new THREE.DirectionalLight(0xf5efd5, 1.2 * Math.PI);
dirLight.position.set(40, 24, 40);
scene.add(dirLight);

// Add a white sphere at the location of the light to indicate its position
const lightSphere = new THREE.Mesh(
  new THREE.SphereGeometry(0.5, 32, 32),
  new THREE.MeshBasicMaterial({ color: 0xffffff })
);
lightSphere.position.copy(dirLight.position);
scene.add(lightSphere);

const ambientLight = new THREE.AmbientLight(0xcccccc, 1.2 * Math.PI);
scene.add(ambientLight);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

THREE.ColorManagement.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

const clock = new THREE.Clock();
clock.start();

const animate = () => {
  composer.render();
  volumetricPass.setCurTimeSeconds(clock.getElapsedTime());
  controls.update();
  stats.update();
  requestAnimationFrame(animate);
};

window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  camera.aspect = canvas.width / canvas.height;
  camera.updateProjectionMatrix();
  renderer.setSize(canvas.width, canvas.height);
});

animate();
