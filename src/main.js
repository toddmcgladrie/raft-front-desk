import './style.css';
import * as data from './data.js';
import * as view from './views.js';

const app = document.querySelector('#app');
const { supabase, roles, name } = data;
const { escape, mark, screens, message, optionRows } = view;
let session;
let renderId = 0;
let recordId = '';

function staffRole() {
  const key = data.tokenRole(session?.access_token);
  return Object.hasOwn(roles, key) ? roles[key] : null;
}

function signIn() {
  const badRole = Boolean(session);
  app.innerHTML = `<main class="login-layout"><section class="identity" aria-label="Richmond Area Family Therapy"><div class="lockup">${mark}<span>RAFT</span></div><div class="identity-title"><p>Richmond Area Family Therapy</p><h1>Front desk</h1></div></section>
    <section class="login-column"><div class="login-card"><h2>${badRole ? 'Staff access required' : 'Staff sign-in'}</h2>
    ${badRole ? '<p>This account needs a RAFT staff role. Sign out and use an assigned staff account.</p><button type="button" class="primary" data-signout>Sign out</button>' : `<p>Use your RAFT staff email and password.</p><form id="signin" class="form-stack">
    <label>Email<input name="email" type="email" autocomplete="username" required ${supabase ? '' : 'disabled'}></label>
    <label>Password<input name="password" type="password" autocomplete="current-password" required ${supabase ? '' : 'disabled'}></label>
    <button type="submit" class="primary" ${supabase ? '' : 'disabled'}>Sign in</button>
    <p class="feedback" role="alert">${supabase ? '' : 'Supabase connection settings are required before staff can sign in.'}</p>
    </form>`}</div></section></main>`;
  app.querySelector('[data-signout]')?.addEventListener('click', signOut);
  app.querySelector('#signin')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('button');
    const values = new FormData(form);
    submit.disabled = true;
    form.querySelector('[role="alert"]').textContent = '';
    const { data: signedIn, error } = await supabase.auth.signInWithPassword({ email: values.get('email').trim(), password: values.get('password') });
    if (error) {
      const invalid = ['invalid_credentials', 'email_not_confirmed'].includes(error.code);
      form.querySelector('[role="alert"]').textContent = invalid ? 'Check your staff email and password and try again.' : 'Sign-in is unavailable. Try again in a moment.';
      submit.disabled = false;
      return;
    }
    replaceSession(signedIn.session);
  });
}

async function signOut(event) {
  const button = event.currentTarget;
  button.disabled = true;
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (!error) return replaceSession(null);
  button.disabled = false;
  button.textContent = 'Retry sign-out';
}

function replaceSession(next) {
  const previousKey = `${session?.user.id}:${data.tokenRole(session?.access_token)}`;
  const nextKey = `${next?.user.id}:${data.tokenRole(next?.access_token)}`;
  if (session !== undefined && previousKey === nextKey) {
    session = next;
    return;
  }
  recordId = '';
  if (session !== undefined) history.replaceState(null, '', location.pathname + location.search);
  session = next;
  render();
}

function failure(area, error, retry) {
  const detail = ['PGRST106', 'PGRST205', '42501'].includes(error?.code)
    ? 'Ask the project owner to check the RAFT Data API and staff permissions.'
    : 'Try again in a moment.';
  area.innerHTML = `<div class="panel"><p role="alert">RAFT could not load this information. ${detail}</p><button class="secondary" type="button">Retry</button></div>`;
  area.querySelector('button').addEventListener('click', retry);
}

