import { GcrCodec, GcrMessage, GcrFlightLine, ActionCode, IdentifierType, FlightType } from '../codec';
import { OWNER_ACTION_CODES, ACTION_CODE_DESCRIPTIONS, FLIGHT_TYPE_DESCRIPTIONS, MONTHS } from '../codec/constants';

interface FlightFormData {
  actionCode: ActionCode;
  date: string;
  isArrival: boolean;
  otherAirport: string;
  time: string;
  slotId: string;
}

export class EncoderUI {
  private container: HTMLElement;
  private codec: GcrCodec;
  private identifierType: IdentifierType = 'REG';
  private coordinationAirport: string = '';
  private identifier: string = '';
  private aircraftType: string = '';
  private seatCount: string = '';
  private flightType: FlightType = 'D';
  private flights: FlightFormData[] = [];
  private siText: string = '';
  private giText: string = '';
  private outputTextarea: HTMLTextAreaElement;
  private errorsDiv: HTMLElement;
  private formContainer: HTMLElement;

  private static STORAGE_KEY = 'gcr-encoder-preferences';

  constructor(selector: string) {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`Element not found: ${selector}`);
    this.container = el as HTMLElement;
    this.codec = new GcrCodec();
    this.outputTextarea = document.createElement('textarea');
    this.errorsDiv = document.createElement('div');
    this.formContainer = document.createElement('div');
    this.loadPreferences();
    this.addFlight();
    this.render();
  }

  private loadPreferences(): void {
    try {
      const stored = localStorage.getItem(EncoderUI.STORAGE_KEY);
      if (stored) {
        const prefs = JSON.parse(stored);
        if (prefs.identifierType) this.identifierType = prefs.identifierType;
        if (prefs.identifier) this.identifier = prefs.identifier;
        if (prefs.aircraftType) this.aircraftType = prefs.aircraftType;
        if (prefs.seatCount) this.seatCount = prefs.seatCount;
        if (prefs.flightType) this.flightType = prefs.flightType;
      }
    } catch {
      // Ignore localStorage errors
    }
  }

  private savePreferences(): void {
    try {
      const prefs = {
        identifierType: this.identifierType,
        identifier: this.identifier,
        aircraftType: this.aircraftType,
        seatCount: this.seatCount,
        flightType: this.flightType
      };
      localStorage.setItem(EncoderUI.STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore localStorage errors
    }
  }

  private render(): void {
    this.container.innerHTML = '';
    this.container.classList.add('gcr-encoder');

    // Header section
    const headerSection = document.createElement('article');
    headerSection.className = 'gcr-section';
    headerSection.innerHTML = `
      <header><h3>Request Details</h3></header>
      <div class="gcr-form-flex">
        <label>
          Coord. Airport
          <input type="text" id="gcr-coord-airport" class="gcr-input gcr-input-xs" maxlength="4" placeholder="EDDF" value="${this.coordinationAirport}" />
        </label>
        <label>
          Identifier Type
          <select id="gcr-id-type" class="gcr-select gcr-select-md">
            <option value="REG" ${this.identifierType === 'REG' ? 'selected' : ''}>Registration (REG)</option>
            <option value="FLT" ${this.identifierType === 'FLT' ? 'selected' : ''}>Flight Number (FLT)</option>
          </select>
        </label>
        <label>
          ${this.identifierType === 'FLT' ? 'Flight Number' : 'Registration'}
          <input type="text" id="gcr-identifier" class="gcr-input gcr-input-md" placeholder="${this.identifierType === 'FLT' ? 'ABC123' : 'HBIEV'}" value="${this.identifier}" />
        </label>
        <label>
          Aircraft Type
          <input type="text" id="gcr-aircraft-type" class="gcr-input gcr-input-xs" maxlength="4" placeholder="G159" value="${this.aircraftType}" />
        </label>
        <label>
          Seats
          <input type="number" id="gcr-seat-count" class="gcr-input gcr-input-xs" min="0" max="999" placeholder="10" value="${this.seatCount}" />
        </label>
        <label>
          Flight Type
          <select id="gcr-flight-type" class="gcr-select gcr-select-lg">
            ${(['D', 'I', 'N'] as FlightType[]).map(type => `<option value="${type}" ${this.flightType === type ? 'selected' : ''}>${type} - ${FLIGHT_TYPE_DESCRIPTIONS[type]}</option>`).join('')}
          </select>
        </label>
      </div>
    `;

    headerSection.querySelector('#gcr-id-type')?.addEventListener('change', (e) => {
      this.identifierType = (e.target as HTMLSelectElement).value as IdentifierType;
      this.savePreferences();
      this.render();
      this.generate();
    });

    headerSection.querySelector('#gcr-identifier')?.addEventListener('input', (e) => {
      this.identifier = (e.target as HTMLInputElement).value.toUpperCase();
      (e.target as HTMLInputElement).value = this.identifier;
      this.savePreferences();
      this.generate();
    });

    headerSection.querySelector('#gcr-aircraft-type')?.addEventListener('input', (e) => {
      this.aircraftType = (e.target as HTMLInputElement).value.toUpperCase();
      (e.target as HTMLInputElement).value = this.aircraftType;
      this.savePreferences();
      this.generate();
    });

    headerSection.querySelector('#gcr-seat-count')?.addEventListener('input', (e) => {
      this.seatCount = (e.target as HTMLInputElement).value;
      this.savePreferences();
      this.generate();
    });

    headerSection.querySelector('#gcr-flight-type')?.addEventListener('change', (e) => {
      this.flightType = (e.target as HTMLSelectElement).value as FlightType;
      this.savePreferences();
      this.generate();
    });

    headerSection.querySelector('#gcr-coord-airport')?.addEventListener('input', (e) => {
      this.coordinationAirport = (e.target as HTMLInputElement).value.toUpperCase();
      (e.target as HTMLInputElement).value = this.coordinationAirport;
      this.generate();
    });

    this.container.appendChild(headerSection);

    // Flights section
    const flightsSection = document.createElement('article');
    flightsSection.className = 'gcr-section';
    flightsSection.innerHTML = '<header><h3>Flights</h3></header>';

    this.formContainer.className = 'gcr-flights-container';
    flightsSection.appendChild(this.formContainer);

    this.container.appendChild(flightsSection);

    // Footnotes section (collapsible using native details)
    const hasFootnotes = this.siText || this.giText;
    const footnotesSection = document.createElement('details');
    footnotesSection.className = 'gcr-collapsible';
    if (hasFootnotes) footnotesSection.open = true;
    footnotesSection.innerHTML = `
      <summary>Footnotes (Optional)</summary>
      <div class="gcr-collapsible-content">
        <div class="gcr-form-row">
          <label>
            SI (Special Information)
            <input type="text" id="gcr-si" class="gcr-input gcr-input-wide" placeholder="IF NOT AVBL PLS CFM NEXT LATER POSS" value="${this.siText}" />
          </label>
        </div>
        <div class="gcr-form-row">
          <label>
            GI (General Information)
            <input type="text" id="gcr-gi" class="gcr-input gcr-input-wide" placeholder="BRGDS" value="${this.giText}" />
          </label>
        </div>
      </div>
    `;

    footnotesSection.querySelector('#gcr-si')?.addEventListener('input', (e) => {
      this.siText = (e.target as HTMLInputElement).value;
      if (this.siText && !footnotesSection.open) {
        footnotesSection.open = true;
      }
      this.generate();
    });

    footnotesSection.querySelector('#gcr-gi')?.addEventListener('input', (e) => {
      this.giText = (e.target as HTMLInputElement).value;
      if (this.giText && !footnotesSection.open) {
        footnotesSection.open = true;
      }
      this.generate();
    });

    this.container.appendChild(footnotesSection);

    // Generate section
    const generateSection = document.createElement('article');
    generateSection.className = 'gcr-section';

    const generateBtn = document.createElement('button');
    generateBtn.className = 'gcr-btn-primary';
    generateBtn.textContent = 'Generate GCR';
    generateBtn.addEventListener('click', () => this.generate());

    this.errorsDiv.className = 'gcr-errors';

    this.outputTextarea.className = 'gcr-textarea gcr-output-textarea';
    this.outputTextarea.readOnly = true;
    this.outputTextarea.rows = 10;

    const copyBtn = document.createElement('button');
    copyBtn.className = 'gcr-btn-secondary';
    copyBtn.textContent = 'Copy to Clipboard';
    copyBtn.addEventListener('click', () => this.copyToClipboard());

    generateSection.appendChild(generateBtn);
    generateSection.appendChild(this.errorsDiv);
    generateSection.appendChild(this.outputTextarea);
    generateSection.appendChild(copyBtn);

    this.container.appendChild(generateSection);

    this.renderFlights();
  }

  private addFlight(): void {
    this.flights.push({
      actionCode: 'N',
      date: '',
      isArrival: true,
      otherAirport: '',
      time: '',
      slotId: ''
    });
  }

  private renderFlights(): void {
    this.formContainer.innerHTML = '';

    // Create table structure
    const table = document.createElement('table');
    table.className = 'gcr-flights-table';

    // Header row
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th>Action</th>
        <th>Date</th>
        <th>Dir</th>
        <th>Airport</th>
        <th>Time (UTC)</th>
        <th>Slot ID</th>
        <th></th>
      </tr>
    `;
    table.appendChild(thead);

    // Body rows
    const tbody = document.createElement('tbody');
    this.flights.forEach((flight, index) => {
      const row = document.createElement('tr');
      const slotIdDisabled = !['D', 'C', 'R'].includes(flight.actionCode);

      row.innerHTML = `
        <td>
          <select class="gcr-table-select" data-field="actionCode" data-index="${index}">
            ${OWNER_ACTION_CODES.map(code => `<option value="${code}" ${flight.actionCode === code ? 'selected' : ''}>${code} - ${ACTION_CODE_DESCRIPTIONS[code]}</option>`).join('')}
          </select>
        </td>
        <td>
          <input type="text" class="gcr-table-input gcr-table-input-date" data-field="date" data-index="${index}" maxlength="5" placeholder="08JUN" value="${flight.date}" />
        </td>
        <td>
          <select class="gcr-table-select gcr-table-select-dir" data-field="isArrival" data-index="${index}">
            <option value="true" ${flight.isArrival ? 'selected' : ''}>Arrival</option>
            <option value="false" ${!flight.isArrival ? 'selected' : ''}>Departure</option>
          </select>
        </td>
        <td>
          <input type="text" class="gcr-table-input gcr-table-input-airport" data-field="otherAirport" data-index="${index}" maxlength="4" placeholder="LSZH" value="${flight.otherAirport}" />
        </td>
        <td>
          <input type="text" class="gcr-table-input gcr-table-input-time" data-field="time" data-index="${index}" maxlength="4" placeholder="0900" value="${flight.time}" />
        </td>
        <td>
          <input type="text" class="gcr-table-input gcr-table-input-slot" data-field="slotId" data-index="${index}" placeholder="${slotIdDisabled ? '—' : 'EDDF3010070001'}" value="${flight.slotId}" ${slotIdDisabled ? 'disabled' : ''} />
        </td>
        <td>
          ${this.flights.length > 1 ? `<button class="gcr-btn-remove" data-index="${index}" title="Remove flight">&times;</button>` : ''}
        </td>
      `;

      // Add event listeners
      row.querySelectorAll('input, select').forEach(el => {
        el.addEventListener('change', (e) => this.handleFieldChange(e));
        el.addEventListener('input', (e) => this.handleFieldChange(e));
      });

      const removeBtn = row.querySelector('.gcr-btn-remove');
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          this.flights.splice(index, 1);
          this.renderFlights();
          this.generate();
        });
      }

      tbody.appendChild(row);
    });
    table.appendChild(tbody);

    this.formContainer.appendChild(table);

    // Add flight button below table
    const addBtn = document.createElement('button');
    addBtn.className = 'gcr-btn-add gcr-flights-add-btn';
    addBtn.textContent = '+ Add Flight';
    addBtn.addEventListener('click', () => {
      this.addFlight();
      this.renderFlights();
      this.generate();
    });
    this.formContainer.appendChild(addBtn);
  }

  private handleFieldChange(e: Event): void {
    const target = e.target as HTMLInputElement | HTMLSelectElement;
    const field = target.dataset.field;
    const index = parseInt(target.dataset.index || '0', 10);

    if (field && this.flights[index]) {
      let value: string | boolean | number = target.value;

      if (field === 'isArrival') {
        value = target.value === 'true';
      } else if (field === 'otherAirport' || field === 'date') {
        value = target.value.toUpperCase();
        target.value = value;
      }

      (this.flights[index] as any)[field] = value;

      // Clear slotId when switching to an action code that doesn't need it
      if (field === 'actionCode' && !['D', 'C', 'R'].includes(value as string)) {
        this.flights[index].slotId = '';
      }

      // Re-render if direction or action code changed to update UI
      if (field === 'isArrival' || field === 'actionCode') {
        this.renderFlights();
      }

      this.generate();
    }
  }

  private generate(): void {
    this.errorsDiv.innerHTML = '';

    // Validate and build message
    const errors: string[] = [];

    // Validate top-level fields
    if (!this.identifier) {
      errors.push(`${this.identifierType === 'FLT' ? 'Flight number' : 'Registration'} is required`);
    }

    if (!this.seatCount || parseInt(this.seatCount, 10) < 0 || parseInt(this.seatCount, 10) > 999) {
      errors.push('Seat count must be 0-999');
    }

    if (!/^[A-Z0-9]{3,4}$/.test(this.aircraftType)) {
      errors.push('Aircraft type must be 3-4 alphanumeric characters');
    }

    if (!this.coordinationAirport || !/^[A-Z]{4}$/.test(this.coordinationAirport)) {
      errors.push('Coordination airport must be a 4-letter ICAO code');
    }

    const flightLines: GcrFlightLine[] = [];

    this.flights.forEach((flight, index) => {
      const prefix = `Flight ${index + 1}`;

      if (!/^\d{2}[A-Z]{3}$/.test(flight.date)) {
        errors.push(`${prefix}: Date must be in DDMMM format (e.g., 08JUN)`);
      } else {
        const month = flight.date.slice(2);
        if (!MONTHS.includes(month)) {
          errors.push(`${prefix}: Invalid month in date`);
        }
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
          identifier: this.identifier,
          date: flight.date,
          seatCount: parseInt(this.seatCount, 10),
          aircraftType: this.aircraftType,
          isArrival: flight.isArrival,
          otherAirport: flight.otherAirport,
          time: flight.time,
          flightType: this.flightType,
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
      footnotes: [],
      messageType: 'request'
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
