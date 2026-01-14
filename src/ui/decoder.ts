import { GcrCodec, isParseError, GcrMessage, GcrFlightLine } from '../codec';
import { ACTION_CODE_DESCRIPTIONS, MONTHS } from '../codec/constants';
import type { ActionCode } from '../codec/types';

export class DecoderUI {
  private container: HTMLElement;
  private codec: GcrCodec;
  private textarea: HTMLTextAreaElement;
  private outputDiv: HTMLElement;

  constructor(selector: string) {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`Element not found: ${selector}`);
    this.container = el as HTMLElement;
    this.codec = new GcrCodec();
    this.textarea = document.createElement('textarea');
    this.outputDiv = document.createElement('div');
    this.render();
  }

  private render(): void {
    this.container.innerHTML = '';
    this.container.classList.add('gcr-decoder');

    // Flex container for side-by-side layout
    const parseContainer = document.createElement('div');
    parseContainer.className = 'gcr-parse-container';

    const inputSection = document.createElement('div');
    inputSection.className = 'gcr-input-section';

    const label = document.createElement('label');
    label.textContent = 'Paste GCR request or reply:';
    label.htmlFor = 'gcr-input';

    this.textarea.id = 'gcr-input';
    this.textarea.className = 'gcr-textarea';
    this.textarea.placeholder = 'GCR\n/FLT\nEDDF\nNABC123 08JUN 010G159 LSZH0900 D\nGI BRGDS';
    this.textarea.rows = 10;
    this.textarea.addEventListener('input', () => this.decode());

    const parseBtn = document.createElement('button');
    parseBtn.className = 'gcr-btn gcr-btn-primary';
    parseBtn.textContent = 'Parse';
    parseBtn.addEventListener('click', () => this.decode());

    inputSection.appendChild(label);
    inputSection.appendChild(this.textarea);
    inputSection.appendChild(parseBtn);

    this.outputDiv.className = 'gcr-output';

    parseContainer.appendChild(inputSection);
    parseContainer.appendChild(this.outputDiv);
    this.container.appendChild(parseContainer);
  }

  private decode(): void {
    const text = this.textarea.value.trim();
    if (!text) {
      this.outputDiv.innerHTML = '';
      return;
    }

    const result = this.codec.decode(text);

    if (isParseError(result)) {
      this.showError(result.message, result.line);
    } else {
      this.showResult(result);
    }
  }

  private showError(message: string, line?: number): void {
    this.outputDiv.innerHTML = '';
    const errorDiv = document.createElement('div');
    errorDiv.className = 'gcr-error';
    errorDiv.textContent = line ? `Line ${line}: ${message}` : message;
    this.outputDiv.appendChild(errorDiv);
  }

  private showResult(message: GcrMessage): void {
    this.outputDiv.innerHTML = '';

    if (message.messageType === 'reply') {
      this.showReplyResult(message);
    } else if (message.messageType === 'mixed') {
      this.showMixedResult(message);
    } else {
      this.showRequestResult(message);
    }
  }

  private showRequestResult(message: GcrMessage): void {
    const allFlights = this.getAllFlights(message);
    const commonAircraft = this.getCommonAircraft(allFlights);
    const commonIdentifier = this.getCommonIdentifier(allFlights);

    // Combined header section
    const headerDiv = document.createElement('div');
    headerDiv.className = 'gcr-section gcr-header-section';

    let headerContent = `
      <div class="gcr-header-line"><span class="gcr-header-label">Type</span> <span class="gcr-header-value">Request</span></div>
      <div class="gcr-header-line"><span class="gcr-header-label">Airport</span> <span class="gcr-header-value">${message.header.airport}</span></div>
    `;
    if (commonIdentifier) {
      const idLabel = message.header.identifierType === 'FLT' ? 'Flight' : 'Registration';
      headerContent += `<div class="gcr-header-line"><span class="gcr-header-label">${idLabel}</span> <span class="gcr-header-value">${commonIdentifier}</span></div>`;
    }
    if (commonAircraft) {
      headerContent += `<div class="gcr-header-line"><span class="gcr-header-label">Aircraft</span> <span class="gcr-header-value">${commonAircraft.type} (${commonAircraft.seats} seats)</span></div>`;
    }
    headerDiv.innerHTML = headerContent;
    this.outputDiv.appendChild(headerDiv);

    // Flights table
    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'gcr-results-table-wrapper';
    tableWrapper.appendChild(this.renderResultsTable(allFlights, message.header.identifierType, !commonAircraft, !commonIdentifier));
    this.outputDiv.appendChild(tableWrapper);

    this.renderFootnotes(message);
  }

  private showReplyResult(message: GcrMessage): void {
    const allFlights = this.getAllFlights(message);
    const commonAircraft = this.getCommonAircraft(allFlights);
    const commonIdentifier = this.getCommonIdentifier(allFlights);

    // Combined header section
    const headerDiv = document.createElement('div');
    headerDiv.className = 'gcr-section gcr-header-section gcr-reply-section';

    let headerContent = `
      <div class="gcr-header-line"><span class="gcr-header-label">Type</span> <span class="gcr-header-value">Coordinator Response</span></div>
      <div class="gcr-header-line"><span class="gcr-header-label">Airport</span> <span class="gcr-header-value">${message.header.airport}</span></div>
    `;
    if (commonIdentifier) {
      const idLabel = message.header.identifierType === 'FLT' ? 'Flight' : 'Registration';
      headerContent += `<div class="gcr-header-line"><span class="gcr-header-label">${idLabel}</span> <span class="gcr-header-value">${commonIdentifier}</span></div>`;
    }
    if (commonAircraft) {
      headerContent += `<div class="gcr-header-line"><span class="gcr-header-label">Aircraft</span> <span class="gcr-header-value">${commonAircraft.type} (${commonAircraft.seats} seats)</span></div>`;
    }
    headerDiv.innerHTML = headerContent;
    this.outputDiv.appendChild(headerDiv);

    // Flights table
    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'gcr-results-table-wrapper';
    tableWrapper.appendChild(this.renderResultsTable(allFlights, message.header.identifierType, !commonAircraft, !commonIdentifier));
    this.outputDiv.appendChild(tableWrapper);

    this.renderFootnotes(message);
  }

  private showMixedResult(message: GcrMessage): void {
    const allFlights = this.getAllFlights(message);
    const commonAircraft = this.getCommonAircraft(allFlights);
    const commonIdentifier = this.getCommonIdentifier(allFlights);

    // Combined header section
    const headerDiv = document.createElement('div');
    headerDiv.className = 'gcr-section gcr-header-section gcr-mixed-section';

    let headerContent = `
      <div class="gcr-header-line"><span class="gcr-header-label">Type:</span> <span class="gcr-header-value">Response with Alternative</span></div>
      <div class="gcr-header-line"><span class="gcr-header-label">Airport:</span> <span class="gcr-header-value">${message.header.airport}</span></div>
    `;
    if (commonIdentifier) {
      const idLabel = message.header.identifierType === 'FLT' ? 'Flight:' : 'Registration:';
      headerContent += `<div class="gcr-header-line"><span class="gcr-header-label">${idLabel}</span> <span class="gcr-header-value">${commonIdentifier}</span></div>`;
    }
    if (commonAircraft) {
      headerContent += `<div class="gcr-header-line"><span class="gcr-header-label">Aircraft:</span> <span class="gcr-header-value">${commonAircraft.type} (${commonAircraft.seats} seats)</span></div>`;
    }
    headerDiv.innerHTML = headerContent;
    this.outputDiv.appendChild(headerDiv);

    // Flights table
    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'gcr-results-table-wrapper';
    tableWrapper.appendChild(this.renderResultsTable(allFlights, message.header.identifierType, !commonAircraft, !commonIdentifier));
    this.outputDiv.appendChild(tableWrapper);

    this.renderFootnotes(message);
  }

  private renderFootnotes(message: GcrMessage): void {
    const siNotes = message.footnotes.filter(f => f.type === 'SI');
    const giNotes = message.footnotes.filter(f => f.type === 'GI');

    if (siNotes.length === 0 && giNotes.length === 0) return;

    const footnotesDiv = document.createElement('div');
    footnotesDiv.className = 'gcr-section gcr-footnote-section';
    footnotesDiv.innerHTML = '<h3>Notes</h3>';

    // SI (Supplementary Information)
    if (siNotes.length > 0) {
      const siGroup = document.createElement('div');
      siGroup.className = 'gcr-footnote-group';
      siGroup.innerHTML = `
        <h4>Supplementary Information (SI)</h4>
        <p class="gcr-footnote-desc">Flight-specific operational details and requirements.</p>
      `;
      for (const note of siNotes) {
        const noteDiv = document.createElement('div');
        noteDiv.className = 'gcr-footnote-text';
        noteDiv.textContent = note.text;
        siGroup.appendChild(noteDiv);
      }
      footnotesDiv.appendChild(siGroup);
    }

    // GI (General Information)
    if (giNotes.length > 0) {
      const giGroup = document.createElement('div');
      giGroup.className = 'gcr-footnote-group';
      giGroup.innerHTML = `
        <h4>General Information (GI)</h4>
        <p class="gcr-footnote-desc">General remarks and administrative notes.</p>
      `;
      for (const note of giNotes) {
        const noteDiv = document.createElement('div');
        noteDiv.className = 'gcr-footnote-text';
        noteDiv.textContent = note.text;
        giGroup.appendChild(noteDiv);
      }
      footnotesDiv.appendChild(giGroup);
    }

    this.outputDiv.appendChild(footnotesDiv);
  }

  private getAllFlights(message: GcrMessage): GcrFlightLine[] {
    const flights: GcrFlightLine[] = [];
    for (const section of message.airportSections) {
      flights.push(...section.flights);
    }
    return flights;
  }

  private getCommonAircraft(flights: GcrFlightLine[]): { type: string; seats: number } | null {
    if (flights.length === 0) return null;
    const firstType = flights[0].aircraftType;
    const firstSeats = flights[0].seatCount;
    const allSame = flights.every(f => f.aircraftType === firstType && f.seatCount === firstSeats);
    return allSame ? { type: firstType, seats: firstSeats } : null;
  }

  private getCommonIdentifier(flights: GcrFlightLine[]): string | null {
    if (flights.length === 0) return null;
    const firstId = flights[0].identifier;
    const allSame = flights.every(f => f.identifier === firstId);
    return allSame ? firstId : null;
  }

  private sortFlightsByDateTime(flights: GcrFlightLine[]): GcrFlightLine[] {
    return [...flights].sort((a, b) => {
      // Parse date (DDMMM format, e.g., "08JUN")
      const dayA = parseInt(a.date.slice(0, 2), 10);
      const monthA = MONTHS.indexOf(a.date.slice(2).toUpperCase());
      const dayB = parseInt(b.date.slice(0, 2), 10);
      const monthB = MONTHS.indexOf(b.date.slice(2).toUpperCase());

      // Compare by month first, then day, then time
      if (monthA !== monthB) return monthA - monthB;
      if (dayA !== dayB) return dayA - dayB;

      // Parse time (HHMM format)
      const timeA = parseInt(a.time, 10);
      const timeB = parseInt(b.time, 10);
      return timeA - timeB;
    });
  }

  private getStatusText(actionCode: ActionCode): string {
    return ACTION_CODE_DESCRIPTIONS[actionCode] || actionCode;
  }

  private copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      // Brief visual feedback could be added here
    }).catch(err => {
      console.error('Failed to copy to clipboard:', err);
    });
  }

  private renderResultsTable(flights: GcrFlightLine[], identifierType: string, showAircraft: boolean, showIdentifier: boolean = true): HTMLElement {
    const table = document.createElement('table');
    table.className = 'gcr-results-table';

    // Sort flights by date and time (oldest first)
    const sortedFlights = this.sortFlightsByDateTime(flights);

    // Header row
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const headers = ['Status'];
    if (showIdentifier) headers.push(identifierType === 'FLT' ? 'Flight' : 'Reg');
    headers.push('Date', 'Time', 'Dir', 'From/To');
    if (showAircraft) headers.push('Aircraft');
    headers.push('Slot ID');

    for (const h of headers) {
      const th = document.createElement('th');
      th.textContent = h;
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body rows
    const tbody = document.createElement('tbody');
    for (const flight of sortedFlights) {
      const row = document.createElement('tr');
      const direction = flight.isArrival ? 'Arrival' : 'Departure';
      const timeFormatted = `${flight.time.slice(0, 2)}:${flight.time.slice(2)}`;
      const statusText = this.getStatusText(flight.actionCode);

      // Status cell
      const statusCell = document.createElement('td');
      statusCell.innerHTML = `<span class="gcr-action gcr-action-${flight.actionCode.toLowerCase()}">${statusText}</span>`;
      row.appendChild(statusCell);

      // Identifier cell (if showing)
      if (showIdentifier) {
        const idCell = document.createElement('td');
        idCell.textContent = flight.identifier;
        idCell.style.fontWeight = '600';
        row.appendChild(idCell);
      }

      // Date cell
      const dateCell = document.createElement('td');
      dateCell.textContent = flight.date;
      row.appendChild(dateCell);

      // Time cell
      const timeCell = document.createElement('td');
      timeCell.textContent = timeFormatted;
      row.appendChild(timeCell);

      // Direction cell
      const dirCell = document.createElement('td');
      dirCell.innerHTML = `<span class="gcr-direction gcr-${direction.toLowerCase()}">${flight.isArrival ? 'Arr' : 'Dep'}</span>`;
      row.appendChild(dirCell);

      // From/To cell
      const airportCell = document.createElement('td');
      airportCell.textContent = flight.otherAirport;
      row.appendChild(airportCell);

      // Aircraft cell (if showing)
      if (showAircraft) {
        const acCell = document.createElement('td');
        acCell.textContent = `${flight.aircraftType} (${flight.seatCount})`;
        row.appendChild(acCell);
      }

      // Slot ID cell
      const slotCell = document.createElement('td');
      if (flight.slotId) {
        const slotWrapper = document.createElement('span');
        slotWrapper.className = 'gcr-slot-id-wrapper';

        const slotSpan = document.createElement('span');
        slotSpan.className = 'gcr-slot-id';
        slotSpan.textContent = flight.slotId;

        const copyBtn = document.createElement('button');
        copyBtn.className = 'gcr-copy-btn';
        copyBtn.title = 'Copy to clipboard';
        copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
        copyBtn.addEventListener('click', () => this.copyToClipboard(flight.slotId!));

        slotWrapper.appendChild(slotSpan);
        slotWrapper.appendChild(copyBtn);
        slotCell.appendChild(slotWrapper);
      } else {
        slotCell.innerHTML = `<span class="gcr-no-slot">—</span>`;
      }
      row.appendChild(slotCell);

      tbody.appendChild(row);
    }
    table.appendChild(tbody);

    return table;
  }
}
