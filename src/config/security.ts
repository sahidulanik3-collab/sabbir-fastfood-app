// 100% Offline Device Activation Security
// Predefined in source code by developer

export const ACTIVATION_STORAGE_KEY = 'sabbir_pos_device_activated_v1';

// Supported exact password (including with/without trailing period for maximum reliability)
export const VALID_ACTIVATION_PASSWORDS = [
  '160922003Fastfoodapp@#&*.',
  '160922003Fastfoodapp@#&*'
];

/**
 * Checks if the current smartphone/browser has already been activated
 */
export function isDeviceActivated(): boolean {
  try {
    return localStorage.getItem(ACTIVATION_STORAGE_KEY) === 'true';
  } catch (e) {
    return false;
  }
}

/**
 * Validates entered activation key
 */
export function verifyActivationPassword(enteredPassword: string): boolean {
  const clean = enteredPassword.trim();
  return VALID_ACTIVATION_PASSWORDS.includes(clean);
}

/**
 * Marks this device as permanently activated
 */
export function markDeviceAsActivated(): void {
  try {
    localStorage.setItem(ACTIVATION_STORAGE_KEY, 'true');
  } catch (e) {
    console.error('Failed to save activation state', e);
  }
}
