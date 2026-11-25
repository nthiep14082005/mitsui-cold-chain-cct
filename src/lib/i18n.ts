export type Lang = 'vi' | 'en';

export const DICTIONARY: Record<string, { vi: string; en: string }> = {
  appTitle: {
    vi: 'Mitsui Cold Chain Control Tower',
    en: 'Mitsui Cold Chain Control Tower',
  },
  corridorTag: {
    vi: 'Hành lang ĐBSCL – Bến Lức – TP.HCM',
    en: 'Mekong Delta – Ben Luc – HCMC Corridor',
  },
  navOverview: { vi: 'Tổng quan điều phối', en: 'Control Overview' },
  navOrdersPlan: { vi: 'Đơn ngày & Kế hoạch', en: 'Orders & Supply Plan' },
  navWarehouseTransport: { vi: 'Kho lạnh & Vận tải', en: 'Cold Storage & Fleet' },
  navTelemetry: { vi: 'Giám sát nhiệt & Cảnh báo', en: 'Temp & Alerts' },
  navLots: { vi: 'Hồ sơ Lô & ePOD', en: 'Lots & ePOD' },
  navClaims: { vi: 'Khiếu nại & Phán quyết', en: 'Claims & QC Verdict' },
  navBilling: { vi: 'Take-or-Pay & Đối soát', en: 'Billing & Take-or-Pay' },
  navKpi: { vi: 'KPI & Chấm điểm', en: 'KPI & Partner Scoring' },
  navAdmin: { vi: 'Danh mục & Quản trị', en: 'Catalog & Admin' },
  channelControlTower: { vi: 'Web Điều Phối Mitsui', en: 'Mitsui Control Tower' },
  channelCustomer: { vi: 'Web Khách Hàng B2B', en: 'B2B Customer Portal' },
  channelFieldApp: { vi: 'App Hiện Trường', en: 'Field Mobile App' },
  channelPublicQr: { vi: 'Trang QR Công Khai', en: 'Public QR Traceability' },
  resetDemo: { vi: 'Khôi phục dữ liệu mẫu (Reset Demo)', en: 'Reset Demo Data' },
  notifications: { vi: 'Thông báo & Zalo/SMS', en: 'Notifications & Zalo/SMS' },
  switchRole: { vi: 'Chuyển vai trò Demo', en: 'Switch Demo Role' },
  loginModalTitle: { vi: 'Xác thực đăng nhập (NFR-08)', en: 'Authentication (NFR-08)' },
  offlineMode: { vi: 'Chế độ mất sóng', en: 'Offline Mode' },
  onlineMode: { vi: 'Trực tuyến', en: 'Online' },
};

export function t(key: string, lang: Lang): string {
  const entry = DICTIONARY[key];
  if (!entry) return key;
  return entry[lang] ?? entry.vi;
}
