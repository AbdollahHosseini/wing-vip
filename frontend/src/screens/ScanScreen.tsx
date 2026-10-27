import { QRScanner } from '../components/QRScanner';
import { useQrScanner } from '../hooks/useQrScanner';

type Props = {
  onLocated: (nodeId: string) => void;
};

export function ScanScreen({ onLocated }: Props) {
  const { handleScan, error } = useQrScanner(onLocated);

  return (
    <div>
      <h1>Scan the QR code nearest you</h1>
      <QRScanner onScan={handleScan} />
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
    </div>
  );
}
