/**
 * The "controller" for the scan screen: receives the raw scanned string
 * from the camera (a UI event) and decides what it means, by asking the
 * qrRepository to resolve it to a node ID. ScanScreen never touches
 * Supabase or qrRepository directly — only this hook.
 */
import { useCallback, useState } from 'react';
import { resolveCode } from '../repositories/qrRepository';

export function useQrScanner(onResolved: (nodeId: string) => void) {
  const [error, setError] = useState<string | null>(null);

  const handleScan = useCallback(
    async (code: string) => {
      const nodeId = await resolveCode(code);
      if (!nodeId) {
        setError(`"${code}" isn't a recognised WING checkpoint.`);
        return;
      }
      setError(null);
      onResolved(nodeId);
    },
    [onResolved]
  );

  return { handleScan, error };
}
