import type {
  GcrMessage,
  GcrParseError,
  GcrHeader,
  GcrFlightLine,
  GcrFootnote,
  GcrAirportSection,
  ActionCode,
  IdentifierType,
  FlightType,
  MessageType,
  ValidationResult,
  ValidationError
} from './types';
import { ALL_ACTION_CODES, OWNER_ACTION_CODES, COORDINATOR_ACTION_CODES, FLIGHT_TYPES, MONTHS } from './constants';

export class GcrCodec {
  decode(gcrText: string): GcrMessage | GcrParseError {
    const lines = gcrText.trim().split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

    if (lines.length < 3) {
      return { error: true, message: 'Invalid GCR message: too few lines' };
    }

    // Parse header
    if (lines[0] !== 'GCR') {
      return { error: true, message: 'Invalid GCR message: must start with GCR', line: 1 };
    }

    const identifierLine = lines[1];
    if (identifierLine !== '/FLT' && identifierLine !== '/REG') {
      return { error: true, message: 'Invalid identifier type: must be /FLT or /REG', line: 2 };
    }
    const identifierType: IdentifierType = identifierLine.slice(1) as IdentifierType;

    const header: GcrHeader = {
      identifierType,
      airport: ''
    };

    const airportSections: GcrAirportSection[] = [];
    const footnotes: GcrFootnote[] = [];

    let currentAirport = '';
    let currentFlights: GcrFlightLine[] = [];
    let lineIndex = 2;

    while (lineIndex < lines.length) {
      const line = lines[lineIndex];

      // Check if it's a footnote (SI or GI)
      // Formats: "SI text", "GI text", or "SI"/"GI" alone followed by multi-line text
      if (line.startsWith('SI ') || line.startsWith('GI ')) {
        const type = line.slice(0, 2) as 'SI' | 'GI';
        const text = line.slice(3).trim();
        footnotes.push({ type, text });
        lineIndex++;
        continue;
      }

      // Handle SI or GI alone on a line (multi-line footnote)
      if (line === 'SI' || line === 'GI') {
        const type = line as 'SI' | 'GI';
        const textLines: string[] = [];
        lineIndex++;

        // Collect subsequent lines until we hit another SI/GI or end of message
        while (lineIndex < lines.length) {
          const nextLine = lines[lineIndex];
          // Stop if we hit another footnote marker or GI (which often ends messages)
          if (nextLine === 'SI' || nextLine === 'GI' || nextLine.startsWith('SI ') || nextLine.startsWith('GI ')) {
            break;
          }
          textLines.push(nextLine);
          lineIndex++;
        }

        footnotes.push({ type, text: textLines.join('\n') });
        continue;
      }

      // Check if it's an airport code (4 uppercase letters)
      if (/^[A-Z]{4}$/.test(line)) {
        // Save previous section if exists
        if (currentAirport && currentFlights.length > 0) {
          airportSections.push({ airport: currentAirport, flights: currentFlights });
        }
        currentAirport = line;
        currentFlights = [];

        // Set first airport as header airport
        if (!header.airport) {
          header.airport = line;
        }
        lineIndex++;
        continue;
      }

      // Try to parse as flight line
      const flightResult = this.parseFlightLine(line, lineIndex + 1);
      if ('error' in flightResult) {
        return flightResult;
      }
      currentFlights.push(flightResult);
      lineIndex++;
    }

    // Save last section
    if (currentAirport && currentFlights.length > 0) {
      airportSections.push({ airport: currentAirport, flights: currentFlights });
    }

    if (airportSections.length === 0) {
      return { error: true, message: 'No valid flight lines found' };
    }

    const messageType = this.detectMessageType(airportSections);

    return { header, airportSections, footnotes, messageType };
  }

