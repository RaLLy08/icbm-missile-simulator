import Earth from './Earth';
import * as THREE from 'three';
import earth8kTextureJpg from 'public/textures/8k_earth_daymap.jpg';
import countriesGeoJsonData from 'public/data/countries.geo.json';
import { atmosphereLayerKeys } from './earth.consts';
import EarthGui from './Earth.gui';

const textureLoader = new THREE.TextureLoader();
const earthTexture = textureLoader.load(earth8kTextureJpg);
earthTexture.colorSpace = THREE.SRGBColorSpace;
earthTexture.anisotropy = 16; // Better texture quality at angles

export default class EarthView {
  readonly mesh: THREE.Mesh;
  private atmosphereGlow?: THREE.Mesh;
  private camera?: THREE.Camera;
  private countryBorders?: THREE.LineSegments;

  public atmosphereLayers = new Map<atmosphereLayerKeys, THREE.Mesh>();
  public atmostphereBorders = new Map<
    atmosphereLayerKeys,
    THREE.LineSegments
  >();
  markers: THREE.Mesh[] = [];

  constructor(
    private readonly earth: Earth,
    private readonly scene: THREE.Scene,
    private readonly earthGui: EarthGui
  ) {
    const segments = 512;

    const geometry = new THREE.SphereGeometry(Earth.RADIUS, segments, segments);

    // Use MeshStandardMaterial for physically-based rendering
    const material = new THREE.MeshStandardMaterial({
      map: earthTexture,
      roughness: 0.9,
      metalness: 0.1,
      // Water will appear more reflective due to lower roughness in specular map
    });

    this.mesh = new THREE.Mesh(geometry, material);

    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    this.mesh.name = Earth.name;
    this.mesh.position.copy(this.earth.position);

    this.scene.add(this.mesh);

    // Add atmospheric glow
    this.createAtmosphericGlow();

    this.initAtmosphereLayers();
    this.initAtmosphereBorders();
    this.createCountryBorders();

    earthGui.onAddAtmosphereLayerClicked = (layerKey) => {
      this.renderAtmosphereLayer(layerKey);
    };
    earthGui.onRemoveAtmosphereLayerClicked = (layerKey) => {
      this.removeAtmosphereLayer(layerKey);
    };
    earthGui.onAddAtmosphereBorderClicked = (layerKey) => {
      this.renderAtmosphereBorder(layerKey);
    };
    earthGui.onRemoveAtmosphereBorderClicked = (layerKey) => {
      this.removeAtmosphereBorder(layerKey);
    };
    earthGui.onShowEarthClicked = (show) => {
      this.setVisibility(show);
    };
    earthGui.onToggleCountryBordersClicked = (show) => {
      this.toggleCountryBorders(show);
    };
  }

  private createAtmosphericGlow() {
    // Create a realistic atmospheric glow using custom shader
    const glowGeometry = new THREE.SphereGeometry(
      Earth.RADIUS * 1.015,
      128,
      128
    );

    // Custom shader for realistic atmospheric scattering
    const glowMaterial = new THREE.ShaderMaterial({
      uniforms: {
        c: { value: 0.3 },
        p: { value: 3.5 },
        glowColor: { value: new THREE.Color(0x88ccff) },
        viewVector: { value: new THREE.Vector3() },
      },
      vertexShader: `
        uniform vec3 viewVector;
        uniform float c;
        uniform float p;
        varying float intensity;
        void main() {
          vec3 vNormal = normalize(normalMatrix * normal);
          vec3 vNormel = normalize(normalMatrix * viewVector);
          intensity = pow(c - dot(vNormal, vNormel), p);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        varying float intensity;
        void main() {
          vec3 glow = glowColor * intensity;
          gl_FragColor = vec4(glow, intensity);
        }
      `,
      side: THREE.FrontSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });

    this.atmosphereGlow = new THREE.Mesh(glowGeometry, glowMaterial);
    this.atmosphereGlow.position.copy(this.earth.position);
    this.scene.add(this.atmosphereGlow);
  }