async function lookup(area, role) {
  const clients = await data.clients();
  if (!area.isConnected) return;
  area.innerHTML = `<div class="lookup-grid"><section class="panel lookup"><h2>Find a client</h2><label for="client-search">Search by name</label><input type="search" id="client-search" placeholder="Enter a first or last name"><p class="result-count" aria-live="polite"></p><ul class="client-list"></ul></section><div id="client-profile" class="stack">${message('Select a client to open their record.')}</div></div>`;
  const search = area.querySelector('#client-search');
  const list = area.querySelector('.client-list');
  const profile = area.querySelector('#client-profile');
  let selected;
  let request = 0;
  const filtered = () => {
    const terms = search.value.trim().toLowerCase().split(/\s+/);
    const matched = clients.filter((row) => terms.every((term) => name(row.person).toLowerCase().includes(term)))
      .sort((a, b) => (a.person?.lastname ?? '').localeCompare(b.person?.lastname ?? '') || name(a.person).localeCompare(name(b.person)));
    area.querySelector('.result-count').textContent = `${matched.length} ${matched.length === 1 ? 'client' : 'clients'}`;
    list.innerHTML = matched.map((row) => `<li><button type="button" data-client="${row.clientid}" aria-pressed="${selected === row.clientid}">${escape(name(row.person))}<span aria-hidden="true">›</span></button></li>`).join('');
  };
  async function openClient(id) {
    selected = id;
    const ticket = ++request;
    for (const button of list.querySelectorAll('button')) button.setAttribute('aria-pressed', String(Number(button.dataset.client) === id));
    profile.innerHTML = '<p role="status" class="empty">Loading client record…</p>';
    try {
      const details = await data.clientDetails(id, role);
      if (profile.isConnected && ticket === request) profile.innerHTML = view.clientProfile(details, role);
    } catch (error) {
      if (profile.isConnected && ticket === request) failure(profile, error, () => openClient(id));
    }
  }
  search.addEventListener('input', filtered);
  list.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-client]');
    if (button) openClient(Number(button.dataset.client));
  });
  filtered();
}

async function summary(area, role) {
  const [clients, visits, team, spaces, staff, attendance] = await Promise.all([
    data.clients(), data.appointments({ clinical: false }), data.counselors(), data.rooms(), role.wages ? data.employees(role) : [], data.recordedAttendance(),
  ]);
  if (area.isConnected) area.innerHTML = view.dashboard({ clientCount: clients.length, visits, team, spaces, staff, attendance }, role);
}

function wageEditor(staff) {
  return `<section class="panel"><h2>Edit employee wage</h2><form data-form="wage" class="form-grid"><label>Employee<select name="employeeid" required><option value="">Select employee</option>${optionRows(staff, 'employeeid', (row) => name(row.person))}</select></label><label>Hourly wage<input name="wage" type="number" step="0.01" min="0" max="99.99" required></label><div class="form-actions whole"><button type="submit" class="secondary">Save wage</button><p role="status"></p></div></form></section>`;
}