  private parseFlightLine(line: string, lineNum: number): GcrFlightLine | GcrParseError {
    // Detect arrival vs departure by checking if there's a space after the action code
    const firstChar = line[0];
    if (!ALL_ACTION_CODES.includes(firstChar as ActionCode)) {
      return { error: true, message: `Invalid action code: ${firstChar}`, line: lineNum };
    }

    const actionCode = firstChar as ActionCode;

    // Arrival: no space after action code (e.g., "NABC123 08JUN...")
    // Departure: space after action code (e.g., "N ABC123 08JUN...")
    const isArrival = line[1] !== ' ';

    // Extract slot ID if present
    // Format variations:
    // - "/ ID.EDDF3010070001" (with spaces)
    // - "D/ ID.EDDH1512250402/" (no space before /, trailing /)
    let slotId: string | undefined;
    let mainPart = line;
    const slotMatch = line.match(/\s*\/\s*ID\.?([A-Z0-9]+)\/?$/);
    if (slotMatch) {
      slotId = slotMatch[1];
      mainPart = line.slice(0, slotMatch.index).trim();
    }

    // Split the line into parts
    let restOfLine: string;
    if (isArrival) {
      restOfLine = mainPart.slice(1); // Remove action code only
    } else {
      restOfLine = mainPart.slice(2); // Remove action code and space
    }

    // Parse the rest of the line
    // Format: {identifier} {date} {seats}{aircraft} {origin/dest}{time} or {time}{origin/dest} {flightType}
    const parts = restOfLine.split(/\s+/);

    if (parts.length < 4) {
      return { error: true, message: 'Invalid flight line format: too few parts', line: lineNum };
    }

    const identifier = parts[0];
    const date = parts[1];

    // Validate date format (DDMMM)
    if (!/^\d{2}[A-Z]{3}$/.test(date)) {
      return { error: true, message: `Invalid date format: ${date}`, line: lineNum };
    }
    const monthPart = date.slice(2);
    if (!MONTHS.includes(monthPart)) {
      return { error: true, message: `Invalid month: ${monthPart}`, line: lineNum };
    }

    // Parse seat count and aircraft type (e.g., "010G159")
    const seatAircraft = parts[2];
    const seatMatch = seatAircraft.match(/^(\d{3})([A-Z0-9]{3,4})$/);
    if (!seatMatch) {
      return { error: true, message: `Invalid seat/aircraft format: ${seatAircraft}`, line: lineNum };
    }
    const seatCount = parseInt(seatMatch[1], 10);
    const aircraftType = seatMatch[2];

    // Parse routing and time
    const routingTime = parts[3];
    let otherAirport: string;
    let time: string;

    if (isArrival) {
      // Arrival: origin airport followed by time (e.g., "LSZH0900")
      const arrivalMatch = routingTime.match(/^([A-Z]{4})(\d{4})$/);
      if (!arrivalMatch) {
        return { error: true, message: `Invalid arrival routing/time format: ${routingTime}`, line: lineNum };
      }
      otherAirport = arrivalMatch[1];
      time = arrivalMatch[2];
    } else {
      // Departure: time followed by destination airport (e.g., "0750LOWW")
      const departureMatch = routingTime.match(/^(\d{4})([A-Z]{4})$/);
      if (!departureMatch) {
        return { error: true, message: `Invalid departure routing/time format: ${routingTime}`, line: lineNum };
      }
      time = departureMatch[1];
      otherAirport = departureMatch[2];
    }

    // Parse flight type (last single character, may have trailing / from slot ID delimiter)
    let flightTypePart = parts[4];
    if (flightTypePart.endsWith('/')) {
      flightTypePart = flightTypePart.slice(0, -1);
    }
    const flightType = flightTypePart as FlightType;
    if (!FLIGHT_TYPES.includes(flightType)) {
      return { error: true, message: `Invalid flight type: ${flightType}`, line: lineNum };
    }

    return {
      actionCode,
      identifier,
      date,
      seatCount,
      aircraftType,
      isArrival,
      otherAirport,
      time,
      flightType,
      slotId
    };
  }

  private detectMessageType(airportSections: GcrAirportSection[]): MessageType {
    let hasOwnerCode = false;
    let hasCoordinatorCode = false;

    for (const section of airportSections) {
      for (const flight of section.flights) {
        if (OWNER_ACTION_CODES.includes(flight.actionCode)) {
          hasOwnerCode = true;
        }
        if (COORDINATOR_ACTION_CODES.includes(flight.actionCode)) {
          hasCoordinatorCode = true;
        }
      }
    }

    if (hasOwnerCode && hasCoordinatorCode) {
      return 'mixed';
    }
    if (hasCoordinatorCode) {
      return 'reply';
    }
    return 'request';
  }

