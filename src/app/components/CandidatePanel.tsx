import * as THREE from 'three';
import clsx from 'clsx';
import s from '../App.module.scss';
import { formatSeconds } from '../utils';
import { useSimulatorStore } from '../store/useSimulatorStore';
import type { BestCandidate } from '../store/types';

const formatMissDistance = (km: number) => {
  if (km < 10) return `${km.toFixed(2)} km`;
  if (km < 1000) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
};

const formatDuration = (seconds: number) => {
  const { value, unit } = formatSeconds(seconds);
  return `${value.toFixed(1)} ${unit}`;
};

const getCandidateRows = (c: BestCandidate) => [
  {
    key: 'miss',
    label: 'Miss Distance',
    value: formatMissDistance(c.missDistance),
    highlight: true,
  },
  { key: 'fitness', label: 'Fitness', value: c.fitness.toFixed(3) },
  { key: 'd1', label: null, value: null },
  {
    key: 'incline',
    label: 'Turn Start Altitude',
    value: `${c.startInclineAfterDistance.toFixed(2)} km`,
  },
  {
    key: 'turnDuration',
    label: 'Gravity Turn Duration',
    value: formatDuration(c.thrustInclineMaxDuration),
  },
  {
    key: 'turnVelocity',
    label: 'Gravity Turn Rate',
    value: `${THREE.MathUtils.radToDeg(c.thrustInclineVelocity).toFixed(2)}°/s`,
  },
  { key: 'fuel', label: 'Fuel Mass', value: `${c.fuelMass.toFixed(1)} kg` },
  {
    key: 'payload',
    label: 'Payload Mass',
    value: `${c.payloadMass.toFixed(1)} kg`,
  },
  {
    key: 'flow',
    label: 'Mass Flow Rate (ṁ)',
    value: `${c.massFlowRate.toFixed(1)} kg/s`,
  },
  {
    key: 'exhaust',
    label: 'Exhaust Velocity (vₑ)',
    value: `${c.exhaustVelocity.toFixed(2)} km/s`,
  },
  { key: 'd2', label: null, value: null },
  {
    key: 'burn',
    label: 'Burn Time',
    value: formatDuration(c.fuelCombustionTime),
  },
  {
    key: 'apogee',
    label: 'Max Altitude',
    value: `${c.maxAltitude.toFixed(1)} km`,
  },
  {
    key: 'travelled',
    label: 'Travelled Distance',
    value: `${c.travelledDistance.toFixed(1)} km`,
  },
  { key: 'flight', label: 'Flight Time', value: formatDuration(c.flightTime) },
];

/** Parameters of the selected queue item; hidden while calculating. */
const CandidatePanel = () => {
  const isCalculating = useSimulatorStore(
    (st) => st.calculationProgress !== null
  );
  const launchQueue = useSimulatorStore((st) => st.launchQueue);
  const selectedQueueItemId = useSimulatorStore((st) => st.selectedQueueItemId);
  const clearSelectedQueueItem = useSimulatorStore(
    (st) => st.clearSelectedQueueItem
  );

  if (isCalculating) return null;
  const index = launchQueue.findIndex(
    (item) => item.id === selectedQueueItemId
  );
  const candidate = index >= 0 ? launchQueue[index].candidate : null;
  if (!candidate) return null;

  return (
    <div className={s.candidatePanel}>
      <div className={s.candidateHeader}>
        <h3>Launch #{index + 1}</h3>
        <span className={s.candidateGeneration}>
          {candidate.generation} gens
        </span>
        <button
          type="button"
          className={s.candidateClose}
          onClick={(e) => {
            e.stopPropagation();
            clearSelectedQueueItem();
          }}
          title="Close launch data"
          aria-label="Close launch data"
        >
          ✕
        </button>
      </div>
      <dl className={s.candidateList}>
        {getCandidateRows(candidate).map((row) =>
          row.label === null ? (
            <hr key={row.key} className={s.candidateDivider} />
          ) : (
            <div
              key={row.key}
              className={clsx(s.candidateRow, {
                [s.highlight]: row.highlight,
              })}
            >
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          )
        )}
      </dl>
    </div>
  );
};

export default CandidatePanel;
