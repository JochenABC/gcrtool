import { GcrCodec, isParseError, GcrMessage, GcrFlightLine, GcrParseError } from '../codec';
import { ACTION_CODE_DESCRIPTIONS, FLIGHT_TYPE_DESCRIPTIONS, REPLY_STATUS_INFO, StatusClass } from '../codec/constants';
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

    const inputSection = document.createElement('div');
    inputSection.className = 'gcr-input-section';

    const label = document.createElement('label');
    label.textContent = 'Paste GCR message:';
    label.htmlFor = 'gcr-input';

    this.textarea.id = 'gcr-input';
    this.textarea.className = 'gcr-textarea';
    this.textarea.placeholder = 'GCR\n/FLT\nEDDF\nNABC123 08JUN 010G159 LSZH0900 D\nGI BRGDS';
    this.textarea.rows = 10;

    const decodeBtn = document.createElement('button');
    decodeBtn.className = 'gcr-btn';
    decodeBtn.textContent = 'Decode';
    decodeBtn.addEventListener('click', () => this.decode());

    inputSection.appendChild(label);
    inputSection.appendChild(this.textarea);
    inputSection.appendChild(decodeBtn);

    this.outputDiv.className = 'gcr-output';

    this.container.appendChild(inputSection);
    this.container.appendChild(this.outputDiv);
  }

  private decode(): void {
    const text = this.textarea.value.trim();
    if (!text) {
      this.showError('Please enter a GCR message');
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
    // Header section
    const headerDiv = document.createElement('div');
    headerDiv.className = 'gcr-section';
    headerDiv.innerHTML = `
      <h3>Header</h3>
      <div class="gcr-field"><span class="gcr-label">Type:</span> <span class="gcr-value">GCR</span></div>
      <div class="gcr-field"><span class="gcr-label">Identifier:</span> <span class="gcr-value">${message.header.identifierType === 'FLT' ? 'Flight Number' : 'Registration'}</span></div>
      <div class="gcr-field"><span class="gcr-label">Coordination Airport:</span> <span class="gcr-value">${message.header.airport}</span></div>
    `;
    this.outputDiv.appendChild(headerDiv);

    // Airport sections
    for (const section of message.airportSections) {
      const sectionDiv = document.createElement('div');
      sectionDiv.className = 'gcr-section';

      const sectionHeader = document.createElement('h3');
      sectionHeader.textContent = `Airport: ${section.airport}`;
      sectionDiv.appendChild(sectionHeader);

      for (const flight of section.flights) {
        sectionDiv.appendChild(this.renderFlight(flight, message.header.identifierType));
      }

      this.outputDiv.appendChild(sectionDiv);
    }

    this.renderFootnotes(message);
  }

  private showReplyResult(message: GcrMessage): void {
    // Coordinator response banner
    const bannerDiv = document.createElement('div');
    bannerDiv.className = 'gcr-reply-banner';
    bannerDiv.innerHTML = `
      <span class="gcr-reply-icon">&#8617;</span>
      <span class="gcr-reply-title">Coordinator Response</span>
    `;
    this.outputDiv.appendChild(bannerDiv);

    // Header section
    const headerDiv = document.createElement('div');
    headerDiv.className = 'gcr-section gcr-reply-section';
    headerDiv.innerHTML = `
      <h3>Response Details</h3>
      <div class="gcr-field"><span class="gcr-label">Identifier Type:</span> <span class="gcr-value">${message.header.identifierType === 'FLT' ? 'Flight Number' : 'Registration'}</span></div>
      <div class="gcr-field"><span class="gcr-label">Coordination Airport:</span> <span class="gcr-value">${message.header.airport}</span></div>
    `;
    this.outputDiv.appendChild(headerDiv);

    // Airport sections with reply-specific rendering
    for (const section of message.airportSections) {
      const sectionDiv = document.createElement('div');
      sectionDiv.className = 'gcr-section gcr-reply-section';

      const sectionHeader = document.createElement('h3');
      sectionHeader.textContent = `Airport: ${section.airport}`;
      sectionDiv.appendChild(sectionHeader);

      for (const flight of section.flights) {
        sectionDiv.appendChild(this.renderReplyFlight(flight, message.header.identifierType));
      }

      this.outputDiv.appendChild(sectionDiv);
    }

    this.renderFootnotes(message);
  }

  private showMixedResult(message: GcrMessage): void {
    // Mixed response banner (request + reply codes)
    const bannerDiv = document.createElement('div');
    bannerDiv.className = 'gcr-reply-banner gcr-mixed-banner';
    bannerDiv.innerHTML = `
      <span class="gcr-reply-icon">&#8617;</span>
      <span class="gcr-reply-title">Coordinator Response with Alternative</span>
    `;
    this.outputDiv.appendChild(bannerDiv);

    // Header section
    const headerDiv = document.createElement('div');
    headerDiv.className = 'gcr-section gcr-reply-section';
    headerDiv.innerHTML = `
      <h3>Response Details</h3>
      <div class="gcr-field"><span class="gcr-label">Identifier Type:</span> <span class="gcr-value">${message.header.identifierType === 'FLT' ? 'Flight Number' : 'Registration'}</span></div>
      <div class="gcr-field"><span class="gcr-label">Coordination Airport:</span> <span class="gcr-value">${message.header.airport}</span></div>
    `;
    this.outputDiv.appendChild(headerDiv);

    // Airport sections with reply-specific rendering
    for (const section of message.airportSections) {
      const sectionDiv = document.createElement('div');
      sectionDiv.className = 'gcr-section gcr-reply-section';

      const sectionHeader = document.createElement('h3');
      sectionHeader.textContent = `Airport: ${section.airport}`;
      sectionDiv.appendChild(sectionHeader);

      for (const flight of section.flights) {
        sectionDiv.appendChild(this.renderReplyFlight(flight, message.header.identifierType));
      }

      this.outputDiv.appendChild(sectionDiv);
    }

    this.renderFootnotes(message);
  }

  private renderFootnotes(message: GcrMessage): void {
    if (message.footnotes.length > 0) {
      const footnotesDiv = document.createElement('div');
      footnotesDiv.className = 'gcr-section';
      footnotesDiv.innerHTML = '<h3>Footnotes</h3>';

      for (const footnote of message.footnotes) {
        const noteDiv = document.createElement('div');
        noteDiv.className = 'gcr-field';
        noteDiv.innerHTML = `<span class="gcr-label">${footnote.type}:</span> <span class="gcr-value">${footnote.text}</span>`;
        footnotesDiv.appendChild(noteDiv);
      }

      this.outputDiv.appendChild(footnotesDiv);
    }
  }

  private renderReplyFlight(flight: GcrFlightLine, identifierType: string): HTMLElement {
    const flightDiv = document.createElement('div');
    const statusClass = this.getStatusClass(flight.actionCode);
    flightDiv.className = `gcr-flight gcr-reply-flight gcr-reply-${statusClass}`;

    const statusInfo = REPLY_STATUS_INFO[flight.actionCode];
    const statusText = statusInfo?.description || ACTION_CODE_DESCRIPTIONS[flight.actionCode] || flight.actionCode;
    const flightTypeDesc = FLIGHT_TYPE_DESCRIPTIONS[flight.flightType] || flight.flightType;
    const direction = flight.isArrival ? 'Arrival' : 'Departure';

    flightDiv.innerHTML = `
      <div class="gcr-reply-header">
        <div class="gcr-reply-status gcr-status-${statusClass}">
          <span class="gcr-action gcr-action-${flight.actionCode.toLowerCase()}">${flight.actionCode}</span>
          <span class="gcr-status-text">${statusText}</span>
        </div>
        ${flight.slotId
          ? `<div class="gcr-reply-slot-id"><span class="gcr-label">Slot ID:</span> <span class="gcr-slot-id-value">${flight.slotId}</span></div>`
          : '<div class="gcr-reply-no-slot">No Slot ID assigned</div>'}
      </div>
      <div class="gcr-reply-flight-info">
        <div class="gcr-field"><span class="gcr-label">${identifierType === 'FLT' ? 'Flight' : 'Registration'}:</span> <span class="gcr-value">${flight.identifier}</span></div>
        <div class="gcr-field"><span class="gcr-label">Date:</span> <span class="gcr-value">${flight.date}</span></div>
        <div class="gcr-field"><span class="gcr-label">Time (UTC):</span> <span class="gcr-value">${flight.time.slice(0, 2)}:${flight.time.slice(2)}</span></div>
        <div class="gcr-field"><span class="gcr-label">${flight.isArrival ? 'From' : 'To'}:</span> <span class="gcr-value">${flight.otherAirport}</span></div>
        <div class="gcr-field"><span class="gcr-label">Direction:</span> <span class="gcr-direction gcr-${direction.toLowerCase()}">${direction}</span></div>
        <div class="gcr-field"><span class="gcr-label">Aircraft:</span> <span class="gcr-value">${flight.aircraftType} (${flight.seatCount} seats)</span></div>
        <div class="gcr-field"><span class="gcr-label">Flight Type:</span> <span class="gcr-value">${flightTypeDesc}</span></div>
      </div>
    `;

    return flightDiv;
  }

  private getStatusClass(actionCode: ActionCode): string {
    const mapping: Record<ActionCode, string> = {
      K: 'confirmed',
      X: 'cancelled',
      H: 'held',
      U: 'refused',
      W: 'error',
      N: 'new',
      D: 'delete',
      C: 'change',
      R: 'revised'
    };
    return mapping[actionCode] || 'default';
  }

  private renderFlight(flight: GcrFlightLine, identifierType: string): HTMLElement {
    const flightDiv = document.createElement('div');
    flightDiv.className = 'gcr-flight';

    const actionDesc = ACTION_CODE_DESCRIPTIONS[flight.actionCode] || flight.actionCode;
    const flightTypeDesc = FLIGHT_TYPE_DESCRIPTIONS[flight.flightType] || flight.flightType;
    const direction = flight.isArrival ? 'Arrival' : 'Departure';

    flightDiv.innerHTML = `
      <div class="gcr-flight-header">
        <span class="gcr-action gcr-action-${flight.actionCode.toLowerCase()}">${flight.actionCode}</span>
        <span class="gcr-identifier">${flight.identifier}</span>
        <span class="gcr-direction gcr-${direction.toLowerCase()}">${direction}</span>
      </div>
      <div class="gcr-flight-details">
        <div class="gcr-field"><span class="gcr-label">Action:</span> <span class="gcr-value">${actionDesc}</span></div>
        <div class="gcr-field"><span class="gcr-label">Date:</span> <span class="gcr-value">${flight.date}</span></div>
        <div class="gcr-field"><span class="gcr-label">Time (UTC):</span> <span class="gcr-value">${flight.time.slice(0, 2)}:${flight.time.slice(2)}</span></div>
        <div class="gcr-field"><span class="gcr-label">${flight.isArrival ? 'From' : 'To'}:</span> <span class="gcr-value">${flight.otherAirport}</span></div>
        <div class="gcr-field"><span class="gcr-label">Aircraft:</span> <span class="gcr-value">${flight.aircraftType} (${flight.seatCount} seats)</span></div>
        <div class="gcr-field"><span class="gcr-label">Flight Type:</span> <span class="gcr-value">${flightTypeDesc}</span></div>
        ${flight.slotId ? `<div class="gcr-field"><span class="gcr-label">Slot ID:</span> <span class="gcr-value gcr-slot-id">${flight.slotId}</span></div>` : ''}
      </div>
    `;

    return flightDiv;
  }
}
