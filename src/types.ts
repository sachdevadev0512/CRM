/**
 * Middha Ventures Investment CRM Types
 */

export type PipelineStatus =
  | 'New'
  | 'Screening'
  | 'Meeting'
  | 'Due Diligence'
  | 'Approved'
  | 'Rejected'
  | 'Archived';

export interface Startup {
  id: string;
  company_name: string;
  website: string | null;
  one_line_pitch: string;
  description: string;
  hq_location: string;
  sector: string;
  founder_name: string;
  founder_email: string;
  founder_linkedin: string | null;
  team_size: number;
  team_background: string;
  stage: string;
  funding_raised: number;
  target_raise: number;
  traction: string;
  pitch_deck_path: string;
  demo_video?: string;
  status: PipelineStatus;
  currency: string;
  revenue_status: string;
  revenue_generated_fy25?: number | null;
  current_financial_year_revenue?: number | null;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  startup_id: string;
  author_id: string;
  author_email: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Admin {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  target_id: string;
  target_name: string;
  details: any;
  created_at: string;
}

export interface ApplicationFormData {
  company_name: string;
  website: string;
  one_line_pitch: string;
  description: string;
  hq_location: string;
  sector: string;
  founder_name: string;
  founder_email: string;
  founder_linkedin: string;
  team_size: number;
  team_background: string;
  stage: string;
  funding_raised: number;
  target_raise: number;
  traction: string;
  demo_video?: string;
  pitch_deck: File | null;
  currency: string;
  revenue_status: string;
  revenue_generated_fy25?: string | number;
  current_financial_year_revenue?: string | number;
}
