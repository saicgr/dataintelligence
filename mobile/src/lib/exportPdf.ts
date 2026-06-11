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
    // NO auto-print. `noopener` severs the window reference but NOT the renderer process — a
    // same-origin blob: child shares this tab's process, so a load-time window.print() blocks
    // the synchronous print dialog across BOTH tabs (the app hard-freezes; indefinitely under
    // automation). Instead the child gets a fixed "Save as PDF" button: print only ever runs
    // from a user gesture inside the child tab, where the dialog is expected and recoverable.
    const printBtn =
      '<button onclick="window.print()" style="position:fixed;top:14px;right:14px;z-index:9;' +
      'background:#f76707;color:#fff;border:0;border-radius:8px;padding:10px 16px;' +
      'font:700 13px -apple-system,sans-serif;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.25)">' +
      '🖨 Save as PDF</button>' +
      '<style>@media print{button{display:none}}</style>';
    const doc = html.includes('</body>') ? html.replace('</body>', `${printBtn}</body>`) : html + printBtn;
    const url = URL.createObjectURL(new Blob([doc], { type: 'text/html' }));
    window.open(url, '_blank', 'noopener'); // returns null with noopener even on success
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
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
