import { useLayoutEffect, useRef } from 'react';
import clsx from 'clsx';
import s from '../App.module.scss';
import { getCommands, useSimulatorStore } from '../store/useSimulatorStore';
import { INSTRUCTIONS_MENU } from '../instructions/pages';
import { openInstructionsPage } from '../instructions/navigation';
import type { GeoPosition } from '../store/types';
import MuteButton from './MuteButton';
import TimeControls from './TimeControls';
import LaunchQueuePanel from './LaunchQueuePanel';
import CandidatePanel from './CandidatePanel';

const Coordinates = ({ geo }: { geo: GeoPosition | null }) =>
  geo?.longitude != null ? (
    <div className={s.coordinates}>
      Lon: {geo.longitude.toFixed(1)} <br />
      Lat: {geo.latitude.toFixed(1)}
    </div>
  ) : null;

/**
 * Side panels sit to the right of the launch pad; when they'd overflow the
 * viewport, stack them above it instead. Measured from the children's own
 * (max-content) widths, which don't depend on the mode, so it can't flap.
 */
const useSidePanelsStacking = () => {
  const launchPadRef = useRef<HTMLDivElement | null>(null);
  const sidePanelsRef = useRef<HTMLDivElement | null>(null);
  const setAreSidePanelsStacked = useSimulatorStore(
    (st) => st.setAreSidePanelsStacked
  );

  // Runs after every render: panel contents change their widths
  useLayoutEffect(() => {
    const check = () => {
      const pad = launchPadRef.current;
      const panels = sidePanelsRef.current;
      if (!pad || !panels) return;
      const SIDE_OFFSET = 12; // .sidePanels left: calc(100% + 12px)
      const EDGE_MARGIN = 8;
      const gap = parseFloat(getComputedStyle(panels).columnGap) || 0;
      const children = Array.from(panels.children) as HTMLElement[];
      const required =
        children.reduce((sum, el) => sum + el.offsetWidth, 0) +
        gap * Math.max(0, children.length - 1);
      const fits =
        pad.getBoundingClientRect().right + SIDE_OFFSET + required <=
        window.innerWidth - EDGE_MARGIN;
      setAreSidePanelsStacked(!fits);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  });

  return { launchPadRef, sidePanelsRef };
};

const LaunchPad = () => {
  const startPositionActive = useSimulatorStore((st) => st.startPositionActive);
  const targetPositionActive = useSimulatorStore(
    (st) => st.targetPositionActive
  );
  const startPositionGeo = useSimulatorStore((st) => st.startPositionGeo);
  const targetPositionGeo = useSimulatorStore((st) => st.targetPositionGeo);
  const calcWasReset = useSimulatorStore((st) => st.calcWasReset);
  const calculationProgress = useSimulatorStore((st) => st.calculationProgress);
  const isCalculateTrajectoryDisabled = useSimulatorStore(
    (st) => st.isCalculateTrajectoryDisabled
  );
  const queueLength = useSimulatorStore((st) => st.launchQueue.length);
  const areSidePanelsStacked = useSimulatorStore(
    (st) => st.areSidePanelsStacked
  );
  const { toggleStartPositionActive, toggleTargetPositionActive } =
    useSimulatorStore.getState();

  // Every render here can change the panels' widths (the queue or the
  // candidate data), so the stacking check re-runs with it.
  useSimulatorStore((st) => st.launchQueue);
  useSimulatorStore((st) => st.selectedQueueItemId);
  useSimulatorStore((st) => st.isQueueCollapsed);
  const { launchPadRef, sidePanelsRef } = useSidePanelsStacking();

  return (
    <div className={s.launchPad} ref={launchPadRef}>
      <button
        className={s.infoButton}
        onClick={(e) => {
          e.stopPropagation();
          openInstructionsPage(INSTRUCTIONS_MENU, 'push');
        }}
        title="How to launch a rocket"
      >
        ℹ️
      </button>
      <MuteButton className={clsx(s.infoButton, s.muteButton)} />

      <div className={s.infoPanel}>
        {startPositionActive && (
          <div className={s.infoText}>Click on Earth to set Start Position</div>
        )}
        {targetPositionActive && (
          <div className={s.infoText}>
            Click on Earth to set Target Position
          </div>
        )}
      </div>

      <TimeControls />

      <div className={s.controls}>
        <div className={s.positionBlock}>
          <button
            className={s.button}
            onClick={(e) => {
              e.stopPropagation();
              toggleStartPositionActive();
            }}
          >
            Set Start
          </button>
          <Coordinates geo={startPositionGeo} />
        </div>

        <div className={s.trajectoryBlock}>
          <button
            className={clsx(s.calculateButton, {
              [s.calcWasReset]: calcWasReset,
            })}
            onClick={(e) => {
              e.stopPropagation();
              if (calculationProgress !== null) return;
              getCommands().calculateTrajectory();
            }}
            disabled={isCalculateTrajectoryDisabled}
          >
            {calculationProgress !== null ? (
              <div className={s.progressWrapper}>
                <div
                  className={s.progressBar}
                  style={{ width: `${Math.round(calculationProgress)}%` }}
                ></div>
                <span className={s.progressText}>
                  {Math.round(calculationProgress)}%
                </span>
              </div>
            ) : (
              'Calculate'
            )}
          </button>
          <button
            className={s.launchButton}
            disabled={queueLength === 0}
            onClick={(e) => {
              e.stopPropagation();
              getCommands().launchRocket();
            }}
          >
            Launch 🚀 {queueLength > 0 && `(${queueLength})`}
          </button>
        </div>

        <div className={s.positionBlock}>
          <button
            className={s.button}
            onClick={(e) => {
              e.stopPropagation();
              toggleTargetPositionActive();
            }}
          >
            Set Target
          </button>
          <Coordinates geo={targetPositionGeo} />
        </div>
      </div>

      {/* Side panels pinned to the right of the launch pad:
          launch queue first, then the selected launch's data */}
      <div
        ref={sidePanelsRef}
        className={clsx(s.sidePanels, { [s.stacked]: areSidePanelsStacked })}
      >
        <LaunchQueuePanel />
        <CandidatePanel />
      </div>
    </div>
  );
};

export default LaunchPad;
