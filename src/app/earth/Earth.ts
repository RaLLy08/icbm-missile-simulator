import { atmosphereLayerKeys } from './earth.consts';
import * as THREE from 'three';

class Earth {
  /**
   * Unit: m
   */
  static readonly RADIUS = 6_378_000;
  /** Unit: m³/(kg·s²) */
  static readonly G = 6.6743e-11;
  /**
   * Unit: kg
   */
  static readonly MASS = 5.972e24;

  /**
   * Unit: m/s²
   * Gravitational acceleration at the surface of the Earth.
   */
  // static readonly GRAVITY_AT_SURFACE =
  //   (Earth.G * Earth.MASS) / Earth.RADIUS ** 2;

  /** Unit: m */
  static readonly atmosphereLayersHeights = Object.freeze({
    [atmosphereLayerKeys.TROPOSPHERE]: 10_000,
    [atmosphereLayerKeys.STRATOSPHERE]: 50_000,
    [atmosphereLayerKeys.MESOSPHERE]: 85_000,
    [atmosphereLayerKeys.THERMOSPHERE]: 600_000,
    [atmosphereLayerKeys.EXOSPHERE]: 1_000_000,
  });

  /**
   * Piecewise exponential atmosphere model. Below 25 km: US Standard
   * Atmosphere 1976; above: Vallado, "Fundamentals of Astrodynamics and
   * Applications" (CIRA-72).
   * Each row: [base altitude (m), base density (kg/m³), scale height (m)].
   * Above the last row the density is treated as zero.
   */
  private static readonly ATMOSPHERE_DENSITY_TABLE: ReadonlyArray<
    readonly [number, number, number]
  > = Object.freeze([
    // 0–25 km: US Standard Atmosphere 1976, scale heights fitted per 5 km
    [0, 1.225, 9_825],
    [5_000, 0.7364, 8_664],
    [10_000, 0.4135, 6_643],
    [15_000, 0.1948, 6_375],
    [20_000, 8.891e-2, 6_275],
    [25_000, 3.899e-2, 6_349],
    [30_000, 1.774e-2, 6_682],
    [40_000, 3.972e-3, 7_554],
    [50_000, 1.057e-3, 8_382],
    [60_000, 3.206e-4, 7_714],
    [70_000, 8.77e-5, 6_549],
    [80_000, 1.905e-5, 5_799],
    [90_000, 3.396e-6, 5_382],
    [100_000, 5.297e-7, 5_877],
    [110_000, 9.661e-8, 7_263],
    [120_000, 2.438e-8, 9_473],
    [130_000, 8.484e-9, 12_636],
    [140_000, 3.845e-9, 16_149],
    [150_000, 2.07e-9, 22_523],
    [180_000, 5.464e-10, 29_740],
    [200_000, 2.789e-10, 37_105],
    [250_000, 7.248e-11, 45_546],
    [300_000, 2.418e-11, 53_628],
    [350_000, 9.518e-12, 53_298],
    [400_000, 3.725e-12, 58_515],
    [450_000, 1.585e-12, 60_828],
    [500_000, 6.967e-13, 63_822],
    [600_000, 1.454e-13, 71_835],
    [700_000, 3.614e-14, 88_667],
    [800_000, 1.17e-14, 124_640],
    [900_000, 5.245e-15, 181_050],
    [1_000_000, 3.019e-15, 268_000],
  ] as const);

  /** Above this altitude the atmosphere is ignored. Unit: m */
  static readonly ATMOSPHERE_TOP = Earth.atmosphereLayersHeights[atmosphereLayerKeys.EXOSPHERE];

  /**
   * When false, the atmosphere exerts no drag and missiles see zero air
   * density (no aerodynamic heating). `airDensity()` still returns the model.
   */
  atmosphericDragEnabled = true;

  constructor(public position = new THREE.Vector3(0, 0, 0)) {}

  /**
   * Air density at the given altitude above the surface.
   * @param altitude Unit: m
   * @returns Unit: kg/m³ (0 outside the atmosphere)
   */
  static airDensity(altitude: number): number {
    if (altitude > Earth.ATMOSPHERE_TOP) return 0;

    const table = Earth.ATMOSPHERE_DENSITY_TABLE;
    const h = Math.max(altitude, 0);

    let i = table.length - 1;
    while (i > 0 && h < table[i][0]) i--;

    const [baseAltitude, baseDensity, scaleHeight] = table[i];
    return baseDensity * Math.exp(-(h - baseAltitude) / scaleHeight);
  }

