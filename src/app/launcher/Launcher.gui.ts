import { FolderApi, Pane } from 'tweakpane';
import {
    getMissileOptions,
    getMissileById,
    type MissileSpec,
} from './MissileDatabase';

export default class LauncherGui {
  private folder: FolderApi;

  selectedMissileId = 'us_minuteman3';
  selectedMissileLabel = '';

  minimizeFlightTime = true;
  increaseCalculationAccuracy = false;
  showCalculationPreview = false;

  startLongitude: number | string = 'N/A';
  startLatitude: number | string = 'N/A';

  rocketCount = 0;
  rocketSizeMultiplier = 1;

  onMissileSelected: (spec: MissileSpec) => void = () => {};

  constructor(pane: Pane) {
    this.folder = pane.addFolder({
      title: 'Launcher',
      expanded: false,
    });

    const missile = getMissileById(this.selectedMissileId);
    if (missile) {
      this.selectedMissileLabel = `${missile.country} - ${missile.name}`;
    }

    this.folder
      .addBinding(this, 'selectedMissileId', {
        label: 'Missile Preset',
        view: 'list',
        options: getMissileOptions(),
      })
      .on('change', (ev) => {
        this.selectedMissileId = ev.value;
        const spec = getMissileById(this.selectedMissileId);
        if (spec) {
          this.selectedMissileLabel = `${spec.country} - ${spec.name}`;
          this.onMissileSelected(spec);
        }
      });

    this.folder
      .addBinding(this, 'minimizeFlightTime', {
        label: 'Minimize Flight Time',
        view: 'checkbox',
        input: 'checkbox',
      })
      .on('change', (ev) => {
        this.minimizeFlightTime = ev.value;
      });

    this.folder
      .addBinding(this, 'increaseCalculationAccuracy', {
        label: 'Increase Calculation Precision (slower)',
        view: 'checkbox',
        input: 'checkbox',
      })
      .on('change', (ev) => {
        this.increaseCalculationAccuracy = ev.value;
      });

    this.folder
      .addBinding(this, 'showCalculationPreview', {
        label: 'Animate Trajectory Calculating (slower)',
        view: 'checkbox',
        input: 'checkbox',
      })
      .on('change', (ev) => {
        this.showCalculationPreview = ev.value;
      });

    this.folder.addBinding(this, 'rocketCount', {
      label: 'Rocket Count',
      readonly: true,
      format: (v) => {
        return `${v.toFixed(0)} rockets`;
      },
    });

    this.folder.addBinding(this, 'rocketSizeMultiplier', {
      label: 'Rocket Size Multiplier',
      min: 1,
      max: 100,
      step: 0.1,
      format: (v) => {
        return `${v.toFixed(1)} X`;
      },
    });
  }
}
