import * as THREE from 'three';
import earth8kTextureJpg from 'public/textures/8k_earth_daymap.jpg';
import Rocket from './Rocket';

const earthTexture = new THREE.TextureLoader().load(earth8kTextureJpg);


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

  private geometry: THREE.SphereGeometry;
  private material: THREE.MeshPhongMaterial;
  mesh: THREE.Mesh;

  constructor(private readonly scene: THREE.Scene) {
    const segments = 128;

    this.geometry = new THREE.SphereGeometry(Earth.RADIUS, segments, segments);
    this.material = new THREE.MeshPhongMaterial({
      map: earthTexture,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);

    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    this.mesh.name = Earth.name;
    this.mesh.position.set(0, 0, 0);

    this.scene.add(this.mesh);
  }

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
      .subVectors(this.mesh.position, target) // Earth - Rocket
      .normalize();

    const distanceToRocketMeters = this.mesh.position.distanceTo(target) * 1000; // Convert km to meters

    // Calculate gravitational force
    const gravityForceMagnitude =
      (Earth.G * Earth.MASS) / distanceToRocketMeters ** 2;

    return earthGravityVector.multiplyScalar(gravityForceMagnitude * 0.001); // Convert to km/s^2
  }

  distanceToSurface(position: THREE.Vector3): number {
    const distanceToEarthCenters = this.mesh.position.distanceTo(position);
    return distanceToEarthCenters - Earth.RADIUS; 
  }

  update(tick: number) {
      
  }

  geoCoordinatesToPosition(latitude: number, longitude: number): THREE.Vector3 {
    const phi = (90 - latitude) * (Math.PI / 180); // Convert latitude to polar angle
    const theta = (longitude + 180) * (Math.PI / 180); // Convert longitude to azimuthal angle

    const x = Earth.RADIUS * Math.sin(phi) * Math.cos(theta);
    const y = Earth.RADIUS * Math.cos(phi);
    const z = Earth.RADIUS * Math.sin(phi) * Math.sin(theta);

    return new THREE.Vector3(x, y, z);
  }

  positionToGeoCoordinates(position: THREE.Vector3): { latitude: number; longitude: number } {
    const latitude = 90 - (Math.acos(position.y / Earth.RADIUS) * (180 / Math.PI));
    const longitude = (Math.atan2(position.z, position.x) * (180 / Math.PI)) - 180;

    return { latitude, longitude };
  }
}


export default Earth;