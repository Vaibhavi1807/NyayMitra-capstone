export interface CaseMetrics {
  respondent_count: number;
  total_case_age_days: number;
  total_hearings_scheduled: number;
  current_stage_duration_days: number;
}

export interface CaseHistoryEntry {
  judge_title: string;
  business_on_date: string;
  hearing_date: string;
  purpose_of_hearing: string;
}

export interface Case {
  cnr_number: string;
  court_state: string;
  court_district: string;
  court_name: string;
  case_type: string;
  filing_number: string;
  filing_date: string;
  registration_number: string;
  registration_date: string;
  first_hearing_date: string;
  next_hearing_date: string;
  current_case_stage: string;
  presiding_judge: string;
  petitioner_name: string;
  petitioner_advocate: string;
  respondents_list: string[];
  applied_act: string;
  applied_section: string;
  calculated_metrics: CaseMetrics;
  case_history_timeline: CaseHistoryEntry[];
}