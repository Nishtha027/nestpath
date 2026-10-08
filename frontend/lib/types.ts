export type Child = {
  id: string;
  name: string | null;
  birth_date: string;
  region: string | null;
};

export type Family = {
  id: string;
  invite_code: string;
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
  /** First date this dose is no longer recommended (hard age limit), if any. */
  window_closes_on: string | null;
  /** Parent-facing explanation of that age limit. */
  age_window_note: string | null;
};

export type GrowthMeasurement = {
  id: string;
  child_id: string;
  measured_at: string;
  age_months: number;
  sex: string;
  // A measurement has a weight, a length, or both.
  weight_kg: number | null;
  percentile: number | null; // weight-for-age
  z_score: number | null; // weight-for-age
  length_cm: number | null;
  length_percentile: number | null;
  length_z_score: number | null;
  source_version: string | null;
};

/** One month of WHO chart percentile curves (GET /growth/reference). */
export type GrowthReferenceRow = {
  month: number;
  p3: number;
  p15: number;
  p50: number;
  p85: number;
  p97: number;
};

export type GrowthReference = {
  sex: "male" | "female";
  source: string;
  weight_kg: GrowthReferenceRow[];
  length_cm: GrowthReferenceRow[];
};

export type CareLog = {
  id: string;
  child_id: string;
  caregiver_id: string;
  type: "feed" | "diaper" | "sleep" | "medication";
  timestamp: string;
  notes: string | null;
};

export type Provider = {
  id: string;
  name: string;
  specialty: string | null;
};

export type AvailabilitySlot = {
  id: string;
  provider_id: string;
  start_time: string;
  end_time: string;
  is_booked: boolean;
};

export type Appointment = {
  id: string;
  child_id: string;
  slot_id: string;
  caregiver_id: string;
  status: "booked" | "cancelled";
  checklist: string[];
};

export type ScoreBand = "low" | "moderate" | "high";

export type ScreeningSubmitResponse = {
  id: string;
  total_score: number;
  /** Total-score band only; item 10 is reported separately in item_10_flag. */
  score_band: ScoreBand;
  risk_level: "low" | "moderate" | "high";
  item_10_flag: boolean;
  message: string;
  created_at: string;
};

export type ScreeningHistoryItem = {
  id: string;
  total_score: number;
  score_band: ScoreBand;
  item_10_flag: boolean;
  created_at: string;
};

export type Alert = {
  id: string;
  caregiver_id: string;
  family_id: string;
  total_score: number;
  risk_level: string;
  item_10_flag: boolean;
  created_at: string;
};

export type HelpRequestStatus = "open" | "claimed" | "completed";

export type HelpRequest = {
  id: string;
  family_id: string;
  created_by: string;
  need_type: string;
  description: string | null;
  time_window_start: string;
  time_window_end: string;
  status: HelpRequestStatus;
  claimed_by: string | null;
};
