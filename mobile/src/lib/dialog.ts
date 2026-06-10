/**
 * Cross-platform confirm/alert. React Native Web's Alert.alert is a SILENT NO-OP, which is
 * why "locked" taps and confirms felt broken in the browser — every dialog in the app must
 * go through these helpers instead of Alert directly.
 */
import { Alert, Platform } from 'react-native';

/** Two-button confirm. Resolves true when the user accepts. */
export function confirmAsync(title: string, message: string, confirmLabel = 'OK'): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, onPress: () => resolve(true) },
    ]);
  });
}

/** One-button informational alert. */
export function alertInfo(title: string, message: string): void {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}