  encode(message: GcrMessage): string {
    const lines: string[] = [];

    // Header
    lines.push('GCR');
    lines.push(`/${message.header.identifierType}`);

    // Airport sections
    for (const section of message.airportSections) {
      lines.push(section.airport);

      for (const flight of section.flights) {
        lines.push(this.encodeFlightLine(flight));
      }
    }

    // Footnotes
    for (const footnote of message.footnotes) {
      lines.push(`${footnote.type} ${footnote.text}`);
    }

    return lines.join('\n');
  }

  private encodeFlightLine(flight: GcrFlightLine): string {
    const seatStr = flight.seatCount.toString().padStart(3, '0');
    const seatAircraft = `${seatStr}${flight.aircraftType}`;

    let routingTime: string;
    let prefix: string;

    if (flight.isArrival) {
      // Arrival: no space after action code, origin then time
      routingTime = `${flight.otherAirport}${flight.time}`;
      prefix = flight.actionCode;
    } else {
      // Departure: space after action code, time then destination
      routingTime = `${flight.time}${flight.otherAirport}`;
      prefix = `${flight.actionCode} `;
    }

    let line = `${prefix}${flight.identifier} ${flight.date} ${seatAircraft} ${routingTime} ${flight.flightType}`;

    if (flight.slotId) {
      line += ` / ID.${flight.slotId}`;
    }

    return line;
  }

  validate(message: GcrMessage): ValidationResult {
    const errors: ValidationError[] = [];

    // Validate header
    if (!message.header.airport || !/^[A-Z]{4}$/.test(message.header.airport)) {
      errors.push({ field: 'header.airport', message: 'Airport must be a 4-letter ICAO code' });
    }

    if (!['FLT', 'REG'].includes(message.header.identifierType)) {
      errors.push({ field: 'header.identifierType', message: 'Identifier type must be FLT or REG' });
    }

    // Validate airport sections
    if (!message.airportSections || message.airportSections.length === 0) {
      errors.push({ field: 'airportSections', message: 'At least one airport section is required' });
    }

    for (let i = 0; i < message.airportSections.length; i++) {
      const section = message.airportSections[i];

      if (!section.airport || !/^[A-Z]{4}$/.test(section.airport)) {
        errors.push({ field: `airportSections[${i}].airport`, message: 'Airport must be a 4-letter ICAO code' });
      }

      for (let j = 0; j < section.flights.length; j++) {
        const flight = section.flights[j];
        const prefix = `airportSections[${i}].flights[${j}]`;

        if (!ALL_ACTION_CODES.includes(flight.actionCode)) {
          errors.push({ field: `${prefix}.actionCode`, message: `Invalid action code: ${flight.actionCode}` });
        }

        if (!flight.identifier || flight.identifier.length === 0) {
          errors.push({ field: `${prefix}.identifier`, message: 'Identifier is required' });
        }

        if (!/^\d{2}[A-Z]{3}$/.test(flight.date)) {
          errors.push({ field: `${prefix}.date`, message: 'Date must be in DDMMM format (e.g., 08JUN)' });
        }

        if (flight.seatCount < 0 || flight.seatCount > 999) {
          errors.push({ field: `${prefix}.seatCount`, message: 'Seat count must be 0-999' });
        }

        if (!/^[A-Z0-9]{3,4}$/.test(flight.aircraftType)) {
          errors.push({ field: `${prefix}.aircraftType`, message: 'Aircraft type must be 3-4 alphanumeric characters' });
        }

        if (!/^[A-Z]{4}$/.test(flight.otherAirport)) {
          errors.push({ field: `${prefix}.otherAirport`, message: 'Airport must be a 4-letter ICAO code' });
        }

        if (!/^\d{4}$/.test(flight.time)) {
          errors.push({ field: `${prefix}.time`, message: 'Time must be in HHMM format' });
        }

        if (!FLIGHT_TYPES.includes(flight.flightType)) {
          errors.push({ field: `${prefix}.flightType`, message: `Invalid flight type: ${flight.flightType}` });
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

export const gcrCodec = new GcrCodec();
