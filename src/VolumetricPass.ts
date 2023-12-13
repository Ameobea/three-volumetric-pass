import { type Disposable, Pass } from 'postprocessing';
import * as THREE from 'three';

import { getBlueNoiseTexture } from './blueNoise';
import VolumetricFragmentShader from './volumetric.frag';
import VolumetricVertexShader from './volumetric.vert';
import {
  VolumetricCompositorMaterial,
  VolumetricCompositorPass,
  type VolumetricPassCompositorParams,
} from './CompositorPass';

export interface VolumetricPassParams {
  /**
   * Color of the ambient light used to light the fog.  This will override the color of the scene's ambient light if one is present.
   *
   * Default: `new THREE.Color(0xffffff)`
   */
  ambientLightColor?: THREE.Color;
  /**
   * Intensity of the ambient light used to light the fog.  This will override the intensity of the scene's ambient light if one is present.
   *
   * Default: 0
   */
  ambientLightIntensity?: number;
  /**
   * Y coordinate of the plane bounding the bottom of the volume.  No fog will be rendered below this plane.
   *
   * Default: -40
   */
  fogMinY?: number;
  /**
   * Y coordinate of the plane bounding the top of the volume.
   *
   * Default: 4.4
   */
  fogMaxY?: number;
  /**
   * Number of steps to take when raymarching through the volume.  Higher values will produce more accurate results but will be slower.
   *
   * Default: 80
   */
  baseRaymarchStepCount?: number;
  /**
   * Maximum number of steps to take when raymarching through the volume.  Higher values will produce more accurate results but will be slower.
   *
   * Default: 400
   */
  maxRaymarchStepCount?: number;
  /**
   * Maximum distance to raymarch through the volume.
   *
   * TODO: Update with docs about the adjustment that happens for long rays
   *
   * Default: 300
   */
  baseMaxRayLength?: number;
  /**
   * Minimum distance to step when raymarching through the volume.  Setting this to higher values can help improve performance but may produce artifacts.
   *
   * Default: 0.2
   */
  minStepLength?: number;
  /**
   * Maximum density of the fog.  Raymarching will stop when the total accumulated density reaches this value.
   *
   * Default: 1
   */
  maxDensity?: number;
  /**
   * Color of the fog when the density is high.  Changing this along with `fogColorLowDensity` can be very useful for creating stylized looks and
   * faking things like self-shadowing and scattering for free.
   *
   * For things like clouds, try setting this to a darker color and `fogColorLowDensity` to a lighter color to get a "silver lining" effect.
   *
   * Default: `new THREE.Vector3(0.32, 0.35, 0.38)`
   */
  fogColorHighDensity?: THREE.Vector3;
  /**
   * Color of the fog when the density is low.  Changing this along with `fogColorHighDensity` can be very useful for creating stylized looks and
   * faking things like self-shadowing and scattering for free.
   *
   * For things like clouds, try setting this to a darker color and `fogColorHighDensity` to a lighter color to get a "silver lining" effect.
   *
   * Default: `new THREE.Vector3(0.9, 0.9, 0.9)`
   */
  fogColorLowDensity?: THREE.Vector3;
  lightColor?: THREE.Vector3;
  lightIntensity?: number;
  lightFalloffDistance?: number;
  /**
   * Controls the strength of the fog fade out effect.
   *
   * Within the range `[fogMaxY - fogFadeOutRangeY, fogMaxY]`, the fog density will be reduced until reaching 0 at `fogMaxY`.
   *
   * Default: 1
   */
  fogFadeOutPow?: number;
  /**
   * Within the range `[fogMaxY - fogFadeOutRangeY, fogMaxY]`, the fog density will be reduced until reaching 0 at `fogMaxY`.
   *
   * The shape of the fade out is controlled by `fogFadeOutPow`.
   *
   * Default: 1.5
   */
  fogFadeOutRangeY?: number;
  /**
   * Main control over the density of the fog.
   *
   * Default: 0.086
   */
  fogDensityMultiplier?: number;
  /**
   * The Y coordinate of the plane where the height fog starts.
   *
   * Within the range `[heightFogStartY, heightFogEndY]`, additional density will be added at all points in the volume.
   *
   * See also `heightFogEndY` and `heightFogFactor`.
   *
   * Default: -10
   */
  heightFogStartY?: number;
  /**
   * The Y coordinate of the plane where the height fog ends.
   *
   * Within the range `[heightFogStartY, heightFogEndY]`, additional density will be added at all points in the volume.
   *
   * See also `heightFogStartY` and `heightFogFactor`.
   *
   * Default: 8
   */
  heightFogEndY?: number;
  /**
   * Controls the amount of additional density added to the volume within the range `[heightFogStartY, heightFogEndY]`.
   *
   * See also `heightFogStartY` and `heightFogEndY`.
   *
   * Default: 0.1852
   */
  heightFogFactor?: number;
  /**
   * This value is added to the summed raw noise octave samples before being normalized to [0, 1] and raised to `noisePow`.
   *
   * Default: 0.485
   */
  noiseBias?: number;
  /**
   * Normalized noise is raised to this power after sampling.  Higher values can produce results with more contrast.
   *
   * Default: 3
   */
  noisePow?: number;
  /**
   * Controls the speed of the noise movement to simulate wind.
   *
   * Default: new THREE.Vector2(1.2, 0.8)
   */
  noiseMovementPerSecond?: THREE.Vector2;
  /**
   * Accumulated density after full raymarching is completed is multiplied by this value before raising to `postDensityPow`.
   *
   * Default: 1.2
   */
  postDensityMultiplier?: number;
  /**
   * Accumulated density after full raymarching is completed is raised to this power after multiplying by `postDensityMultiplier`.
   *
   * Default: 1
   */
  postDensityPow?: number;
  /**
   * Controls the compositing pass that upscales + combines the volumetric pass with the main scene.
   *
   * Only applies if `halfRes` is set to `true`.
   */
  compositor?: Partial<VolumetricPassCompositorParams>;
  /**
   * If set, the volumetric pass will render at half resolution and then upscale to full resolution.
   *
   * Cannot be changed after the pass is created.
   *
   * Default: false
   */
  halfRes?: boolean;
  /**
   * A scale factor for all noise function sampling.  Works the same way as a frequency parameter in a noise function.
   *
   * Default: 1
   */
  globalScale?: number;
}

