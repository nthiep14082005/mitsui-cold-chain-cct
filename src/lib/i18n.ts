export type Lang = 'vi' | 'ja';

export function tx(lang: Lang, vi: string, ja: string): string {
  return lang === 'ja' ? ja : vi;
}

export const DICTIONARY: Record<string, { vi: string; ja: string }> = {
  appTitle: {
    vi: 'Mitsui Cold Chain Control Tower',
    ja: 'Mitsui Cold Chain Control Tower',
  },
  corridorTag: {
    vi: 'Hành lang ĐBSCL – Bến Lức – TP.HCM',
    ja: 'メコンデルタ – ベンルック – ホーチミン回廊',
  },
  navOverview: { vi: 'Tổng quan điều phối', ja: 'コントロール概要' },
  navOrdersPlan: { vi: 'Đơn ngày & Kế hoạch', ja: '日次注文・供給計画' },
  navWarehouseTransport: { vi: 'Kho lạnh & Vận tải', ja: '冷蔵倉庫・輸送配車' },
  navTelemetry: { vi: 'Giám sát nhiệt & Cảnh báo', ja: '温度監視・アラート' },
  navLots: { vi: 'Hồ sơ Lô & ePOD', ja: 'ロット台帳・ePOD' },
  navClaims: { vi: 'Khiếu nại & Phán quyết', ja: 'クレーム・QC裁定' },
  navBilling: { vi: 'Take-or-Pay & Đối soát', ja: 'Take-or-Pay・月次精算' },
  navKpi: { vi: 'KPI & Chấm điểm', ja: 'KPI・パートナー評価' },
  navAdmin: { vi: 'Danh mục & Quản trị', ja: 'マスタ・システム管理' },
  channelControlTower: { vi: 'Web Điều Phối Mitsui', ja: 'Mitsui Control Tower' },
  channelCustomer: { vi: 'Web Khách Hàng B2B', ja: 'B2B顧客ポータル' },
  channelFieldApp: { vi: 'App Hiện Trường', ja: '現場モバイルアプリ' },
  channelPublicQr: { vi: 'Trang QR Công Khai', ja: '公開QRトレーサビリティ' },
  customerOrdersTrack: { vi: 'Đơn hàng & Theo dõi lô', ja: '日次注文・ロット追跡' },
  customerLoginNav: { vi: 'Đăng nhập / Đăng ký B2B', ja: 'ログイン / 新規登録 B2B' },
  fieldOpsNav: { vi: 'Thao tác hiện trường', ja: '現場オペレーション' },
  loginRegister: { vi: 'Đăng nhập / Đăng ký', ja: 'ログイン / 新規登録' },
  logout: { vi: 'Đăng xuất', ja: 'ログアウト' },
  adminPortal: { vi: 'Admin', ja: 'Admin' },
  back: { vi: 'Quay lại', ja: '戻る' },
  resetDemo: {
    vi: 'Khôi phục dữ liệu mẫu (Reset Demo)',
    ja: 'デモデータを初期化 (Reset Demo)',
  },
  notifications: { vi: 'Thông báo & Zalo/SMS', ja: '通知・Zalo/SMS' },
  switchRole: { vi: 'Chuyển vai trò', ja: 'ロール切替' },
  offlineMode: { vi: 'Chế độ mất sóng', ja: 'オフラインモード' },
  onlineMode: { vi: 'Trực tuyến', ja: 'オンライン' },
};

export function t(key: string, lang: Lang): string {
  const entry = DICTIONARY[key];
  if (!entry) return key;
  return entry[lang] ?? entry.vi;
}

export const ROLE_LABELS_I18N: Record<string, { vi: string; ja: string }> = {
  DIEU_PHOI_VIEN: {
    vi: 'Điều phối viên (Mitsui)',
    ja: 'コーディネーター (Mitsui)',
  },
  QUAN_LY_QC: {
    vi: 'Quản lý / QC (Mitsui)',
    ja: 'マネージャー / QC (Mitsui)',
  },
  QUAN_TRI_HE_THONG: {
    vi: 'Quản trị hệ thống (Mitsui)',
    ja: 'システム管理者 (Mitsui)',
  },
  KHACH_HANG: {
    vi: 'Khách hàng B2B',
    ja: 'B2B顧客',
  },
  NHA_CUNG_CAP: {
    vi: 'Nhà cung cấp (HTX)',
    ja: 'サプライヤー (農協/HTX)',
  },
  NHAN_VIEN_SO_CHE: {
    vi: 'Nhân viên sơ chế',
    ja: '選果・予冷スタッフ',
  },
  NHAN_VIEN_KHO: {
    vi: 'Nhân viên kho lạnh',
    ja: '冷蔵倉庫スタッフ',
  },
  TAI_XE: {
    vi: 'Tài xế / Vận tải',
    ja: 'ドライバー / 輸送',
  },
  NGUOI_TIEU_DUNG: {
    vi: 'Người tiêu dùng (QR)',
    ja: '消費者 (QR)',
  },
};
