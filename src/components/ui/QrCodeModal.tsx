'use client';

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ExternalLink, Printer } from 'lucide-react';
import Link from 'next/link';
import { useCct } from '@/components/layout/CctContext';
import { displayProductName, displayTempGroupName, formatNum, tx } from '@/lib/i18n';
import { Modal } from './Modal';

export function QrCodeModal({
  open,
  onClose,
  lotCode,
  qrToken,
  productName,
  packingDate,
  tempRangeLabel,
  weightKg,
}: {
  open: boolean;
  onClose: () => void;
  lotCode: string;
  qrToken: string;
  productName: string;
  packingDate: string;
  tempRangeLabel?: string;
  weightKg?: number;
}) {
  const { lang } = useCct();
  const [origin, setOrigin] = React.useState('');
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);
  const qrPath = `/qr/${qrToken}`;
  const qrUrl = origin ? `${origin}${qrPath}` : qrPath;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={tx(lang, `Tem nhãn QR lô ${lotCode}`, `ロット ${lotCode} QRラベル`)}
      maxWidth="max-w-md"
    >
      <div className="border-2 border-dashed border-slate-300 rounded-2xl p-5 bg-white text-center space-y-3">
        <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">
          Mitsui Cold Chain Control Tower
        </div>
        <div className="text-lg font-bold text-slate-900">
          {displayProductName(productName, lang)}
        </div>
        <div className="flex justify-center py-2">
          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
            <QRCodeSVG value={qrUrl} size={176} level="M" />
          </div>
        </div>
        <div className="font-mono text-sm font-bold text-slate-800 bg-slate-100 rounded-lg py-1.5 px-3 inline-block">
          {lotCode}
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-2 border-t border-slate-100 text-left">
          <div>
            <span className="text-slate-400">{tx(lang, 'Ngày sơ chế:', '選果・梱包日:')}</span>{' '}
            <strong className="text-slate-800">{packingDate}</strong>
          </div>
          {weightKg !== undefined && (
            <div>
              <span className="text-slate-400">{tx(lang, 'Khối lượng:', '重量:')}</span>{' '}
              <strong className="text-slate-800">{formatNum(weightKg, lang)} kg</strong>
            </div>
          )}
          {tempRangeLabel && (
            <div className="col-span-2">
              <span className="text-slate-400">{tx(lang, 'Bảo quản:', '保管温度帯:')}</span>{' '}
              <strong className="text-blue-700">
                {displayTempGroupName(tempRangeLabel, lang)}
              </strong>
            </div>
          )}
        </div>
        <p className="text-[11px] text-slate-400 break-all">{qrUrl}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 justify-end no-print">
        <Link
          href={`/qr/${qrToken}`}
          target="_blank"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <ExternalLink className="w-4 h-4" /> {tx(lang, 'Mở trang QR', 'QRページを開く')}
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
        >
          <Printer className="w-4 h-4" /> {tx(lang, 'In tem dán thùng', '箱ラベルを印刷')}
        </button>
      </div>
    </Modal>
  );
}
