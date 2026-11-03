/**
 * Purely presentational + event callback. Renders the camera feed and
 * calls onScan(code) with the raw decoded string — it doesn't know what
 * a "node" is or that Supabase exists. That interpretation happens one
 * layer up, in useQrScanner.
 */
import { useEffect, useRef } from 'react';
import QrScanner from 'qr-scanner';

type Props = {
  onScan: (code: string) => void;
};

export function QRScanner({ onScan }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current) return;

    const scanner = new QrScanner(
      videoRef.current,
      (result) => onScan(result.data),
      { highlightScanRegion: true, highlightCodeOutline: true }
    );

    scanner.start();
    return () => scanner.stop();
  }, [onScan]);

  // muted: the camera preview has no sound, so it needs no captions (qr-scanner mutes it anyway)
  return <video ref={videoRef} muted style={{ width: '100%', borderRadius: 12 }} />;
}
