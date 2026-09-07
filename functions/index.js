const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2/options');
const admin = require('firebase-admin');

admin.initializeApp();
setGlobalOptions({ region: 'europe-west1' });

const db = admin.firestore();
const ROLES = ['member', 'pro', 'admin', 'superadmin'];
const SUPERADMIN_EMAIL = 'admin@lawal.org';

function normaliseRole(role) {
  return ROLES.includes(role) ? role : 'member';
}

async function getContext(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'You must be signed in.');
  const user = await admin.auth().getUser(request.auth.uid);
  const email = (user.email || '').toLowerCase();
  let role = normaliseRole(user.customClaims?.role);

  if (email === SUPERADMIN_EMAIL) {
    role = 'superadmin';
    if (user.customClaims?.role !== 'superadmin') {
      await admin.auth().setCustomUserClaims(user.uid, { ...(user.customClaims || {}), role: 'superadmin' });
    }
  } else if (!user.customClaims?.role || !ROLES.includes(user.customClaims.role) || user.customClaims.role === 'superadmin') {
    role = 'member';
    if (user.customClaims?.role !== 'member') {
      await admin.auth().setCustomUserClaims(user.uid, { ...(user.customClaims || {}), role: 'member' });
    }
  }

  return { user, role };
}

function requireAdmin(role) {
  if (!['admin', 'superadmin'].includes(role)) throw new HttpsError('permission-denied', 'Administrator access required.');
}

function canManage(actor, target) {
  if (actor.uid === target.uid) return false;
  if (target.email?.toLowerCase() === SUPERADMIN_EMAIL) return false;
  if (actor.role === 'superadmin') return true;
  return ['member', 'pro'].includes(target.role);
}

async function serialiseUser(user) {
  const role = normaliseRole(user.customClaims?.role);
  return {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || '',
    photoURL: user.photoURL || '',
    provider: (user.providerData?.[0]?.providerId || '').replace('password', 'Email/Password'),
    createdAt: user.metadata.creationTime || null,
    lastSignInAt: user.metadata.lastSignInTime || null,
    disabled: Boolean(user.disabled),
    emailVerified: Boolean(user.emailVerified),
    role: (user.email || '').toLowerCase() === SUPERADMIN_EMAIL ? 'superadmin' : role
  };
}

exports.getMyRole = onCall(async (request) => {
  const { user, role } = await getContext(request);
  return { role, email: user.email || '', uid: user.uid };
});

exports.listUsers = onCall(async (request) => {
  const { user, role } = await getContext(request);
  requireAdmin(role);
  const users = [];
  let pageToken;
  do {
    const result = await admin.auth().listUsers(1000, pageToken);
    for (const item of result.users) users.push(await serialiseUser(item));
    pageToken = result.pageToken;
  } while (pageToken);
  return { users };
});

exports.setUserDisabled = onCall(async (request) => {
  const { user: actorUser, role: actorRole } = await getContext(request);
  requireAdmin(actorRole);
  const uid = request.data?.uid;
  const disabled = Boolean(request.data?.disabled);
  if (!uid || uid === actorUser.uid) throw new HttpsError('invalid-argument', 'A different user is required.');
  const target = await admin.auth().getUser(uid);
  const targetRole = normaliseRole(target.customClaims?.role);
  const targetRecord = { uid, email: target.email || '', role: targetRole };
  if (!canManage({ uid: actorUser.uid, role: actorRole }, targetRecord)) throw new HttpsError('permission-denied', 'You cannot manage this account.');
  if (targetRecord.email.toLowerCase() === SUPERADMIN_EMAIL) throw new HttpsError('permission-denied', 'The Superadmin account is protected.');
  await admin.auth().updateUser(uid, { disabled });
  if (disabled) await admin.auth().revokeRefreshTokens(uid);
  return { success: true };
});

exports.deleteUser = onCall(async (request) => {
  const { user: actorUser, role: actorRole } = await getContext(request);
  requireAdmin(actorRole);
  const uid = request.data?.uid;
  if (!uid || uid === actorUser.uid) throw new HttpsError('invalid-argument', 'A different user is required.');
  const target = await admin.auth().getUser(uid);
  const targetRole = (target.email || '').toLowerCase() === SUPERADMIN_EMAIL ? 'superadmin' : normaliseRole(target.customClaims?.role);
  if (!canManage({ uid: actorUser.uid, role: actorRole }, { uid, email: target.email || '', role: targetRole })) throw new HttpsError('permission-denied', 'You cannot manage this account.');
  await admin.auth().deleteUser(uid);
  return { success: true };
});

exports.setUserRole = onCall(async (request) => {
  const { user: actorUser, role: actorRole } = await getContext(request);
  requireAdmin(actorRole);
  const uid = request.data?.uid;
  const newRole = request.data?.role;
  if (!uid || !ROLES.includes(newRole) || newRole === 'superadmin') throw new HttpsError('invalid-argument', 'Choose Member, Pro or Admin.');
  if (uid === actorUser.uid) throw new HttpsError('permission-denied', 'You cannot change your own role.');
  const target = await admin.auth().getUser(uid);
  const targetRole = (target.email || '').toLowerCase() === SUPERADMIN_EMAIL ? 'superadmin' : normaliseRole(target.customClaims?.role);
  if ((target.email || '').toLowerCase() === SUPERADMIN_EMAIL) throw new HttpsError('permission-denied', 'The Superadmin account is protected.');
  if (actorRole === 'admin' && !['member', 'pro'].includes(targetRole)) throw new HttpsError('permission-denied', 'Admins can only manage Member and Pro accounts.');
  if (actorRole !== 'superadmin' && newRole === 'admin') throw new HttpsError('permission-denied', 'Only the Superadmin can grant Admin access.');
  if (actorRole === 'admin' && !['member', 'pro'].includes(newRole)) throw new HttpsError('permission-denied', 'Admins can only assign Member or Pro access.');
  await admin.auth().setCustomUserClaims(uid, { ...(target.customClaims || {}), role: newRole });
  await admin.auth().revokeRefreshTokens(uid);
  return { success: true, role: newRole };
});
