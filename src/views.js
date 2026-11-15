import { name } from './data.js';

export function escape(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

export const value = (text, fallback = '—') => escape(text ?? fallback);
export const message = (text) => `<p class="empty">${escape(text)}</p>`;

export const screens = {
  home: { title: 'Home', intro: 'Choose where to start.' },
  clients: { title: 'Client lookup', intro: 'Find contact information, family memberships, and appointments.' },
  dashboard: { title: 'Dashboard', intro: 'Clients and appointment activity across RAFT.' },
  records: { title: 'Add or edit a record', intro: 'Open an appointment to see the fields you can change.' },
};

export const mark = '<span class="mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';

export function home(role) {
  const actions = [
    ['clients', 'Find a client', 'Look up contacts, appointments, and family roles.'],
    ['dashboard', 'View dashboard', 'See client totals and appointment activity.'],
    ['records', role.schedule ? 'Manage appointments' : 'Record visit details',
      role.schedule ? 'Add an appointment or update an existing record.' : 'Update appointment notes and client assignments.'],
  ];
  return `<section class="home-grid" aria-label="Front desk actions">${actions.map(([route, title, description]) => `
    <a class="action-card" href="#${route}"><h2>${title}</h2><p>${description}</p><span aria-hidden="true">↗</span></a>`).join('')}</section>`;
}

const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });
const timeFormat = new Intl.DateTimeFormat('en-US', { timeStyle: 'short', timeZone: 'UTC' });

export function dateTime(stamp) {
  if (!stamp) return 'Time pending';
  // RAFT uses timestamp without time zone. Preserve the recorded Richmond wall time.
  const date = new Date(`${stamp.replace(' ', 'T')}Z`);
  return `${dateFormat.format(date)} at ${timeFormat.format(date)}`;
}

export function optionRows(rows, key, label, current) {
  return rows.map((row) => `<option value="${escape(row[key])}"${String(row[key]) === String(current) ? ' selected' : ''}>${escape(label(row))}</option>`).join('');
}