  /**
   * Air density at a point in space (depends on its distance to the Earth).
   * @returns Unit: kg/m³
   */
  airDensityAt(target: THREE.Vector3): number {
    return Earth.airDensity(this.calcAltitude(target));
  }

  /**
   * Drag coefficient factor k = ½·ρ·Cd·A / m, so that the drag acceleration
   * is a = -k·|v|·v. The atmosphere is assumed to be at rest.
   * @param target Position of the body. Unit: m
   * @param dragCoefficient Cd (dimensionless)
   * @param crossSectionArea Unit: m²
   * @param mass Unit: kg
   * @returns Unit: 1/m
   */
  dragFactor(
    target: THREE.Vector3,
    dragCoefficient: number,
    crossSectionArea: number,
    mass: number
  ): number {
    if (!this.atmosphericDragEnabled || mass <= 0) return 0;
    const density = this.airDensityAt(target);
    return (0.5 * density * dragCoefficient * crossSectionArea) / mass;
  }

  /**
   * Calculates the atmospheric drag acting on a body moving through the air.
   * @returns The drag acceleration vector in m/s² (opposite to the velocity).
   */
  dragForce(
    target: THREE.Vector3,
    velocity: THREE.Vector3,
    dragCoefficient: number,
    crossSectionArea: number,
    mass: number,
    out = new THREE.Vector3()
  ): THREE.Vector3 {
    const k = this.dragFactor(target, dragCoefficient, crossSectionArea, mass);
    return out.copy(velocity).multiplyScalar(-k * velocity.length());
  }

  // private createSphereEdges(radius: number, color: number, segmentCount: number = 128): THREE.LineSegments {
  //   const geo = new THREE.EdgesGeometry(
  //     new THREE.SphereGeometry(radius, segmentCount, segmentCount)
  //   );
  //   const mat = new THREE.LineBasicMaterial({ color: color });
  //   const lineSegments = new THREE.LineSegments(geo, mat);

  //   return lineSegments;
  // }
  
  /**
   * Calculates the gravitational force exerted by the Earth on a target point.
   * @param target The position of the target in 3D space.
   * @returns The gravitational acceleration vector in m/s².
   */
  gravityForce(target: THREE.Vector3): THREE.Vector3 {
    const earthGravityVector = new THREE.Vector3()
      .subVectors(this.position, target) // Earth - Missile
      .normalize();

    const distanceToMissile = this.position.distanceTo(target); // m

    const gravityForceMagnitude = (Earth.G * Earth.MASS) / distanceToMissile ** 2;

    return earthGravityVector.multiplyScalar(gravityForceMagnitude);
  }

  /**
   * @returns The distance to the surface of the Earth in meters.
   */
  calcAltitude(position: THREE.Vector3): number {
    const distanceToEarthCenters = this.position.distanceTo(position);
    return distanceToEarthCenters - Earth.RADIUS;
  }

  update(tick = 1) {
    // rotate the Earth around its axis
  }

  static geoCoordinatesToPosition(
    latitude: number,
    longitude: number
  ): THREE.Vector3 {
    const latRad = latitude * (Math.PI / 180);
    const lonRad = longitude * (Math.PI / 180);

    const cosLat = Math.cos(latRad);
    const sinLat = Math.sin(latRad);
    const cosLon = Math.cos(lonRad);
    const sinLon = Math.sin(lonRad);

    const x = Earth.RADIUS * cosLat * cosLon;
    const y = Earth.RADIUS * sinLat;
    const z = Earth.RADIUS * cosLat * sinLon;

    return new THREE.Vector3(x, y, z);
  }

  static positionToGeoCoordinates(position: THREE.Vector3): {
    latitude: number;
    longitude: number;
  } {
    const radius = position.length(); // distance from Earth's center

    const latitude = Math.asin(position.y / radius) * (180 / Math.PI);
    const longitude = Math.atan2(position.z, position.x) * (180 / Math.PI);

    return { latitude, longitude };
  }
}

export default Earth;
