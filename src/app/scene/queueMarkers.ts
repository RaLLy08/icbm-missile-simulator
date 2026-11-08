import * as THREE from 'three';
import type { LaunchQueueItem } from '../store/types';

type Marker = THREE.Mesh | THREE.Group;

const faceOutward = (object: THREE.Object3D, position: THREE.Vector3) => {
  object.position.copy(position);
  const normal = position.clone().normalize();
  object.lookAt(position.clone().add(normal));
};

export const createHighlightRing = (position: THREE.Vector3, color: number) => {
  const geometry = new THREE.TorusGeometry(150, 14, 16, 100);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.9,
  });
  const ring = new THREE.Mesh(geometry, material);
  faceOutward(ring, position);
  return ring;
};

export const createQueueMarker = (
  position: THREE.Vector3,
  color: number,
  type: 'start' | 'target'
): Marker => {
  let marker: Marker;

  if (type === 'start') {
    // Sphere (point) for the start position
    const geometry = new THREE.SphereGeometry(50, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.7,
    });
    marker = new THREE.Mesh(geometry, material);
  } else {
    // Cross (two intersecting planes) for the target position
    const size = 100;
    const thickness = 10;
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    });
    const group = new THREE.Group();
    group.add(
      new THREE.Mesh(new THREE.PlaneGeometry(size, thickness), material)
    );
    group.add(
      new THREE.Mesh(new THREE.PlaneGeometry(thickness, size), material.clone())
    );
    marker = group;
  }

  faceOutward(marker, position);
  return marker;
};

const START_COLOR = 0x00ffff;
const TARGET_COLOR = 0xffff00;

/**
 * Replaces `prevMarkers` in the scene with markers for every queued launch,
 * plus highlight rings around the selected one. Returns the new markers.
 */
export const syncQueueMarkers = (
  scene: THREE.Scene,
  queue: LaunchQueueItem[],
  selectedId: number | null,
  prevMarkers: Marker[]
): Marker[] => {
  prevMarkers.forEach((marker) => scene.remove(marker));

  const markers: Marker[] = [];
  queue.forEach((item) => {
    markers.push(
      createQueueMarker(item.startPosition, START_COLOR, 'start'),
      createQueueMarker(item.targetPosition, TARGET_COLOR, 'target')
    );
    if (item.id === selectedId) {
      markers.push(
        createHighlightRing(item.startPosition, START_COLOR),
        createHighlightRing(item.targetPosition, TARGET_COLOR)
      );
    }
  });

  markers.forEach((marker) => scene.add(marker));
  return markers;
};
