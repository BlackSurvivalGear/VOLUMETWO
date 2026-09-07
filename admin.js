import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js";
import { app } from "./firebase-config.js";

const auth = getAuth(app);
const functions = getFunctions(app, 'europe-west1');
const listUsers = httpsCallable(functions, 'listUsers');
const setUserDisabled = httpsCallable(functions, 'setUserDisabled');
const deleteUser = httpsCallable(functions, 'deleteUser');
const setUserRole = httpsCallable(functions, 'setUserRole');
const getMyRole = httpsCallable(functions, 'getMyRole');

const tableBody = document.querySelector('#user-table-body');
const status = document.querySelector('#admin-status');
const refreshButton = document.querySelector('#refresh-users');
let currentRole = 'member';

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const formatDate = (value) => {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const setStatus = (message, isError = false) => {
  if (!status) return;
  status.textContent = message;
  status.classList.toggle('error', isError);
};

const rolePill = (role) => {
  const label = role === 'superadmin' ? 'Superadmin' : role === 'admin' ? 'Admin' : 'Member';
  return `<span class="role-pill ${escapeHtml(role)}">${label}</span>`;
};

const renderUsers = (users) => {
  const total = users.length;
  const admins = users.filter((user) => user.role === 'admin' || user.role === 'superadmin').length;
  const suspended = users.filter((user) => user.disabled).length;

  document.querySelector('#stat-total').textContent = total;
  document.querySelector('#stat-admins').textContent = admins;
  document.querySelector('#stat-suspended').textContent = suspended;

  if (!users.length) {
    tableBody.innerHTML = '<tr><td colspan="6" class="admin-empty">No user accounts found.</td></tr>';
    return;
  }

  tableBody.innerHTML = users.map((user) => {
    const isSelf = auth.currentUser?.uid === user.uid;
    const isSuperadmin = user.role === 'superadmin';
    const canChangeRole = currentRole === 'superadmin' && !isSelf && !isSuperadmin;
    const canChangeStatus = !isSelf;
    const canDelete = !isSelf;
    const displayName = user.displayName || 'Unnamed user';
    const statusClass = user.disabled ? 'suspended' : 'active';
    const statusLabel = user.disabled ? 'Suspended' : 'Active';
    const verification = user.emailVerified ? 'Verified' : 'Unverified';
    const accountMeta = [user.provider || 'unknown provider', verification].join(' · ');
    const roleControl = canChangeRole
      ? `<button class="admin-action" type="button" data-action="role" data-uid="${escapeHtml(user.uid)}" data-role="${user.role}">${user.role === 'admin' ? 'Make member' : 'Make admin'}</button>`
      : '';
    const statusControl = canChangeStatus
      ? `<button class="admin-action" type="button" data-action="status" data-uid="${escapeHtml(user.uid)}" data-disabled="${user.disabled}">${user.disabled ? 'Resume' : 'Suspend'}</button>`
      : '';
    const deleteControl = canDelete
      ? `<button class="admin-action danger" type="button" data-action="delete" data-uid="${escapeHtml(user.uid)}">Delete</button>`
      : '';

    return `<tr>
      <td><span class="user-name">${escapeHtml(displayName)}</span><span class="user-email">${escapeHtml(user.email || 'No email')}</span><span class="user-email">${escapeHtml(accountMeta)}</span></td>
      <td>${rolePill(user.role)}</td>
      <td><span class="status-pill ${statusClass}">${statusLabel}</span></td>
      <td>${escapeHtml(formatDate(user.createdAt))}</td>
      <td>${escapeHtml(formatDate(user.lastSignInAt))}</td>
      <td><div class="admin-actions">${roleControl}${statusControl}${deleteControl || '<span class="user-email">Current account</span>'}</div></td>
    </tr>`;
  }).join('');
};

const loadUsers = async () => {
  setStatus('Loading users…');
  refreshButton.disabled = true;
  try {
    const result = await listUsers();
    renderUsers(result.data?.users || []);
    setStatus(`${result.data?.users?.length || 0} users loaded.`);
  } catch (error) {
    setStatus(error.message || 'Unable to load users.', true);
    tableBody.innerHTML = '<tr><td colspan="6" class="admin-empty">Unable to load users. Check that the Firebase Functions backend is deployed.</td></tr>';
  } finally {
    refreshButton.disabled = false;
  }
};

const withActionLock = async (button, action) => {
  button.disabled = true;
  try {
    await action();
    await loadUsers();
  } catch (error) {
    setStatus(error.message || 'The requested action could not be completed.', true);
    button.disabled = false;
  }
};

tableBody?.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const uid = button.dataset.uid;
  const action = button.dataset.action;
  if (!uid) return;

  if (action === 'status') {
    const currentlyDisabled = button.dataset.disabled === 'true';
    const nextDisabled = !currentlyDisabled;
    const prompt = nextDisabled
      ? 'Suspend this user? They will be prevented from signing in.'
      : 'Resume this user account?';
    if (!window.confirm(prompt)) return;

    await withActionLock(button, async () => {
      await setUserDisabled({ uid, disabled: nextDisabled });
    });
    return;
  }

  if (action === 'delete') {
    if (!window.confirm('Delete this user permanently from Firebase Authentication? This cannot be undone.')) return;

    await withActionLock(button, async () => {
      await deleteUser({ uid });
    });
    return;
  }

  if (action === 'role') {
    if (currentRole !== 'superadmin') return;
    const currentTargetRole = button.dataset.role;
    const nextRole = currentTargetRole === 'admin' ? 'member' : 'admin';
    const prompt = nextRole === 'admin'
      ? 'Make this user an admin? They will be able to suspend and delete users.'
      : 'Remove this user’s admin role?';
    if (!window.confirm(prompt)) return;

    await withActionLock(button, async () => {
      await setUserRole({ uid, role: nextRole });
    });
  }
});

refreshButton?.addEventListener('click', loadUsers);

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  try {
    const roleResult = await getMyRole();
    currentRole = roleResult.data?.role || 'member';
    if (currentRole !== 'admin' && currentRole !== 'superadmin') return;
    await loadUsers();
  } catch (error) {
    setStatus(error.message || 'Unable to verify administrator access.', true);
  }
});