class VolumetricMaterial extends THREE.ShaderMaterial {
  constructor(params: VolumetricPassParams) {
    const uniforms = {
      sceneDepth: { value: null },
      sceneDiffuse: { value: null },
      blueNoise: { value: null },
      resolution: { value: new THREE.Vector2(1, 1) },
      cameraPos: { value: new THREE.Vector3(0, 0, 0) },
      cameraProjectionMatrixInv: { value: new THREE.Matrix4() },
      cameraMatrixWorld: { value: new THREE.Matrix4() },
      curTimeSeconds: { value: 0 },
      // lighting
      ambientLightColor: { value: new THREE.Color(0xffffff) },
      ambientLightIntensity: { value: 0 },
      // params
      fogMinY: { value: -40.0 },
      fogMaxY: { value: 4.4 },
      baseRaymarchStepCount: { value: 80 },
      maxRaymarchStepCount: { value: 400 },
      baseMaxRayLength: { value: 300.0 },
      minStepLength: { value: 0.2 },
      maxDensity: { value: 1 },
      fogColorHighDensity: { value: new THREE.Vector3(0.32, 0.35, 0.38) },
      fogColorLowDensity: { value: new THREE.Vector3(0.9, 0.9, 0.9) },
      lightColor: { value: new THREE.Vector3(1.0, 0.0, 0.76) },
      lightIntensity: { value: 7.5 },
      blueNoiseResolution: { value: 256 },
      lightFalloffDistance: { value: 110 },
      fogFadeOutPow: { value: 1 },
      fogFadeOutRangeY: { value: 1.5 },
      fogDensityMultiplier: { value: 0.086 },
      heightFogStartY: { value: -10 },
      heightFogEndY: { value: 8 },
      heightFogFactor: { value: 0.1852 },
      noiseBias: { value: 0.485 },
      noisePow: { value: 3 },
      noiseMovementPerSecond: { value: new THREE.Vector2(1.2, 0.8) },
      postDensityMultiplier: { value: 1.2 },
      postDensityPow: { value: 1 },
      noiseTexture: { value: null },
      globalScale: { value: 1 },
    };

    super({
      name: 'VolumetricMaterial',
      uniforms,
      fragmentShader: VolumetricFragmentShader,
      vertexShader: VolumetricVertexShader,
      defines: params.halfRes ? undefined : { DO_DIRECT_COMPOSITING: '1' },
    });

    getBlueNoiseTexture(new THREE.TextureLoader()).then(blueNoiseTexture => {
      this.uniforms.blueNoise.value = blueNoiseTexture;
    });
  }
}

