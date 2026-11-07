import * as THREE from 'three';
import { FolderApi, Pane } from 'tweakpane';
import { formatSeconds } from './utils';

export default class WorldGui {
  folder: FolderApi;
  timeMultiplier = 1;
  timeDeltaTime = 0.01666;
  timePassedSeconds = 0;
  showStars = true;
  onShowStarsChange?: (show: boolean) => void;
  onTimeMultiplierChange?: (value: number) => void;
  onTimeRunningChange?: (isRunning: boolean) => void;
  private guiTimeMultiplier?: ReturnType<FolderApi['addBinding']>;
  private guiStopTimeButton?: ReturnType<FolderApi['addButton']>;

  constructor(
    pane: Pane,
    private clock: THREE.Clock
  ) {
    this.folder = pane.addFolder({
      title: 'World',
      expanded: false,
    });

    this.initGui();
  }

  private initGui() {
    this.guiStopTimeButton = this.folder.addButton({
      title: 'Stop Time',
    });
    this.guiStopTimeButton.on('click', () => this.toggleTime());

    const guiDeltaTime = this.folder.addBinding(this, 'timeDeltaTime', {
      label: 'Seconds Passed Between Frames (s)',
      readonly: true,
      format: (v) => (v != null ? v.toFixed(3) : 'N/A'),
    });

    const guiTimePassedSeconds = this.folder.addBinding(
      this,
      'timePassedSeconds',
      {
        label: 'Time Passed',
        readonly: true,
        format: (v) => {
          const formatted = formatSeconds(v);

          return `${formatted.value.toFixed(1)} ${formatted.unit}`;
        },
      }
    );

    this.guiTimeMultiplier = this.folder.addBinding(this, 'timeMultiplier', {
      label: 'Time Multiplier',
      format: (v) => {
        return v + ' X';
      },
      min: 1,
      max: 300,
      step: 1,
    });

    this.guiTimeMultiplier.on('change', (ev) => {
      this.onTimeMultiplierChange?.(Number(ev.value));
    });

    this.folder
      .addBinding(this, 'showStars', { label: 'Show Stars' })
      .on('change', (ev) => {
        this.onShowStarsChange?.(ev.value);
      });
  }

  toggleTime() {
    if (this.clock.running) {
      this.clock.stop();
    } else {
      this.clock.start();
    }

    const isRunning = this.clock.running;
    if (this.guiStopTimeButton) {
      this.guiStopTimeButton.title = isRunning ? 'Stop Time' : 'Resume Time';
    }
    this.onTimeRunningChange?.(isRunning);
  }

  setTimeMultiplier(value: number) {
    this.timeMultiplier = value;
    this.guiTimeMultiplier?.refresh();
    this.onTimeMultiplierChange?.(value);
  }

  update(tick = 1) {
    this.timeDeltaTime = tick * this.timeMultiplier;
    this.timePassedSeconds += tick * this.timeMultiplier;
  }
}
