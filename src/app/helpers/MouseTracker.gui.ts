import * as THREE from 'three';
import MouseTracker from './MouseTracker';
import { FolderApi, Pane } from 'tweakpane';

export default class MouseTrackerGui {
  readonly position = new THREE.Vector2();

  velMag = 0; 
  accMag = 0; 

  private readonly folder: FolderApi;
  private tracker: MouseTracker;

  constructor(pane: FolderApi | Pane, tracker: MouseTracker) {
    this.tracker = tracker;
    this.folder = pane.addFolder({ title: 'Mouse', expanded: false });

    const n2 = (v: number) => v.toFixed(2);

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

  update(): void {
    this.position.copy(this.tracker.position);
    this.velMag = this.tracker.velocity.length();
    this.accMag = this.tracker.acceleration.length();

    this.folder.refresh();
  }
}