import { KpiMetricItem } from '@/types/claim-billing-kpi';

export type Lang = 'vi' | 'ja';

export function tx(lang: Lang, vi: string, ja: string): string {
  return lang === 'ja' ? ja : vi;
}

export function formatDateTime(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleString(lang === 'ja' ? 'ja-JP' : 'vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

export function formatTime(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleTimeString(lang === 'ja' ? 'ja-JP' : 'vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

export function formatNum(n: number, lang: Lang): string {
  return n.toLocaleString(lang === 'ja' ? 'ja-JP' : 'vi-VN');
}

export function formatVnd(n: number, lang: Lang): string {
  return `${formatNum(n, lang)} ${lang === 'ja' ? 'VND' : 'đ'}`;
}

export type LocalizedBadgeMeta = {
  vi: string;
  ja: string;
  tone: 'slate' | 'emerald' | 'blue' | 'amber' | 'rose' | 'purple';
};

export const LOT_STATUS_I18N: Record<string, LocalizedBadgeMeta> = {
  DA_TAO: { vi: 'Đã tạo', ja: '作成済', tone: 'slate' },
  DANG_LAM_LANH: { vi: 'Đang làm lạnh', ja: '予冷中', tone: 'blue' },
  DANG_TRUNG_CHUYEN: { vi: 'Đang trung chuyển', ja: '中継輸送中', tone: 'purple' },
  TRONG_KHO: { vi: 'Trong kho', ja: '倉庫保管中', tone: 'blue' },
  DANG_GIAO: { vi: 'Đang giao', ja: '配送中', tone: 'amber' },
  DA_GIAO: { vi: 'Đã giao', ja: '納品完了', tone: 'emerald' },
  CO_KHIEU_NAI: { vi: 'Có khiếu nại', ja: 'クレーム中', tone: 'rose' },
  DONG: { vi: 'Đóng', ja: 'クローズ', tone: 'slate' },
};

export const ORDER_STATUS_I18N: Record<string, LocalizedBadgeMeta> = {
  DA_NHAN: { vi: 'Đã nhận', ja: '受付済', tone: 'blue' },
  PHAT_SINH: { vi: 'Phát sinh (>14:00)', ja: '締切後追加 (>14:00)', tone: 'amber' },
  DA_XAC_NHAN: { vi: 'Đã xác nhận', ja: '確定済', tone: 'emerald' },
  TU_CHOI: { vi: 'Từ chối', ja: '却下', tone: 'rose' },
  DANG_THUC_HIEN: { vi: 'Đang thực hiện', ja: '手配中', tone: 'purple' },
  HOAN_TAT: { vi: 'Hoàn tất', ja: '完了', tone: 'emerald' },
};

export const TRIP_TYPE_I18N: Record<string, LocalizedBadgeMeta> = {
  THU_GOM: { vi: 'Thu gom', ja: '集荷輸送', tone: 'slate' },
  TRUNG_CHUYEN: { vi: 'Trung chuyển', ja: '中継輸送', tone: 'purple' },
  GIAO_HANG: { vi: 'Giao hàng', ja: '店舗配送', tone: 'blue' },
};

export const TRIP_STATUS_I18N: Record<string, LocalizedBadgeMeta> = {
  MOI_TAO: { vi: 'Mới tạo', ja: '配車済', tone: 'slate' },
  DA_NHAN_LENH: { vi: 'Đã nhận lệnh', ja: '受領済', tone: 'purple' },
  DANG_CHAY: { vi: 'Đang chạy', ja: '運行中', tone: 'blue' },
  HOAN_TAT: { vi: 'Hoàn tất', ja: '完了', tone: 'emerald' },
};

export const CLAIM_STATUS_I18N: Record<string, LocalizedBadgeMeta> = {
  MOI_TAO: { vi: 'Mới tạo', ja: '新規受付', tone: 'slate' },
  CHO_GIAI_TRINH: { vi: 'Chờ giải trình', ja: '弁明待ち', tone: 'amber' },
  DA_GIAI_TRINH: { vi: 'Đã giải trình', ja: '弁明提出済', tone: 'blue' },
  DA_PHAN_QUYET: { vi: 'Đã phán quyết', ja: '裁定確定', tone: 'emerald' },
};

export const STATEMENT_STATUS_I18N: Record<string, LocalizedBadgeMeta> = {
  CHO_XAC_NHAN: { vi: 'Chờ xác nhận', ja: '確認待ち', tone: 'amber' },
  DA_XAC_NHAN: { vi: 'Đã xác nhận', ja: '確定済', tone: 'emerald' },
};

export const ORG_TYPE_I18N: Record<string, LocalizedBadgeMeta> = {
  MITSUI: { vi: 'Điều phối Mitsui', ja: 'Mitsui 管制', tone: 'emerald' },
  KHACH_HANG: { vi: 'Khách hàng B2B', ja: 'B2B顧客', tone: 'blue' },
  NHA_CUNG_CAP: { vi: 'Nhà cung cấp (HTX)', ja: 'サプライヤー (HTX)', tone: 'purple' },
  CO_SO_SO_CHE: { vi: 'Cơ sở sơ chế', ja: '選果・予冷施設', tone: 'amber' },
  KHO_LANH: { vi: 'Kho lạnh', ja: '冷蔵倉庫', tone: 'blue' },
  NHA_VAN_TAI: { vi: 'Nhà vận tải', ja: '冷蔵輸送', tone: 'slate' },
};

export const ALLOC_CONFIRM_I18N: Record<string, LocalizedBadgeMeta> = {
  CHO_XAC_NHAN: { vi: 'Chờ HTX xác nhận', ja: 'HTX確認待ち', tone: 'slate' },
  DA_XAC_NHAN: { vi: 'Đã xác nhận', ja: '確認済', tone: 'emerald' },
  DE_XUAT_KHAC: { vi: 'Đề xuất khác', ja: '数量変更提案', tone: 'amber' },
};

export const PARTY_TYPE_I18N: Record<string, { vi: string; ja: string }> = {
  DOI_TAC: { vi: 'Đối tác vận hành (trừ phạt SLA)', ja: '物流パートナー（SLA違約金適用）' },
  NGUON_HANG: { vi: 'Nguồn hàng (xử lý ngoài hệ thống)', ja: '生産元・産地（システム外処理）' },
  SAU_BAN_GIAO: { vi: 'Sau bàn giao BG5', ja: 'BG5引渡後' },
  MITSUI: { vi: 'Mitsui chịu rủi ro', ja: 'Mitsui負担' },
};

export const AUDIT_ACTION_I18N: Record<string, { vi: string; ja: string }> = {
  ADJUDICATE_CLAIM: { vi: 'Phán quyết khiếu nại', ja: 'クレーム裁定確定' },
  SPLIT_LOT: { vi: 'Tách lô hàng', ja: '子ロット分割' },
  CREATE_ORDER: { vi: 'Tạo đơn ngày', ja: '日次注文作成' },
  CONFIRM_ORDER: { vi: 'Duyệt đơn ngày', ja: '日次注文承認' },
  REJECT_ORDER: { vi: 'Từ chối đơn ngày', ja: '日次注文却下' },
  UPDATE_ORDER: { vi: 'Cập nhật đơn ngày', ja: '日次注文更新' },
  GENERATE_PLAN: { vi: 'Tổng hợp kế hoạch', ja: '供給計画集計' },
  PUBLISH_PLAN: { vi: 'Phát hành kế hoạch', ja: '供給計画発行' },
  CONFIRM_PLAN_ALLOCATION: { vi: 'HTX xác nhận nguồn', ja: 'HTX供給確認' },
  CREATE_LOT: { vi: 'Tạo lô & QR', ja: 'ロット作成・QR発行' },
  ENTER_COOLING: { vi: 'Vào phòng mát', ja: '予冷室入庫' },
  EXIT_COOLING: { vi: 'Xuất phòng mát', ja: '予冷室出庫' },
  WMS_SYNC: { vi: 'Đồng bộ WMS', ja: 'WMS同期' },
  RECORD_EPOD: { vi: 'Ký bàn giao ePOD', ja: 'ePOD署名記録' },
  CREATE_EPOD_ADJUSTMENT: { vi: 'Biên bản điều chỉnh ePOD', ja: 'ePOD訂正記録作成' },
  CREATE_TRIP: { vi: 'Phát hành chuyến xe', ja: '配車指示発行' },
  UPDATE_TRIP: { vi: 'Cập nhật chuyến xe', ja: '運行ステータス更新' },
  SIMULATE_IOT: { vi: 'Giả lập IoT', ja: 'IoTシミュレーション' },
  UPLOAD_CSV: { vi: 'Nhập CSV Logger', ja: 'Logger CSV取込' },
  ACK_TEMP_ALERT: { vi: 'Xác nhận cảnh báo nhiệt', ja: '温度アラート確認' },
  OPEN_CLAIM: { vi: 'Mở khiếu nại', ja: 'クレーム登録' },
  PARTNER_EXPLAIN_CLAIM: { vi: 'Đối tác giải trình', ja: 'パートナー弁明提出' },
  RECALCULATE_BILLING: { vi: 'Tính lại bảng kê', ja: '月次精算再計算' },
  CONFIRM_STATEMENT: { vi: 'Xác nhận bảng kê', ja: '月次精算書確定' },
  RECALCULATE_SCORES: { vi: 'Chấm điểm đối tác', ja: 'パートナー再採点' },
  UPDATE_CONFIG: { vi: 'Cập nhật tham số HT', ja: '運用パラメータ更新' },
  CREATE_CATALOG: { vi: 'Thêm danh mục', ja: 'マスタ新規登録' },
  UPDATE_CATALOG: { vi: 'Cập nhật danh mục', ja: 'マスタ更新' },
  RESET_DEMO: { vi: 'Khôi phục dữ liệu mẫu', ja: 'デモデータ初期化' },
  REGISTER_CUSTOMER: { vi: 'Đăng ký khách hàng B2B', ja: 'B2B顧客新規登録' },
};

const PRODUCT_JA: Record<string, string> = {
  'PROD-CAIXANH': 'カラシナ (青菜)',
  'Cải xanh': 'カラシナ (青菜)',
  'PROD-XALACH': '水耕レタス',
  'Xà lách thủy canh': '水耕レタス',
  'PROD-BONGCAI': 'ブロッコリー',
  'Bông cải xanh': 'ブロッコリー',
  'PROD-CACHUA': '完熟トマト',
  'Cà chua chín': '完熟トマト',
  'PROD-XOAI': 'カッチュウマンゴー',
  'Xoài cát Chu': 'カッチュウマンゴー',
  'PROD-THANHLONG': '赤果肉ドラゴンフルーツ',
  'Thanh long ruột đỏ': '赤果肉ドラゴンフルーツ',
  'Nông sản tươi': '生鮮青果',
};

export function displayProductName(nameOrId: string, lang: Lang): string {
  if (lang !== 'ja') return nameOrId;
  return PRODUCT_JA[nameOrId] ?? nameOrId;
}

const PACKAGING_SPEC_JA: Record<string, string> = {
  '10 kg/thùng carton thoáng khí': '10 kg / 通気性カートン箱',
  '5 kg/rổ nhựa lót giấy ẩm': '5 kg / 保湿シート敷プラかご',
  '12 kg/thùng xốp bảo ôn': '12 kg / 保冷発泡スチロール箱',
  '15 kg/sọt nhựa đục lỗ': '15 kg / 通気プラコンテナ',
  '20 kg/thùng carton 2 lớp': '20 kg / 二層強化カートン箱',
  '18 kg/thùng carton tiêu chuẩn': '18 kg / 標準カートン箱',
  '10 kg/thùng carton': '10 kg / カートン箱',
};

export function displayPackagingSpec(spec: string, lang: Lang): string {
  if (lang !== 'ja') return spec;
  if (PACKAGING_SPEC_JA[spec]) return PACKAGING_SPEC_JA[spec];
  return spec
    .replace(/thùng carton thoáng khí/g, '通気性カートン箱')
    .replace(/thùng carton 2 lớp/g, '二層強化カートン箱')
    .replace(/thùng carton tiêu chuẩn/g, '標準カートン箱')
    .replace(/thùng carton/g, 'カートン箱')
    .replace(/thùng xốp bảo ôn/g, '保冷発泡箱')
    .replace(/sọt nhựa/g, 'プラコンテナ')
    .replace(/rổ nhựa/g, 'プラかご');
}

const TEMP_GROUP_JA: Record<string, string> = {
  'TG-LANH': '冷蔵 0–4°C',
  LANH: '冷蔵 0–4°C',
  'Lạnh 0–4°C': '冷蔵 0–4°C',
  'TG-MAT': '定温 10–13°C',
  MAT: '定温 10–13°C',
  'Mát 10–13°C': '定温 10–13°C',
};

export function displayTempGroupName(nameOrId: string, lang: Lang): string {
  if (lang !== 'ja') return nameOrId;
  return TEMP_GROUP_JA[nameOrId] ?? nameOrId;
}

const ORG_JA: Record<string, string> = {
  'HTX Rau An Toàn Tiền Giang': 'ティエンザン安全野菜農協 (HTX)',
  'HTX Nông Sản Đồng Tháp': 'ドンタップ農産物農協 (HTX)',
  'Cơ sở sơ chế Mỹ Tho (MT01)': 'ミトー選果・予冷センター (MT01)',
  'Cơ sở sơ chế Cần Giuộc (CG02)': 'カンジュオック選果・予冷センター (CG02)',
  'Kho lạnh NECS – KCN Phú An Thạnh, Bến Lức': 'NECS 冷蔵倉庫 – ベンルック工業団地',
  'Kho lạnh Nichirei TBA – KCN Long Hậu': 'Nichirei TBA 冷蔵倉庫 – ロンハウ工業団地',
  'Nhà vận tải lạnh ABA Cooltrans': 'ABA Cooltrans 冷蔵輸送',
};

export function displayOrgName(name: string, lang: Lang): string {
  if (lang !== 'ja') return name;
  return ORG_JA[name] ?? name;
}

export function displayUserName(name: string, lang: Lang): string {
  if (lang !== 'ja') return name;
  if (name === 'Quản trị viên Hệ thống 02') return 'システム管理者 02';
  return name
    .replace('(HTX Tiền Giang)', '(ティエンザン農協)')
    .replace('(HTX Đồng Tháp)', '(ドンタップ農協)')
    .replace('(Sơ chế MT01)', '(選果 MT01)')
    .replace('(Sơ chế CG02)', '(選果 CG02)')
    .replace('(Kho NECS)', '(NECS倉庫)')
    .replace('(Tài xế ABA)', '(ABAドライバー)');
}

const PLACE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/Cơ sở sơ chế Mỹ Tho \(MT01\)/g, 'ミトー選果・予冷センター (MT01)'],
  [/Cơ sở sơ chế Cần Giuộc \(CG02\)/g, 'カンジュオック選果・予冷センター (CG02)'],
  [/Kho lạnh NECS – Bến Lức/g, 'NECS ベンルック冷蔵倉庫'],
  [/DC Bách Hóa Xanh Tân Bình/g, 'BHX タンビン配送センター'],
  [/DC Bách Hóa Xanh Thủ Đức/g, 'BHX トゥードゥック配送センター'],
  [/Kho Trung Tâm Saigon Co\.op Lê Minh Xuân/g, 'Saigon Co.op レミンスアン中央倉庫'],
  [/Co\.opmart Nguyễn Đình Chiểu/g, 'Co.opmart グエンディンチエウ店'],
  [/Kho WinCommerce Hiệp Phước/g, 'WinCommerce ヒエップフック倉庫'],
  [/Lô B2, KCN Phú An Thạnh, Bến Lức, Long An/g, 'ロンアン省ベンルック・フーアンタイン工業団地 B2区画'],
  [/KCN Long Hậu, Cần Giuộc, Long An/g, 'ロンアン省カンジュオック・ロンハウ工業団地'],
  [/Xã Thạnh Phú, Châu Thành, Tiền Giang/g, 'ティエンザン省チャウタイン県タインフー'],
  [/Châu Thành, Tiền Giang/g, 'ティエンザン省チャウタイン'],
  [/Huyện Cao Lãnh, Đồng Tháp/g, 'ドンタップ省カオライン県'],
  [/Cao Lãnh, Đồng Tháp/g, 'ドンタップ省カオライン'],
  [/Logger Phòng mát Mỹ Tho/g, 'Logger ミトー予冷室'],
  [/Logger Phòng mát Cần Giuộc/g, 'Logger カンジュオック予冷室'],
  [/Logger Buồng Lạnh ([^()]+) \(NECS\)/g, 'Logger 冷蔵室 $1 (NECS)'],
  [/Logger Buồng Mát ([^()]+) \(NECS\)/g, 'Logger 定温室 $1 (NECS)'],
  [/Logger Buồng Lạnh ([^()]+) \(Nichirei\)/g, 'Logger 冷蔵室 $1 (Nichirei)'],
  [/Logger Xe (\S+) \(Khoang (\d+)\)/g, 'Logger 車両 $1 (第$2室)'],
  [/Logger Xe (\S+)/g, 'Logger 車両 $1'],
  [/Buồng Lạnh (\S+)/g, '冷蔵室 $1'],
  [/Buồng Mát (\S+)/g, '定温室 $1'],
  [/Kho NECS Buồng (\S+)/g, 'NECS倉庫 $1室'],
  [/Phòng mát (MT01|CG02) \(Khu Mát\)/g, '予冷室 $1 (定温ゾーン)'],
  [/Phòng mát (MT01|CG02)/g, '予冷室 $1'],
  [/Xe trung chuyển (\S+) \(K(\d+)\)/g, '中継車 $1 (第$2室)'],
  [/Xe trung chuyển (\S+)/g, '中継車 $1'],
  [/Xe giao (\S+) \(K(\d+)\)/g, '配送車 $1 (第$2室)'],
  [/Xe giao (\S+)/g, '配送車 $1'],
  [/Xe (\S+)/g, '車両 $1'],
  [/Điểm nhận A/g, '配送先 A'],
  [/Điểm nhận B/g, '配送先 B'],
  [/Nguồn hàng hoặc sau bàn giao/g, '生産元・産地または納品後'],
  [/Tiền Giang/g, 'ティエンザン省'],
  [/Đồng Tháp/g, 'ドンタップ省'],
  [/Long An/g, 'ロンアン省'],
  [/TP\.HCM/g, 'ホーチミン市'],
  [/ĐBSCL/g, 'メコンデルタ'],
];

export function displayPlace(text: string, lang: Lang): string {
  if (lang !== 'ja' || !text) return text;
  let out = text;
  for (const [pattern, replacement] of PLACE_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

export function localizeKpiMetric(m: KpiMetricItem, lang: Lang): KpiMetricItem {
  if (lang !== 'ja') return m;

  switch (m.key) {
    case 'loss_reduction': {
      const match = m.formulaNote.match(/([\d.]+)%\s*so với nền\s*([\d.]+)%/);
      return {
        ...m,
        group: '品質',
        label: 'ロス率削減幅',
        targetLabel: '基準比 ≥ 25%削減',
        formulaNote: match
          ? `実証ロス率 ${match[1]}% vs 顧客基準 ${match[2]}%`
          : '実証ロス率 vs 顧客基準',
      };
    }
    case 'accepted_rate': {
      const match = m.formulaNote.match(/([\d.,]+)\s*kg đạt\s*\/\s*([\d.,]+)\s*kg/);
      return {
        ...m,
        group: '品質',
        label: '納品時合格率',
        targetLabel: '≥ 95%',
        formulaNote: match
          ? `合格 ${match[1]} kg / BG5納品 ${match[2]} kg`
          : m.formulaNote,
      };
    }
    case 'otd': {
      const match = m.formulaNote.match(/(\d+)\s*\/\s*(\d+)/);
      return {
        ...m,
        group: 'サービス',
        label: '定時配送率 (OTD)',
        targetLabel: '≥ 95%',
        formulaNote: match
          ? `${match[1]} / ${match[2]} 件の時間帯遵守納品`
          : m.formulaNote,
      };
    }
    case 'temp_compliance':
      return {
        ...m,
        group: 'コールドチェーン',
        label: '温度帯遵守率',
        targetLabel: '≥ 98%',
        formulaNote: '通信欠測区間は基準外として算入',
      };
    case 'utilization': {
      const match = m.formulaNote.match(/Xe TB\s*([\d.]+)%,\s*Kho TB\s*([\d.]+)%/);
      return {
        ...m,
        group: '稼働効率',
        label: '車両積載率 / 倉庫稼働率',
        targetLabel: '車両 ≥ 75% / 倉庫 ≥ 70%',
        formulaNote: match
          ? `車両平均 ${match[1]}%、倉庫平均 ${match[2]}%`
          : m.formulaNote,
      };
    }
    case 'monthly_volume':
      return {
        ...m,
        group: '財務',
        label: '月間納品取扱量',
        unit: 'トン/月',
        targetLabel: '≥ 400 トン (損益分岐点)',
        formulaNote: '当月 BG5 総納品量',
      };
    case 'operating_profit': {
      const match = m.formulaNote.match(/(\d+)tr/);
      return {
        ...m,
        group: '財務',
        label: '営業利益',
        unit: '百万VND',
        targetLabel: '> 0 VND (黒字)',
        formulaNote: match
          ? `売上高 - パートナー費用 - 固定費 ${match[1]}百万VND`
          : '売上高 - パートナー費用 - 固定費',
      };
    }
    case 'customer_retention': {
      const match = m.formulaNote.match(/(\d+)\s*\/\s*(\d+)/);
      return {
        ...m,
        group: '市場',
        label: '顧客契約継続率',
        targetLabel: '≥ 70%',
        formulaNote: match
          ? `パイロット顧客 ${match[1]} / ${match[2]} 社が継続契約`
          : m.formulaNote,
      };
    }
    default:
      return m;
  }
}

export function displayOperationalText(text: string, lang: Lang): string {
  if (lang !== 'ja' || !text) return text;

  // Dynamic BR-10 suggestions
  let m = text.match(
    /^BR-10\(a\): Nhiệt độ đo tại (\S+) là ([\d.-]+)°C, ngoài dải ([\d.-]+)–([\d.-]+)°C\. Đề xuất quy trách nhiệm cho bên giao: (.+)\.$/
  );
  if (m) {
    return `BR-10(a): ${m[1]} の測定温度は ${m[2]}°C で許容範囲 ${m[3]}–${m[4]}°C を逸脱しています。引渡元 ${displayOrgName(m[5], 'ja')} への帰責を提案します。`;
  }

  m = text.match(
    /^BR-10\(b\): Chặng "(.+)" ghi nhận (mất tín hiệu logger (\d+) phút|vượt ngưỡng nhiệt \(([\d.?-]+)°C trong (\d+) phút\))\. Đề xuất quy trách nhiệm cho bên giữ hàng: (.+)\.$/
  );
  if (m) {
    const stageJa = displayPlace(m[1], 'ja');
    const orgJa = displayOrgName(m[6], 'ja');
    const detailJa = m[3]
      ? `Logger通信途絶（${m[3]}分間）`
      : `温度逸脱（${m[4]}°C・${m[5]}分間）`;
    return `BR-10(b): 工程「${stageJa}」で ${detailJa} を記録。保管責任者「${orgJa}」への帰責を提案します。`;
  }

  m = text.match(
    /^BR-10\(c\): Hụt khối lượng ([\d.-]+)% \(từ ([\d.]+) kg còn ([\d.]+) kg\) vượt dung sai ([\d.]+)% tại (.+)\. Đề xuất quy cho: (.+)\.$/
  );
  if (m) {
    return `BR-10(c): ${displayPlace(m[5], 'ja')} にて重量減少率 ${m[1]}%（${m[2]} kg → ${m[3]} kg）が発生し、許容差 ${m[4]}% を超過。${displayOrgName(m[6], 'ja')} への帰責を提案します。`;
  }

  if (text.startsWith('BR-10(d):')) {
    return 'BR-10(d): 温度逸脱・通信途絶・許容差超過の重量減少は検出されませんでした。生産元（産地）または納品後工程に起因する可能性を提案します。';
  }
  if (text.startsWith('BR-10(b): Phòng mát CG02')) {
    return 'BR-10(b): 予冷室 CG02 で BG1 後 2時間以内に基準温度への予冷が完了しませんでした。';
  }

  // Exact seed messages, claims, alerts, notifications, and audit logs
  const exactMap: Record<string, string> = {
    'Bông cải xanh bị mềm và ngả vàng 180kg khi kiểm nhận tại BG5.':
      'BG5 検品時にブロッコリー 180 kg の軟化・黄変を確認。',
    'Hụt 45 kg thanh long (4.5%) khi xuất kho NECS tại BG4 so với BG3.':
      'NECS倉庫の出庫時（BG4）にBG3比でドラゴンフルーツ 45 kg（4.5%）の不足を確認。',
    'Nhân viên kho ghi nhận thiếu 3 sọt (45kg) bị thất lạc khi chuyển pallet từ cửa nhập sang buồng M1, đang rà soát camera.':
      '倉庫スタッフが搬入口からM1室へのパレット移動時に3コンテナ（45 kg）の紛失を確認、現在カメラ映像を精査中です。',
    '195kg cải xanh héo lá khi giao tại DC Tân Bình.':
      'タンビン配送センター納品時にカラシナ 195 kg の葉萎れが発生。',
    'Máy nén phòng mát gặp sự cố nhẹ lúc 08:00 ngày 23/11.':
      '11月23日 08:00頃に予冷室コンプレッサーに軽微な不具合が発生しました。',
    'Xác định lỗi làm lạnh ban đầu chậm tại Cơ sở sơ chế Cần Giuộc (CG02). Bồi hoàn BHX 3.500.000 đ, phạt SLA CG02 2.000.000 đ.':
      'カンジュオック選果・予冷センター (CG02) での初期予冷遅延と認定。BHXへ 3,500,000 VND 補償、CG02へ SLA違約金 2,000,000 VND を適用。',
    'Kiểm tra máy lạnh thùng xe, đóng kín van cửa sau và bật làm lạnh tăng cường.':
      '冷凍機の点検、後部扉シールの密閉確認、および急速冷却運転を実施済。',
    'Hụt 45 kg (4.5%) trong thời gian lưu tại kho NECS':
      'NECS 倉庫保管中に 45 kg（4.5%）の重量不足が発生',
    'Bông cải bị ngả vàng và mềm do sốc nhiệt':
      '温度ショックによりブロッコリーが黄変・軟化',
    'Rau bị héo lá tại phòng mát CG02':
      '予冷室 CG02 にて青菜の葉萎れが発生',
    'Đơn phát sinh sau 14:00 chờ duyệt':
      '14:00 締切後の追加注文が承認待ち',
    'Nhắc lại cảnh báo mất tín hiệu > 30 phút (FR-29)':
      '通信途絶アラート再通知（30分超・FR-29）',
    'Cảnh báo hạn lưu kho >= 80% (FR-19)':
      '保管期限 80%以上到達アラート (FR-19)',
    'Bách Hóa Xanh vừa gửi đơn DN-261126-02 (1.500 kg) lúc 15:30 sau giờ chốt 14:00 D-1.':
      'Bách Hóa Xanh が締切（D-1 14:00）後の 15:30 に注文 DN-261126-02（1,500 kg）を送信しました。',
    'Logger LOG-XE-11209 (Lô CG02-261124-002) mất tín hiệu 45 phút, chưa có người xác nhận.':
      'Logger LOG-XE-11209（ロット CG02-261124-002）で45分間の通信途絶が発生し、未確認のままです。',
    'Lô MT01-261125-001 (Cải xanh) tại Buồng C1 NECS đã lưu 41/48 giờ (85.4%). Ưu tiên xuất FEFO!':
      'NECS C1室のロット MT01-261125-001（カラシナ）は保管 41/48時間（85.4%）に達しました。FEFO優先出庫してください！',
    'Phán quyết khiếu nại KN-261123-03: lỗi phòng mát CG02, bồi hoàn BHX 3.500.000đ':
      'クレーム KN-261123-03 裁定確定：CG02予冷室起因、BHX補償 3,500,000 VND',
    'Tách lô MT01-261124-005 (1.200 kg) thành MT01-261124-005-A (700 kg) và -B (500 kg)':
      'ロット MT01-261124-005 (1,200 kg) を MT01-261124-005-A (700 kg) と -B (500 kg) に分割',
  };

  if (exactMap[text]) return exactMap[text];

  // Fallback partial localization for stage labels inside suggestedStage
  return displayOrgName(displayPlace(text, 'ja'), 'ja');
}

export function translateApiMessage(msg: string, lang: Lang): string {
  if (lang !== 'ja' || !msg) return msg;

  const exactErrors: Record<string, string> = {
    'Chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.':
      '未ログイン、またはログインセッションの有効期限が切れています。',
    'Không được phép truy cập dữ liệu của tổ chức khác (NFR-07).':
      '他組織のデータへのアクセスは許可されていません (NFR-07)。',
    'Bản ghi gốc (ePOD / Nhiệt độ / Phán quyết) là bất biến, không thể sửa hoặc xóa (NFR-06). Vui lòng tạo biên bản điều chỉnh.':
      '原記録（ePOD・温度データ・QC裁定）は改変不可のため変更・削除できません (NFR-06)。訂正記録を作成してください。',
    'Chỉ Quản trị hệ thống mới được thay đổi tham số vận hành (FR-52).':
      '運用パラメータの変更はシステム管理者のみ可能です (FR-52)。',
    'Action không hợp lệ.': '無効なアクションです。',
    'Vui lòng nhập đầy đủ Email, Mật khẩu và mã OTP 2FA.':
      'メールアドレス・パスワード・2FA OTPコードをすべて入力してください。',
    'Mã OTP xác thực 2 lớp (2FA) không chính xác.':
      '2段階認証 (2FA) のOTPコードが正しくありません。',
    'Email hoặc mật khẩu quản trị không chính xác.':
      '管理者のメールアドレスまたはパスワードが正しくありません。',
    'Vui lòng nhập Email và Mật khẩu khách hàng B2B.':
      'B2B顧客のメールアドレスとパスワードを入力してください。',
    'Email hoặc mật khẩu khách hàng không đúng.':
      'B2B顧客のメールアドレスまたはパスワードが正しくありません。',
    'Phiên Quản trị chưa được xác thực. Vui lòng đăng nhập tại /admin.':
      '管理者セッションが未認証です。/admin からログインしてください。',
    'Tài khoản nội bộ không hợp lệ.': '社内アカウントが無効です。',
    'Cổng Khách hàng chỉ cho phép chuyển giữa các tài khoản Khách hàng B2B.':
      '顧客ポータルではB2B顧客アカウント間の切替のみ許可されています。',
    'Số điện thoại hoặc mã OTP hiện trường không đúng (OTP demo: 123456).':
      '電話番号または現場OTPコードが正しくありません（デモOTP: 123456）。',
    'Không tìm thấy tài khoản hiện trường hợp lệ.': '有効な現場アカウントが見つかりません。',
    'Chế độ xác thực không được hỗ trợ.': 'サポートされていない認証モードです。',
    'Vui lòng nhập đầy đủ Họ tên, Tên doanh nghiệp, Email, SĐT và Mật khẩu (>= 6 ký tự).':
      '担当者名・企業名・メール・電話番号・パスワード（6文字以上）をすべて入力してください。',
    'Chỉ Quản lý / QC mới được chốt tính lại bảng kê đối soát tháng (FR-40..FR-43).':
      '月次精算書の再計算・確定はマネージャー / QCのみ実行できます (FR-40..FR-43)。',
    'Chỉ Quản trị hệ thống mới được thêm danh mục nền (FR-01..FR-03).':
      'マスタデータの登録・更新はシステム管理者のみ可能です (FR-01..FR-03)。',
    'Thiếu mã lô, khối lượng bị ảnh hưởng hoặc mô tả khiếu nại (FR-36).':
      'ロットID、対象重量、またはクレーム内容が不足しています (FR-36)。',
    'Không tìm thấy lô hàng.': '対象のロットが見つかりません。',
    'Không thể gửi khiếu nại cho lô của khách hàng khác (NFR-07).':
      '他顧客のロットに対してクレームを送信することはできません (NFR-07)。',
    'Lô chưa có biên bản giao hàng BG5, chưa thể mở khiếu nại.':
      'BG5納品記録が未完了のため、クレームを登録できません。',
    'Khách hàng chưa có hợp đồng khung còn hiệu lực.':
      '有効な基本契約 (HDK) が見つかりません。',
    'Đơn hàng phải có ít nhất một mặt hàng.':
      '注文には最低1つの品目が必要です。',
    'Khối lượng đặt phải lớn hơn 0 kg.':
      '注文数量は 0 kg より大きい値を指定してください。',
    'Điểm giao không thuộc hợp đồng khung.':
      '指定された配送先は基本契約に含まれていません。',
    'Chỉ Điều phối viên mới được xác nhận hoặc từ chối đơn.':
      '注文の承認・却下はコーディネーターのみ実行できます。',
    'Từ chối đơn phát sinh bắt buộc phải kèm lý do (FR-07).':
      '締切後追加注文を却下する場合は理由の入力が必須です (FR-07)。',
    'Đơn đã chốt kế hoạch hoặc hoàn tất, không thể sửa.':
      'すでに計画確定または完了した注文は変更できません。',
    'Chuyến xe phải được gán ít nhất 1 lô hàng.':
      '配車便には最低1つのロットを割り当てる必要があります。',
    'Vui lòng chọn cảnh báo và ghi hành động xử lý (FR-29).':
      'アラートと対応記録内容を入力してください (FR-29)。',
    'Không tìm thấy cảnh báo.': '対象のアラートが見つかりません。',
    'Không được phép xác nhận cảnh báo của đơn vị khác.':
      '他組織のアラートを確認・処理することはできません。',
    'Nội dung CSV trống.': 'CSVデータが空です。',
    'Phán quyết khiếu nại đã chốt là bất biến, không thể sửa hoặc xóa (NFR-06).':
      '確定済のクレーム裁定は改変不可のため変更・削除できません (NFR-06)。',
    'Chỉ đối tác bị đề xuất lỗi mới được gửi giải trình (FR-39).':
      '原因工程と推定されたパートナーのみ弁明を提出できます (FR-39)。',
    'Vui lòng nhập nội dung giải trình.': '弁明内容を入力してください。',
    'Chỉ Quản lý / QC của Mitsui mới có quyền ra phán quyết khiếu nại (FR-38).':
      'クレームの最終裁定は Mitsui マネージャー / QC のみ可能です (FR-38)。',
    'Phán quyết phải có bên chịu trách nhiệm và lý do (FR-38).':
      '裁定には責任主体と裁定理由の入力が必須です (FR-38)。',
    'Khối lượng thực tế phải lớn hơn 0 kg.':
      '実測重量は 0 kg より大きい値を入力してください。',
    'Tại BG5, khách hàng phải nhập khối lượng đạt và không đạt (FR-35).':
      'BG5 では合格重量と不合格重量の両方を入力してください (FR-35)。',
    'Khi có hàng không đạt tại BG5, khách hàng phải ghi lý do (FR-35).':
      'BG5 で不合格品がある場合は理由の入力が必須です (FR-35)。',
    'Tuân thủ NFR-09: Chỉ thu thập GPS khi chuyến xe đang hoạt động.':
      'NFR-09準拠: 運行中の便のみ GPS 位置情報を収集します。',
    'Không được phép thao tác chuyến của nhà vận tải khác (NFR-07).':
      '他運送会社の配車便を操作することはできません (NFR-07)。',
    'Không được phép xác nhận bảng kê của tổ chức khác (NFR-07).':
      '他組織の月次精算書を確定することはできません (NFR-07)。',
    'Không thể xác nhận kế hoạch của HTX khác (NFR-07).':
      '他の農協 (HTX) の供給計画を確認することはできません (NFR-07)。',
    'Không có quyền thao tác lô của cơ sở khác.':
      '他施設のロットを操作する権限がありません。',
    'Tách lô cần tối thiểu 2 lô con.': '分割には最低2つの子ロットが必要です。',
    'Lô này đã được tách trước đó.': 'このロットはすでに分割済です。',
  };

  if (exactErrors[msg]) return exactErrors[msg];

  // Dynamic patterns
  let m = msg.match(/^Vai trò (\S+) không có quyền thực hiện thao tác này \(NFR-07\)\.$/);
  if (m) {
    return `ロール「${m[1]}」にはこの操作を実行する権限がありません (NFR-07)。`;
  }

  m = msg.match(/^Đã quá cửa sổ khiếu nại (\d+) giờ sau BG5 \(BR-11\)\.$/);
  if (m) {
    return `BG5 納品後 ${m[1]}時間以内のクレーム受付期限を過ぎています (BR-11)。`;
  }

  m = msg.match(/^Mặt hàng "(.+)" không nằm trong hợp đồng khung (\S+) \(FR-06\)\.$/);
  if (m) {
    return `品目「${displayProductName(m[1], 'ja')}」は基本契約 ${m[2]} の対象外です (FR-06)。`;
  }

  m = msg.match(/^Vi phạm BR-05: Không được xếp 2 lô khác nhóm nhiệt .+ vào cùng Khoang (\d+) trên xe (\S+)!$/);
  if (m) {
    return `BR-05違反: 車両 ${m[2]} の第${m[1]}室に異なる温度帯（冷蔵 0–4°C と 定温 10–13°C）を混載することはできません！`;
  }

  m = msg.match(/^Vi phạm FR-23: Khối lượng Khoang (\d+) \(([\d.,]+) kg\) vượt tải trọng khoang \(([\d.,]+) kg\)\.$/);
  if (m) {
    return `FR-23違反: 第${m[1]}室の積載量（${m[2]} kg）が庫室最大容量（${m[3]} kg）を超過しています。`;
  }

  m = msg.match(/^Vi phạm BR-05 \/ FR-23: Tổng khối lượng \(([\d.,]+) kg\) vượt tải trọng đăng ký của xe (\S+) \(([\d.,]+) kg\)\.$/);
  if (m) {
    return `BR-05 / FR-23違反: 総積載重量（${m[1]} kg）が車両 ${m[2]} の最大積載量（${m[3]} kg）を超過しています。`;
  }

  m = msg.match(/^Chưa hoàn tất biên bản (\S+) \(xác nhận đủ 2 bên theo BR-08\) cho lô (\S+)\.$/);
  if (m) {
    return `ロット ${m[2]} の前工程 ${m[1]}（BR-08 双方署名確認）が完了していません。`;
  }

  m = msg.match(/^Chênh lệch khối lượng \(([\d.-]+)%\) vượt dung sai ([\d.]+)% \(BR-09\)\. Vui lòng ghi lý do!$/);
  if (m) {
    return `重量差異（${m[1]}%）が許容範囲 ${m[2]}% を超えています (BR-09)。理由を入力してください！`;
  }

  m = msg.match(/^Nhiệt độ đo \(([\d.-]+)°C\) nằm ngoài dải ([\d.-]+)–([\d.-]+)°C\. Vui lòng ghi lý do!$/);
  if (m) {
    return `測定温度（${m[1]}°C）が許容範囲 ${m[2]}–${m[3]}°C を逸脱しています。理由を入力してください！`;
  }

  m = msg.match(/^Tổng kg đạt \(([\d.]+)\) \+ không đạt \(([\d.]+)\) phải bằng kg thực nhận \(([\d.]+)\)\.$/);
  if (m) {
    return `合格重量（${m[1]}）＋ 不合格重量（${m[2]}）は実受領重量（${m[3]}）と一致する必要があります。`;
  }

  m = msg.match(/^BR-05: Buồng (.+) đang chứa lô (\S+) khác nhóm nhiệt\. Không thể xếp chung buồng kho!$/);
  if (m) {
    return `BR-05違反: ${displayPlace(m[1], 'ja')} には別温度帯のロット ${m[2]} が保管中のため同一庫室に入庫できません！`;
  }

  m = msg.match(/^Cảnh báo FR-18: Buồng (.+) không đúng nhóm nhiệt của lô (\S+)!$/);
  if (m) {
    return `警告 FR-18: ${displayPlace(m[1], 'ja')} はロット ${m[2]} の指定温度帯と一致しません！`;
  }

  m = msg.match(/^Chưa có bản tổng hợp kế hoạch ngày (\S+)\.$/);
  if (m) {
    return `${m[1]} の供給計画集計がまだ作成されていません。`;
  }

  m = msg.match(/^Email (\S+) đã được đăng ký trong hệ thống\.$/);
  if (m) {
    return `メールアドレス ${m[1]} はすでに登録されています。`;
  }

  return msg;
}
