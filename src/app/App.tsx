import Earth from './earth/Earth';
import { FlightTrajectory } from './FlightTrajectory';
import OrbitalVelocity from './OrbitalVelocity';
import * as THREE from 'three';

const App = () => {
  return (
    <>
      <OrbitalVelocity />
    </>
  );
};

export default App;



const earth = new Earth();

const rocketInitialPosition = Earth.geoCoordinatesToPosition(90, 0);
const rocketTargetPosition = Earth.geoCoordinatesToPosition(180, 0);

const euclideanDistance = rocketInitialPosition
  .clone()
  .sub(rocketTargetPosition)
  .length();


const ft = new FlightTrajectory(
  earth,
  rocketInitialPosition,
  rocketTargetPosition,
  {
    startInclineAfterDistance: {
      min: 0,
      max: 100,
    },
    thrustInclineMaxDuration: {
      min: 2,
      max: 3 * 60,
    },
    thrustInclineVelocity: {
      min: 0,
      max: THREE.MathUtils.degToRad(5),
    },
    fuelCombustionTime: {
      min: 60 * 2,
      max: 60 * 5,
    },
  },
  {
    maxDistanceThreshold: euclideanDistance * 8,
    maxFlightTimeSeconds: 60 * 60, // 45 minutes
  }
);

// ft.onProgress = (bestGenome, progress) => {
//   console.log('Best genome:', bestGenome.fitness);
// };

// ft.calcTrajectory(0).then((bestGenome) => {
//   console.log('Best genome fitness:', bestGenome.fitness);
//   console.log('Best genome:', Array.from(bestGenome));
// });
