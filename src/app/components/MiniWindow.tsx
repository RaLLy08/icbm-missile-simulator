import clsx from 'clsx';
import s from '../App.module.scss';
import { useSimulatorStore } from '../store/useSimulatorStore';

type Props = {
  /** DOM id of the element the scene mounts the minimap renderer into. */
  miniWindowId: string;
};

const MiniWindow = ({ miniWindowId }: Props) => {
  const isOpen = useSimulatorStore((st) => st.isMiniWindowOpen);
  const isFolded = useSimulatorStore((st) => st.isMiniWindowFolded);
  const toggleFolded = useSimulatorStore((st) => st.toggleMiniWindowFolded);

  return (
    <div
      className={clsx(s.miniWindowContainer, {
        [s.miniWindowFolded]: isFolded,
      })}
      style={{ visibility: isOpen ? 'visible' : 'hidden' }}
    >
      <button
        className={s.miniWindowToggle}
        onClick={toggleFolded}
        aria-expanded={!isFolded}
        title={isFolded ? 'Expand minimap' : 'Fold minimap'}
      >
        {isFolded ? '▴ Minimap' : '▾'}
      </button>
      <div
        id={miniWindowId}
        style={{
          position: 'absolute',
          display: isFolded ? 'none' : undefined,
        }}
      ></div>
    </div>
  );
};

export default MiniWindow;
