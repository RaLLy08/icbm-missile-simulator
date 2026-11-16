import { FolderApi, Pane } from 'tweakpane';
import {
  CUSTOM_MISSILE_ID,
  MISSILES,
  getMissileById,
  type MissileSpec,
} from './MissileDatabase';

type BindingApi = ReturnType<FolderApi['addBinding']>;

/** Preset selected on startup */
const DEFAULT_MISSILE = getMissileById(CUSTOM_MISSILE_ID)!;

export interface CalculationRange {
  min: number;
  max: number;
}

export interface StageCalculationBounds {
  stage: number;
  exhaustVelocity: CalculationRange; // m/s
  massFlowRate: CalculationRange; // kg/s
  fuelMass: CalculationRange; // kg
}

export interface CalculationBounds {
  startInclineAfterAltitude: CalculationRange; // m
  thrustInclineMaxDuration: CalculationRange; // seconds
  thrustInclineVelocityDeg: CalculationRange; // degrees per second
  /** Burnt in ascending `stage` order */
  stages: StageCalculationBounds[];
}

const cloneStageBounds = (
  s: StageCalculationBounds,
  stage: number
): StageCalculationBounds => ({
  stage,
  exhaustVelocity: { ...s.exhaustVelocity },
  massFlowRate: { ...s.massFlowRate },
  fuelMass: { ...s.fuelMass },
});

export default class LauncherGui {
  private folder: FolderApi;

  selectedMissileId = DEFAULT_MISSILE.id;
  selectedMissileLabel = DEFAULT_MISSILE.name;

  minimizeFlightTime = true;
  increaseCalculationAccuracy = false;
  showCalculationPreview = false;
  showTrails = true;

  /** Called when "Show Trails" is toggled. */
  onShowTrailsChange: ((visible: boolean) => void) | null = null;

  startLongitude: number | string = 'N/A';
  startLatitude: number | string = 'N/A';

  missileCount = 0;
  missileSizeMultiplier = 1;

  /** Payload of the selected missile, kg */
  payloadMass = DEFAULT_MISSILE.payloadMass;

  /** Real length of the selected missile, m */
  missileHeight: number | null = DEFAULT_MISSILE.height;

  calculationBounds: CalculationBounds = {
    startInclineAfterAltitude: { ...DEFAULT_MISSILE.startInclineAfterAltitude },
    thrustInclineMaxDuration: { ...DEFAULT_MISSILE.thrustInclineMaxDuration },
    thrustInclineVelocityDeg: { ...DEFAULT_MISSILE.thrustInclineVelocityDeg },
    stages: DEFAULT_MISSILE.stages.map((s) => cloneStageBounds(s, s.stage)),
  };

  private stagesFolder: FolderApi | null = null;
  private stageFolders: FolderApi[] = [];
  /** min/max bindings of the guidance ranges, refreshed on preset change */
  private guidanceBindings: BindingApi[] = [];

