# three-volumetric-pass

[![npm version](https://img.shields.io/npm/v/three-hex-tiling.svg?style=flat-square)](https://www.npmjs.com/package/three-hex-tiling)
[![twitter](https://flat.badgen.net/badge/twitter/@ameobea10/?icon&label)](https://twitter.com/ameobea10)

An implementation of raymarched screen space volumetrics in Three.JS, compatible with the [pmndrs `postprocessing` library](https://github.com/pmndrs/postprocessing).

Useful for adding clouds, fog, and other volumetric effects to your Three.JS scenes.

Interactive Demo: <https://three-volumetric-pass.ameo.design/>

## Installation + Usage

`npm install three-volumetric-pass postprocessing`

```ts
import { EffectComposer, RenderPass } from 'postprocessing';
import { VolumetricPass } from 'three-volumetric-pass';

const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });

composer.addPass(new RenderPass(scene, camera));
const volumetricPass = new VolumetricPass(scene, camera, {
  halfRes: true,
  // other params go here
});

const animate = () => {
  composer.render();
  animate();
};

animate();
```

## Credits

Several parts of the core shader implementation were inspired by this "Clouds" ShaderToy demo by [Inigo Quilez](https://iquilezles.org/): <https://www.shadertoy.com/view/XslGRr>

Some shader components involving the depth buffer were taken from [`three-good-godrays`](https://github.com/ameobea/three-good-godrays) which contains code originally written by [n8programs](https://github.com/N8python)
