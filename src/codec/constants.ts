import type { ActionCode, FlightType } from './types';

export const OWNER_ACTION_CODES: ActionCode[] = ['N', 'D', 'C', 'R'];
export const COORDINATOR_ACTION_CODES: ActionCode[] = ['K', 'X', 'H', 'U', 'W'];
export const ALL_ACTION_CODES: ActionCode[] = [...OWNER_ACTION_CODES, ...COORDINATOR_ACTION_CODES];

export const ACTION_CODE_DESCRIPTIONS: Record<ActionCode, string> = {
  N: 'New schedule',
  D: 'Delete schedule',
  C: 'Schedule to be changed',
  R: 'Revised schedule',
  K: 'Confirmation',
  X: 'Cancelled',
  H: 'Holding',
  U: 'Refusal',
  W: 'Wrong'
};

export const FLIGHT_TYPES: FlightType[] = ['D', 'I', 'N'];

export const FLIGHT_TYPE_DESCRIPTIONS: Record<FlightType, string> = {
  D: 'General Aviation',
  I: 'State/Diplomatic',
  N: 'Business Aviation/Air taxi'
};

export const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export type StatusClass = 'confirmed' | 'cancelled' | 'held' | 'refused' | 'error';

export interface ReplyStatusInfo {
  description: string;
  statusClass: StatusClass;
}

export const REPLY_STATUS_INFO: Partial<Record<ActionCode, ReplyStatusInfo>> = {
  K: { description: 'Slot Confirmed', statusClass: 'confirmed' },
  X: { description: 'Slot Cancelled', statusClass: 'cancelled' },
  H: { description: 'Request Held', statusClass: 'held' },
  U: { description: 'Request Refused', statusClass: 'refused' },
  W: { description: 'Wrong/Invalid Request', statusClass: 'error' }
};