async function records(area, role) {
  const [visits, team, spaces, staff, clients] = await Promise.all([
    data.appointments(role), role.schedule ? data.counselors() : [], role.schedule ? data.rooms() : [],
    role.schedule ? data.employees(role) : [], role.schedule ? data.clients() : [],
  ]);
  if (!area.isConnected) return;
  const appointmentName = (row) => `${view.dateTime(row.appointmenttime)} · ${name(row.counselor?.person)} · #${row.appointmentid}`;
  if (!visits.some((row) => String(row.appointmentid) === recordId)) recordId = '';
  area.innerHTML = `<section class="panel record-picker"><label>Appointment<select id="appointment-picker"><option value="">${role.schedule ? 'New appointment' : 'Choose an appointment'}</option>${optionRows(visits, 'appointmentid', appointmentName, recordId)}</select></label></section><div class="stack" id="editor"></div>${role.wages ? wageEditor(staff) : ''}`;
  const picker = area.querySelector('#appointment-picker');
  const editor = area.querySelector('#editor');
  let request = 0;

  async function openRecord() {
    recordId = picker.value;
    const ticket = ++request;
    const record = visits.find((row) => String(row.appointmentid) === recordId);
    if (!record && !role.schedule) {
      editor.innerHTML = message('Choose an appointment to record notes and client assignments.');
      return;
    }
    editor.innerHTML = view.appointmentForm(record, role, team, spaces, staff);
    if (!record) return;
    const participants = document.createElement('div');
    participants.innerHTML = '<p class="empty" role="status">Loading scheduled clients…</p>';
    editor.append(participants);
    try {
      const attendees = await data.participants(record.appointmentid, role);
      if (participants.isConnected && ticket === request) {
        const assigned = new Set(attendees.map((entry) => entry.clientid));
        participants.innerHTML = view.participantForms(record.appointmentid, attendees, clients.filter((entry) => !assigned.has(entry.clientid)), role);
      }
    } catch (error) {
      if (participants.isConnected && ticket === request) failure(participants, error, openRecord);
    }
  }

  picker.addEventListener('change', openRecord);
  area.querySelector('[data-form="wage"] select')?.addEventListener('change', (event) => {
    const entry = staff.find((row) => String(row.employeeid) === event.target.value);
    event.target.form.elements.wage.value = entry?.wage ?? '';
  });
  area.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target;
    const inputs = new FormData(form);
    const button = form.querySelector('button');
    const notice = form.querySelector('[role="status"]');
    const id = Number(form.dataset.id);
    const clientId = Number(form.dataset.client);
    const formType = form.dataset.form;
    const currentRequest = request;
    button.disabled = true;
    notice.textContent = 'Saving…';
    try {
      if (formType === 'appointment') {
        const values = {};
        if (role.schedule) {
          values.appointmenttime = inputs.get('appointmenttime');
          for (const field of ['duration', 'counselorid', 'employeeid', 'roomnumber']) values[field] = Number(inputs.get(field));
        }
        if (role.clinical) values.notes = inputs.get('notes') || null;
        const saved = id ? await data.editAppointment(id, values) : await data.addAppointment(values);
        if (!role.schedule) Object.assign(visits.find((row) => row.appointmentid === id), values);
        if (area.isConnected && currentRequest === request) {
          if (role.schedule) {
            recordId = String(saved.appointmentid);
            render('Appointment saved.');
          } else {
            notice.textContent = 'Appointment notes saved.';
          }
        }
      } else if (formType === 'add-participant' && role.schedule) {
        await data.addParticipant(id, Number(inputs.get('clientid')));
        if (area.isConnected && currentRequest === request) render('Client added to the appointment.');
      } else if (formType === 'participant') {
        const kept = inputs.get('kept');
        const values = { kept: kept === '' ? null : kept === 'true' };
        if (role.clinical) values.assignment = inputs.get('assignment') || null;
        await data.editParticipant(id, clientId, values);
        notice.textContent = 'Client details saved.';
      } else if (formType === 'wage' && role.wages) {
        const employeeId = Number(inputs.get('employeeid'));
        const wage = Number(inputs.get('wage'));
        await data.editWage(employeeId, wage);
        staff.find((row) => row.employeeid === employeeId).wage = wage;
        notice.textContent = 'Wage saved.';
      }
    } catch (error) {
      notice.textContent = error?.code === '23505' ? 'This client is already scheduled. Reload the appointment to see the current list.' : 'The save could not be confirmed. Reload the record before trying again.';
    } finally {
      button.disabled = false;
    }
  });
  await openRecord();
}

function render(feedback = '') {
  const version = ++renderId;
  const role = staffRole();
  if (!role) return signIn();
  const requested = location.hash.slice(1);
  const route = Object.hasOwn(screens, requested) ? requested : 'home';
  const { title, intro } = screens[route];
  const nav = Object.entries(screens).map(([key, screen]) => `<a href="#${key}"${key === route ? ' aria-current="page"' : ''}>${screen.title}</a>`).join('');
  app.innerHTML = `<div class="workspace"><aside class="sidebar"><a href="#home" class="lockup" aria-label="RAFT home">${mark}<span>RAFT <small>Front desk</small></span></a><nav aria-label="Front desk screens">${nav}</nav></aside><div class="workspace-main"><header class="topbar"><span class="role">${role.label}</span><span class="staff-email">${escape(session.user.email)}</span><button class="secondary" data-signout>Sign out</button></header><main class="page"><h1 tabindex="-1">${title}</h1><p class="intro">${intro}</p>${feedback ? `<p role="status" class="success">${escape(feedback)}</p>` : ''}<div class="stack" data-screen></div></main></div></div>`;
  app.querySelector('[data-signout]').addEventListener('click', signOut);
  const area = app.querySelector('[data-screen]');
  const load = async () => {
    if (version !== renderId) return;
    area.innerHTML = '<p role="status" class="empty">Loading from RAFT…</p>';
    try {
      if (route === 'home') area.innerHTML = view.home(role);
      if (route === 'clients') await lookup(area, role);
      if (route === 'dashboard') await summary(area, role);
      if (route === 'records') await records(area, role);
    } catch (error) {
      if (area.isConnected) failure(area, error, load);
    }
  };
  load();
}

window.addEventListener('hashchange', () => {
  render();
  app.querySelector('h1[tabindex]')?.focus();
});

if (supabase) {
  supabase.auth.onAuthStateChange((event, current) => {
    setTimeout(() => {
      if (event === 'INITIAL_SESSION' && session !== undefined) return;
      replaceSession(current);
    }, 0);
  });
} else {
  signIn();
}