export function table(headers, rows, caption) {
  return `<div class="table-scroll"><table><caption class="sr-only">${escape(caption)}</caption><thead><tr>${headers.map((label) => `<th scope="col">${escape(label)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell, index) => index === 0 ? `<th scope="row">${cell}</th>` : `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

export function clientProfile({ client, memberships, familyRoles, visits }, role) {
  const person = client.person;
  const address = [person?.address, [person?.city, [person?.state?.trim(), person?.zip?.trim()].filter(Boolean).join(' ')].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
  const fields = [['Email', person?.email], ['Phone', person?.phone], ['Address', address || null], ['Reminder method', client.remindermethod]];
  const families = memberships.map((membership) => {
    const labels = familyRoles.filter(({ familyid }) => familyid === membership.familyid).map(({ role: entry }) => entry?.rolename).filter(Boolean).sort();
    return [value(membership.family?.familyname), value(labels.join(', ') || null, 'No role recorded'), value(membership.datejoined)];
  });
  const ordered = visits.filter(({ appointment }) => appointment).sort((a, b) => (b.appointment.appointmenttime ?? '').localeCompare(a.appointment.appointmenttime ?? ''));
  return `<section class="panel"><h2>${escape(name(person))}</h2><dl class="details">${fields.map(([label, text]) => `<div><dt>${label}</dt><dd>${value(text)}</dd></div>`).join('')}</dl></section>
    <section class="panel"><h2>Families and roles</h2>${families.length ? table(['Family', 'Roles', 'Joined'], families, 'Family memberships') : message('No family memberships recorded.')}</section>
    <section class="panel"><h2>Appointments</h2>${ordered.length ? `<div class="visit-list">${ordered.map(({ appointment, kept, assignment }) => `
      <article class="visit"><h3>${escape(dateTime(appointment.appointmenttime))}</h3>
      <p>${escape(name(appointment.counselor?.person, 'Counselor pending'))} · ${value(appointment.room?.roomname, 'Room pending')} · ${escape(keptLabel(kept))}</p>
      ${role.clinical && appointment.notes ? `<p class="long-text"><strong>Notes</strong> ${escape(appointment.notes)}</p>` : ''}
      ${role.clinical && assignment ? `<p class="long-text"><strong>Assignment</strong> ${escape(assignment)}</p>` : ''}</article>`).join('')}</div>` : message('No appointments recorded.')}</section>`;
}

export const keptLabel = (kept) => kept === true ? 'Kept' : kept === false ? 'Not kept' : 'Attendance pending';
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function dashboard({ clientCount, visits, team, spaces, staff }, role) {
  const byCounselor = new Map();
  const byRoom = new Map();
  for (const visit of visits) {
    byCounselor.set(visit.counselorid, (byCounselor.get(visit.counselorid) ?? 0) + 1);
    byRoom.set(visit.roomnumber, (byRoom.get(visit.roomnumber) ?? 0) + 1);
  }
  const stats = [['Clients', clientCount], ['Appointments', visits.length], ['Rooms used', byRoom.size]];
  const counselorRows = team.map((entry) => [escape(name(entry.person)), byCounselor.get(entry.counselorid) ?? 0]);
  const roomRows = spaces.map((entry) => [value(entry.roomname, `Room ${entry.roomnumber}`), byRoom.get(entry.roomnumber) ?? 0]);
  return `<div class="stat-grid">${stats.map(([label, total]) => `<div class="stat"><p>${label}</p><strong>${total.toLocaleString()}</strong></div>`).join('')}</div>
    <div class="panel-grid"><section class="panel"><h2>Appointments by counselor</h2>${counselorRows.length ? table(['Counselor', 'Appointments'], counselorRows, 'Appointments by counselor') : message('No counselors recorded.')}</section>
    <section class="panel"><h2>Appointments by room</h2>${roomRows.length ? table(['Room', 'Appointments'], roomRows, 'Appointments by room') : message('No rooms recorded.')}</section></div>
    ${role.wages ? `<section class="panel"><h2>Employee wages</h2>${staff.length ? table(['Employee', 'Wage'], staff.map((entry) => [escape(name(entry.person)), entry.wage == null ? '—' : money.format(entry.wage)]), 'Employee wages') : message('No employee wages recorded.')}</section>` : ''}`;
}

export function appointmentForm(record, role, team, spaces, staff) {
  const id = record?.appointmentid ?? '';
  const datetime = record?.appointmenttime?.replace(' ', 'T') ?? '';
  const dropdown = (label, field, values, getLabel) => `<label>${label}<select name="${field}" required><option value="">Select ${label.toLowerCase()}</option>${optionRows(values, field, getLabel, record?.[field])}</select></label>`;
  return `<section class="panel"><h2>${id ? 'Appointment details' : 'New appointment'}</h2>
    ${!role.schedule ? `<p>${escape(dateTime(record.appointmenttime))} · ${escape(name(record.counselor?.person))} · ${value(record.room?.roomname)}</p>` : ''}
    <form data-form="appointment" class="form-grid" data-id="${id}">
      ${role.schedule ? `<label>Date and time (Eastern)<input type="datetime-local" name="appointmenttime" value="${escape(datetime)}" step="any" required></label>
      <label>Duration (minutes)<input type="number" name="duration" min="1" max="2147483647" value="${value(record?.duration, '')}" required></label>
      ${dropdown('Counselor', 'counselorid', team, (row) => name(row.person))}
      ${dropdown('Scheduling employee', 'employeeid', staff, (row) => name(row.person))}
      ${dropdown('Room', 'roomnumber', spaces, (row) => row.roomname || `Room ${row.roomnumber}`)}` : ''}
      ${role.clinical ? `<label class="whole">Appointment notes<textarea name="notes" rows="4" maxlength="3000">${value(record?.notes, '')}</textarea></label>` : ''}
      <div class="form-actions whole"><button class="primary" type="submit">${id ? 'Save appointment' : 'Create appointment'}</button><p role="status"></p></div>
    </form></section>`;
}

export function participantForms(id, attendees, available, role) {
  return `<section class="panel"><h2>Scheduled clients</h2>${attendees.length ? attendees.map((row) => `
    <form class="participant form-grid" data-form="participant" data-id="${id}" data-client="${row.clientid}">
      <h3>${escape(name(row.client?.person, `Client ${row.clientid}`))}</h3>
      <label>Attendance<select name="kept"><option value=""${row.kept === null ? ' selected' : ''}>Pending</option><option value="true"${row.kept === true ? ' selected' : ''}>Kept</option><option value="false"${row.kept === false ? ' selected' : ''}>Not kept</option></select></label>
      ${role.clinical ? `<label class="whole">Client assignment<textarea name="assignment" rows="3" maxlength="2000">${value(row.assignment, '')}</textarea></label>` : ''}
      <div class="form-actions whole"><button class="secondary" type="submit">Save client details</button><p role="status"></p></div>
    </form>`).join('') : message('No clients are scheduled for this appointment.')}
    ${role.schedule && available.length ? `<form class="participant form-grid" data-form="add-participant" data-id="${id}">
      <label>Add a client<select name="clientid" required><option value="">Select client</option>${optionRows(available, 'clientid', (row) => name(row.person))}</select></label>
      <div class="form-actions whole"><button class="secondary" type="submit">Add client to appointment</button><p role="status"></p></div></form>` : ''}</section>`;
}
