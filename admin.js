import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js";
import { app } from "./firebase-config.js";

const auth = getAuth(app);
const functions = getFunctions(app, 'europe-west1');
const ROLE_LABELS = { member: 'Member', pro: 'Pro', admin: 'Admin', superadmin: 'Superadmin' };
const getRole = httpsCallable(functions, 'getMyRole');
const listUsers = httpsCallable(functions, 'listUsers');
const setDisabled = httpsCallable(functions, 'setUserDisabled');
const deleteUser = httpsCallable(functions, 'deleteUser');
const setUserRole = httpsCallable(functions, 'setUserRole');

const status = (message, type = '') => {
  const el = document.querySelector('#admin-status');
  if (!el) return;
  el.textContent = message;
  el.dataset.type = type;
};
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
const formatDate = (value) => value ? new Date(value).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';

let currentRole = 'member';
let currentUid = '';

function updateStats(users) {
  document.querySelector('#stat-total').textContent = users.length;
  document.querySelector('#stat-members').textContent = users.filter((u) => u.role === 'member').length;
  document.querySelector('#stat-pros').textContent = users.filter((u) => u.role === 'pro').length;
  document.querySelector('#stat-admins').textContent = users.filter((u) => ['admin','superadmin'].includes(u.role)).length;
  document.querySelector('#stat-suspended').textContent = users.filter((u) => u.disabled).length;
}

function actionCell(user) {
  const protectedUser = user.email?.toLowerCase() === 'admin@lawal.org' || user.uid === currentUid;
  const canManage = currentRole === 'superadmin' ? !protectedUser : currentRole === 'admin' && !protectedUser && ['member','pro'].includes(user.role);
  if (!canManage) return '<span class="user-email">Protected</span>';
  const roleOptions = currentRole === 'superadmin' ? ['member','pro','admin'] : ['member','pro'];
  const roleSelect = `<select class="role-select" data-role-uid="${escapeHtml(user.uid)}" aria-label="Change role for ${escapeHtml(user.email)}">${roleOptions.map((role) => `<option value="${role}" ${user.role === role ? 'selected' : ''}>${ROLE_LABELS[role]}</option>`).join('')}</select>`;
  const suspendLabel = user.disabled ? 'Resume' : 'Suspend';
  return `<div class="row-actions">${roleSelect}<button class="row-action" data-action="toggle" data-uid="${escapeHtml(user.uid)}" data-disabled="${user.disabled}">${suspendLabel}</button><button class="row-action danger" data-action="delete" data-uid="${escapeHtml(user.uid)}">Delete</button></div>`;
}

function renderUsers(users) {
  updateStats(users);
  const body = document.querySelector('#user-table-body');
  if (!users.length) { body.innerHTML = '<tr><td colspan="6" class="admin-empty">No user accounts found.</td></tr>'; return; }
  body.innerHTML = users.map((user) => `<tr><td><span class="user-name">${escapeHtml(user.displayName || 'V2 Member')}</span><span class="user-email">${escapeHtml(user.email || 'No email')}</span></td><td><span class="role-pill ${user.role}">${ROLE_LABELS[user.role] || 'Member'}</span></td><td><span class="status-pill ${user.disabled ? 'suspended' : 'active'}">${user.disabled ? 'Suspended' : 'Active'}</span></td><td>${formatDate(user.createdAt)}</td><td>${formatDate(user.lastSignInAt)}</td><td>${actionCell(user)}</td></tr>`).join('');
}

async function loadUsers() {
  status('Loading users…');
  try {
    const result = await listUsers({});
    renderUsers(result.data?.users || []);
    status(`${result.data?.users?.length || 0} account${result.data?.users?.length === 1 ? '' : 's'} loaded.`);
  } catch (error) {
    status(error.message || 'Unable to load users.', 'error');
    document.querySelector('#user-table-body').innerHTML = `<tr><td colspan="6" class="admin-empty">${escapeHtml(error.message || 'Unable to load users.')}</td></tr>`;
  }
}

document.querySelector('#refresh-users')?.addEventListener('click', loadUsers);
document.querySelector('#user-table-body')?.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const uid = button.dataset.uid;
  if (button.dataset.action === 'delete') {
    if (!window.confirm('Delete this user account permanently? This cannot be undone.')) return;
    button.disabled = true; status('Deleting account…');
    try { await deleteUser({ uid }); await loadUsers(); } catch (error) { status(error.message || 'Unable to delete account.', 'error'); button.disabled = false; }
  }
  if (button.dataset.action === 'toggle') {
    const disabled = button.dataset.disabled === 'true';
    button.disabled = true; status(disabled ? 'Resuming account…' : 'Suspending account…');
    try { await setDisabled({ uid, disabled: !disabled }); await loadUsers(); } catch (error) { status(error.message || 'Unable to change account status.', 'error'); button.disabled = false; }
  }
});

document.querySelector('#user-table-body')?.addEventListener('change', async (event) => {
  const select = event.target.closest('[data-role-uid]');
  if (!select) return;
  const uid = select.dataset.roleUid;
  const role = select.value;
  select.disabled = true; status('Updating access…');
  try { await setUserRole({ uid, role }); await loadUsers(); } catch (error) { status(error.message || 'Unable to update role.', 'error'); select.disabled = false; }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.replace('auth.html'); return; }
  currentUid = user.uid;
  try {
    const result = await getRole({});
    currentRole = result.data?.role || 'member';
    if (!['admin','superadmin'].includes(currentRole)) { window.location.replace('dashboard.html'); return; }
    document.querySelector('[data-auth-role]').textContent = ROLE_LABELS[currentRole];
    await loadUsers();
  } catch (error) {
    status('Administrator service is not available yet. Deploy the Firebase Functions before using this dashboard.', 'error');
    document.querySelector('#user-table-body').innerHTML = '<tr><td colspan="6" class="admin-empty">Administrator access could not be verified.</td></tr>';
  }
});
