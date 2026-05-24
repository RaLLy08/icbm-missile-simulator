import * as THREE from 'three';
import Earth from '../earth/Earth';
import { type DefenseSpec } from './DefenseDatabase';
import Interceptor from './Interceptor';

export interface HostileTarget {
  id: number;
  getPosition: () => THREE.Vector3;
  getVelocity: () => THREE.Vector3;
  isDead: () => boolean;
  die: () => void;
}

export default class DefenseSystem {
  position: THREE.Vector3;
  interceptors: Interceptor[] = [];
  ammo: number;
  engagedTargetIds: Set<number> = new Set();
  private interceptorIdCounter = 0;

  constructor(
    private earth: Earth,
    position: THREE.Vector3,
    public spec: DefenseSpec,
    public id: number
  ) {
    this.position = position.clone();
    this.ammo = spec.maxAmmo;
  }

  isInRadarRange(targetPos: THREE.Vector3): boolean {
    return this.position.distanceTo(targetPos) <= this.spec.radarRange;
  }

  tryEngage(target: HostileTarget): Interceptor | null {
    if (this.ammo <= 0) return null;
    if (this.engagedTargetIds.has(target.id)) return null;
    if (target.isDead()) return null;

    const targetPos = target.getPosition();
    if (!this.isInRadarRange(targetPos)) return null;

    this.ammo--;
    this.engagedTargetIds.add(target.id);

    const interceptor = new Interceptor(
      this.earth,
      this.position,
      this.spec,
      target.getPosition,
      target.getVelocity,
      this.interceptorIdCounter++,
      target.id
    );

    this.interceptors.push(interceptor);
    return interceptor;
  }

  update(tick: number) {
    for (let i = this.interceptors.length - 1; i >= 0; i--) {
      const ic = this.interceptors[i];
      ic.update(tick);
      if (ic.hasExpired || ic.hasIntercepted) {
        this.interceptors.splice(i, 1);
        this.engagedTargetIds.delete(ic.targetId);
      }
    }
  }

  get statusText(): string {
    if (this.ammo <= 0) return 'Out of ammo';
    const active = this.interceptors.length;
    if (active > 0) return `Engaging (${active} active)`;
    return `Ready (${this.ammo} remaining)`;
  }
}
