import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
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
camera.position.set(120, 200, 120);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});

const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });

const params: VolumetricPassParams = {
  fogMinY: -100,
  fogMaxY: 40,
  fogFadeOutRangeY: 40,
  fogFadeOutPow: 1,
  maxRayLength: 1000,
  baseRaymarchStepCount: 180,
  noisePow: 8,
  halfRes: true,
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

const dirLight = new THREE.DirectionalLight(0xf5efd5, 1.2 * Math.PI);
dirLight.position.set(40, 24, 40);
scene.add(dirLight);

// Add a white sphere at the location of the light to indicate its position
const lightSphere = new THREE.Mesh(
  new THREE.SphereGeometry(0.5, 32, 32),
  new THREE.MeshBasicMaterial({ color: 0xffffff })
);
lightSphere.castShadow = false;
lightSphere.receiveShadow = false;
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

const animate = () => {
  composer.render();
  controls.update();
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
