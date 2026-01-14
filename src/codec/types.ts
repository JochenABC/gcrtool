export type ActionCode = 'N' | 'D' | 'C' | 'R' | 'K' | 'X' | 'H' | 'U' | 'W';
export type IdentifierType = 'FLT' | 'REG';
export type FlightType = 'D' | 'I' | 'N';
export type MessageType = 'request' | 'reply' | 'mixed';

export interface GcrHeader {
  identifierType: IdentifierType;
  airport: string;
}

export interface GcrFlightLine {
  actionCode: ActionCode;
  identifier: string;
  date: string;
  seatCount: number;
  aircraftType: string;
  isArrival: boolean;
  otherAirport: string;
  time: string;
  flightType: FlightType;
  slotId?: string;
}

export interface GcrFootnote {
  type: 'SI' | 'GI';
  text: string;
}

export interface GcrMessage {
  header: GcrHeader;
  airportSections: GcrAirportSection[];
  footnotes: GcrFootnote[];
  messageType: MessageType;
}

export interface GcrAirportSection {
  airport: string;
  flights: GcrFlightLine[];
}

export interface GcrParseError {
  error: true;
  message: string;
  line?: number;
  details?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  line?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export function isParseError(result: GcrMessage | GcrParseError): result is GcrParseError {
  return 'error' in result && result.error === true;
}
