import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export function tokenRole(token) {
  try {
    const part = token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/');
    return JSON.parse(atob(part)).role;
  } catch {
    return null;
  }
}

const publicKey = key?.startsWith('sb_publishable_') || tokenRole(key) === 'anon';
export const supabase = url && publicKey ? createClient(url, key, {
  db: { schema: 'raft' },
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
}) : null;

export const roles = {
  raft_admin: { label: 'Admin', schedule: true, clinical: true, wages: true },
  raft_scheduler: { label: 'Scheduler', schedule: true, clinical: false, wages: false },
  raft_counselor: { label: 'Counselor', schedule: false, clinical: true, wages: false },
};

const people = 'firstname,lastname';
const contact = `${people},address,city,state,zip,phone,email`;
const appointmentFields = 'appointmentid,appointmenttime,duration,counselorid,employeeid,roomnumber';
const appointmentColumns = (role) => role.clinical ? `${appointmentFields},notes` : appointmentFields;
const participantColumns = (role) => role.clinical ? 'clientid,kept,assignment' : 'clientid,kept';

async function result(request) {
  const { data, error } = await request;
  if (error) throw error;
  return data;
}

async function rows(query) {
  const all = [];
  const size = 100;
  for (let start = 0; ; start += size) {
    const page = await result(query().range(start, start + size - 1));
    all.push(...page);
    if (page.length < size) return all;
  }
}

export function name(person, fallback = 'Unnamed person') {
  return [person?.firstname, person?.lastname].filter(Boolean).join(' ') || fallback;
}

export function clients() {
  return rows(() => supabase.from('client').select(`clientid,person(${people})`).order('clientid'));
}

export function counselors() {
  return rows(() => supabase.from('counselor').select(`counselorid,degreesuffix,person(${people})`).order('counselorid'));
}

export function rooms() {
  return rows(() => supabase.from('room').select('roomnumber,roomname').order('roomnumber'));
}

export function employees(role) {
  const columns = role.wages ? 'employeeid,wage' : 'employeeid';
  return rows(() => supabase.from('employee').select(`${columns},person(${people})`).order('employeeid'));
}

export async function clientDetails(id, role) {
  const [client, memberships, familyRoles, visits] = await Promise.all([
    result(supabase.from('client').select(`clientid,foundout,remindermethod,person(${contact})`).eq('clientid', id).single()),
    rows(() => supabase.from('member_in_family').select('familyid,datejoined,family(familyname)').eq('memberid', id).order('familyid')),
    rows(() => supabase.from('member_role').select('familyid,role(rolename)').eq('memberid', id).order('familyid').order('roleid')),
    rows(() => supabase.from('scheduledfor').select(`${participantColumns(role)},appointment(${appointmentColumns(role)},counselor(person(${people})),room(roomname))`).eq('clientid', id).order('appointmentid')),
  ]);
  return { client, memberships, familyRoles, visits };
}

export function appointments(role) {
  return rows(() => supabase.from('appointment').select(`${appointmentColumns(role)},counselor(person(${people})),room(roomname)`).order('appointmenttime', { ascending: false, nullsFirst: false }).order('appointmentid'));
}

export function participants(id, role) {
  return rows(() => supabase.from('scheduledfor').select(`${participantColumns(role)},client(person(${people}))`).eq('appointmentid', id).order('clientid'));
}

export function addAppointment(values) {
  return result(supabase.from('appointment').insert(values).select('appointmentid').single());
}

export function editAppointment(id, values) {
  return result(supabase.from('appointment').update(values).eq('appointmentid', id).select('appointmentid').single());
}

export function addParticipant(id, clientId) {
  return result(supabase.from('scheduledfor').insert({ appointmentid: id, clientid: clientId }).select('clientid').single());
}

export function editParticipant(id, clientId, values) {
  return result(supabase.from('scheduledfor').update(values).eq('appointmentid', id).eq('clientid', clientId).select('clientid').single());
}

export function editWage(id, wage) {
  return result(supabase.from('employee').update({ wage }).eq('employeeid', id).select('employeeid').single());
}
