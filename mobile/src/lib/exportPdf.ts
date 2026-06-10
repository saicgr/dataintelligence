/**
 * Cheat-sheet PDF delivery. Native: expo-print renders the HTML to a PDF file and the share
 * sheet hands it off. Web: printToFileAsync isn't available, so open a print-ready window and
 * let the browser's print dialog do "Save as PDF".
 */
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export async function exportSheet(html: string): Promise<{ ok: boolean; error?: string }> {
  if (Platform.OS === 'web') {
    const w = window.open('', '_blank');
    if (!w) return { ok: false, error: 'Pop-up blocked — allow pop-ups for this site to export.' };
    w.document.write(html);
    w.document.close();
    w.focus();
    // Give the new window a beat to lay out before the print dialog freezes it.
    setTimeout(() => w.print(), 250);
    return { ok: true };
  }
  try {
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Export cheat sheet' });
      return { ok: true };
    }
    return { ok: false, error: 'Sharing isn’t available on this device.' };
  } catch (e) {
    return { ok: false, error: String((e as Error).message) };
  }
}
