import s from '../OrbitalVelocity.module.scss';
import { useSimulatorStore } from '../store/useSimulatorStore';
import { INSTRUCTIONS_MENU, INSTRUCTIONS_PAGES } from '../instructions/pages';
import {
  backToInstructionsMenu,
  closeInstructions,
  openInstructionsPage,
} from '../instructions/navigation';

const InstructionsModal = () => {
  const instructionsPage = useSimulatorStore((st) => st.instructionsPage);

  if (instructionsPage === null) return null;

  return (
    <div className={s.modalOverlay} onClick={closeInstructions}>
      <div className={s.modalWrapper} onClick={(e) => e.stopPropagation()}>
        <button
          className={s.closeButton}
          onClick={closeInstructions}
          aria-label="Close"
        >
          ✕
        </button>
        {instructionsPage !== INSTRUCTIONS_MENU && (
          <button className={s.backButton} onClick={backToInstructionsMenu}>
            ← Back
          </button>
        )}
        <div className={s.modalContent}>
          {instructionsPage === INSTRUCTIONS_MENU && (
            <>
              <h2 className={s.modalTitle}>Help</h2>
              <nav className={s.pageMenu}>
                {INSTRUCTIONS_PAGES.map((page) => (
                  <button
                    key={page.id}
                    className={s.pageMenuItem}
                    onClick={() =>
                      openInstructionsPage(page.id, 'push', {
                        fromMenu: true,
                      })
                    }
                  >
                    <span className={s.pageMenuText}>
                      <span className={s.pageMenuLabel}>{page.label}</span>
                      <span className={s.pageMenuDescription}>
                        {page.description}
                      </span>
                    </span>
                  </button>
                ))}
              </nav>
            </>
          )}

          {instructionsPage === INSTRUCTIONS_MENU && (
            <a
              className={s.sourceLink}
              href="https://github.com/rally08/icbm-missile-simulator"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg
                width="20"
                height="20"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 98 96"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"
                  fill="currentColor"
                />
              </svg>
              Source code
            </a>
          )}

          {instructionsPage === 'how-it-works' && (
            <>
              <h2 className={s.modalTitle}>How does it work?</h2>
              <div className={s.instructions}>
                <div className={s.step}>
                  <div className={s.stepContent}>
                    <h3>Rocket Equation &amp; Thrust</h3>
                    <p>
                      Rocket motion during fuel burn is described by the{' '}
                      <a
                        className={s.modalLink}
                        href="https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/ideal-rocket-equation/"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Ideal Rocket Equation
                      </a>
                      . At every time step the simulation uses the{' '}
                      <a
                        className={s.modalLink}
                        href="https://www.grc.nasa.gov/www/k-12/airplane/rockth.html"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Rocket Thrust Equation
                      </a>{' '}
                      <strong>F = ṁ · vₑ</strong> to compute the instantaneous
                      force from the exhaust velocity <strong>vₑ</strong> and
                      the mass flow rate <strong>ṁ</strong>.
                    </p>
                  </div>
                </div>

                <div className={s.step}>
                  <div className={s.stepContent}>
                    <h3>Thrust vs. Gravity</h3>
                    <p>
                      The rocket's movement is shaped by two forces: the thrust
                      from burning fuel and Earth's gravity. As fuel burns the
                      rocket gets lighter, so it accelerates faster until
                      burnout, then coasts on gravity alone.
                    </p>
                  </div>
                </div>

                <div className={s.step}>
                  <div className={s.stepContent}>
                    <h3>Gravity Turn</h3>
                    <p>
                      To steer the rocket toward its target, the simulator
                      performs a gravity turn: once a set altitude is reached,
                      the angle of attack changes by <strong>X rad/s</strong>{' '}
                      for <strong>N seconds</strong>. In real rockets this is
                      done with mechanisms like gimbaled nozzles.
                    </p>
                  </div>
                </div>

                <div className={s.step}>
                  <div className={s.stepContent}>
                    <h3>Six Launch Parameters</h3>
                    <p>The whole trajectory is governed by:</p>
                    <ol className={s.paramList}>
                      <li>Altitude at which the gravity turn begins</li>
                      <li>Duration of the gravity turn (s)</li>
                      <li>Rate of turn during the gravity turn (rad/s)</li>
                      <li>Payload and fuel mass</li>
                      <li>
                        Mass flow rate <strong>ṁ</strong> (kg/s): how much fuel
                        burns per unit of time
                      </li>
                      <li>
                        Exhaust velocity <strong>vₑ</strong>: the speed of the
                        exhaust gases
                      </li>
                    </ol>
                  </div>
                </div>

                <div className={s.step}>
                  <div className={s.stepContent}>
                    <h3>Solving the Inverse Problem</h3>
                    <p>
                      The challenge is finding the combination of these six
                      parameters that takes the missile from the launch point to
                      the target. When you press <strong>"Calculate"</strong>, a
                      heuristic{' '}
                      <a
                        className={s.modalLink}
                        href="https://en.wikipedia.org/wiki/Differential_evolution"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <strong>Differential Evolution</strong>
                      </a>{' '}
                      algorithm runs the simulation over and over, searching for
                      the parameter set that minimizes the distance between the
                      rocket's final position and the target.
                    </p>
                  </div>
                </div>

                <div className={s.tip}>
                  <strong>💡 Note:</strong> To keep things simple, atmospheric
                  drag, heat and other external perturbations are not included.
                </div>
              </div>
            </>
          )}

          {instructionsPage === 'how-to-launch' && (
            <>
              <h2 className={s.modalTitle}>How to Launch a Rocket</h2>
              <div className={s.instructions}>
                <div className={s.step}>
                  <div className={s.stepNumber}>1</div>
                  <div className={s.stepContent}>
                    <h3>Set Start Position</h3>
                    <p>
                      Click the <strong>"Set Start"</strong> button, then click
                      anywhere on Earth to select your launch location.
                    </p>
                  </div>
                </div>

                <div className={s.step}>
                  <div className={s.stepNumber}>2</div>
                  <div className={s.stepContent}>
                    <h3>Set Target Position</h3>
                    <p>
                      Click the <strong>"Set Target"</strong> button, then click
                      on Earth to select your target location.
                    </p>
                  </div>
                </div>

                <div className={s.step}>
                  <div className={s.stepNumber}>3</div>
                  <div className={s.stepContent}>
                    <h3>Calculate Trajectory</h3>
                    <p>
                      Click the <strong>"Calculate"</strong> button to compute
                      the optimal flight path. The trajectory will be
                      automatically added to your launch queue when complete.
                    </p>
                  </div>
                </div>

                <div className={s.step}>
                  <div className={s.stepNumber}>4</div>
                  <div className={s.stepContent}>
                    <h3>Queue Multiple Launches</h3>
                    <p>
                      You can repeat steps 1-3 to add multiple launches to your
                      queue. All queued launches will appear in the{' '}
                      <strong>Launch Queue</strong> panel at the bottom-left,
                      with cyan (start) and yellow (target) markers on Earth.
                    </p>
                  </div>
                </div>

                <div className={s.step}>
                  <div className={s.stepNumber}>5</div>
                  <div className={s.stepContent}>
                    <h3>Launch!</h3>
                    <p>
                      Click the <strong>"Launch 🚀"</strong> button to fire the
                      next rocket in your queue. Each click launches one rocket
                      and removes it from the queue. You can launch them one by
                      one, even while time is running!
                    </p>
                  </div>
                </div>

                <div className={s.tip}>
                  <strong>⏸️ Tip:</strong> Stop time using the{' '}
                  <strong>"Stop Time"</strong> button in Main Controls to set up
                  multiple launches, then resume and fire them sequentially!
                </div>

                <div className={s.tip}>
                  <strong>⚡ Tip:</strong> Increase the{' '}
                  <strong>Time Multiplier</strong> in the Main Controls panel to
                  speed up the simulation.
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstructionsModal;
