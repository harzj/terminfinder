function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

interface EventBase {
  groupName: string
  eventDate: string
  fromTime?: string | null
  untilTime?: string | null
  eventUrl?: string
}

function eventLine(event: EventBase): string {
  const time = event.fromTime
    ? `${event.fromTime}${event.untilTime ? ` bis ${event.untilTime}` : ''}`
    : 'ganztägig'

  return `${event.eventDate} um ${time} in ${event.groupName}`
}

export function newEventVoteTemplate(event: EventBase) {
  const summary = eventLine(event)
  return {
    subject: `Neuer Termin zur Abstimmung: ${event.groupName}`,
    text: `${summary}\n\nEin neuer Termin wurde vorgeschlagen.${event.eventUrl ? `\n${event.eventUrl}` : ''}`,
    html: `
      <h2>Neuer Termin zur Abstimmung</h2>
      <p>${escapeHtml(summary)}</p>
      <p>Ein neuer Termin wurde vorgeschlagen.</p>
      ${event.eventUrl ? `<p><a href="${escapeHtml(event.eventUrl)}">Termin ansehen</a></p>` : ''}
    `.trim(),
  }
}

export function reminderTemplate(event: EventBase) {
  const summary = eventLine(event)
  return {
    subject: `Erinnerung: Spieleabend heute`,
    text: `Heute ist dein Spieleabend:\n${summary}${event.eventUrl ? `\n\n${event.eventUrl}` : ''}`,
    html: `
      <h2>Erinnerung an den Spieleabend</h2>
      <p>Heute ist dein Spieleabend:</p>
      <p><strong>${escapeHtml(summary)}</strong></p>
      ${event.eventUrl ? `<p><a href="${escapeHtml(event.eventUrl)}">Termin ansehen</a></p>` : ''}
    `.trim(),
  }
}

export function opinionChangedTemplate(event: EventBase & { participantName: string }) {
  const summary = eventLine(event)
  return {
    subject: `Änderung bei der Abstimmung: ${event.groupName}`,
    text: `${event.participantName} hat seine Meinung geändert.\n${summary}${event.eventUrl ? `\n\n${event.eventUrl}` : ''}`,
    html: `
      <h2>Jemand hat seine Meinung geändert</h2>
      <p><strong>${escapeHtml(event.participantName)}</strong> hat seine Meinung geändert.</p>
      <p>${escapeHtml(summary)}</p>
      ${event.eventUrl ? `<p><a href="${escapeHtml(event.eventUrl)}">Termin ansehen</a></p>` : ''}
    `.trim(),
  }
}
