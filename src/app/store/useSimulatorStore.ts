import { create } from 'zustand';
import { isAudioMuted } from '../helpers/SpatialAudio';
import {
    InstructionsPage,
    getInstructionsPageFromHash,
} from '../instructions/pages';
import { isMobileViewport } from '../viewport';
import type { GeoPosition, LaunchQueueItem, SimulatorCommands } from './types';

const noop = () => {};

const defaultCommands: SimulatorCommands = {
  calculateTrajectory: noop,
  launchRocket: noop,
  focusOnEarth: noop,
  setTimeMultiplier: noop,
  toggleTime: noop,
  setMuted: noop,
};

export type SimulatorState = {
  // Time / audio (mirrors WorldGui, which stays the source of truth)
  timeMultiplier: number;
  isTimeRunning: boolean;
  isMuted: boolean;
  setTimeMultiplier: (value: number) => void;
  setIsTimeRunning: (isRunning: boolean) => void;
  setIsMuted: (muted: boolean) => void;

  // Launch pad
  startPositionActive: boolean;
  targetPositionActive: boolean;
  startPositionGeo: GeoPosition | null;
  targetPositionGeo: GeoPosition | null;
  activePositionGeo: GeoPosition | null;
  calcWasReset: boolean;
  calculationProgress: number | null;
  isCalculateTrajectoryDisabled: boolean;
  isLaunchDisabled: boolean;
  rocketCount: number;
  toggleStartPositionActive: () => void;
  toggleTargetPositionActive: () => void;
  resetActivePosition: () => void;
  setStartPicked: (geo: GeoPosition) => void;
  setTargetPicked: (geo: GeoPosition) => void;
  setActivePositionGeo: (geo: GeoPosition) => void;
  setIsCalculateTrajectoryDisabled: (disabled: boolean) => void;
  startCalculation: () => void;
  setCalculationProgress: (progress: number) => void;
  finishCalculation: () => void;
  setRocketCount: (count: number) => void;

  // Launch queue
  launchQueue: LaunchQueueItem[];
  nextQueueId: number;
  isQueueCollapsed: boolean;
  selectedQueueItemId: number | null;
  isConfirmingClear: boolean;
  enqueueLaunch: (item: Omit<LaunchQueueItem, 'id'>) => void;
  dequeueLaunch: () => LaunchQueueItem | undefined;
  removeFromQueue: (id: number) => void;
  clearQueue: () => void;
  /** First call arms the confirmation, second call clears the queue. */
  requestClearQueue: () => void;
  cancelClearQueue: () => void;
  toggleSelectedQueueItem: (id: number) => void;
  clearSelectedQueueItem: () => void;
  setQueueCollapsed: (collapsed: boolean) => void;
  toggleQueueCollapsed: () => void;

  // View / UI
  isFocusedOnEarth: boolean;
  isMiniWindowOpen: boolean;
  isMiniWindowFolded: boolean;
  instructionsPage: InstructionsPage | null;
  areSidePanelsStacked: boolean;
  focusEarthView: () => void;
  focusRocketView: () => void;
  toggleMiniWindowFolded: () => void;
  setInstructionsPage: (page: InstructionsPage | null) => void;
  setAreSidePanelsStacked: (stacked: boolean) => void;

  // Engine commands (registered by the scene on mount)
  commands: SimulatorCommands;
  registerCommands: (commands: Partial<SimulatorCommands>) => void;
  resetCommands: () => void;
};

/** Drops the selection when its item is no longer in the queue. */
const keepSelection = (
  selectedId: number | null,
  queue: LaunchQueueItem[]
): number | null =>
  selectedId !== null && queue.some((item) => item.id === selectedId)
    ? selectedId
    : null;

