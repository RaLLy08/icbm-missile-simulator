import { useEffect } from 'react';
import clsx from 'clsx';
import s from '../App.module.scss';
import { useSimulatorStore } from '../store/useSimulatorStore';

const LaunchQueuePanel = () => {
  const launchQueue = useSimulatorStore((st) => st.launchQueue);
  const isQueueCollapsed = useSimulatorStore((st) => st.isQueueCollapsed);
  const selectedQueueItemId = useSimulatorStore((st) => st.selectedQueueItemId);
  const isConfirmingClear = useSimulatorStore((st) => st.isConfirmingClear);
  const {
    setQueueCollapsed,
    toggleQueueCollapsed,
    requestClearQueue,
    cancelClearQueue,
    toggleSelectedQueueItem,
    removeFromQueue,
  } = useSimulatorStore.getState();

  // Auto-cancel the pending "Confirm" state after a few seconds
  useEffect(() => {
    if (!isConfirmingClear) return;
    const timeout = setTimeout(cancelClearQueue, 3000);
    return () => clearTimeout(timeout);
  }, [isConfirmingClear, cancelClearQueue]);

  if (launchQueue.length === 0) return null;

  return (
    <div className={clsx(s.queueWrapper, { [s.collapsed]: isQueueCollapsed })}>
      <div
        className={s.queuePanel}
        title={isQueueCollapsed ? 'Expand queue' : undefined}
        onClick={(e) => {
          e.stopPropagation();
          if (isQueueCollapsed) setQueueCollapsed(false);
        }}
      >
        <div className={s.queueHeader}>
          <h3>Launch Queue ({launchQueue.length})</h3>
          <button
            className={clsx(s.clearButton, {
              [s.confirming]: isConfirmingClear,
            })}
            onClick={(e) => {
              e.stopPropagation();
              requestClearQueue();
            }}
          >
            {isConfirmingClear ? 'Confirm' : 'Clear All'}
          </button>
        </div>
        {!isQueueCollapsed && (
          <div className={s.queueList}>
            {launchQueue.map((item, index) => (
              <div
                key={item.id}
                className={clsx(s.queueItem, {
                  [s.selected]: item.id === selectedQueueItemId,
                })}
                title="Show start and target on the map"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSelectedQueueItem(item.id);
                }}
              >
                <div className={s.queueItemInfo}>
                  <span className={s.queueItemNumber}>#{index + 1}</span>
                  <div className={s.queueItemCoords}>
                    <div className={s.coordPair}>
                      <span className={s.coordLabel}>Start</span>
                      <span>
                        {item.startGeo.latitude.toFixed(1)},
                        {item.startGeo.longitude.toFixed(1)}
                      </span>
                    </div>
                    <div className={s.coordPair}>
                      <span className={s.coordLabel}>Target</span>
                      <span>
                        {item.targetGeo.latitude.toFixed(1)},
                        {item.targetGeo.longitude.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  className={s.removeButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFromQueue(item.id);
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        className={s.collapseToggle}
        onClick={toggleQueueCollapsed}
        aria-expanded={!isQueueCollapsed}
        title={isQueueCollapsed ? 'Expand queue' : 'Collapse queue'}
      >
        <span className={s.collapseIcon}>▾</span>
      </button>
    </div>
  );
};

export default LaunchQueuePanel;
