import * as THREE from 'three';
import { FolderApi, Pane } from 'tweakpane';
import { formatSeconds } from './utils';

export default class WorldGui {
  private folder: FolderApi;
  timeMultiplier = 1;
  timeDeltaTime = 0;
  timePassedSeconds = 0;

  constructor(
    pane: Pane,
    private clock: THREE.Clock
  ) {
    this.folder = pane.addFolder({
      title: 'World',
      expanded: true,
    });

    this.initGui();
  }

  private initGui() {
    this.folder
      .addButton({
        title: 'Stop Time',
      })
      .on('click', (ev) => {
        if (this.clock.running) {
          this.clock.stop();
        } else {
          this.clock.start();
        }

        ev.target.title = this.clock.running ? 'Stop Time' : 'Resume Time';
      });

    const guiTimeMultiplier = this.folder.addBinding(this, 'timeMultiplier', {
      label: 'Time Multiplier',
      min: 1,
      max: 10,
      step: 1,
    });

    const guiDeltaTime = this.folder.addBinding(this, 'timeDeltaTime', {
      label: 'Delta Time Between Frames (s)',
      readonly: true,
      format: (v) => (v != null ? v.toFixed(3) : 'N/A'),
    });

    const guiTimePassedSeconds = this.folder.addBinding(
      this,
      'timePassedSeconds',
      {
        label: 'Time Passed (s)',
        readonly: true,
        format: (v) => {
          const formatted = formatSeconds(v);

          return `${formatted.value.toFixed(1)} ${formatted.unit}`;
        },
      }
    );
  }

  update(tick = 1) {
    this.folder.refresh();

    this.timeDeltaTime = tick;
    this.timePassedSeconds += tick;
  }
}
