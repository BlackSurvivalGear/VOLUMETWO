import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { app } from "./firebase-config.js";

const auth = getAuth(app);
const db = getFirestore(app);
const form = document.querySelector('#business-profile-form');
const message = document.querySelector('#profile-message');
const status = document.querySelector('#profile-status');
const businessIdLabel = document.querySelector('#profile-business-id');
const logoInput = document.querySelector('#business-logo');
const logoPreview = document.querySelector('#logo-preview');
const removeLogoButton = document.querySelector('#remove-logo');
let currentUser = null;
let businessId = '';
let logoDataUrl = '';
let removeLogo = false;

const field = (id) => document.querySelector(`#${id}`);
const setMessage = (text, error = false) => { if (!message) return; message.textContent = text; message.classList.toggle('error', error); };
const setFormDisabled = (disabled) => form?.querySelectorAll('input, textarea, button').forEach((element) => { element.disabled = disabled; });

const setLogoPreview = (dataUrl = '') => {
  logoDataUrl = dataUrl || '';
  removeLogo = false;
  if (!logoPreview) return;
  if (logoDataUrl) {
    logoPreview.innerHTML = `<img src="${logoDataUrl}" alt="Business logo preview">`;
    removeLogoButton.hidden = false;
  } else {
    logoPreview.innerHTML = '<span>V2</span>';
    removeLogoButton.hidden = true;
  }
};

const optimiseLogo = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Unable to read logo file.'));
  reader.onload = () => {
    const image = new Image();
    image.onerror = () => reject(new Error('Logo file is not a valid image.'));
    image.onload = () => {
      const maxSize = 600;
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      let quality = 0.84;
      let output = canvas.toDataURL('image/webp', quality);
      while (output.length > 320000 && quality > 0.45) {
        quality -= 0.08;
        output = canvas.toDataURL('image/webp', quality);
      }
      if (output.length > 320000) return reject(new Error('Please choose a simpler or smaller logo image.'));
      resolve(output);
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
});

const loadProfile = async (user) => {
  currentUser = user;
  field('owner-name').textContent = user.displayName || 'Account owner';
  field('owner-email').textContent = user.email || 'No account email available';
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
    field('business-registration').value = business.registrationNumber || '';
    field('business-tax').value = business.taxNumber || '';
    field('business-country').value = business.country || '';
    field('business-city').value = business.city || '';
    field('business-website').value = business.website || '';
    field('business-address').value = business.address || '';
    field('owner-title').value = business.ownerTitle || '';
    setLogoPreview(business.logoDataUrl || '');
    status.textContent = 'Profile ready';
    businessIdLabel.textContent = 'Business profile loaded';
  } else {
    status.textContent = 'New profile';
    businessIdLabel.textContent = 'Complete your business details';
  }
};

logoInput?.addEventListener('change', async () => {
  const file = logoInput.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { setMessage('Please choose an image file.', true); return; }
  setMessage('Optimising logo…');
  try {
    setLogoPreview(await optimiseLogo(file));
    setMessage('Logo ready. Save the profile to keep it.');
  } catch (error) {
    console.error('Unable to process business logo:', error);
    logoInput.value = '';
    setMessage(error.message || 'Unable to process that logo.', true);
  }
});

removeLogoButton?.addEventListener('click', () => {
  setLogoPreview('');
  removeLogo = true;
  if (logoInput) logoInput.value = '';
  setMessage('Logo removed from the profile. Save to confirm.');
});

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
    const businessData = {
      ownerUid: currentUser.uid,
      name,
      type: field('business-type').value.trim(),
      email: field('business-email').value.trim(),
      phone: field('business-phone').value.trim(),
      registrationNumber: field('business-registration').value.trim(),
      taxNumber: field('business-tax').value.trim(),
      country: field('business-country').value.trim(),
      city: field('business-city').value.trim(),
      website: field('business-website').value.trim(),
      address: field('business-address').value.trim(),
      ownerTitle: field('owner-title').value.trim(),
      updatedAt: serverTimestamp(),
      ...(removeLogo ? { logoDataUrl: '' } : logoDataUrl ? { logoDataUrl } : {}),
      ...(existing.exists() ? {} : { createdAt: serverTimestamp() })
    };
    await setDoc(businessRef, businessData, { merge: true });
    await setDoc(doc(db, 'users', currentUser.uid), {
      businessId,
      updatedAt: serverTimestamp()
    }, { merge: true });
    status.textContent = 'Saved';
    businessIdLabel.textContent = 'Business profile saved';
    setMessage('Business profile saved.');
    removeLogo = false;
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
