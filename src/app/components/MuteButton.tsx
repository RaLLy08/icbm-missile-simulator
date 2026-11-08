import { getCommands, useSimulatorStore } from '../store/useSimulatorStore';

type Props = {
  className?: string;
};

const MuteButton = ({ className }: Props) => {
  const isMuted = useSimulatorStore((st) => st.isMuted);

  return (
    <button
      className={className}
      onClick={(e) => {
        e.stopPropagation();
        getCommands().setMuted(!isMuted);
      }}
      title={isMuted ? 'Unmute all sounds' : 'Mute all sounds'}
      aria-pressed={isMuted}
    >
      {isMuted ? '🔇' : '🔊'}
    </button>
  );
};

export default MuteButton;
