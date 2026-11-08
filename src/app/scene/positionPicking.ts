import * as THREE from 'three';
import Earth from '../earth/Earth';
import { useSimulatorStore } from '../store/useSimulatorStore';
import type { SimulationContext } from './types';

const TAP_MAX_MOVE_PX = 8;

const toNdc = (x: number, y: number) =>
  new THREE.Vector2(
    (x / window.innerWidth) * 2 - 1,
    -(y / window.innerHeight) * 2 + 1
  );

/**
 * Picking start/target points on the globe: a live preview under the
 * pointer (call `update` every frame) and a tap/click to place the point.
 */
export const setupPositionPicking = (
  { cameraManager, earthView, launcher, launcherView }: SimulationContext,
  canvas: HTMLCanvasElement,
  mouseFollower: HTMLElement | null
) => {
  const store = useSimulatorStore.getState;

  const intersectEarth = (x: number, y: number) =>
    cameraManager.getMeshIntersectionPoint(earthView.mesh, toNdc(x, y));

  const pickAt = (clientX: number, clientY: number) => {
    const point = intersectEarth(clientX, clientY);
    if (point == null) return;

    const geo = Earth.positionToGeoCoordinates(point);
    const { startPositionActive, targetPositionActive } = store();

    if (startPositionActive) {
      launcherView.setStartPosition(point);
      launcher.setStartPosition(point);
      store().setStartPicked(geo);
    }
    if (targetPositionActive) {
      launcherView.setTargetPosition(point);
      launcher.setTargetPosition(point);
      store().setTargetPicked(geo);
    }

    store().setIsCalculateTrajectoryDisabled(
      !(launcher.rocketStartPosition && launcher.rocketTargetPosition)
    );
  };

  // Pointer position for the selection preview, taken only from pointers
  // over the 3D canvas. The global mouse tracker also receives the emulated
  // mousemove of a tap on a UI button (e.g. "Set Start" on mobile), which
  // would put the preview on the Earth behind the panel.
  const previewPointer = { x: 0, y: 0, valid: false };

  const update = () => {
    const { startPositionActive, targetPositionActive } = store();
    if (!startPositionActive && !targetPositionActive) return;

    if (mouseFollower) {
      mouseFollower.style.visibility = previewPointer.valid ? '' : 'hidden';
    }
    if (!previewPointer.valid) return;

    if (mouseFollower) {
      mouseFollower.style.left = `${previewPointer.x}px`;
      mouseFollower.style.top = `${previewPointer.y}px`;
    }

    const point = intersectEarth(previewPointer.x, previewPointer.y);
    if (point == null) return;

    if (startPositionActive) launcherView.setActivePosition(point, 'start');
    if (targetPositionActive) launcherView.setActivePosition(point, 'target');
    store().setActivePositionGeo(Earth.positionToGeoCoordinates(point));
  };

  // Pick only on a tap/click that starts and ends on the 3D canvas without
  // dragging. Listening on window made presses on UI buttons (e.g. the tap
  // that enables "Set Start" on mobile) immediately pick the point behind
  // them, and rotating the globe placed a point too.
  let tapStart: { id: number; x: number; y: number } | null = null;

  const onCanvasPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Second finger -> pinch/rotate gesture, not a tap
    tapStart = tapStart
      ? null
      : { id: e.pointerId, x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: PointerEvent) => {
    const start = tapStart;
    tapStart = null;
    if (!start || start.id !== e.pointerId) return;
    if (e.target !== canvas) return;
    const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
    if (moved > TAP_MAX_MOVE_PX) return;
    pickAt(e.clientX, e.clientY);
  };
  const onPointerCancel = () => {
    tapStart = null;
  };

  // Preview follows only pointers over the canvas (hover for mouse, the
  // finger for touch). Any press elsewhere (UI) invalidates it.
  const onPreviewPointer = (e: PointerEvent) => {
    if (e.target !== canvas) {
      if (e.type === 'pointerdown') previewPointer.valid = false;
      return;
    }
    previewPointer.x = e.clientX;
    previewPointer.y = e.clientY;
    previewPointer.valid = true;
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') store().resetActivePosition();
  };

  canvas.addEventListener('pointerdown', onCanvasPointerDown);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerCancel);
  window.addEventListener('pointerdown', onPreviewPointer, true);
  window.addEventListener('pointermove', onPreviewPointer, true);
  window.addEventListener('keydown', onKeyDown);

  const dispose = () => {
    canvas.removeEventListener('pointerdown', onCanvasPointerDown);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerCancel);
    window.removeEventListener('pointerdown', onPreviewPointer, true);
    window.removeEventListener('pointermove', onPreviewPointer, true);
    window.removeEventListener('keydown', onKeyDown);
  };

  return { update, dispose };
};
