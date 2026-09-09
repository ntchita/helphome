// src/api/utils/matcher.ts

export interface Worker {
  id: number;
  name: string;
  skills: string[];
  interests: string[]; // e.g., ["dogs", "music", "outdoors"]
  rate: number;
}

export interface ClientProfile {
  interests: string[];
  needs: string[];
}

/**
 * Calculates a compatibility score (0-100) based on shared interests
 * This implements the "Real Wellness Focus" differentiator
 */
export function calculateWellnessMatch(worker: Worker, client: ClientProfile): number {
  if (!worker.interests || !client.interests || worker.interests.length === 0) {
    return 50; // Default neutral score
  }

  const sharedInterests = worker.interests.filter(i => 
    client.interests.includes(i)
  );

  const totalUniqueInterests = new Set([...worker.interests, ...client.interests]).size;
  
  if (totalUniqueInterests === 0) return 50;

  // Jaccard similarity coefficient scaled to 100
  const score = (sharedInterests.length / totalUniqueInterests) * 100;
  
  return Math.min(Math.round(score), 100);
}

/**
 * Sorts workers by match score descending
 */
export function rankWorkers(workers: Worker[], client: ClientProfile): Worker[] {
  return workers.map(worker => ({
    ...worker,
    // @ts-ignore - adding temporary matchScore for sorting
    matchScore: calculateWellnessMatch(worker, client)
  }))
  .sort((a: any, b: any) => b.matchScore - a.matchScore);
}