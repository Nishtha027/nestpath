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