  private createAtmosphereLayer(
    radius: number,
    color: number,
    opacity: number
  ) {
    const geometry = new THREE.SphereGeometry(radius, 128, 128);
    const material = new THREE.MeshPhongMaterial({
      color: color,
      transparent: true,
      opacity: opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    return new THREE.Mesh(geometry, material);
  }

  private createAtmosphereBorder(radius: number, color: number) {
    const geo = new THREE.EdgesGeometry(
      new THREE.SphereGeometry(radius, 128, 128)
    );
    const mat = new THREE.LineBasicMaterial({ color: color, linewidth: 1 });
    return new THREE.LineSegments(geo, mat);
  }

  private initAtmosphereLayers() {
    this.atmosphereLayers.clear();

    this.atmosphereLayers.set(
      atmosphereLayerKeys.TROPOSPHERE,
      this.createAtmosphereLayer(
        Earth.RADIUS +
          Earth.atmosphereLayersHeights[atmosphereLayerKeys.TROPOSPHERE],
        0x87ceeb, // Sky blue
        0.25 // Fairly visible
      )
    );

    this.atmosphereLayers.set(
      atmosphereLayerKeys.STRATOSPHERE,
      this.createAtmosphereLayer(
        Earth.RADIUS +
          Earth.atmosphereLayersHeights[atmosphereLayerKeys.STRATOSPHERE],
        0x4682b4, // Steel blue
        0.15 // Thinner
      )
    );

    this.atmosphereLayers.set(
      atmosphereLayerKeys.MESOSPHERE,
      this.createAtmosphereLayer(
        Earth.RADIUS +
          Earth.atmosphereLayersHeights[atmosphereLayerKeys.MESOSPHERE],
        0x1e90ff, // Dodger blue
        0.1 // Very faint
      )
    );

    this.atmosphereLayers.set(
      atmosphereLayerKeys.THERMOSPHERE,
      this.createAtmosphereLayer(
        Earth.RADIUS +
          Earth.atmosphereLayersHeights[atmosphereLayerKeys.THERMOSPHERE],
        0x4169e1, // Royal blue
        0.05 // Extremely faint
      )
    );

    this.atmosphereLayers.set(
      atmosphereLayerKeys.EXOSPHERE,
      this.createAtmosphereLayer(
        Earth.RADIUS +
          Earth.atmosphereLayersHeights[atmosphereLayerKeys.EXOSPHERE],
        0x191970, // Midnight blue
        0.12 // Barely visible
      )
    );

    this.atmosphereLayers.forEach((layer) => {
      layer.castShadow = false;
      layer.receiveShadow = false;
    });

    Object.entries(this.earthGui.atmosphereLayersStates).forEach(
      ([key, isVisible]: [atmosphereLayerKeys, boolean]) => {
        if (isVisible) {
          this.renderAtmosphereLayer(key);
        }
      }
    );
  }

  private initAtmosphereBorders() {
    this.atmostphereBorders.clear();

    this.atmostphereBorders.set(
      atmosphereLayerKeys.TROPOSPHERE,
      this.createAtmosphereBorder(
        Earth.RADIUS +
          Earth.atmosphereLayersHeights[atmosphereLayerKeys.TROPOSPHERE],
        0x87ceeb // Sky blue
      )
    );

    this.atmostphereBorders.set(
      atmosphereLayerKeys.STRATOSPHERE,
      this.createAtmosphereBorder(
        Earth.RADIUS +
          Earth.atmosphereLayersHeights[atmosphereLayerKeys.STRATOSPHERE],
        0x4682b4 // Steel blue
      )
    );

    this.atmostphereBorders.set(
      atmosphereLayerKeys.MESOSPHERE,
      this.createAtmosphereBorder(
        Earth.RADIUS +
          Earth.atmosphereLayersHeights[atmosphereLayerKeys.MESOSPHERE],
        0x1e90ff // Dodger blue
      )
    );

    this.atmostphereBorders.set(
      atmosphereLayerKeys.THERMOSPHERE,
      this.createAtmosphereBorder(
        Earth.RADIUS +
          Earth.atmosphereLayersHeights[atmosphereLayerKeys.THERMOSPHERE],
        0x4169e1 // Royal blue
      )
    );

    this.atmostphereBorders.set(
      atmosphereLayerKeys.EXOSPHERE,
      this.createAtmosphereBorder(
        Earth.RADIUS +
          Earth.atmosphereLayersHeights[atmosphereLayerKeys.EXOSPHERE],
        0x191970 // Midnight blue
      )
    );

    this.atmostphereBorders.forEach((border) => {
      border.castShadow = false;
      border.receiveShadow = false;
    });

    Object.entries(this.earthGui.atmosphereBordersStates).forEach(
      ([key, isVisible]: [atmosphereLayerKeys, boolean]) => {
        if (isVisible) {
          this.renderAtmosphereBorder(key);
        }
      }
    );
  }

  renderAtmosphereBorder(name: atmosphereLayerKeys) {
    const atmosphereBorder = this.atmostphereBorders.get(name);
    if (atmosphereBorder) {
      this.scene.add(atmosphereBorder);
    }
  }

  removeAtmosphereBorder(name: atmosphereLayerKeys) {
    const atmosphereBorder = this.atmostphereBorders.get(name);

    if (atmosphereBorder) {
      this.scene.remove(atmosphereBorder);
    }
  }

  setVisibility(show: boolean) {
    this.mesh.visible = show;
  }

  renderAtmosphereLayer(name: atmosphereLayerKeys) {
    const atmosphereLayer = this.atmosphereLayers.get(name);
    if (atmosphereLayer) {
      this.scene.add(atmosphereLayer);
    }
  }

  removeAtmosphereLayer(name: atmosphereLayerKeys) {
    const atmosphereLayer = this.atmosphereLayers.get(name);

    if (atmosphereLayer) {
      this.scene.remove(atmosphereLayer);
    }
  }

  clickToGeoCoordinates(
    mouse: THREE.Vector2,
    camera: THREE.PerspectiveCamera
  ): THREE.Vector3 | null {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObject(this.mesh);

    if (intersects.length > 0) {
      return intersects[0].point;
    }

    return null;
  }

  addTorusMarker = (
    position: THREE.Vector3,
    color: number = 0x0000ff,
    radius: number = 80,
    tube: number = 16
  ) => {
    const normal = position.clone().sub(this.earth.position).normalize();

    // create torus
    const geometry = new THREE.TorusGeometry(radius, tube, 16, 100);
    const material = new THREE.MeshBasicMaterial({ color: color });
    const marker = new THREE.Mesh(geometry, material);
    marker.position.copy(position);
    marker.lookAt(position.clone().add(normal)); // orient the torus to face the normal direction

    marker.castShadow = true;
    marker.receiveShadow = true;

    this.scene.add(marker);
  };

  addCrossMarker = (
    position: THREE.Vector3,
    color: number = 0xff0000,
    size: number = 100,
    thickness: number = 10
  ) => {
    const normal = position.clone().sub(this.earth.position).normalize();

    const material = new THREE.MeshBasicMaterial({ color: color });

    // Create horizontal bar
    const horizontalGeometry = new THREE.BoxGeometry(
      size,
      thickness,
      thickness
    );
    const horizontal = new THREE.Mesh(horizontalGeometry, material);

    // Create vertical bar
    const verticalGeometry = new THREE.BoxGeometry(thickness, size, thickness);
    const vertical = new THREE.Mesh(verticalGeometry, material);

    // Combine into a single object
    const cross = new THREE.Object3D();
    cross.add(horizontal);
    cross.add(vertical);

    cross.position.copy(position);
    cross.lookAt(position.clone().add(normal)); // orient the cross to face outward

    cross.castShadow = true;
    cross.receiveShadow = true;

    this.scene.add(cross);
  };

  createLineToSkyMarker(
    position: THREE.Vector3,
    color: number = 0x00ff00,
    length: number = 1000
  ) {
    const material = new THREE.LineBasicMaterial({ color: color });

    const points: THREE.Vector3[] = [
      position.clone(),
      position.clone().addScaledVector(position.clone().normalize(), length),
    ];

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, material);

    return line;
  }

  removeMarker(marker: THREE.Mesh) {
    this.scene.remove(marker);
  }

  setMarkerVisible(marker: THREE.Mesh, visible: boolean = true) {
    marker.visible = visible;
  }

  setCamera(camera: THREE.Camera) {
    this.camera = camera;
  }

  update() {
    // Update atmospheric glow shader with camera position for realistic effect
    if (this.atmosphereGlow && this.camera) {
      const material = this.atmosphereGlow.material as THREE.ShaderMaterial;
      if (material.uniforms?.viewVector) {
        this.camera.getWorldPosition(material.uniforms.viewVector.value);
        material.uniforms.viewVector.value.sub(this.earth.position);
        material.uniforms.viewVector.value.normalize();
      }
    }
  }

  private createCountryBorders() {
    const points: THREE.Vector3[] = [];

    // Helper function to convert lat/lon to 3D coordinates
    const latLonToVector3 = (lon: number, lat: number, radius: number) => {
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lon + 180) * (Math.PI / 180);

      const x = -(radius * Math.sin(phi) * Math.cos(theta));
      const z = radius * Math.sin(phi) * Math.sin(theta);
      const y = radius * Math.cos(phi);

      return new THREE.Vector3(x, y, z);
    };

    // Process GeoJSON features
    const countriesGeoJson: any = countriesGeoJsonData;
    countriesGeoJson.features.forEach((feature: any) => {
      const geometry = feature.geometry;

      const processCoordinates = (coords: any[], depth: number = 0) => {
        if (depth === 0 && Array.isArray(coords[0]) && typeof coords[0][0] === 'number') {
          // This is a coordinate pair [lon, lat]
          return;
        }

        if (Array.isArray(coords[0]) && typeof coords[0][0] === 'number') {
          // Process line string
          for (let i = 0; i < coords.length - 1; i++) {
            const [lon1, lat1] = coords[i];
            const [lon2, lat2] = coords[i + 1];

            const p1 = latLonToVector3(lon1, lat1, Earth.RADIUS + 2);
            const p2 = latLonToVector3(lon2, lat2, Earth.RADIUS + 2);

            points.push(p1, p2);
          }
        } else {
          // Recurse deeper
          coords.forEach((subCoords: any) => processCoordinates(subCoords, depth + 1));
        }
      };

      if (geometry.type === 'Polygon') {
        processCoordinates(geometry.coordinates);
      } else if (geometry.type === 'MultiPolygon') {
        geometry.coordinates.forEach((polygon: any) => processCoordinates(polygon));
      }
    });

    // Create line segments from points
    const borderGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const borderMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      opacity: 0.5,
      transparent: true,
      linewidth: 1,
    });

    this.countryBorders = new THREE.LineSegments(borderGeometry, borderMaterial);
    this.countryBorders.position.copy(this.earth.position);

    // Add to scene by default
    this.scene.add(this.countryBorders);
  }

  toggleCountryBorders(visible: boolean) {
    if (this.countryBorders) {
      this.countryBorders.visible = visible;
    }
  }

  setCountryBordersColor(color: number) {
    if (this.countryBorders) {
      const material = this.countryBorders.material as THREE.LineBasicMaterial;
      material.color.setHex(color);
    }
  }

  setCountryBordersOpacity(opacity: number) {
    if (this.countryBorders) {
      const material = this.countryBorders.material as THREE.LineBasicMaterial;
      material.opacity = opacity;
    }
  }
}
