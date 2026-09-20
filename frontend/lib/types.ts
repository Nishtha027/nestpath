export type Child = {
  id: string;
  name: string | null;
  birth_date: string;
  region: string | null;
};

export type ScheduleItem = {
  id: string;
  child_id: string;
  type: string;
  vaccine_id: string;
  dose_number: number | null;
  due_date: string;
  status: string;
  administered_date: string | null;
  notes: string | null;
  source_version: string | null;
};

export type GrowthMeasurement = {
  id: string;
  child_id: string;
  measured_at: string;
  age_months: number;
  sex: string;
  weight_kg: number;
  percentile: number;
  z_score: number;
  source_version: string | null;
};

export type CareLog = {
  id: string;
  child_id: string;
  caregiver_id: string;
  type: "feed" | "diaper" | "sleep" | "medication";
  timestamp: string;
  notes: string | null;
};
