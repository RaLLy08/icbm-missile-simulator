import type * as THREE from 'three';
import type { Pane } from 'tweakpane';
import type Earth from '../earth/Earth';
import type EarthView from '../earth/EarthView';
import type CameraManager from '../helpers/CameraManager';
import type Launcher from '../launcher/Launcher';
import type LauncherGui from '../launcher/Launcher.gui';
import type LauncherView from '../launcher/LauncherView';
import type WorldGui from '../WorldGui';

/** Anything ticked by the animation loop. */
export type Updatable = {
  [key: string]: any;
  update: (deltaTime?: number) => void;
  /** Receives wall-clock delta instead of (pausable) simulation delta. */
  usesRealTime?: boolean;
};

/** Long-lived scene objects shared by the simulation modules. */
export type SimulationContext = {
  scene: THREE.Scene;
  updateTriggers: Updatable[];
  earth: Earth;
  earthView: EarthView;
  cameraManager: CameraManager;
  launcher: Launcher;
  launcherGui: LauncherGui;
  launcherView: LauncherView;
  worldGui: WorldGui;
  rocketGuiPane: Pane;
  rocketGuiContainer: HTMLElement;
};

/** Removes an item from the update loop (no-op if it isn't there). */
export const removeTrigger = (triggers: Updatable[], item: Updatable) => {
  const index = triggers.indexOf(item);
  if (index >= 0) triggers.splice(index, 1);
};
