import { Gem } from 'lucide-react';

export default function Logo() {
  return (
    <div className="flex items-center gap-2 font-semibold text-lg text-primary">
      <Gem className="h-6 w-6" />
      <span>QuantumMint</span>
    </div>
  );
}
