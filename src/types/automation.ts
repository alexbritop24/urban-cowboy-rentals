export interface AutomationLog {
  id: string;
  created_at: string;
  rental_request_id: string | null;
  event_type: string;
  channel: string;
  status: string;
  message: string;
}