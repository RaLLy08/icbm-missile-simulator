import { atmosphereLayerKeys } from './earth.consts';
import * as THREE from 'three';


class Earth {
  /**
   * Unit: km
   */
  static readonly RADIUS = 6378;
  static readonly G = 6.6743e-11;
  /**
   * Unit: kg
   */
  static readonly MASS = 5.972e24;

  static readonly atmosphereLayersHeights = Object.freeze({
    [atmosphereLayerKeys.TROPOSPHERE]: 10,
    [atmosphereLayerKeys.STRATOSPHERE]: 50,
    [atmosphereLayerKeys.MESOSPHERE]: 85,
    [atmosphereLayerKeys.THERMOSPHERE]: 600,
    [atmosphereLayerKeys.EXOSPHERE]: 1000,
  });

  constructor(public position = new THREE.Vector3(0, 0, 0)) {}

  // private createSphereEdges(radius: number, color: number, segmentCount: number = 128): THREE.LineSegments {
  //   const geo = new THREE.EdgesGeometry(
  //     new THREE.SphereGeometry(radius, segmentCount, segmentCount)
  //   );
  //   const mat = new THREE.LineBasicMaterial({ color: color });
  //   const lineSegments = new THREE.LineSegments(geo, mat);

  //   return lineSegments;
  // }

  gravityForce(target: THREE.Vector3): THREE.Vector3 {
    const earthGravityVector = new THREE.Vector3()
      .subVectors(this.position, target) // Earth - Rocket
      .normalize();

    const distanceToRocketMeters = this.position.distanceTo(target) * 1000; // Convert km to meters

    // Calculate gravitational force
    const gravityForceMagnitude =
      (Earth.G * Earth.MASS) / distanceToRocketMeters ** 2;

    return earthGravityVector.multiplyScalar(gravityForceMagnitude * 0.001); // Convert to km/s^2
  }

  /**
   * @returns The distance to the surface of the Earth in kilometers.
   */
  calcAltitude(position: THREE.Vector3): number {
    const distanceToEarthCenters = this.position.distanceTo(position);
    return distanceToEarthCenters - Earth.RADIUS;
  }

  update(tick: number) {}

  geoCoordinatesToPosition(latitude: number, longitude: number): THREE.Vector3 {
    const phi = (90 - latitude) * (Math.PI / 180); // Convert latitude to polar angle
    const theta = (longitude + 180) * (Math.PI / 180); // Convert longitude to azimuthal angle

    const x = Earth.RADIUS * Math.sin(phi) * Math.cos(theta);
    const y = Earth.RADIUS * Math.cos(phi);
    const z = Earth.RADIUS * Math.sin(phi) * Math.sin(theta);

    return new THREE.Vector3(x, y, z);
  }

  positionToGeoCoordinates(position: THREE.Vector3): {
    latitude: number;
    longitude: number;
  } {
    const latitude =
      90 - Math.acos(position.y / Earth.RADIUS) * (180 / Math.PI);
    const longitude =
      Math.atan2(position.z, position.x) * (180 / Math.PI) - 180;

    return { latitude, longitude };
  }
}


export default Earth;