import GA from "./GA";

const clamp = (value, min, max) => {
  return Math.max(min, Math.min(max, value));
}

/**
 * Differential Evolution (DE) algorithm
 */
export default class DE extends GA {
  constructor(
      {
          CR,
          scalingFactor,
          ...params
      }
  ) {
      super(params);

      this.CR = CR;
      this.scalingFactor = scalingFactor;
  }

  /** 
   * @param {Array} genomeA
   * @param {Array} genomeB
   * @returns {Array} child - New genome created from half of genomeA and half of genomeB
   * */
  crossover(genomeA, genomeB, genomeC) {
      const child = [];
  
      for (let i = 0; i < genomeA.length; i++) {
          let chromosome = genomeA[i];

          if (Math.random() < this.CR) {
            chromosome = genomeA[i] + this.scalingFactor * (genomeB[i] - genomeC[i])
          }

          const { min, max } = this.genomeConstraints[i];

          chromosome = clamp(chromosome, min, max); // may remove?/

          child.push(chromosome);
      }
  
      return child;
  }


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
          const parentC = parents[Math.floor(Math.random() * parents.length)];
          // Crossover between best parent and random parent to increase diversity

          if (j < eliteSize) {
              // Elite genomes pass to next generation without changes
              newPopulation.push(parentA);
              continue;
          }
          
          const child = this.crossover(parentA, parentB, parentC);
      
          if (Math.random() < this.mutationRate) {
              // Mutate child with probability of mutationRate
              this.mutate(child);
          }
  
          newPopulation.push(child);
      }
  
      this.population.push(...newPopulation);
  }

}