  constructor(pane: Pane) {
    this.folder = pane.addFolder({
      title: 'Launcher',
      expanded: false,
    });

    this.folder
      .addBinding(this, 'selectedMissileId', {
        label: 'Missile',
        options: MISSILES.reduce<Record<string, string>>((acc, m) => {
          acc[m.country ? `${m.name} (${m.country})` : m.name] = m.id;
          return acc;
        }, {}),
      })
      .on('change', (ev) => {
        const missile = getMissileById(ev.value);
        if (!missile) return;
        this.applyMissilePreset(missile);
        this.guidanceBindings.forEach((b) => b.refresh());
        this.renderStages();
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

    this.folder
      .addBinding(this, 'showTrails', {
        label: 'Show Trails',
      })
      .on('change', (ev) => {
        this.onShowTrailsChange?.(ev.value);
      });

    this.folder.addBinding(this, 'missileCount', {
      label: 'Launched Missile Count',
      readonly: true,
      format: (v) => {
        return `${v.toFixed(0)} missiles`;
      },
    });

    const calculationFolder = this.folder.addFolder({
      title: 'Missile Calculation Preset',
      expanded: false,
    });

    calculationFolder.addBlade({
      view: 'notice',
      title: 'Info',
      variant: 'info',
      description:
        'These constraints define the range of values for the missile calculation parameters. Change them only if you know what you want to achieve.',
    });

    const bounds = this.calculationBounds;

    calculationFolder.addBlade({ view: 'title', title: 'Payload Mass', unit: 'kg' });
    const payloadBinding = calculationFolder.addBinding(this, 'payloadMass', {
      label: 'value',
      min: 1,
      step: 10,
    });

    this.guidanceBindings = [
      payloadBinding,
      ...this.addRangeBindings(
        calculationFolder,
        bounds.startInclineAfterAltitude,
        'Gravity Turn Start Altitude',
        'm',
        { min: 0, step: 10 }
      ),
      ...this.addRangeBindings(
        calculationFolder,
        bounds.thrustInclineMaxDuration,
        'Gravity Turn Duration',
        's',
        { min: 0, step: 1 }
      ),
      ...this.addRangeBindings(
        calculationFolder,
        bounds.thrustInclineVelocityDeg,
        'Gravity Turn Velocity',
        '°/s',
        { min: 0, max: 90, step: 0.1 }
      ),
    ];

    const stagesFolder = calculationFolder.addFolder({
      title: 'Stages',
      expanded: true,
    });
    this.stagesFolder = stagesFolder;

    stagesFolder.addButton({ title: 'Add Stage' }).on('click', () => {
      const stages = this.calculationBounds.stages;
      const last = stages[stages.length - 1];
      stages.push(cloneStageBounds(last, last.stage + 1));
      this.renderStages();
    });

    stagesFolder.addButton({ title: 'Remove Last Stage' }).on('click', () => {
      if (this.calculationBounds.stages.length <= 1) return;
      this.calculationBounds.stages.pop();
      this.renderStages();
    });

    this.renderStages();
  }

  /** Rebuilds one folder of search ranges per stage. */
  private renderStages() {
    const stagesFolder = this.stagesFolder;
    if (!stagesFolder) return;

    this.stageFolders.forEach((folder) => folder.dispose());

    this.stageFolders = this.calculationBounds.stages.map((stage, i) => {
      // Folders are appended after the add/remove buttons
      const folder = stagesFolder.addFolder({
        title: `Stage ${i + 1}`,
        expanded: true,
      });

      this.addRangeBindings(
        folder,
        stage.exhaustVelocity,
        'Exhaust Velocity (vₑ)',
        'm/s',
        { min: 0, step: 10 }
      );
      this.addRangeBindings(
        folder,
        stage.massFlowRate,
        'Mass Flow Rate (ṁ)',
        'kg/s',
        { min: 0.1, step: 1 }
      );
      this.addRangeBindings(folder, stage.fuelMass, 'Fuel Mass', 'kg', {
        min: 0,
        step: 100,
      });

      return folder;
    });
  }

  /**
   * Copies a missile's ranges into `calculationBounds`. Guidance ranges are
   * updated in place so their existing bindings stay attached.
   */
  private applyMissilePreset(missile: MissileSpec) {
    const bounds = this.calculationBounds;

    Object.assign(
      bounds.startInclineAfterAltitude,
      missile.startInclineAfterAltitude
    );
    Object.assign(
      bounds.thrustInclineMaxDuration,
      missile.thrustInclineMaxDuration
    );
    Object.assign(
      bounds.thrustInclineVelocityDeg,
      missile.thrustInclineVelocityDeg
    );
    bounds.stages = missile.stages.map((s) => cloneStageBounds(s, s.stage));

    this.payloadMass = missile.payloadMass;
    this.missileHeight = missile.height;
    this.selectedMissileLabel = missile.name;
  }

  /** Adds min/max inputs for a search range, keeping min <= max. */
  private addRangeBindings(
    folder: FolderApi,
    range: CalculationRange,
    label: string,
    unit: string,
    params: { min?: number; max?: number; step?: number }
  ): BindingApi[] {
    folder.addBlade({ view: 'title', title: label, unit });

    const minBinding = folder.addBinding(range, 'min', {
      label: 'min',
      ...params,
    });
    const maxBinding = folder.addBinding(range, 'max', {
      label: 'max',
      ...params,
    });

    minBinding.on('change', (ev) => {
      if (ev.value > range.max) {
        range.max = ev.value;
        maxBinding.refresh();
      }
    });
    maxBinding.on('change', (ev) => {
      if (ev.value < range.min) {
        range.min = ev.value;
        minBinding.refresh();
      }
    });

    return [minBinding, maxBinding];
  }
}
