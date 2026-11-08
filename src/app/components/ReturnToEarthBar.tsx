import s from '../App.module.scss';
import { getCommands } from '../store/useSimulatorStore';
import MuteButton from './MuteButton';
import TimeControls from './TimeControls';

const ReturnToEarthBar = () => (
  <div className={s.clearLaunchPad}>
    <TimeControls />
    <div className={s.returnRow}>
      <button className={s.button} onClick={() => getCommands().focusOnEarth()}>
        Return to Earth
      </button>
      <MuteButton className={s.inlineMuteButton} />
    </div>
  </div>
);

export default ReturnToEarthBar;
