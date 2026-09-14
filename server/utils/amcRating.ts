type AMCRating =
  | "Accessible"
  | "Relaxed"
  | "Easy"
  | "Moderate"
  | "Vigorous"
  | "Strenuous";

export type StubTrailDifficulty = {
  trailId: number;
  name: string;
  rating: AMCRating;
};

export interface TrailMetrics {
  durationHours: number;
  mileage: number;
  elevationGainFt: number;
  isYouthOrFamily: boolean;
  isBackpacking?: boolean;
}

const STUB_TRAIL_METRICS: Array<{
  trailId: number;
  name: string;
  metrics: TrailMetrics;
}> = [
  {
    trailId: 1,
    name: "Stub Valley Loop",
    metrics: {
      durationHours: 3.5,
      mileage: 5,
      elevationGainFt: 800,
      isYouthOrFamily: false,
    },
  },
  {
    trailId: 2,
    name: "Stub Ridge Route",
    metrics: {
      durationHours: 5,
      mileage: 8,
      elevationGainFt: 1800,
      isYouthOrFamily: false,
    },
  },
  {
    trailId: 3,
    name: "Stub Summit Traverse",
    metrics: {
      durationHours: 8,
      mileage: 16,
      elevationGainFt: 4000,
      isYouthOrFamily: false,
    },
  },
];

interface ThresholdCriteria {
  relaxed: { maxDuration: number; maxMiles: number; maxElevation: number };
  easy: { maxDuration: number; maxMiles: number; maxElevation: number };
  moderate: { maxDuration: number; maxMiles: number; maxElevation: number };
  vigorous: { maxDuration: number; maxMiles: number; maxElevation: number };
  strenuous: { minDuration: number; minMiles: number; minElevation: number };
}

export function calculateAMCRating(metrics: TrailMetrics): AMCRating {
  const ratings: AMCRating[] = [
    "Accessible",
    "Relaxed",
    "Easy",
    "Moderate",
    "Vigorous",
    "Strenuous",
  ];

  // AMC Standard Scale (Adult)
  const adultThresholds: ThresholdCriteria = {
    relaxed: { maxDuration: 3, maxMiles: 4, maxElevation: 500 },
    easy: { maxDuration: 4, maxMiles: 6, maxElevation: 1000 },
    moderate: { maxDuration: 6, maxMiles: 8, maxElevation: 2000 },
    vigorous: { maxDuration: 6, maxMiles: 12, maxElevation: 3000 },
    strenuous: { minDuration: 6, minMiles: 15, minElevation: 3500 },
  };

  // AMC Youth (14 & Under) & Family Hiking Scale
  const familyThresholds: ThresholdCriteria = {
    relaxed: { maxDuration: 2, maxMiles: 2, maxElevation: 250 },
    easy: { maxDuration: 3, maxMiles: 3, maxElevation: 500 },
    moderate: { maxDuration: 4, maxMiles: 5, maxElevation: 1000 },
    vigorous: { maxDuration: 6, maxMiles: 8, maxElevation: 2000 },
    strenuous: { minDuration: 6, minMiles: 10, minElevation: 2000 },
  };

  const limits = metrics.isYouthOrFamily ? familyThresholds : adultThresholds;

  let durationScore = 1;
  let mileageScore = 1;
  let elevationScore = 1;

  // 1. Evaluate Duration
  if (metrics.durationHours >= limits.strenuous.minDuration) durationScore = 6;
  else if (metrics.durationHours > limits.moderate.maxDuration)
    durationScore = 5;
  else if (metrics.durationHours > limits.easy.maxDuration) durationScore = 4;
  else if (metrics.durationHours > limits.relaxed.maxDuration)
    durationScore = 3;
  else if (metrics.durationHours > 0) durationScore = 2;

  // 2. Evaluate Mileage
  if (metrics.mileage >= limits.strenuous.minMiles)
    mileageScore = 6; // Codified: >= 15 (Adult) or >= 10 (Family)
  else if (metrics.mileage > limits.moderate.maxMiles)
    mileageScore = 5; // e.g., 12.1 to 14.9 -> Vigorous
  else if (metrics.mileage > limits.easy.maxMiles) mileageScore = 4;
  else if (metrics.mileage > limits.relaxed.maxMiles) mileageScore = 3;
  else if (metrics.mileage > 0) mileageScore = 2;

  // 3. Evaluate Elevation Gain
  if (metrics.elevationGainFt >= limits.strenuous.minElevation)
    elevationScore = 6; // Codified: >= 3500 (Adult) or >= 2000 (Family)
  else if (metrics.elevationGainFt > limits.moderate.maxElevation)
    elevationScore = 5; // e.g., 3001 to 3499 -> Vigorous
  else if (metrics.elevationGainFt > limits.easy.maxElevation)
    elevationScore = 4;
  else if (metrics.elevationGainFt > limits.relaxed.maxElevation)
    elevationScore = 3;
  else if (metrics.elevationGainFt > 0) elevationScore = 2;

  // Choose the highest difficulty triggered by any single baseline metric
  let finalIndex = Math.max(durationScore, mileageScore, elevationScore) - 1;

  // Apply backpacking modifier
  if (metrics.isBackpacking && finalIndex > 0) {
    finalIndex = Math.min(finalIndex + 1, ratings.length - 1);
  }

  return ratings[finalIndex];
}

/**
 * Temporary fixture lookup until trails and mountain-trail associations exist.
 * Replace this with a query against the future association table.
 */
export function getStubTrailDifficulty(
  trailId: number,
): StubTrailDifficulty | null {
  const trail = STUB_TRAIL_METRICS.find((candidate) => candidate.trailId === trailId);
  if (!trail) return null;

  return {
    trailId: trail.trailId,
    name: trail.name,
    rating: calculateAMCRating(trail.metrics),
  };
}

export function getStubMountainDifficulty(mountainId: number): {
  mountainId: number;
  low: AMCRating;
  high: AMCRating;
  trails: StubTrailDifficulty[];
} | null {
  const mountainTrails: Record<number, number[]> = {
    1: [1, 2],
    2: [2, 3],
  };
  const trails = (mountainTrails[mountainId] ?? [])
    .map(getStubTrailDifficulty)
    .filter((trail): trail is StubTrailDifficulty => trail !== null);
  if (trails.length === 0) return null;

  const ratingOrder: AMCRating[] = [
    "Accessible",
    "Relaxed",
    "Easy",
    "Moderate",
    "Vigorous",
    "Strenuous",
  ];
  const indexes = trails.map((trail) => ratingOrder.indexOf(trail.rating));

  return {
    mountainId,
    low: ratingOrder[Math.min(...indexes)],
    high: ratingOrder[Math.max(...indexes)],
    trails,
  };
}
