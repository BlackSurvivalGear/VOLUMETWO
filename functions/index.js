const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2/options');
const admin = require('firebase-admin');

admin.initializeApp();
setGlobalOptions({ region: 'europe-west1' });

const ROLES = ['member', 'pro', 'admin', 'superadmin'];
const SUPERADMIN_EMAIL = 'admin@lawal.org';
const db = admin.firestore();

const normaliseEmail = (email) => String(email || '').trim().toLowerCase();
const isSuperadminIdentity = (email) => normaliseEmail(email) === SUPERADMIN_EMAIL;
const normaliseRole = (role) => ROLES.includes(role) ? role : 'member';

async function getContext(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'You must be signed in.');
  const user = await admin.auth().getUser(request.auth.uid);
  const email = normaliseEmail(user.email);
  let role = normaliseRole(user.customClaims?.role);

  if (isSuperadminIdentity(email)) {
    role = 'superadmin';
    if (user.customClaims?.role !== 'superadmin') {
      await admin.auth().setCustomUserClaims(user.uid, { ...(user.customClaims || {}), role: 'superadmin' });
    }
  } else if (!ROLES.includes(user.customClaims?.role) || user.customClaims?.role === 'superadmin') {
    role = 'member';
    if (user.customClaims?.role !== 'member') {
      await admin.auth().setCustomUserClaims(user.uid, { ...(user.customClaims || {}), role: 'member' });
    }
  }

  return { user, role };
}

function requireAdmin(role) {
  if (!['admin', 'superadmin'].includes(role)) {
    throw new HttpsError('permission-denied', 'Administrator access required.');
  }
}

function assertCanManage(actor, target) {
  if (actor.uid === target.uid) {
    throw new HttpsError('failed-precondition', 'You cannot manage your own account.');
  }
  if (isSuperadminIdentity(target.email)) {
    throw new HttpsError('permission-denied', 'The Superadmin account is protected.');
  }
  if (actor.role === 'admin' && !['member', 'pro'].includes(target.role)) {
    throw new HttpsError('permission-denied', 'Admins can manage Member and Pro accounts only.');
  }
}

async function resolveUserRole(user) {
  if (isSuperadminIdentity(user.email)) return 'superadmin';
  return normaliseRole(user.customClaims?.role);
}

async function serialiseUser(user) {
  const role = await resolveUserRole(user);
  return {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || '',
    photoURL: user.photoURL || '',
    provider: (user.providerData?.[0]?.providerId || '').replace('password', 'Email/Password'),
    createdAt: user.metadata?.creationTime || null,
    lastSignInAt: user.metadata?.lastSignInTime || null,
    disabled: Boolean(user.disabled),
    emailVerified: Boolean(user.emailVerified),
    role
  };
}

async function listAllUsers() {
  const users = [];
  let pageToken;
  do {
    const page = await admin.auth().listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

exports.getMyRole = onCall(async (request) => {
  const { user, role } = await getContext(request);
  return { role, uid: user.uid, email: user.email || '' };
});

exports.listUsers = onCall(async (request) => {
  const { role } = await getContext(request);
  requireAdmin(role);
  const users = await listAllUsers();
  return { users: await Promise.all(users.map(serialiseUser)) };
});

exports.setUserDisabled = onCall(async (request) => {
  const { user: actorUser, role: actorRole } = await getContext(request);
  requireAdmin(actorRole);
  const uid = String(request.data?.uid || '').trim();
  if (!uid || typeof request.data?.disabled !== 'boolean') {
    throw new HttpsError('invalid-argument', 'A user ID and disabled value are required.');
  }
  const target = await admin.auth().getUser(uid);
  const targetRole = await resolveUserRole(target);
  assertCanManage({ uid: actorUser.uid, role: actorRole }, { uid, role: targetRole, email: target.email });
  await admin.auth().updateUser(uid, { disabled: request.data.disabled });
  if (request.data.disabled) await admin.auth().revokeRefreshTokens(uid);
  return { success: true, disabled: request.data.disabled };
});

exports.deleteUser = onCall(async (request) => {
  const { user: actorUser, role: actorRole } = await getContext(request);
  requireAdmin(actorRole);
  const uid = String(request.data?.uid || '').trim();
  if (!uid) throw new HttpsError('invalid-argument', 'A user ID is required.');
  const target = await admin.auth().getUser(uid);
  const targetRole = await resolveUserRole(target);
  assertCanManage({ uid: actorUser.uid, role: actorRole }, { uid, role: targetRole, email: target.email });
  await admin.auth().deleteUser(uid);
  return { success: true };
});

exports.setUserRole = onCall(async (request) => {
  const { user: actorUser, role: actorRole } = await getContext(request);
  requireAdmin(actorRole);
  const uid = String(request.data?.uid || '').trim();
  const newRole = String(request.data?.role || '').trim().toLowerCase();

  if (!uid || !['member', 'pro', 'admin'].includes(newRole)) {
    throw new HttpsError('invalid-argument', 'Choose Member, Pro or Admin.');
  }
  if (uid === actorUser.uid) throw new HttpsError('failed-precondition', 'You cannot change your own role.');

  const target = await admin.auth().getUser(uid);
  if (isSuperadminIdentity(target.email)) {
    throw new HttpsError('permission-denied', 'The Superadmin account is protected.');
  }

  const targetRole = await resolveUserRole(target);
  if (actorRole === 'admin' && (!['member', 'pro'].includes(targetRole) || !['member', 'pro'].includes(newRole))) {
    throw new HttpsError('permission-denied', 'Admins can manage Member and Pro accounts only.');
  }
  if (newRole === 'admin' && actorRole !== 'superadmin') {
    throw new HttpsError('permission-denied', 'Only the Superadmin can grant Admin access.');
  }

  await admin.auth().setCustomUserClaims(uid, { ...(target.customClaims || {}), role: newRole });
  await admin.auth().revokeRefreshTokens(uid);
  await db.collection('users').doc(uid).set({ role: newRole }, { merge: true }).catch(() => {});

  return { success: true, role: newRole };
});
