export type Preferences = {
  birthdate: string | null;
  fitnessLevel: "beginner" | "intermediate" | "expert" | null;
  homeLocation: string | null;
  units: "imperial" | "metric";
  interests: string[];
  publicProfile: boolean;
  publicRatings: boolean;
};

export type SaveStatus = {
  message: string;
  kind: "success" | "error";
};
