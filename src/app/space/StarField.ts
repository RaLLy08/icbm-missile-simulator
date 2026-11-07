import * as THREE from 'three';
import Earth from '../earth/Earth';

/**
 * Background star field rendered as a "skybox" of points.
 *
 * Stars are projected using only the camera rotation (translation is dropped
 * in the vertex shader), so they stay infinitely far away regardless of which
 * camera renders the scene (Earth orbit camera, missile tracking camera,
 * mini window, ...).
 */
export default class StarField {
  static readonly STAR_COUNT = 9000;
  static readonly MILKY_WAY_STAR_COUNT = 6000;
  /** Must stay inside the cameras' far plane (Earth.RADIUS * 100). */
  static readonly SHELL_RADIUS = Earth.RADIUS * 50;

  readonly points: THREE.Points;
  private readonly material: THREE.ShaderMaterial;
  private elapsed = 0;

  constructor(private readonly scene: THREE.Scene) {
    const total = StarField.STAR_COUNT + StarField.MILKY_WAY_STAR_COUNT;
    const positions = new Float32Array(total * 3);
    const colors = new Float32Array(total * 3);
    const sizes = new Float32Array(total);
    const phases = new Float32Array(total);

    // Tilted plane for the Milky Way band
    const bandNormal = new THREE.Vector3(0.3, 1, 0.45).normalize();
    const bandU = new THREE.Vector3(1, 0, 0)
      .projectOnPlane(bandNormal)
      .normalize();
    const bandV = new THREE.Vector3().crossVectors(bandNormal, bandU);

    const dir = new THREE.Vector3();
    const color = new THREE.Color();

    for (let i = 0; i < total; i++) {
      const isBandStar = i >= StarField.STAR_COUNT;

      if (isBandStar) {
        // Concentrate around the band's great circle with gaussian-ish spread
        const angle = Math.random() * Math.PI * 2;
        const spread =
          (Math.random() + Math.random() + Math.random() - 1.5) * 0.18;
        dir
          .copy(bandU)
          .multiplyScalar(Math.cos(angle))
          .addScaledVector(bandV, Math.sin(angle))
          .addScaledVector(bandNormal, spread)
          .normalize();
      } else {
        // Uniform distribution on a sphere
        const u = Math.random() * 2 - 1;
        const theta = Math.random() * Math.PI * 2;
        const r = Math.sqrt(1 - u * u);
        dir.set(r * Math.cos(theta), u, r * Math.sin(theta));
      }

      dir.multiplyScalar(StarField.SHELL_RADIUS);
      positions[i * 3] = dir.x;
      positions[i * 3 + 1] = dir.y;
      positions[i * 3 + 2] = dir.z;

      // Brightness: most stars dim, a few bright ones
      const brightness = Math.pow(Math.random(), isBandStar ? 6 : 4);
      sizes[i] = isBandStar ? 0.8 + brightness * 1.5 : 1 + brightness * 3.2;

      // Star temperature tint: blue-white -> white -> yellow -> orange
      const t = Math.random();
      if (t < 0.15) color.setHSL(0.6, 0.6, 0.85);
      else if (t < 0.7) color.setHSL(0, 0, 0.95);
      else if (t < 0.9) color.setHSL(0.13, 0.6, 0.85);
      else color.setHSL(0.07, 0.7, 0.75);

      const intensity = (isBandStar ? 0.35 : 0.5) + brightness * 0.5;
      colors[i * 3] = color.r * intensity;
      colors[i * 3 + 1] = color.g * intensity;
      colors[i * 3 + 2] = color.b * intensity;

      phases[i] = Math.random() * Math.PI * 2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      },
      vertexShader: `
        #include <common>
        #include <logdepthbuf_pars_vertex>

        attribute float size;
        attribute float phase;
        attribute vec3 color;
        uniform float uTime;
        uniform float uPixelRatio;
        varying vec3 vColor;

        void main() {
          // Rotation only: keeps stars at infinity for any camera position
          vec3 viewPos = mat3(viewMatrix) * mat3(modelMatrix) * position;
          gl_Position = projectionMatrix * vec4(viewPos, 1.0);

          float twinkle = 0.85 + 0.15 * sin(uTime * (1.0 + fract(phase) * 2.0) + phase);
          vColor = color * twinkle;
          gl_PointSize = size * uPixelRatio;

          #include <logdepthbuf_vertex>
        }
      `,
      fragmentShader: `
        #include <common>
        #include <logdepthbuf_pars_fragment>

        varying vec3 vColor;

        void main() {
          #include <logdepthbuf_fragment>

          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          if (d > 0.5) discard;
          float alpha = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vColor * alpha, 1.0);
        }
      `,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: false,
    });

    this.points = new THREE.Points(geometry, this.material);
    this.points.name = 'StarField';
    this.points.frustumCulled = false;
    // Draw before everything else so Earth & objects cover the stars
    this.points.renderOrder = -1000;

    this.scene.add(this.points);
  }

  setVisible(visible: boolean) {
    this.points.visible = visible;
  }

  update(deltaTime = 0) {
    this.elapsed += deltaTime;
    this.material.uniforms.uTime.value = this.elapsed;
  }

  dispose() {
    this.scene.remove(this.points);
    this.points.geometry.dispose();
    this.material.dispose();
  }
}
