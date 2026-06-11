/**
 * In-app renderer for lib/dialog confirms/alerts on web (native keeps Alert.alert and this
 * renders nothing). Mounted ONCE in the root layout. Exists because window.confirm/alert
 * synchronously block the renderer — the app read as hard-frozen wherever a dialog fired
 * under automation — and a native browser popup looks nothing like the product.
 */
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';

import { type DialogRequest, onDialog, settleDialog } from '../lib/dialog';
import { radius, space, useTheme } from '../lib/theme';
import { Btn, Row, T } from './kit';

export function DialogHost() {
  const { c } = useTheme();
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  useEffect(() => onDialog(setDialog), []);
  if (Platform.OS !== 'web' || !dialog) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => settleDialog(false)}>
      {/* Scrim tap = cancel for confirms; alerts require the explicit OK. */}
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: space.md }}
        onPress={() => dialog.cancelable && settleDialog(false)}>
        <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 360 }}>
          <View
            accessibilityRole="alert"
            style={{ backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: radius.lg, padding: 18, gap: 8 }}>
            <T weight="900" size={16}>{dialog.title}</T>
            <T muted size={13} style={{ lineHeight: 19 }}>{dialog.message}</T>
            <Row style={{ gap: 9, marginTop: 10 }}>
              {dialog.cancelable && (
                <Btn label="Cancel" variant="ghost" style={{ flex: 1 }} onPress={() => settleDialog(false)} />
              )}
              <Btn label={dialog.confirmLabel} variant="primary" style={{ flex: 1 }} onPress={() => settleDialog(true)} />
            </Row>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