export const useSimulatorStore = create<SimulatorState>()((set, get) => ({
  // Time / audio
  timeMultiplier: 1,
  isTimeRunning: true,
  isMuted: isAudioMuted(),
  setTimeMultiplier: (timeMultiplier) => set({ timeMultiplier }),
  setIsTimeRunning: (isTimeRunning) => set({ isTimeRunning }),
  setIsMuted: (isMuted) => set({ isMuted }),

  // Launch pad
  startPositionActive: false,
  targetPositionActive: false,
  startPositionGeo: null,
  targetPositionGeo: null,
  activePositionGeo: null,
  calcWasReset: true,
  calculationProgress: null,
  isCalculateTrajectoryDisabled: true,
  isLaunchDisabled: true,
  rocketCount: 0,
  toggleStartPositionActive: () =>
    set((s) => ({ startPositionActive: !s.startPositionActive })),
  toggleTargetPositionActive: () =>
    set((s) => ({ targetPositionActive: !s.targetPositionActive })),
  resetActivePosition: () =>
    set({ startPositionActive: false, targetPositionActive: false }),
  setStartPicked: (startPositionGeo) =>
    set({ startPositionGeo, startPositionActive: false, calcWasReset: true }),
  setTargetPicked: (targetPositionGeo) =>
    set({ targetPositionGeo, targetPositionActive: false, calcWasReset: true }),
  setActivePositionGeo: (activePositionGeo) => set({ activePositionGeo }),
  setIsCalculateTrajectoryDisabled: (isCalculateTrajectoryDisabled) =>
    set({ isCalculateTrajectoryDisabled }),
  startCalculation: () => set({ calcWasReset: false, isLaunchDisabled: true }),
  setCalculationProgress: (calculationProgress) => set({ calculationProgress }),
  finishCalculation: () =>
    set({ isLaunchDisabled: false, calculationProgress: null }),
  setRocketCount: (rocketCount) => set({ rocketCount }),

  // Launch queue
  launchQueue: [],
  nextQueueId: 0,
  isQueueCollapsed: true,
  selectedQueueItemId: null,
  isConfirmingClear: false,
  enqueueLaunch: (item) =>
    set((s) => ({
      launchQueue: [...s.launchQueue, { ...item, id: s.nextQueueId }],
      nextQueueId: s.nextQueueId + 1,
    })),
  dequeueLaunch: () => {
    const [next, ...rest] = get().launchQueue;
    if (!next) return undefined;
    set((s) => ({
      launchQueue: rest,
      selectedQueueItemId: keepSelection(s.selectedQueueItemId, rest),
    }));
    return next;
  },
  removeFromQueue: (id) =>
    set((s) => {
      const launchQueue = s.launchQueue.filter((item) => item.id !== id);
      return {
        launchQueue,
        selectedQueueItemId: keepSelection(s.selectedQueueItemId, launchQueue),
      };
    }),
  clearQueue: () =>
    set({
      launchQueue: [],
      selectedQueueItemId: null,
      isConfirmingClear: false,
    }),
  requestClearQueue: () => {
    if (!get().isConfirmingClear) {
      set({ isConfirmingClear: true });
      return;
    }
    get().clearQueue();
  },
  cancelClearQueue: () => set({ isConfirmingClear: false }),
  toggleSelectedQueueItem: (id) =>
    set((s) => ({
      selectedQueueItemId: s.selectedQueueItemId === id ? null : id,
    })),
  clearSelectedQueueItem: () => set({ selectedQueueItemId: null }),
  setQueueCollapsed: (isQueueCollapsed) => set({ isQueueCollapsed }),
  toggleQueueCollapsed: () =>
    set((s) => ({ isQueueCollapsed: !s.isQueueCollapsed })),

  // View / UI
  isFocusedOnEarth: true,
  isMiniWindowOpen: false,
  isMiniWindowFolded: isMobileViewport(),
  instructionsPage: getInstructionsPageFromHash(),
  areSidePanelsStacked: false,
  focusEarthView: () =>
    set({ isFocusedOnEarth: true, isMiniWindowOpen: false }),
  focusRocketView: () =>
    set({ isFocusedOnEarth: false, isMiniWindowOpen: true }),
  toggleMiniWindowFolded: () =>
    set((s) => ({ isMiniWindowFolded: !s.isMiniWindowFolded })),
  setInstructionsPage: (instructionsPage) => set({ instructionsPage }),
  setAreSidePanelsStacked: (areSidePanelsStacked) =>
    set((s) =>
      s.areSidePanelsStacked === areSidePanelsStacked
        ? s
        : { areSidePanelsStacked }
    ),

  // Engine commands
  commands: defaultCommands,
  registerCommands: (commands) =>
    set((s) => ({ commands: { ...s.commands, ...commands } })),
  resetCommands: () => set({ commands: defaultCommands }),
}));

/** Shorthand for imperative (non-React) access to the engine commands. */
export const getCommands = () => useSimulatorStore.getState().commands;
