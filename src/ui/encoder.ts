import { GcrCodec, GcrMessage, GcrFlightLine, ActionCode, IdentifierType, FlightType, GcrAirportSection } from '../codec';
import { OWNER_ACTION_CODES, COORDINATOR_ACTION_CODES, ACTION_CODE_DESCRIPTIONS, FLIGHT_TYPE_DESCRIPTIONS, MONTHS } from '../codec/constants';

interface FlightFormData {
  actionCode: ActionCode;
  identifier: string;
  date: string;
  seatCount: string;
  aircraftType: string;
  isArrival: boolean;
  otherAirport: string;
  time: string;
  flightType: FlightType;
  slotId: string;
}

export class EncoderUI {
  private container: HTMLElement;
  private codec: GcrCodec;
  private identifierType: IdentifierType = 'FLT';
  private coordinationAirport: string = '';
  private flights: FlightFormData[] = [];
  private siText: string = '';
  private giText: string = '';
  private outputTextarea: HTMLTextAreaElement;
  private errorsDiv: HTMLElement;
  private formContainer: HTMLElement;

  constructor(selector: string) {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`Element not found: ${selector}`);
    this.container = el as HTMLElement;
    this.codec = new GcrCodec();
    this.outputTextarea = document.createElement('textarea');
    this.errorsDiv = document.createElement('div');
    this.formContainer = document.createElement('div');
    this.addFlight();
    this.render();
  }

  private render(): void {
    this.container.innerHTML = '';
    this.container.classList.add('gcr-encoder');

    // Header section
    const headerSection = document.createElement('div');
    headerSection.className = 'gcr-section';
    headerSection.innerHTML = `
      <h3>Header</h3>
      <div class="gcr-form-row">
        <label>
          Identifier Type:
          <select id="gcr-id-type" class="gcr-select">
            <option value="FLT" ${this.identifierType === 'FLT' ? 'selected' : ''}>Flight Number (FLT)</option>
            <option value="REG" ${this.identifierType === 'REG' ? 'selected' : ''}>Registration (REG)</option>
          </select>
        </label>
      </div>
      <div class="gcr-form-row">
        <label>
          Coordination Airport (ICAO):
          <input type="text" id="gcr-coord-airport" class="gcr-input" maxlength="4" placeholder="EDDF" value="${this.coordinationAirport}" />
        </label>
      </div>
    `;

    headerSection.querySelector('#gcr-id-type')?.addEventListener('change', (e) => {
      this.identifierType = (e.target as HTMLSelectElement).value as IdentifierType;
    });

    headerSection.querySelector('#gcr-coord-airport')?.addEventListener('input', (e) => {
      this.coordinationAirport = (e.target as HTMLInputElement).value.toUpperCase();
      (e.target as HTMLInputElement).value = this.coordinationAirport;
    });

    this.container.appendChild(headerSection);

    // Flights section
    const flightsSection = document.createElement('div');
    flightsSection.className = 'gcr-section';

    const flightsHeader = document.createElement('div');
    flightsHeader.className = 'gcr-section-header';
    flightsHeader.innerHTML = '<h3>Flights</h3>';

    const addBtn = document.createElement('button');
    addBtn.className = 'gcr-btn gcr-btn-add';
    addBtn.textContent = '+ Add Flight';
    addBtn.addEventListener('click', () => {
      this.addFlight();
      this.renderFlights();
    });
    flightsHeader.appendChild(addBtn);

    flightsSection.appendChild(flightsHeader);

    this.formContainer.className = 'gcr-flights-container';
    flightsSection.appendChild(this.formContainer);

    this.container.appendChild(flightsSection);

    // Footnotes section
    const footnotesSection = document.createElement('div');
    footnotesSection.className = 'gcr-section';
    footnotesSection.innerHTML = `
      <h3>Footnotes (Optional)</h3>
      <div class="gcr-form-row">
        <label>
          SI (Special Information):
          <input type="text" id="gcr-si" class="gcr-input gcr-input-wide" placeholder="IF NOT AVBL PLS CFM NEXT LATER POSS" value="${this.siText}" />
        </label>
      </div>
      <div class="gcr-form-row">
        <label>
          GI (General Information):
          <input type="text" id="gcr-gi" class="gcr-input gcr-input-wide" placeholder="BRGDS" value="${this.giText}" />
        </label>
      </div>
    `;

    footnotesSection.querySelector('#gcr-si')?.addEventListener('input', (e) => {
      this.siText = (e.target as HTMLInputElement).value;
    });

    footnotesSection.querySelector('#gcr-gi')?.addEventListener('input', (e) => {
      this.giText = (e.target as HTMLInputElement).value;
    });

    this.container.appendChild(footnotesSection);

    // Generate section
    const generateSection = document.createElement('div');
    generateSection.className = 'gcr-section';

    const generateBtn = document.createElement('button');
    generateBtn.className = 'gcr-btn gcr-btn-primary';
    generateBtn.textContent = 'Generate GCR';
    generateBtn.addEventListener('click', () => this.generate());

    this.errorsDiv.className = 'gcr-errors';

    const outputLabel = document.createElement('label');
    outputLabel.textContent = 'Generated GCR Message:';

    this.outputTextarea.className = 'gcr-textarea gcr-output-textarea';
    this.outputTextarea.readOnly = true;
    this.outputTextarea.rows = 10;

    const copyBtn = document.createElement('button');
    copyBtn.className = 'gcr-btn';
    copyBtn.textContent = 'Copy to Clipboard';
    copyBtn.addEventListener('click', () => this.copyToClipboard());

    generateSection.appendChild(generateBtn);
    generateSection.appendChild(this.errorsDiv);
    generateSection.appendChild(outputLabel);
    generateSection.appendChild(this.outputTextarea);
    generateSection.appendChild(copyBtn);

    this.container.appendChild(generateSection);

    this.renderFlights();
  }

  private addFlight(): void {
    this.flights.push({
      actionCode: 'N',
      identifier: '',
      date: '',
      seatCount: '',
      aircraftType: '',
      isArrival: true,
      otherAirport: '',
      time: '',
      flightType: 'D',
      slotId: ''
    });
  }

  private renderFlights(): void {
    this.formContainer.innerHTML = '';

    this.flights.forEach((flight, index) => {
      const flightDiv = document.createElement('div');
      flightDiv.className = 'gcr-flight-form';

      flightDiv.innerHTML = `
        <div class="gcr-flight-form-header">
          <span>Flight ${index + 1}</span>
          ${this.flights.length > 1 ? `<button class="gcr-btn gcr-btn-remove" data-index="${index}">Remove</button>` : ''}
        </div>
        <div class="gcr-form-grid">
          <label>
            Action Code:
            <select class="gcr-select" data-field="actionCode" data-index="${index}">
              <optgroup label="Owner/Operator">
                ${OWNER_ACTION_CODES.map(code => `<option value="${code}" ${flight.actionCode === code ? 'selected' : ''}>${code} - ${ACTION_CODE_DESCRIPTIONS[code]}</option>`).join('')}
              </optgroup>
              <optgroup label="Coordinator">
                ${COORDINATOR_ACTION_CODES.map(code => `<option value="${code}" ${flight.actionCode === code ? 'selected' : ''}>${code} - ${ACTION_CODE_DESCRIPTIONS[code]}</option>`).join('')}
              </optgroup>
            </select>
          </label>
          <label>
            ${this.identifierType === 'FLT' ? 'Flight Number' : 'Registration'}:
            <input type="text" class="gcr-input" data-field="identifier" data-index="${index}" placeholder="${this.identifierType === 'FLT' ? 'ABC123' : 'HBIEV'}" value="${flight.identifier}" />
          </label>
          <label>
            Date (DDMMM):
            <input type="text" class="gcr-input" data-field="date" data-index="${index}" maxlength="5" placeholder="08JUN" value="${flight.date}" />
          </label>
          <label>
            Direction:
            <select class="gcr-select" data-field="isArrival" data-index="${index}">
              <option value="true" ${flight.isArrival ? 'selected' : ''}>Arrival</option>
              <option value="false" ${!flight.isArrival ? 'selected' : ''}>Departure</option>
            </select>
          </label>
          <label>
            ${flight.isArrival ? 'Origin' : 'Destination'} Airport (ICAO):
            <input type="text" class="gcr-input" data-field="otherAirport" data-index="${index}" maxlength="4" placeholder="LSZH" value="${flight.otherAirport}" />
          </label>
          <label>
            Time (HHMM UTC):
            <input type="text" class="gcr-input" data-field="time" data-index="${index}" maxlength="4" placeholder="0900" value="${flight.time}" />
          </label>
          <label>
            Seat Count:
            <input type="number" class="gcr-input" data-field="seatCount" data-index="${index}" min="0" max="999" placeholder="10" value="${flight.seatCount}" />
          </label>
          <label>
            Aircraft Type (ICAO):
            <input type="text" class="gcr-input" data-field="aircraftType" data-index="${index}" maxlength="4" placeholder="G159" value="${flight.aircraftType}" />
          </label>
          <label>
            Flight Type:
            <select class="gcr-select" data-field="flightType" data-index="${index}">
              ${(['D', 'I', 'N'] as FlightType[]).map(type => `<option value="${type}" ${flight.flightType === type ? 'selected' : ''}>${type} - ${FLIGHT_TYPE_DESCRIPTIONS[type]}</option>`).join('')}
            </select>
          </label>
          <label>
            Slot ID (Optional):
            <input type="text" class="gcr-input" data-field="slotId" data-index="${index}" placeholder="EDDF3010070001" value="${flight.slotId}" />
          </label>
        </div>
      `;

      // Add event listeners
      flightDiv.querySelectorAll('input, select').forEach(el => {
        el.addEventListener('change', (e) => this.handleFieldChange(e));
        el.addEventListener('input', (e) => this.handleFieldChange(e));
      });

      const removeBtn = flightDiv.querySelector('.gcr-btn-remove');
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          this.flights.splice(index, 1);
          this.renderFlights();
        });
      }

      this.formContainer.appendChild(flightDiv);
    });
  }

  private handleFieldChange(e: Event): void {
    const target = e.target as HTMLInputElement | HTMLSelectElement;
    const field = target.dataset.field;
    const index = parseInt(target.dataset.index || '0', 10);

    if (field && this.flights[index]) {
      let value: string | boolean | number = target.value;

      if (field === 'isArrival') {
        value = target.value === 'true';
      } else if (field === 'identifier' || field === 'otherAirport' || field === 'aircraftType' || field === 'date') {
        value = target.value.toUpperCase();
        target.value = value;
      }

      (this.flights[index] as any)[field] = value;

      // Re-render if direction changed to update label
      if (field === 'isArrival') {
        this.renderFlights();
      }
    }
  }

  private generate(): void {
    this.errorsDiv.innerHTML = '';

    // Validate and build message
    const errors: string[] = [];

    if (!this.coordinationAirport || !/^[A-Z]{4}$/.test(this.coordinationAirport)) {
      errors.push('Coordination airport must be a 4-letter ICAO code');
    }

    const flightLines: GcrFlightLine[] = [];

    this.flights.forEach((flight, index) => {
      const prefix = `Flight ${index + 1}`;

      if (!flight.identifier) {
        errors.push(`${prefix}: ${this.identifierType === 'FLT' ? 'Flight number' : 'Registration'} is required`);
      }

      if (!/^\d{2}[A-Z]{3}$/.test(flight.date)) {
        errors.push(`${prefix}: Date must be in DDMMM format (e.g., 08JUN)`);
      } else {
        const month = flight.date.slice(2);
        if (!MONTHS.includes(month)) {
          errors.push(`${prefix}: Invalid month in date`);
        }
      }

      if (!flight.seatCount || parseInt(flight.seatCount, 10) < 0 || parseInt(flight.seatCount, 10) > 999) {
        errors.push(`${prefix}: Seat count must be 0-999`);
      }

      if (!/^[A-Z0-9]{3,4}$/.test(flight.aircraftType)) {
        errors.push(`${prefix}: Aircraft type must be 3-4 alphanumeric characters`);
      }

      if (!/^[A-Z]{4}$/.test(flight.otherAirport)) {
        errors.push(`${prefix}: ${flight.isArrival ? 'Origin' : 'Destination'} airport must be a 4-letter ICAO code`);
      }

      if (!/^\d{4}$/.test(flight.time)) {
        errors.push(`${prefix}: Time must be in HHMM format`);
      }

      if (errors.length === 0) {
        flightLines.push({
          actionCode: flight.actionCode,
          identifier: flight.identifier,
          date: flight.date,
          seatCount: parseInt(flight.seatCount, 10),
          aircraftType: flight.aircraftType,
          isArrival: flight.isArrival,
          otherAirport: flight.otherAirport,
          time: flight.time,
          flightType: flight.flightType,
          slotId: flight.slotId || undefined
        });
      }
    });

    if (errors.length > 0) {
      this.errorsDiv.innerHTML = errors.map(e => `<div class="gcr-error">${e}</div>`).join('');
      return;
    }

    const message: GcrMessage = {
      header: {
        identifierType: this.identifierType,
        airport: this.coordinationAirport
      },
      airportSections: [{
        airport: this.coordinationAirport,
        flights: flightLines
      }],
      footnotes: []
    };

    if (this.siText) {
      message.footnotes.push({ type: 'SI', text: this.siText });
    }
    if (this.giText) {
      message.footnotes.push({ type: 'GI', text: this.giText });
    }

    const encoded = this.codec.encode(message);
    this.outputTextarea.value = encoded;
  }

  private copyToClipboard(): void {
    if (this.outputTextarea.value) {
      navigator.clipboard.writeText(this.outputTextarea.value).then(() => {
        const btn = this.container.querySelector('.gcr-btn:last-child');
        if (btn) {
          const original = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = original; }, 2000);
        }
      });
    }
  }
}
