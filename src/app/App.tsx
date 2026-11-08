import { useEffect, useId, useRef } from 'react';
import Stats from 'three/examples/jsm/libs/stats.module';
import s from './App.module.scss';
import clsx from 'clsx';

import WorldGui from './WorldGui';
import { useSimulatorStore } from './store/useSimulatorStore';
import { subscribeInstructionsToHash } from './instructions/navigation';
import { createSimulation } from './scene/createSimulation';
import LaunchPad from './components/LaunchPad';
import ReturnToEarthBar from './components/ReturnToEarthBar';
import PositionSelectionOverlay from './components/PositionSelectionOverlay';
import MiniWindow from './components/MiniWindow';
import InstructionsModal from './components/InstructionsModal';

const stats = new Stats();
stats.showPanel(0);
// stats.js sets position:fixed/top-left inline; let the CSS wrapper place it
stats.dom.style.cssText = 'position:relative;cursor:pointer;opacity:0.9;';

const altitudeFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});
const lowAltitudeFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
// One decimal close to the ground (the chase camera near launch)
const formatAltitude = (km: number) => {
  const value = Math.max(0, km);
  const format = value < 10 ? lowAltitudeFormat : altitudeFormat;
  return `📷 ${format.format(value)} km`;
};

const App = () => {
  // Updated imperatively every frame to avoid re-rendering React
  const timePassedTextRef = useRef(WorldGui.formatTimePassed(0));
  const timePassedElRef = useRef<HTMLDivElement | null>(null);
  const altitudeTextRef = useRef('');
  const altitudeElRef = useRef<HTMLDivElement | null>(null);

  const isFocusedOnEarth = useSimulatorStore((st) => st.isFocusedOnEarth);
  const isPositionSelectionActive = useSimulatorStore(
    (st) => st.startPositionActive || st.targetPositionActive
  );

  const sceneContainerId = useId();
  const mainGuiContainerId = useId();
  const rocketGuiContainerId = useId();
  const mouseFollowerId = useId();
  const miniWindowId = useId();

  useEffect(() => subscribeInstructionsToHash(), []);

  useEffect(() => {
    const byId = (id: string) => document.getElementById(id);
    const sceneContainer = byId(sceneContainerId);
    const mainGuiContainer = byId(mainGuiContainerId);
    const rocketGuiContainer = byId(rocketGuiContainerId);
    const miniWindow = byId(miniWindowId);
    if (
      !sceneContainer ||
      !mainGuiContainer ||
      !rocketGuiContainer ||
      !miniWindow
    ) {
      return;
    }

    return createSimulation(
      {
        sceneContainer,
        mainGuiContainer,
        rocketGuiContainer,
        miniWindow,
        mouseFollower: byId(mouseFollowerId),
      },
      {
        extraTriggers: [stats],
        onTimePassedUpdate: (text) => {
          if (text === timePassedTextRef.current) return;
          timePassedTextRef.current = text;
          if (timePassedElRef.current) {
            timePassedElRef.current.textContent = `⏱ ${text}`;
          }
        },
        onCameraAltitudeUpdate: (altitudeKm) => {
          const text = formatAltitude(altitudeKm);
          if (text === altitudeTextRef.current) return;
          altitudeTextRef.current = text;
          if (altitudeElRef.current) altitudeElRef.current.textContent = text;
        },
      }
    );
  }, []);

  return (
    <>
      <div id={sceneContainerId} className={s.sceneContainer}></div>
      <div
        className={clsx(s.container, { [s.hide]: isPositionSelectionActive })}
      >
        <div id={rocketGuiContainerId} className={s.rocketGui}></div>
        <div className={s.topRightPanel}>
          <div
            className={s.stats}
            ref={(el) => el && el.appendChild(stats.dom)}
          ></div>
          <div id={mainGuiContainerId} className={s.mainGui}></div>
        </div>

        <div className={s.topInfo}>
          <div
            className={s.infoChip}
            title="Simulated time passed"
            ref={(el) => {
              timePassedElRef.current = el;
              if (el) el.textContent = `⏱ ${timePassedTextRef.current}`;
            }}
          />
          <div
            className={s.infoChip}
            title="Camera altitude above the Earth's surface"
            ref={(el) => {
              altitudeElRef.current = el;
              if (el) el.textContent = altitudeTextRef.current;
            }}
          />
        </div>

        {isFocusedOnEarth ? <LaunchPad /> : <ReturnToEarthBar />}

        <div className={s.versionBadge}>v{__VERSION__}</div>
      </div>

      <PositionSelectionOverlay mouseFollowerId={mouseFollowerId} />
      <MiniWindow miniWindowId={miniWindowId} />
      <InstructionsModal />
    </>
  );
};

export default App;
