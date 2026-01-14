Here goes the description of the project for ai tools like claude to use. Always update this file if you make relevant changes.

## Project: GCR Tool

A lightweight TypeScript application for encoding and decoding GCR (General Aviation Clearance Request) messages per the GCR-INT specification (`specs/GCR-INT.pdf`).

### Requirements

- **Lightweight**: Minimal dependencies, embeddable in static HTML pages via single JS bundle
- **Both encode and decode**: Full bidirectional conversion
- **Separate codec class**: `GcrCodec` class handles all parsing/encoding logic, independent of UI
- **Test suite**: Vitest tests with cases extracted from the GCR-INT specification

### Architecture

```
src/
├── codec/
│   ├── GcrCodec.ts       # Main codec class (decode, encode, validate)
│   ├── types.ts          # TypeScript interfaces (GcrMessage, GcrFlightLine, etc.)
│   └── constants.ts      # Action codes, flight types
├── ui/
│   ├── decoder.ts        # Decode UI: textarea input, formatted output
│   ├── encoder.ts        # Encode UI: form input, GCR text output
│   └── styles.css        # Minimal functional CSS
└── index.ts              # Entry point, exports GcrTool
tests/
├── codec.test.ts         # Unit tests for GcrCodec
└── testcases.ts          # Test data from spec examples
```

### GcrCodec API

```typescript
class GcrCodec {
  decode(gcrText: string): GcrMessage | GcrParseError
  encode(message: GcrMessage): string
  validate(message: GcrMessage): ValidationResult
}
```

### Key Data Types

```typescript
interface GcrMessage {
  header: GcrHeader;
  flights: GcrFlightLine[];
  footnotes: GcrFootnote[];
}

interface GcrFlightLine {
  actionCode: ActionCode;     // N, D, C, R, K, X, H, U, W
  identifier: string;         // Flight number or registration
  date: string;               // DDMMM (e.g., "08JUN")
  seatCount: number;
  aircraftType: string;       // ICAO 4-letter code
  isArrival: boolean;
  otherAirport: string;       // Origin (arrival) or destination (departure)
  time: string;               // HHMM UTC
  flightType: FlightType;     // D, I, or N
  slotId?: string;
}
```

### Parsing Rules

**Arrival vs Departure Detection** (critical):
- Arrival: No space after action code (`NABC123 08JUN...`)
- Departure: Space after action code (`N ABC456 08JUN...`)

**Flight Line Format**:
- Arrival: `{action}{id} {date} {seats}{aircraft} {origin}{time} {type}`
- Departure: `{action} {id} {date} {seats}{aircraft} {time}{dest} {type}`

**Action Codes**:
- Owner/Operator: N (New), D (Delete), C (Change), R (Revised)
- Coordinator: K (Confirm), X (Cancel), H (Hold), U (Refuse), W (Wrong)

**Flight Types**: D (General Aviation), I (State/Diplomatic), N (Business/Air taxi)

### UI Design

**Decoder**: Paste GCR text into textarea, display decoded data in readable formatted view with inline validation errors.

**Encoder**: Form with structured fields (airport, flight lines with add/remove), generates GCR text output with copy button.

### Embedding

```html
<script src="gcrtool.js"></script>
<div id="gcr-decoder"></div>
<script>GcrTool.initDecoder('#gcr-decoder');</script>
```

### Commands

```bash
npm install          # Install dependencies
npm run dev          # Development server
npm run build        # Build bundle to dist/
npm test             # Run Vitest tests
```

