import { describe, it, expect } from 'vitest';
import { GcrCodec, isParseError } from '../src/codec';
import {
  EXAMPLE_1N,
  EXAMPLE_2N,
  EXAMPLE_3N,
  EXAMPLE_4N,
  EXAMPLE_1NA,
  EXAMPLE_2NA,
  EXAMPLE_WITH_SI,
  EXAMPLE_1D,
  EXAMPLE_1C
} from './testcases';

describe('GcrCodec', () => {
  const codec = new GcrCodec();

  describe('decode', () => {
    it('should decode Example 1N - departure with registration', () => {
      const result = codec.decode(EXAMPLE_1N);

      expect(isParseError(result)).toBe(false);
      if (isParseError(result)) return;

      expect(result.header.identifierType).toBe('REG');
      expect(result.header.airport).toBe('EDDF');
      expect(result.airportSections).toHaveLength(1);
      expect(result.airportSections[0].flights).toHaveLength(1);

      const flight = result.airportSections[0].flights[0];
      expect(flight.actionCode).toBe('N');
      expect(flight.identifier).toBe('HBIEV');
      expect(flight.date).toBe('08JUN');
      expect(flight.seatCount).toBe(10);
      expect(flight.aircraftType).toBe('G159');
      expect(flight.isArrival).toBe(false);
      expect(flight.time).toBe('0750');
      expect(flight.otherAirport).toBe('LOWW');
      expect(flight.flightType).toBe('D');
    });

    it('should decode Example 2N - arrival with flight number', () => {
      const result = codec.decode(EXAMPLE_2N);

      expect(isParseError(result)).toBe(false);
      if (isParseError(result)) return;

      expect(result.header.identifierType).toBe('FLT');
      expect(result.header.airport).toBe('EDDF');

      const flight = result.airportSections[0].flights[0];
      expect(flight.actionCode).toBe('N');
      expect(flight.identifier).toBe('ABC123');
      expect(flight.isArrival).toBe(true);
      expect(flight.otherAirport).toBe('LSZH');
      expect(flight.time).toBe('0900');
    });

    it('should decode Example 3N - arrival and departure with different flight numbers', () => {
      const result = codec.decode(EXAMPLE_3N);

      expect(isParseError(result)).toBe(false);
      if (isParseError(result)) return;

      expect(result.airportSections[0].flights).toHaveLength(2);

      const arrivalFlight = result.airportSections[0].flights[0];
      expect(arrivalFlight.isArrival).toBe(true);
      expect(arrivalFlight.identifier).toBe('ABC123');

      const departureFlight = result.airportSections[0].flights[1];
      expect(departureFlight.isArrival).toBe(false);
      expect(departureFlight.identifier).toBe('ABC456');
    });

    it('should decode Example 4N - domestic flight to 2 coordinated airports', () => {
      const result = codec.decode(EXAMPLE_4N);

      expect(isParseError(result)).toBe(false);
      if (isParseError(result)) return;

      expect(result.airportSections).toHaveLength(2);
      expect(result.airportSections[0].airport).toBe('EDDF');
      expect(result.airportSections[1].airport).toBe('EDDL');

      expect(result.airportSections[0].flights[0].isArrival).toBe(false);
      expect(result.airportSections[1].flights[0].isArrival).toBe(true);
    });

    it('should decode Example 1NA - confirmation with slot ID', () => {
      const result = codec.decode(EXAMPLE_1NA);

      expect(isParseError(result)).toBe(false);
      if (isParseError(result)) return;

      const flight1 = result.airportSections[0].flights[0];
      expect(flight1.actionCode).toBe('K');
      expect(flight1.slotId).toBe('EDDF3010070001');

      const flight2 = result.airportSections[1].flights[0];
      expect(flight2.actionCode).toBe('K');
      expect(flight2.slotId).toBe('EDDL3010070001');
    });

    it('should decode Example 2NA - refusal and alternative confirmation', () => {
      const result = codec.decode(EXAMPLE_2NA);

      expect(isParseError(result)).toBe(false);
      if (isParseError(result)) return;

      expect(result.airportSections[0].flights).toHaveLength(2);

      const refusalFlight = result.airportSections[0].flights[0];
      expect(refusalFlight.actionCode).toBe('U');
      expect(refusalFlight.slotId).toBeUndefined();

      const confirmFlight = result.airportSections[0].flights[1];
      expect(confirmFlight.actionCode).toBe('K');
      expect(confirmFlight.slotId).toBe('EDDF3010070001');
    });

    it('should decode message with SI footnote', () => {
      const result = codec.decode(EXAMPLE_WITH_SI);

      expect(isParseError(result)).toBe(false);
      if (isParseError(result)) return;

      expect(result.footnotes).toHaveLength(2);
      expect(result.footnotes[0].type).toBe('SI');
      expect(result.footnotes[0].text).toBe('IF NOT AVBL PLS CFM NEXT LATER POSS');
      expect(result.footnotes[1].type).toBe('GI');
      expect(result.footnotes[1].text).toBe('BRGDS');
    });

    it('should decode message with multi-line SI footnote', () => {
      const multiLineSI = `GCR
/REG
EDDH
KDFABC 16DEC 006TBM9 EPWR1615 D/ ID.EDDH1512250402/
SI
- PLEASE NOTE AIRPORTSLOT-ID MUST BE ENTERED
  IN YOUR FLIGHTPLAN
GI BRGDS`;

      const result = codec.decode(multiLineSI);

      expect(isParseError(result)).toBe(false);
      if (isParseError(result)) return;

      expect(result.footnotes).toHaveLength(2);
      expect(result.footnotes[0].type).toBe('SI');
      expect(result.footnotes[0].text).toContain('PLEASE NOTE AIRPORTSLOT-ID');
      expect(result.footnotes[0].text).toContain('IN YOUR FLIGHTPLAN');
      expect(result.footnotes[1].type).toBe('GI');
      expect(result.footnotes[1].text).toBe('BRGDS');
    });

    it('should decode Example 1D - cancelled', () => {
      const result = codec.decode(EXAMPLE_1D);

      expect(isParseError(result)).toBe(false);
      if (isParseError(result)) return;

      const flight = result.airportSections[0].flights[0];
      expect(flight.actionCode).toBe('D');
    });

    it('should decode Example 1C - change request', () => {
      const result = codec.decode(EXAMPLE_1C);

      expect(isParseError(result)).toBe(false);
      if (isParseError(result)) return;

      expect(result.airportSections[0].flights).toHaveLength(2);

      const changeFlight = result.airportSections[0].flights[0];
      expect(changeFlight.actionCode).toBe('C');
      expect(changeFlight.slotId).toBe('3010070001');

      const revisedFlight = result.airportSections[0].flights[1];
      expect(revisedFlight.actionCode).toBe('R');
      expect(revisedFlight.slotId).toBeUndefined();
    });

    it('should return error for invalid input', () => {
      const result = codec.decode('INVALID');
      expect(isParseError(result)).toBe(true);
    });

    it('should return error for missing GCR header', () => {
      const result = codec.decode('/FLT\nEDDF\nNABC123 08JUN 010G159 LSZH0900 D');
      expect(isParseError(result)).toBe(true);
      if (isParseError(result)) {
        expect(result.message).toContain('must start with GCR');
      }
    });
  });

  describe('encode', () => {
    it('should encode and produce valid GCR format', () => {
      const decoded = codec.decode(EXAMPLE_2N);
      if (isParseError(decoded)) throw new Error('Decode failed');

      const encoded = codec.encode(decoded);

      expect(encoded).toContain('GCR');
      expect(encoded).toContain('/FLT');
      expect(encoded).toContain('EDDF');
      expect(encoded).toContain('ABC123');
    });

    it('should roundtrip Example 1N', () => {
      const decoded = codec.decode(EXAMPLE_1N);
      if (isParseError(decoded)) throw new Error('Decode failed');

      const encoded = codec.encode(decoded);
      const reDecoded = codec.decode(encoded);

      expect(isParseError(reDecoded)).toBe(false);
      if (isParseError(reDecoded)) return;

      expect(reDecoded.header).toEqual(decoded.header);
      expect(reDecoded.airportSections[0].flights[0].identifier).toBe(decoded.airportSections[0].flights[0].identifier);
    });

    it('should roundtrip Example 4N with multiple airports', () => {
      const decoded = codec.decode(EXAMPLE_4N);
      if (isParseError(decoded)) throw new Error('Decode failed');

      const encoded = codec.encode(decoded);
      const reDecoded = codec.decode(encoded);

      expect(isParseError(reDecoded)).toBe(false);
      if (isParseError(reDecoded)) return;

      expect(reDecoded.airportSections).toHaveLength(2);
    });

    it('should preserve slot IDs in roundtrip', () => {
      const decoded = codec.decode(EXAMPLE_1NA);
      if (isParseError(decoded)) throw new Error('Decode failed');

      const encoded = codec.encode(decoded);
      const reDecoded = codec.decode(encoded);

      expect(isParseError(reDecoded)).toBe(false);
      if (isParseError(reDecoded)) return;

      expect(reDecoded.airportSections[0].flights[0].slotId).toBe('EDDF3010070001');
    });
  });

  describe('validate', () => {
    it('should validate a correctly decoded message', () => {
      const decoded = codec.decode(EXAMPLE_2N);
      if (isParseError(decoded)) throw new Error('Decode failed');

      const result = codec.validate(decoded);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid airport code', () => {
      const decoded = codec.decode(EXAMPLE_2N);
      if (isParseError(decoded)) throw new Error('Decode failed');

      decoded.header.airport = 'XX';
      const result = codec.validate(decoded);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'header.airport')).toBe(true);
    });

    it('should detect invalid time format', () => {
      const decoded = codec.decode(EXAMPLE_2N);
      if (isParseError(decoded)) throw new Error('Decode failed');

      decoded.airportSections[0].flights[0].time = '25:00';
      const result = codec.validate(decoded);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('HHMM'))).toBe(true);
    });
  });

  describe('message type detection', () => {
    it('should detect request message type for new schedule (N code)', () => {
      const result = codec.decode(EXAMPLE_1N);
      expect(isParseError(result)).toBe(false);
      if (isParseError(result)) return;

      expect(result.messageType).toBe('request');
    });

    it('should detect request message type for delete schedule (D code)', () => {
      const result = codec.decode(EXAMPLE_1D);
      expect(isParseError(result)).toBe(false);
      if (isParseError(result)) return;

      expect(result.messageType).toBe('request');
    });

    it('should detect request message type for change request (C and R codes)', () => {
      const result = codec.decode(EXAMPLE_1C);
      expect(isParseError(result)).toBe(false);
      if (isParseError(result)) return;

      expect(result.messageType).toBe('request');
    });

    it('should detect reply message type for confirmation (K code)', () => {
      const result = codec.decode(EXAMPLE_1NA);
      expect(isParseError(result)).toBe(false);
      if (isParseError(result)) return;

      expect(result.messageType).toBe('reply');
    });

    it('should detect reply message type for refusal with alternative (U and K codes)', () => {
      const result = codec.decode(EXAMPLE_2NA);
      expect(isParseError(result)).toBe(false);
      if (isParseError(result)) return;

      // Both U and K are coordinator codes, so this is a reply
      expect(result.messageType).toBe('reply');
    });

    it('should detect mixed message type when owner and coordinator codes present', () => {
      // Create a mixed message with both owner (N) and coordinator (K) codes
      // N with space = departure (time + dest format: 0900LSZH)
      // K without space = arrival (origin + time format: LSZH1000)
      const mixedMessage = `GCR
/FLT
EDDF
N ABC123 08JUN 010G159 0900LSZH D
KABC456 08JUN 010G159 LSZH1000 D / ID.EDDF3010070001
GI BRGDS`;

      const result = codec.decode(mixedMessage);
      expect(isParseError(result)).toBe(false);
      if (isParseError(result)) return;

      expect(result.messageType).toBe('mixed');
    });

    it('should handle slot ID format with trailing slash and no space before delimiter', () => {
      // Format: D/ ID.EDDH1512250402/ (no space before /, trailing /)
      const replyWithTrailingSlash = `GCR
/REG
EDDH
KDFABC 16DEC 006TBM9 EPWR1615 D/ ID.EDDH1512250402/
H DFABC 16DEC 006TBM9 0945EPWR D/ ID.EDDH1512250397/
GI BRGDS`;

      const result = codec.decode(replyWithTrailingSlash);
      expect(isParseError(result)).toBe(false);
      if (isParseError(result)) return;

      expect(result.messageType).toBe('reply');
      expect(result.airportSections[0].flights).toHaveLength(2);

      const flight1 = result.airportSections[0].flights[0];
      expect(flight1.actionCode).toBe('K');
      expect(flight1.identifier).toBe('DFABC');
      expect(flight1.flightType).toBe('D');
      expect(flight1.slotId).toBe('EDDH1512250402');
      expect(flight1.isArrival).toBe(true);

      const flight2 = result.airportSections[0].flights[1];
      expect(flight2.actionCode).toBe('H');
      expect(flight2.flightType).toBe('D');
      expect(flight2.slotId).toBe('EDDH1512250397');
      expect(flight2.isArrival).toBe(false);
    });
  });
});
