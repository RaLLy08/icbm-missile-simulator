import s from '../OrbitalVelocity.module.scss';
import { getCommands, useSimulatorStore } from '../store/useSimulatorStore';

const TIME_MULTIPLIER_PRESETS = [1, 2, 5, 10, 50];

const TimeControls = () => {
  const isTimeRunning = useSimulatorStore((st) => st.isTimeRunning);
  const timeMultiplier = useSimulatorStore((st) => st.timeMultiplier);

  return (
    <div className={s.timeMultiplier}>
      <button
        className={s.timeMultiplierButton}
        title={isTimeRunning ? 'Pause time' : 'Resume time'}
        onClick={(e) => {
          e.stopPropagation();
          getCommands().toggleTime();
        }}
      >
        {isTimeRunning ? '⏸️' : '▶️'}
      </button>
      <button
        className={s.timeMultiplierButton}
        title="Click to change time multiplier"
        onClick={(e) => {
          e.stopPropagation();
          const next =
            TIME_MULTIPLIER_PRESETS.find((v) => v > timeMultiplier) ??
            TIME_MULTIPLIER_PRESETS[0];
          getCommands().setTimeMultiplier(next);
        }}
      >
        ⏩ {timeMultiplier}x
      </button>
    </div>
  );
};

export default TimeControls;
