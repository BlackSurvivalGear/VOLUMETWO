import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { app } from "./firebase-config.js";

const auth = getAuth(app);
const db = getFirestore(app);
const ROLE_LABELS = { member: 'Member', pro: 'Pro', admin: 'Admin', superadmin: 'Superadmin' };
const PLAN_LABELS = { free: 'Free', pro: 'Pro' };
let currentRole = 'member';
let currentUid = '';
let users = [];

const status = (message, type = '') => {
  const el = document.querySelector('#admin-status');
  if (!el) return;
  el.textContent = message;
  el.dataset.type = type;
};
const escapeHtml = (value = '') => String(value).replace(/[&<>'\"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '\"':'&quot;' }[char]));
const formatDate = (value) => value?.toDate ? value.toDate().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : value ? new Date(value).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';

function updateStats(list) {
  document.querySelector('#stat-total').textContent = list.length;
  document.querySelector('#stat-members').textContent = list.filter((u) => u.role === 'member').length;
  document.querySelector('#stat-pros').textContent = list.filter((u) => u.role === 'pro').length;
  document.querySelector('#stat-admins').textContent = list.filter((u) => ['admin','superadmin'].includes(u.role)).length;
  document.querySelector('#stat-suspended').textContent = list.filter((u) => u.suspended).length;
}

function actionCell(user) {
  const protectedUser = user.email?.toLowerCase() === 'admin@lawal.org' || user.uid === currentUid;
  const canManage = currentRole === 'superadmin' ? !protectedUser : currentRole === 'admin' && !protectedUser && ['member','pro'].includes(user.role);
  if (!canManage) return '<span class="user-email">Protected</span>';
  const roleOptions = currentRole === 'superadmin' ? ['member','pro','admin'] : ['member','pro'];
  const roleSelect = `<select class="role-select" data-role-uid="${escapeHtml(user.uid)}" aria-label="Change role for ${escapeHtml(user.email)}">${roleOptions.map((role) => `<option value="${role}" ${user.role === role ? 'selected' : ''}>${ROLE_LABELS[role]}</option>`).join('')}</select>`;
  const suspendLabel = user.suspended ? 'Resume' : 'Suspend';
  return `<div class="row-actions">${roleSelect}<button class="row-action" data-action="toggle" data-uid="${escapeHtml(user.uid)}" data-suspended="${user.suspended}">${suspendLabel}</button><button class="row-action danger" data-action="delete" data-uid="${escapeHtml(user.uid)}">Remove</button></div>`;
}

function renderUsers(list) {
  updateStats(list);
  const body = document.querySelector('#user-table-body');
  if (!list.length) { body.innerHTML = '<tr><td colspan="7" class="admin-empty">No V2 user profiles found.</td></tr>'; return; }
  body.innerHTML = list.map((user) => `<tr><td><span class="user-name">${escapeHtml(user.displayName || 'V2 Member')}</span><span class="user-email">${escapeHtml(user.email || 'No email')}</span>${user.phone ? `<span class="user-email">${escapeHtml(user.phone)}</span>` : ''}</td><td><span class="role-pill ${user.role}">${ROLE_LABELS[user.role] || 'Member'}</span></td><td><span class="role-pill plan-${user.plan || 'free'}">${PLAN_LABELS[user.plan] || 'Free'}</span></td><td><span class="status-pill ${user.suspended ? 'suspended' : 'active'}">${user.suspended ? 'Suspended' : 'Active'}</span></td><td>${formatDate(user.createdAt)}</td><td>${formatDate(user.lastSignInAt)}</td><td>${actionCell(user)}</td></tr>`).join('');
}

async function loadUsers() {
  status('Loading users…');
  try {
    const snapshot = await getDocs(collection(db, 'users'));
    users = snapshot.docs.map((item) => ({ uid: item.id, ...item.data(), role: ROLE_LABELS[item.data().role] ? item.data().role : 'member', plan: PLAN_LABELS[item.data().plan] ? item.data().plan : 'free' }));
    users.sort((a, b) => (a.email || '').localeCompare(b.email || ''));
    renderUsers(users);
    status(`${users.length} account${users.length === 1 ? '' : 's'} loaded.`);
  } catch (error) {
    console.error(error);
    status('Unable to load V2 user profiles. Check Firestore rules.', 'error');
    document.querySelector('#user-table-body').innerHTML = '<tr><td colspan="7" class="admin-empty">User profiles could not be loaded.</td></tr>';
  }
}

async function updateUser(uid, data, successMessage) {
  await updateDoc(doc(db, 'users', uid), data);
  status(successMessage);
  await loadUsers();
}

document.querySelector('#refresh-users')?.addEventListener('click', loadUsers);
document.querySelector('#user-table-body')?.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const uid = button.dataset.uid;
  if (button.dataset.action === 'delete') {
    if (!window.confirm('Remove this V2 user profile? Their Firebase sign-in account will remain and can be restored by signing in again.')) return;
    button.disabled = true; status('Removing profile…');
    try { await deleteDoc(doc(db, 'users', uid)); await loadUsers(); } catch (error) { status('Unable to remove profile. Check Firestore rules.', 'error'); button.disabled = false; }
  }
  if (button.dataset.action === 'toggle') {
    const suspended = button.dataset.suspended === 'true';
    button.disabled = true; status(suspended ? 'Restoring access…' : 'Suspending access…');
    try { await updateUser(uid, { suspended: !suspended, accountStatus: suspended ? 'active' : 'suspended', updatedAt: new Date() }, suspended ? 'V2 access restored.' : 'V2 access suspended.'); } catch (error) { status('Unable to change access status. Check Firestore rules.', 'error'); button.disabled = false; }
  }
});

document.querySelector('#user-table-body')?.addEventListener('change', async (event) => {
  const select = event.target.closest('[data-role-uid]');
  if (!select) return;
  const uid = select.dataset.roleUid;
  const role = select.value;
  select.disabled = true; status('Updating access level…');
  try { await updateUser(uid, { role, updatedAt: new Date() }, `Access level changed to ${ROLE_LABELS[role]}.`); } catch (error) { status('Unable to update role. Check Firestore rules.', 'error'); select.disabled = false; }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.replace('auth.html'); return; }
  currentUid = user.uid;
  try {
    const snapshot = await getDocs(collection(db, 'users'));
    const own = snapshot.docs.find((item) => item.id === user.uid)?.data();
    currentRole = (user.email || '').toLowerCase() === 'admin@lawal.org' ? 'superadmin' : (ROLE_LABELS[own?.role] ? own.role : 'member');
    if (!['admin','superadmin'].includes(currentRole)) { window.location.replace('dashboard.html'); return; }
    document.querySelector('[data-auth-role]').textContent = ROLE_LABELS[currentRole];
    renderUsers(snapshot.docs.map((item) => ({ uid: item.id, ...item.data(), role: ROLE_LABELS[item.data().role] ? item.data().role : 'member', plan: PLAN_LABELS[item.data().plan] ? item.data().plan : 'free' })));
    status('User profiles loaded.');
  } catch (error) {
    console.error(error);
    status('Administrator access could not be verified. Check Firestore rules.', 'error');
    document.querySelector('#user-table-body').innerHTML = '<tr><td colspan="7" class="admin-empty">Administrator access could not be verified.</td></tr>';
  }
});
