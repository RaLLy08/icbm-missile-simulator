import clsx from 'clsx';
import s from '../OrbitalVelocity.module.scss';
import { useSimulatorStore } from '../store/useSimulatorStore';

type Props = {
  /** DOM id of the follower; the scene moves it every frame. */
  mouseFollowerId: string;
};

/** Cancel button and cursor-following coordinates while picking a position. */
const PositionSelectionOverlay = ({ mouseFollowerId }: Props) => {
  const isActive = useSimulatorStore(
    (st) => st.startPositionActive || st.targetPositionActive
  );
  const activePositionGeo = useSimulatorStore((st) => st.activePositionGeo);
  const resetActivePosition = useSimulatorStore((st) => st.resetActivePosition);

  return (
    <>
      {isActive && (
        <div className={s.clearLaunchPad}>
          <button
            className={s.button}
            onClick={(e) => {
              e.stopPropagation();
              resetActivePosition();
            }}
          >
            Cancel
          </button>
        </div>
      )}

      <div
        id={mouseFollowerId}
        className={clsx(s.mouseFollower, { [s.hide]: !isActive })}
      >
        <div className={s.coordBox}>
          {isActive && (
            <>
              <span className={s.coordItem}>
                ↔ {activePositionGeo?.longitude.toFixed(1)}
              </span>
              <span className={s.coordItem}>
                ↕ {activePositionGeo?.latitude.toFixed(1)}
              </span>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default PositionSelectionOverlay;
