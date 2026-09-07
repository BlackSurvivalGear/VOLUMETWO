import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { app } from "./firebase-config.js";

const auth = getAuth(app);
const db = getFirestore(app);
const form = document.querySelector('#business-profile-form');
const message = document.querySelector('#profile-message');
const status = document.querySelector('#profile-status');
const businessIdLabel = document.querySelector('#profile-business-id');
let currentUser = null;
let businessId = '';

const field = (id) => document.querySelector(`#${id}`);
const setMessage = (text, error = false) => { if (!message) return; message.textContent = text; message.classList.toggle('error', error); };
const setFormDisabled = (disabled) => form?.querySelectorAll('input, textarea, button').forEach((element) => { element.disabled = disabled; });

const loadProfile = async (user) => {
  currentUser = user;
  const userSnapshot = await getDoc(doc(db, 'users', user.uid));
  const profile = userSnapshot.exists() ? userSnapshot.data() : {};
  businessId = profile.businessId || user.uid;
  const businessSnapshot = await getDoc(doc(db, 'businesses', businessId));
  if (businessSnapshot.exists()) {
    const business = businessSnapshot.data();
    field('business-name').value = business.name || '';
    field('business-type').value = business.type || '';
    field('business-email').value = business.email || '';
    field('business-phone').value = business.phone || '';
    field('business-website').value = business.website || '';
    field('business-address').value = business.address || '';
    status.textContent = 'Profile ready';
    businessIdLabel.textContent = 'Business profile loaded';
  } else {
    status.textContent = 'New profile';
    businessIdLabel.textContent = 'Complete your business details';
  }
};

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentUser || !businessId) return;
  const name = field('business-name').value.trim();
  if (!name) { setMessage('Please enter your business name.', true); return; }
  const saveButton = form.querySelector('button[type="submit"]');
  setFormDisabled(true);
  setMessage('Saving your business profile…');
  try {
    const businessRef = doc(db, 'businesses', businessId);
    const existing = await getDoc(businessRef);
    await setDoc(businessRef, {
      ownerUid: currentUser.uid,
      name,
      type: field('business-type').value.trim(),
      email: field('business-email').value.trim(),
      phone: field('business-phone').value.trim(),
      website: field('business-website').value.trim(),
      address: field('business-address').value.trim(),
      updatedAt: serverTimestamp(),
      ...(existing.exists() ? {} : { createdAt: serverTimestamp() })
    }, { merge: true });
    await setDoc(doc(db, 'users', currentUser.uid), {
      businessId,
      updatedAt: serverTimestamp()
    }, { merge: true });
    status.textContent = 'Saved';
    businessIdLabel.textContent = 'Business profile saved';
    setMessage('Business profile saved.');
  } catch (error) {
    console.error('Unable to save business profile:', error);
    setMessage('Unable to save your business profile. Please try again.', true);
  } finally {
    setFormDisabled(false);
    if (saveButton) saveButton.disabled = false;
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  try {
    await loadProfile(user);
  } catch (error) {
    console.error('Unable to load business profile:', error);
    setMessage('Unable to load your business profile.', true);
    status.textContent = 'Unavailable';
  }
});
