/**
 * Normalizes a phone number or JID into a clean string of digits.
 * Example: '628123456789:2@s.whatsapp.net' -> '628123456789'
 * Example: '+62 812-3456-789' -> '628123456789'
 * 
 * @param {string} jidOrPhone 
 * @returns {string}
 */
export function normalizePhoneNumber(jidOrPhone) {
  if (!jidOrPhone) return '';
  let clean = jidOrPhone.split('@')[0].split(':')[0];
  clean = clean.replace(/\D/g, '');
  return clean;
}
