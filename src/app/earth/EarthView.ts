import Earth from './Earth';
import * as THREE from 'three';
import earth8kTextureJpg from 'public/textures/8k_earth_daymap.jpg';
import { atmosphereLayerKeys } from './earth.consts';
import EarthGui from './Earth.gui';

const earthTexture = new THREE.TextureLoader().load(earth8kTextureJpg);

export default class EarthView {
  private geometry: THREE.SphereGeometry;
  private material: THREE.MeshPhongMaterial;
  private mesh: THREE.Mesh;

  public atmosphereLayers = new Map<atmosphereLayerKeys, THREE.Mesh>();
  public atmostphereBorders = new Map<
    atmosphereLayerKeys,
    THREE.LineSegments
  >();

  constructor(
    private readonly earth: Earth,
    private readonly scene: THREE.Scene,
    private readonly earthGui: EarthGui
  ) {
    const segments = 128;

    this.geometry = new THREE.SphereGeometry(Earth.RADIUS, segments, segments);
    this.material = new THREE.MeshPhongMaterial({
      map: earthTexture,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);

    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    this.mesh.name = Earth.name;
    this.mesh.position.copy(this.earth.position);

    this.scene.add(this.mesh);

    this.initAtmosphereLayers();
    this.initAtmosphereBorders();

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
}
