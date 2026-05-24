import * as THREE from 'three';
import Interceptor from './Interceptor';
import DefenseSystem from './DefenseSystem';

const RADAR_RING_SEGMENTS = 64;

export default class DefenseView {
  private radarRings: THREE.LineLoop[] = [];
  private interceptorMeshes: Map<number, THREE.Mesh> = new Map();
  private radarDots: THREE.Points | null = null;
  private interceptExplosions: {
    position: THREE.Vector3;
    startTime: number;
    duration: number;
    mesh: THREE.Mesh;
  }[] = [];
  private baseMarker: THREE.Mesh;

  constructor(
    private scene: THREE.Scene,
    private system: DefenseSystem
  ) {
    this.baseMarker = this.createBaseMarker();
    this.scene.add(this.baseMarker);
    this.createRadarRing();
  }

  private createBaseMarker(): THREE.Mesh {
    const geo = new THREE.SphereGeometry(15, 16, 16);
    const mat = new THREE.MeshBasicMaterial({
      color: this.system.spec.color,
      transparent: true,
      opacity: 0.8,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(this.system.position);
    return mesh;
  }

  private createRadarRing() {
    const radius = this.system.spec.radarRange;
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= RADAR_RING_SEGMENTS; i++) {
      const theta = (i / RADAR_RING_SEGMENTS) * Math.PI * 2;
      const x = radius * Math.cos(theta);
      const z = radius * Math.sin(theta);
      points.push(new THREE.Vector3(x, 0, z));
    }

    const normal = this.system.position.clone().normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      normal
    );

    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: this.system.spec.color,
      transparent: true,
      opacity: 0.3,
    });
    const ring = new THREE.LineLoop(geo, mat);
    ring.position.copy(this.system.position);
    ring.quaternion.copy(quat);
    this.scene.add(ring);
    this.radarRings.push(ring);
  }

  showInterceptEffect(position: THREE.Vector3) {
    const geo = new THREE.SphereGeometry(20, 16, 16);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x0088ff,
      transparent: true,
      opacity: 0.9,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position);
    this.scene.add(mesh);
    this.interceptExplosions.push({
      position: position.clone(),
      startTime: Date.now(),
      duration: 500,
      mesh,
    });
  }

  update() {
    for (const ic of this.system.interceptors) {
      let mesh = this.interceptorMeshes.get(ic.id);
      if (!mesh) {
        const geo = new THREE.SphereGeometry(4, 8, 8);
        const mat = new THREE.MeshBasicMaterial({
          color: this.system.spec.color,
        });
        mesh = new THREE.Mesh(geo, mat);
        this.scene.add(mesh);
        this.interceptorMeshes.set(ic.id, mesh);
      }
      mesh.position.copy(ic.position);

      if (ic.velocity.length() > 0.1) {
        const dir = ic.velocity.clone().normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
        mesh.quaternion.copy(quat);
      }
    }

    for (const [id, mesh] of this.interceptorMeshes) {
      const ic = this.system.interceptors.find((i) => i.id === id);
      if (!ic || ic.hasExpired || ic.hasIntercepted) {
        this.scene.remove(mesh);
        this.interceptorMeshes.delete(id);
      }
    }

    for (let i = this.interceptExplosions.length - 1; i >= 0; i--) {
      const exp = this.interceptExplosions[i];
      const elapsed = Date.now() - exp.startTime;
      if (elapsed > exp.duration) {
        this.scene.remove(exp.mesh);
        this.interceptExplosions.splice(i, 1);
      } else {
        const scale = 1 + (elapsed / exp.duration) * 5;
        exp.mesh.scale.set(scale, scale, scale);
        (exp.mesh.material as THREE.MeshBasicMaterial).opacity =
          1 - elapsed / exp.duration;
      }
    }
  }

  remove() {
    this.scene.remove(this.baseMarker);
    for (const ring of this.radarRings) {
      this.scene.remove(ring);
    }
    for (const [, mesh] of this.interceptorMeshes) {
      this.scene.remove(mesh);
    }
    for (const exp of this.interceptExplosions) {
      this.scene.remove(exp.mesh);
    }
    this.radarRings = [];
    this.interceptorMeshes.clear();
    this.interceptExplosions = [];
  }
}
