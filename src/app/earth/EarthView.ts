import Earth from './Earth';
import * as THREE from 'three';
import earth8kTextureJpg from 'public/textures/8k_earth_daymap.jpg';
import { atmosphereLayerKeys } from './earth.consts';
import EarthGui from './Earth.gui';

const earthTexture = new THREE.TextureLoader().load(earth8kTextureJpg);

export default class EarthView {
  readonly mesh: THREE.Mesh;

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
    const material = new THREE.MeshPhongMaterial({
      map: earthTexture,
    });

    this.mesh = new THREE.Mesh(geometry, material);

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
    length: number = 1000,
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
}
