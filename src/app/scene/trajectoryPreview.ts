import * as THREE from 'three';

const PREVIEW_COLOR = 0xff4500;

/** Live preview of the best candidate's flight path while calculating. */
export const createTrajectoryPreview = (scene: THREE.Scene) => {
  const line = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({
      color: PREVIEW_COLOR,
      transparent: true,
      opacity: 0.9,
    })
  );
  line.frustumCulled = false;
  line.visible = false;
  scene.add(line);

  const impactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(40, 16, 16),
    new THREE.MeshBasicMaterial({ color: PREVIEW_COLOR })
  );
  impactMarker.visible = false;
  scene.add(impactMarker);

  let shownPoints: THREE.Vector3[] | null = null;

  const show = (points: THREE.Vector3[] | null) => {
    if (points === shownPoints) return;
    shownPoints = points;

    line.geometry.dispose();
    line.geometry = new THREE.BufferGeometry().setFromPoints(points ?? []);

    const hasPoints = !!points && points.length > 1;
    line.visible = hasPoints;
    impactMarker.visible = hasPoints;
    if (hasPoints) impactMarker.position.copy(points[points.length - 1]);
  };

  return { show };
};

export type TrajectoryPreview = ReturnType<typeof createTrajectoryPreview>;