export class VolumetricPass extends Pass implements Disposable {
  /**
   * The camera used to render the main scene, different from the camera used to render the volumetric pass
   */
  private playerCamera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera();
  private material: VolumetricMaterial;
  private curTimeSeconds = 0;
  private ambientLight?: THREE.AmbientLight;
  private params: VolumetricPassParams;
  private compositorPass?: VolumetricCompositorPass;
  private fogRenderTarget: THREE.WebGLRenderTarget | null = null;
  private noiseTexture3D: THREE.Data3DTexture;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, params: VolumetricPassParams) {
    super('VolumetricPass');
    this.params = params;

    // Indicate to the composer that this pass needs depth information from the previous pass
    this.needsDepthTexture = true;

    this.playerCamera = camera;
    this.material = new VolumetricMaterial(params);
    this.fullscreenMaterial = this.material;
    if (params.halfRes) {
      this.fogRenderTarget = new THREE.WebGLRenderTarget(1, 1, {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
      });
      this.compositorPass = new VolumetricCompositorPass({
        camera,
        params: params.compositor,
        fogTexture: this.fogRenderTarget.texture,
      });
    }

    this.ambientLight = scene.children.find(child => child instanceof THREE.AmbientLight) as
      | THREE.AmbientLight
      | undefined;

    this.updateUniforms();

    const noise = new Uint8Array(64 * 64 * 64);
    for (let i = 0; i < noise.length; i++) {
      noise[i] = Math.random() * 255;
    }
    this.noiseTexture3D = new THREE.Data3DTexture(noise, 64, 64, 64);
    this.noiseTexture3D.format = THREE.RedFormat;
    this.noiseTexture3D.type = THREE.UnsignedByteType;
    this.noiseTexture3D.wrapR = THREE.RepeatWrapping;
    this.noiseTexture3D.wrapS = THREE.RepeatWrapping;
    this.noiseTexture3D.wrapT = THREE.RepeatWrapping;
    this.noiseTexture3D.generateMipmaps = true;
    this.noiseTexture3D.minFilter = THREE.LinearMipmapLinearFilter;
    this.noiseTexture3D.magFilter = THREE.LinearFilter;
    this.noiseTexture3D.needsUpdate = true;
  }

  public setCurTimeSeconds(newCurTimeSeconds: number) {
    this.curTimeSeconds = newCurTimeSeconds;
  }

  override render(
    renderer: THREE.WebGLRenderer,
    inputBuffer: THREE.WebGLRenderTarget,
    outputBuffer: THREE.WebGLRenderTarget,
    _deltaTime?: number | undefined,
    _stencilTest?: boolean | undefined
  ): void {
    this.updateUniforms();
    this.material.uniforms.sceneDiffuse.value = inputBuffer.texture;
    this.material.uniforms.curTimeSeconds.value = this.curTimeSeconds;

    renderer.setRenderTarget(
      (() => {
        if (this.compositorPass) {
          return this.fogRenderTarget!;
        }

        if (this.renderToScreen) {
          return null;
        }

        return outputBuffer;
      })()
    );
    renderer.render(this.scene, this.camera);

    if (this.compositorPass) {
      (
        this.compositorPass.fullscreenMaterial as VolumetricCompositorMaterial
      ).uniforms.fogTexture.value = this.fogRenderTarget!.texture;
      this.compositorPass.render(renderer, inputBuffer, this.renderToScreen ? null : outputBuffer);
    }
  }

  override setSize(width: number, height: number): void {
    this.material.uniforms.resolution.value.set(width, height);
    this.fogRenderTarget?.setSize(
      Math.ceil(width * (this.params.halfRes ? 0.5 : 1)),
      Math.ceil(height * (this.params.halfRes ? 0.5 : 1))
    );
    this.compositorPass?.setSize(width, height);
  }

  override setDepthTexture(
    depthTexture: THREE.Texture,
    depthPacking?: THREE.DepthPackingStrategies | undefined
  ): void {
    this.material.uniforms.sceneDepth.value = depthTexture;
    this.compositorPass?.setDepthTexture(depthTexture, depthPacking);
  }

  public updateUniforms(): void {
    this.material.uniforms.cameraPos.value = this.playerCamera.position;
    this.material.uniforms.cameraProjectionMatrixInv.value =
      this.playerCamera.projectionMatrixInverse;
    this.material.uniforms.cameraMatrixWorld.value = this.playerCamera.matrixWorld;

    this.material.uniforms.ambientLightColor.value =
      this.params.ambientLightColor ?? this.ambientLight?.color ?? new THREE.Color(0xffffff);
    this.material.uniforms.ambientLightIntensity.value =
      this.params.ambientLightIntensity ?? this.ambientLight?.intensity ?? 0;
    this.material.uniforms.noiseTexture.value = this.noiseTexture3D;

    for (const [key, value] of Object.entries(this.params)) {
      if (
        value === null ||
        value === undefined ||
        !(key in this.material.uniforms) ||
        key === 'ambientLightColor' ||
        key === 'ambientLightIntensity'
      ) {
        continue;
      }

      (this.material.uniforms as any)[key].value = value;
    }
  }

  override dispose(): void {
    this.fogRenderTarget?.dispose();
    this.compositorPass?.dispose();
    super.dispose();
  }
}
