const randFloat = (min, max) => {
  return Math.random() * (max - min) + min;
};

class Genome extends Array {
  fitness = Infinity;

  constructor(genes=[]) {
    super(...genes);
  }
}

export default class GA {
  static pickRandomElements(arr, numElements) {
    const shuffledArray = [...arr];

    // Fisher-Yates shuffle algorithm
    for (let i = shuffledArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledArray[i], shuffledArray[j]] = [
        shuffledArray[j],
        shuffledArray[i],
      ];
    }

    return shuffledArray.slice(0, numElements);
  }

  /**
   * @param {Object} 
  
   * @param {number} params.maxGenerations // Maximum generations for reaching optimum
   * @param {number} params.populationSize // Number of genomes in population
   * @param {number} params.mutationRate // Probability of mutation
   * @param {number} params.elite // Percent of best genomes that will be copied to next generation
   * @param {number} params.bestSurvivePercent // Percent of best genomes that will be used for creating children
   * @param {number} params.genomeLength  // Length of genome
   * @param {Function} params.fitnessFunction // Function for calculating fitness of genome (how genome is close to optimum). The lower value of fitness the better
   * @param {Function} params.randMutationFunction // Function for returning random value for mutation
   * @param {{ min: number, max: number }[]} params.genomeConstraints // 
  */
  constructor({
    maxGenerations,
    populationSize,
    mutationRate,
    elite,
    bestSurvivePercent,
    genomeLength,
    fitnessFunction,
    randMutationFunction,
    genomeConstraints
  }) {
    this.maxGenerations = maxGenerations;
    this.populationSize = populationSize;
    this.mutationRate = mutationRate;
    this.elite = elite;
    this.bestSurvivePercent = bestSurvivePercent;
    this.genomeLength = genomeLength;
    this.fitnessFunction = fitnessFunction;

    this.randMutationFunction = randMutationFunction;
    this.genomeConstraints = genomeConstraints;

    if (genomeConstraints.length !== genomeLength) {
      throw new Error(
        `Genome constraints length ${genomeConstraints.length} must be equal to genome length ${genomeLength}`
      );
    }

    this.population = [];
    // flag for terminating GA
    this._terminate = false;
  }

  /**
   * Filling population with random genomes [... [genomeN] ]
   */
  createInitialPopulation = () => {
    this.population = [];

    for (let i = 0; i < this.populationSize; i++) {
      const genome = new Genome();

      for (let j = 0; j < this.genomeLength; j++) {
        const { min, max } = this.genomeConstraints[j];

        genome.push(
          randFloat(min, max)
        );
      }

      this.population.push(genome);
    }
  };

  calcFitness() {
    this.population.forEach((genome) => {
      genome.fitness = this.fitnessFunction(genome);
    });
  }

  /**
   * @param {number} bestSurvivePercent
   * @param {number} populationSize
   */
  selection(bestSurvivePercent, populationSize) {
    this.calcFitness();
    // Sort population by fitness function smallers first
    const sorted = this.population.sort(
      (a, b) => a.fitness - b.fitness
    );

    const bestParentSurviveSize = Math.floor(
      populationSize * bestSurvivePercent
    );
    const badParentSurviveSize = populationSize - bestParentSurviveSize;

    // Slice of the best genomes by bestSurvivePercent
    const bestSurvive = sorted.slice(0, bestParentSurviveSize);
    // Slice of the rest genomes
    const restSurvive = sorted.slice(
      bestParentSurviveSize,
      this.population.length
    );

    // Supplement population size by picking random genomes from rest worst genomes to keep size of population the same
    // Picking the random genomes is used to keep diversity of population, and not to stuck in local optimum
    const badSurvive = GA.pickRandomElements(restSurvive, badParentSurviveSize);

    this.population = [...bestSurvive, ...badSurvive];
  }

  /**
   * @param {Array} genomeA
   * @param {Array} genomeB
   * @returns {Array} child - New genome created from half of genomeA and half of genomeB
   * */
  crossover(genomeA, genomeB) {
    const mid = Math.floor(this.genomeLength / 2);

    const child = [...genomeA.slice(0, mid), ...genomeB.slice(mid)];

    return child;
  }

  /**
   * Mutate genome by adding random value to random index of genome
   * @param {Array} genome
   */
  mutate = (genome) => {
    const index = Math.floor(Math.random() * genome.length);
    const delta = this.randMutationFunction();

    genome[index] += delta;
  };

  /**
   * Adding new population by creating children from population
   */
  addNewPopulation() {
    const newPopulation = [];

    const parents = this.population;
    const eliteSize = this.elite * this.population.length;

    for (let j = 0; j <= parents.length - 1; j++) {
      const parentA = parents[j];
      const parentB = parents[Math.floor(Math.random() * parents.length)];
      // Crossover between best parent and random parent to increase diversity

      if (j < eliteSize) {
        // Elite genomes pass to next generation without changes
        newPopulation.push(parentA);
        continue;
      }

      const child = this.crossover(parentA, parentB);

      if (Math.random() < this.mutationRate) {
        // Mutate child with probability of mutationRate
        this.mutate(child);
      }

      newPopulation.push(child);
    }

    this.population.push(...newPopulation);
  }

  async run(delay, onGeneration = () => {}) {
    // Creating initial population 1st time
    this.createInitialPopulation();

    for (let i = 0; i < this.maxGenerations; i++) {
      if (this._terminate) {
        return;
      }

      // Wait delay to overcome blocking of UI
      if (delay != null) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      // Adding new population (crossover -> mutation)
      this.addNewPopulation();

      // Selection of best genomes (selection)
      this.selection(this.bestSurvivePercent, this.populationSize);

      onGeneration(i);
    }
  }

  terminate() {
    this._terminate = true;
  }
}
