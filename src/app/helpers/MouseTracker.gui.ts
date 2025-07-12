import * as THREE from 'three';
import MouseTracker from './MouseTracker';
import { FolderApi, Pane } from 'tweakpane';

export default class MouseTrackerGui {
  /* ——— public fields bound to the pane ——— */
  readonly position = new THREE.Vector2();

  velMag = 0; // ‖velocity‖  (units / s)
  accMag = 0; // ‖acceleration‖ (units / s²)

  private readonly folder: FolderApi;
  private tracker: MouseTracker;

  constructor(pane: FolderApi | Pane, tracker: MouseTracker) {
    this.tracker = tracker;
    this.folder = pane.addFolder({ title: 'Mouse', expanded: false });

    /* helper for neat decimals */
    const n2 = (v: number) => v.toFixed(2);

    /* position (vector2 shown as two readonly fields) */
    this.folder.addBinding(this.position, 'x', {
      label: 'Pos X',
      readonly: true,
      format: n2,
    });
    this.folder.addBinding(this.position, 'y', {
      label: 'Pos Y',
      readonly: true,
      format: n2,
    });

    /* velocity & acceleration magnitudes */
    this.folder.addBinding(this, 'velMag', {
      label: '‖Velocity‖',
      readonly: true,
      format: (v) => `${n2(v)} /s`,
    });
    this.folder.addBinding(this, 'accMag', {
      label: '‖Accel‖',
      readonly: true,
      format: (v) => `${n2(v)} /s²`,
    });
  }

  /** Call once per animation frame *after* `tracker.update()`. */
  update(): void {
    /* copy fresh data from tracker */
    this.position.copy(this.tracker.position);
    this.velMag = this.tracker.velocity.length();
    this.accMag = this.tracker.acceleration.length();

    /* tell Tweakpane to repaint */
    this.folder.refresh();
  }
}