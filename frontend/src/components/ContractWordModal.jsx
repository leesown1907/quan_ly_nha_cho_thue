import { useEffect, useRef, useState } from 'react';
import {
  CalendarPlus, Check, Download, Edit3, FileText, Printer, Save, X, XOctagon,
} from 'lucide-react';
import { api } from '../api';
import { useFeedback } from '../context/FeedbackContext';
import { addMonths, date, money, today } from '../utils/format';
import { Button } from './ui';

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

function readThreeDigits(n, full) {
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const u = n % 10;
  let out = '';
  if (h > 0 || full) out += `${DIGITS[h]} trăm`;
  if (t > 1) {
    out += `${out ? ' ' : ''}${DIGITS[t]} mươi`;
    if (u === 1) out += ' mốt';
    else if (u === 5) out += ' lăm';
    else if (u > 0) out += ` ${DIGITS[u]}`;
  } else if (t === 1) {
    out += `${out ? ' ' : ''}mười`;
    if (u === 5) out += ' lăm';
    else if (u > 0) out += ` ${DIGITS[u]}`;
  } else if (u > 0) {
    if (out) out += ' lẻ';
    out += `${out ? ' ' : ''}${DIGITS[u]}`;
  }
  return out;
}

function moneyToWords(amount) {
  const n = Math.round(Number(amount || 0));
  if (!Number.isFinite(n) || n <= 0) return 'Không đồng';
  const units = ['', 'nghìn', 'triệu', 'tỷ'];
  const groups = [];
  let tmp = n;
  while (tmp > 0) {
    groups.push(tmp % 1000);
    tmp = Math.floor(tmp / 1000);
  }
  let res = '';
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    const g = groups[i];
    if (g > 0) {
      const part = readThreeDigits(g, i < groups.length - 1);
      res += `${res ? ' ' : ''}${part}${units[i] ? ` ${units[i]}` : ''}`;
    }
  }
  const s = `${res.trim()} đồng`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function splitDateParts(d) {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(String(d))) return { day: '...', month: '...', year: '....' };
  const [year, month, day] = String(d).split('-');
  return { day, month, year };
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');
}

function buildWordHtml(c) {
  const startParts = splitDateParts(c.start_date);
  const endSection = c.status === 'ended'
    ? `
      <div style="margin-top:18pt;padding:10pt 12pt;border:1pt solid #b91c1c;background:#fef2f2;">
        <p style="margin:0 0 6pt 0;font-weight:bold;text-align:center;color:#991b1b;text-transform:uppercase;">
          BIÊN BẢN THANH LÝ / CHẤM DỨT HỢP ĐỒNG
        </p>
        <p style="margin:3pt 0;">- Ngày chấm dứt hợp đồng: <b>${esc(date(c.ended_at || c.end_date))}</b></p>
        <p style="margin:3pt 0;">- Lý do / ghi chú thanh lý: ${esc(c.end_reason || 'Hai bên thống nhất thanh lý hợp đồng và bàn giao lại phòng.')}</p>
        <p style="margin:3pt 0;">- Trạng thái: <b>Đã hoàn tất thanh lý, bàn giao lại Phòng ${esc(c.room_code)} cho Bên A.</b></p>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <title>Hợp đồng ${esc(c.code)} - Phòng ${esc(c.room_code)}</title>
  <style>
    @page { size: A4; margin: 2cm 2cm 2cm 2.5cm; }
    body { font-family: "Times New Roman", Times, serif; font-size: 13pt; line-height: 1.55; color: #000; }
    p { margin: 4pt 0; text-align: justify; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .italic { font-style: italic; }
    .section { font-weight: bold; text-transform: uppercase; margin-top: 12pt; margin-bottom: 4pt; }
    table.sig { width: 100%; border-collapse: collapse; margin-top: 26pt; }
    table.sig td { width: 50%; text-align: center; vertical-align: top; }
  </style>
</head>
<body>
  <p class="center bold" style="font-size:13pt;margin-bottom:0;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
  <p class="center bold" style="font-size:13pt;margin-top:2pt;">Độc lập - Tự do - Hạnh phúc</p>
  <p class="center" style="margin-top:0;">---------------o0o---------------</p>

  <p class="center bold" style="font-size:16pt;margin-top:14pt;margin-bottom:2pt;">HỢP ĐỒNG THUÊ PHÒNG TRỌ</p>
  <p class="center italic" style="margin-top:0;">Số: ${esc(c.code)}/HĐTP</p>
  <p style="text-align:right;font-style:italic;margin-top:8pt;">
    Hà Nội, ngày ${startParts.day} tháng ${startParts.month} năm ${startParts.year}
  </p>

  <p>Hôm nay, chúng tôi gồm có:</p>

  <p class="section">BÊN CHO THUÊ (BÊN A):</p>
  <p>- Đại diện chủ nhà: <b>Chủ nhà 57 Giảng Võ</b></p>
  <p>- Địa chỉ khu nhà cho thuê: <b>57 Giảng Võ, Đống Đa, Hà Nội</b></p>
  <p>- Số điện thoại liên hệ: <b>0988 000 057</b></p>

  <p class="section">BÊN THUÊ PHÒNG (BÊN B):</p>
  <p>- Ông/Bà: <b>${esc(c.tenant_name)}</b></p>
  <p>- Số CCCD/CMND: <b>${esc(c.tenant_id_card || '........................')}</b> &nbsp;&nbsp;&nbsp; Điện thoại: <b>${esc(c.tenant_phone || '........................')}</b></p>
  <p>- Địa chỉ thường trú: <b>${esc(c.tenant_hometown || '................................................')}</b></p>

  <p style="margin-top:8pt;">Hai bên thống nhất ký kết hợp đồng thuê phòng với các điều khoản sau đây:</p>

  <p class="section">ĐIỀU 1: ĐỐI TƯỢNG VÀ THỜI HẠN CHO THUÊ</p>
  <p>1.1. Bên A đồng ý cho Bên B thuê <b>Phòng ${esc(c.room_code)}</b> (Tầng ${esc(c.room_floor)}, diện tích <b>${esc(c.room_area)} m²</b>) tại địa chỉ 57 Giảng Võ, Đống Đa, Hà Nội.</p>
  <p>1.2. Số lượng người đăng ký ở tại phòng: <b>${esc(c.occupants)} người</b>.</p>
  <p>1.3. Thời hạn thuê: Từ ngày <b>${esc(date(c.start_date))}</b> đến hết ngày <b>${esc(date(c.end_date))}</b>.</p>

  <p class="section">ĐIỀU 2: GIÁ THUÊ, TIỀN ĐẶT CỌC VÀ THANH TOÁN</p>
  <p>2.1. Giá thuê phòng hàng tháng: <b>${esc(money(c.monthly_rent))}</b> / tháng <i>(Bằng chữ: ${esc(moneyToWords(c.monthly_rent))})</i>.</p>
  <p>2.2. Tiền đặt cọc đảm bảo thực hiện hợp đồng: <b>${esc(money(c.deposit))}</b> <i>(Bằng chữ: ${esc(moneyToWords(c.deposit))})</i>. Tiền cọc sẽ được hoàn trả khi kết thúc hợp đồng đúng hạn và không phát sinh hư hỏng, công nợ.</p>
  <p>2.3. Thời hạn thanh toán: Bên B thanh toán tiền phòng và các khoản điện, nước, dịch vụ vào <b>ngày ${esc(c.payment_day)} hằng tháng</b>.</p>

  <p class="section">ĐIỀU 3: ĐIỀU KHOẢN CHUNG VÀ CAM KẾT CỦA HAI BÊN</p>
  <p>${esc(c.terms || 'Hai bên cam kết thực hiện đầy đủ các quy định về an ninh trật tự, phòng cháy chữa cháy và giữ gìn vệ sinh chung.')}</p>
  <p>Hợp đồng được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản.</p>

  ${endSection}

  <table class="sig">
    <tr>
      <td>
        <p class="center bold">ĐẠI DIỆN BÊN A (CHO THUÊ)</p>
        <p class="center italic">(Ký và ghi rõ họ tên)</p>
        <br/><br/><br/>
        <p class="center bold">Chủ nhà 57 Giảng Võ</p>
      </td>
      <td>
        <p class="center bold">ĐẠI DIỆN BÊN B (NGƯỜI THUÊ)</p>
        <p class="center italic">(Ký và ghi rõ họ tên)</p>
        <br/><br/><br/>
        <p class="center bold">${esc(c.tenant_name)}</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export default function ContractWordModal({ contract, initialMode = 'view', canEdit = false, onClose, onSaved }) {
  const { toast } = useFeedback();
  const [doc, setDoc] = useState(contract);
  const [mode, setMode] = useState(initialMode);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});
  const terminateRef = useRef(null);

  useEffect(() => {
    if (!contract) return;
    setDoc(contract);
    setMode(initialMode);
    initForm(contract, initialMode);
  }, [contract, initialMode]);

  useEffect(() => {
    if (!contract) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [contract, onClose]);

  useEffect(() => {
    if (mode === 'terminate') {
      setTimeout(() => terminateRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
    }
  }, [mode]);

  if (!contract || !doc) return null;

  function initForm(c, targetMode) {
    setForm({
      end_date: targetMode === 'extend' ? addMonths(c.end_date, 6) : c.end_date,
      monthly_rent: c.monthly_rent,
      deposit: c.deposit,
      payment_day: c.payment_day,
      occupants: c.occupants,
      terms: c.terms || '',
      ended_at: c.ended_at || today(),
      end_reason: c.end_reason || '',
    });
  }

  const switchMode = (nextMode) => {
    initForm(doc, nextMode);
    setMode(nextMode);
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      let updated;
      if (mode === 'edit') {
        updated = await api.put(`/contracts/${doc.id}`, {
          end_date: form.end_date,
          monthly_rent: form.monthly_rent,
          deposit: form.deposit,
          payment_day: form.payment_day,
          occupants: form.occupants,
          terms: form.terms,
        });
        toast('Đã cập nhật trực tiếp lên hợp đồng');
      } else if (mode === 'extend') {
        updated = await api.post(`/contracts/${doc.id}/extend`, {
          end_date: form.end_date,
          monthly_rent: form.monthly_rent,
        });
        toast('Đã gia hạn hợp đồng thành công');
      } else if (mode === 'terminate') {
        updated = await api.post(`/contracts/${doc.id}/terminate`, {
          ended_at: form.ended_at,
          end_reason: form.end_reason,
        });
        toast('Đã thanh lý hợp đồng & chuyển phòng về "Phòng trống"');
      }
      if (updated) {
        setDoc(updated);
        setMode('view');
        onSaved?.(updated);
      }
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const downloadWord = () => {
    const html = `\ufeff${buildWordHtml(doc)}`;
    const blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HopDong_${doc.code}_Phong_${doc.room_code}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printWord = () => {
    const win = window.open('', '_blank', 'width=900,height=900');
    if (!win) {
      toast('Trình duyệt đã chặn cửa sổ in, vui lòng cho phép popup', 'error');
      return;
    }
    win.document.write(buildWordHtml(doc));
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 250);
  };

  const isEditing = mode === 'edit';
  const isExtending = mode === 'extend';
  const isTerminating = mode === 'terminate';
  const startParts = splitDateParts(doc.start_date);
  const currentRent = isEditing || isExtending ? form.monthly_rent : doc.monthly_rent;
  const currentDeposit = isEditing ? form.deposit : doc.deposit;

  const inlineInput = 'inline-block rounded border-b-2 border-dashed border-blue-500 bg-blue-50/90 px-2 py-0.5 font-sans text-sm font-semibold text-blue-900 outline-none focus:border-solid focus:bg-white focus:ring-2 focus:ring-blue-200';
  const extendInput = 'inline-block rounded border-b-2 border-dashed border-amber-500 bg-amber-50/90 px-2 py-0.5 font-sans text-sm font-semibold text-amber-900 outline-none focus:border-solid focus:bg-white focus:ring-2 focus:ring-amber-200';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/65 backdrop-blur-[1px]">
      {/* Thanh tiêu đề kiểu Microsoft Word */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#2b579a] px-4 py-2.5 text-white shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 font-serif text-base font-bold">
            W
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">
              HopDong_{doc.code}_Phong_{doc.room_code}.doc
            </p>
            <p className="text-[11px] text-blue-100">
              {mode === 'view' && 'Chế độ xem bản Word — Nhà 57 Giảng Võ'}
              {mode === 'edit' && 'Đang chỉnh sửa trực tiếp các điều khoản trên văn bản'}
              {mode === 'extend' && 'Đang gia hạn thời hạn & giá thuê trực tiếp trên văn bản'}
              {mode === 'terminate' && 'Đang lập biên bản thanh lý / kết thúc hợp đồng trên văn bản'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {mode === 'view' ? (
            <>
              {canEdit && doc.status === 'active' && (
                <>
                  <button
                    type="button"
                    onClick={() => switchMode('edit')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/25"
                  >
                    <Edit3 className="h-3.5 w-3.5" /> Cập nhật
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode('extend')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/90 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-500"
                  >
                    <CalendarPlus className="h-3.5 w-3.5" /> Gia hạn
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode('terminate')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/90 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-500"
                  >
                    <XOctagon className="h-3.5 w-3.5" /> Kết thúc HĐ
                  </button>
                  <span className="mx-1 hidden h-5 w-px bg-white/25 sm:inline-block" />
                </>
              )}
              <button
                type="button"
                onClick={downloadWord}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#2b579a] shadow-sm transition hover:bg-blue-50"
              >
                <Download className="h-3.5 w-3.5" /> Tải file Word (.doc)
              </button>
              <button
                type="button"
                onClick={printWord}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/25"
              >
                <Printer className="h-3.5 w-3.5" /> In
              </button>
            </>
          ) : (
            <>
              <Button size="sm" variant="secondary" onClick={() => setMode('view')} disabled={saving}>
                Hủy chỉnh sửa
              </Button>
              <Button
                size="sm"
                variant={isTerminating ? 'danger' : 'success'}
                icon={isTerminating ? Check : Save}
                loading={saving}
                onClick={handleSave}
              >
                {isEditing && 'Lưu cập nhật vào hợp đồng'}
                {isExtending && 'Xác nhận gia hạn hợp đồng'}
                {isTerminating && 'Xác nhận kết thúc hợp đồng'}
              </Button>
            </>
          )}

          <button
            type="button"
            onClick={onClose}
            className="ml-1 rounded-lg p-1.5 text-blue-100 transition hover:bg-white/15 hover:text-white"
            title="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Thanh thông báo hướng dẫn khi đang chỉnh sửa trực tiếp */}
      {mode !== 'view' && (
        <div
          className={`flex flex-wrap items-center justify-between gap-2 border-b px-5 py-2 text-xs font-medium ${
            isTerminating
              ? 'border-red-200 bg-red-50 text-red-800'
              : isExtending
                ? 'border-amber-200 bg-amber-50 text-amber-900'
                : 'border-blue-200 bg-blue-50 text-blue-900'
          }`}
        >
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4 shrink-0" />
            {isEditing && 'Bấm trực tiếp vào các ô tô xanh trên văn bản hợp đồng bên dưới để sửa số người ở, ngày kết thúc, giá thuê, tiền cọc, ngày thanh toán và điều khoản.'}
            {isExtending && 'Sửa trực tiếp Ngày kết thúc mới (Điều 1) và Giá thuê áp dụng (Điều 2) ngay trên văn bản hợp đồng.'}
            {isTerminating && 'Điền trực tiếp Ngày thanh lý và Lý do vào khung Biên bản thanh lý màu đỏ ở cuối hợp đồng. Phòng sẽ tự động chuyển về trạng thái "Phòng trống".'}
          </span>
          {isExtending && (
            <div className="flex items-center gap-1.5">
              <span className="text-amber-700">Gia hạn nhanh:</span>
              {[3, 6, 12].map((months) => (
                <button
                  key={months}
                  type="button"
                  onClick={() => setForm({ ...form, end_date: addMonths(doc.end_date, months) })}
                  className="rounded-md bg-white px-2 py-0.5 text-xs font-semibold text-amber-800 shadow-sm ring-1 ring-amber-300 hover:bg-amber-100"
                >
                  +{months} tháng
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Không gian trang giấy A4 kiểu Word */}
      <div className="flex-1 overflow-y-auto bg-slate-200/90 p-3 sm:p-8">
        <form
          onSubmit={handleSave}
          style={{ fontFamily: '"Times New Roman", Times, serif' }}
          className="relative mx-auto min-h-[1040px] max-w-[820px] rounded-sm border border-slate-300 bg-white px-6 py-8 text-[15px] leading-relaxed text-slate-900 shadow-xl sm:px-14 sm:py-12"
        >
          {/* Con dấu ĐÃ THANH LÝ nếu hợp đồng đã kết thúc */}
          {doc.status === 'ended' && (
            <div className="pointer-events-none absolute right-8 top-8 rotate-[-12deg] rounded-lg border-4 border-red-600/70 px-4 py-1.5 font-sans text-sm font-extrabold tracking-widest text-red-600/80">
              ĐÃ THANH LÝ
            </div>
          )}

          {/* Quốc hiệu & Tiêu ngữ */}
          <div className="text-center">
            <p className="text-[15px] font-bold uppercase tracking-wide">
              CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
            </p>
            <p className="text-[15px] font-bold">Độc lập - Tự do - Hạnh phúc</p>
            <p className="mt-0.5 text-sm tracking-widest">---------------o0o---------------</p>
          </div>

          {/* Tiêu đề hợp đồng */}
          <div className="mt-6 text-center">
            <h2 className="text-[22px] font-bold uppercase tracking-wide">
              HỢP ĐỒNG THUÊ PHÒNG TRỌ
            </h2>
            <p className="italic text-slate-700">Số: {doc.code}/HĐTP</p>
          </div>

          <p className="mt-4 text-right italic">
            Hà Nội, ngày {startParts.day} tháng {startParts.month} năm {startParts.year}
          </p>

          <p className="mt-3">Hôm nay, chúng tôi gồm có:</p>

          {/* Bên A */}
          <div className="mt-4">
            <h3 className="font-bold uppercase">BÊN CHO THUÊ (BÊN A):</h3>
            <p>- Đại diện chủ nhà: <strong>Chủ nhà 57 Giảng Võ</strong></p>
            <p>- Địa chỉ khu nhà cho thuê: <strong>57 Giảng Võ, Đống Đa, Hà Nội</strong></p>
            <p>- Số điện thoại liên hệ: <strong>0988 000 057</strong></p>
          </div>

          {/* Bên B */}
          <div className="mt-4">
            <h3 className="font-bold uppercase">BÊN THUÊ PHÒNG (BÊN B):</h3>
            <p>- Ông/Bà: <strong>{doc.tenant_name}</strong></p>
            <p>
              - Số CCCD/CMND: <strong>{doc.tenant_id_card || '........................'}</strong>
              <span className="ml-6">Điện thoại: <strong>{doc.tenant_phone || '........................'}</strong></span>
            </p>
            <p>- Địa chỉ thường trú: <strong>{doc.tenant_hometown || '................................................'}</strong></p>
          </div>

          <p className="mt-4">
            Sau khi bàn bạc, thỏa thuận, hai bên thống nhất ký kết hợp đồng thuê phòng với các điều khoản sau đây:
          </p>

          {/* Điều 1 */}
          <div className="mt-4 space-y-1.5">
            <h3 className="font-bold uppercase">ĐIỀU 1: ĐỐI TƯỢNG VÀ THỜI HẠN CHO THUÊ</h3>
            <p className="text-justify">
              1.1. Bên A đồng ý cho Bên B thuê <strong>Phòng {doc.room_code}</strong> (Tầng {doc.room_floor}, diện tích{' '}
              <strong>{doc.room_area} m²</strong>) tại địa chỉ 57 Giảng Võ, Đống Đa, Hà Nội.
            </p>
            <p>
              1.2. Số lượng người đăng ký ở tại phòng:{' '}
              {isEditing ? (
                <input
                  type="number"
                  min="1"
                  required
                  value={form.occupants}
                  onChange={(e) => setForm({ ...form, occupants: e.target.value })}
                  className={`${inlineInput} w-20 text-center`}
                />
              ) : (
                <strong>{doc.occupants}</strong>
              )}{' '}
              người.
            </p>
            <p>
              1.3. Thời hạn thuê: Từ ngày <strong>{date(doc.start_date)}</strong> đến hết ngày{' '}
              {isEditing || isExtending ? (
                <input
                  type="date"
                  required
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className={isExtending ? extendInput : inlineInput}
                />
              ) : (
                <strong>{date(doc.end_date)}</strong>
              )}
              .
              {isExtending && (
                <span className="ml-2 font-sans text-xs font-medium text-amber-700">
                  (Hạn cũ: {date(doc.end_date)})
                </span>
              )}
            </p>
          </div>

          {/* Phụ lục gia hạn nổi bật khi đang ở chế độ gia hạn */}
          {isExtending && (
            <div className="mt-4 rounded-lg border-2 border-dashed border-amber-400 bg-amber-50/70 p-4 font-sans text-sm text-amber-950">
              <p className="font-bold uppercase text-amber-800">Phụ lục gia hạn hợp đồng</p>
              <p className="mt-1">
                Thời hạn hợp đồng được gia hạn từ ngày <strong>{date(doc.end_date)}</strong> đến hết ngày{' '}
                <strong>{date(form.end_date)}</strong> với mức giá thuê áp dụng{' '}
                <strong>{money(form.monthly_rent)}/tháng</strong>.
              </p>
            </div>
          )}

          {/* Điều 2 */}
          <div className="mt-4 space-y-1.5">
            <h3 className="font-bold uppercase">ĐIỀU 2: GIÁ THUÊ, TIỀN ĐẶT CỌC VÀ THANH TOÁN</h3>
            <p className="text-justify">
              2.1. Giá thuê phòng hàng tháng:{' '}
              {isEditing || isExtending ? (
                <input
                  type="number"
                  min="0"
                  step="50000"
                  required
                  value={form.monthly_rent}
                  onChange={(e) => setForm({ ...form, monthly_rent: e.target.value })}
                  className={`${isExtending ? extendInput : inlineInput} w-40`}
                />
              ) : (
                <strong>{money(doc.monthly_rent)}</strong>
              )}{' '}
              {isEditing || isExtending ? 'VNĐ / tháng' : '/ tháng'}{' '}
              <span className="italic">(Bằng chữ: {moneyToWords(currentRent)})</span>.
            </p>
            <p className="text-justify">
              2.2. Tiền đặt cọc đảm bảo thực hiện hợp đồng:{' '}
              {isEditing ? (
                <input
                  type="number"
                  min="0"
                  step="50000"
                  required
                  value={form.deposit}
                  onChange={(e) => setForm({ ...form, deposit: e.target.value })}
                  className={`${inlineInput} w-40`}
                />
              ) : (
                <strong>{money(doc.deposit)}</strong>
              )}{' '}
              {isEditing ? 'VNĐ ' : ''}
              <span className="italic">(Bằng chữ: {moneyToWords(currentDeposit)})</span>. Tiền cọc sẽ được hoàn trả khi kết thúc hợp đồng đúng hạn và không phát sinh hư hỏng, công nợ.
            </p>
            <p className="text-justify">
              2.3. Thời hạn thanh toán: Bên B thanh toán tiền phòng và các khoản điện, nước, dịch vụ vào{' '}
              <strong>
                ngày{' '}
                {isEditing ? (
                  <input
                    type="number"
                    min="1"
                    max="28"
                    required
                    value={form.payment_day}
                    onChange={(e) => setForm({ ...form, payment_day: e.target.value })}
                    className={`${inlineInput} w-16 text-center`}
                  />
                ) : (
                  doc.payment_day
                )}{' '}
                hằng tháng
              </strong>
              .
            </p>
          </div>

          {/* Điều 3 */}
          <div className="mt-4 space-y-1.5">
            <h3 className="font-bold uppercase">ĐIỀU 3: ĐIỀU KHOẢN CHUNG VÀ CAM KẾT CỦA HAI BÊN</h3>
            {isEditing ? (
              <textarea
                rows={4}
                value={form.terms}
                onChange={(e) => setForm({ ...form, terms: e.target.value })}
                placeholder="Nhập điều khoản bổ sung của hợp đồng..."
                className="mt-1 w-full rounded-lg border-2 border-dashed border-blue-400 bg-blue-50/70 p-3 font-serif text-[15px] leading-relaxed text-slate-900 outline-none focus:border-solid focus:bg-white focus:ring-2 focus:ring-blue-200"
              />
            ) : (
              <p className="whitespace-pre-line text-justify">
                {doc.terms || 'Hai bên cam kết thực hiện đầy đủ các quy định về an ninh trật tự, phòng cháy chữa cháy và giữ gìn vệ sinh chung.'}
              </p>
            )}
            <p className="text-justify">
              Hợp đồng được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản để thực hiện.
            </p>
          </div>

          {/* Biên bản thanh lý (hiện khi hợp đồng đã kết thúc hoặc đang thao tác kết thúc) */}
          {(doc.status === 'ended' || isTerminating) && (
            <div
              ref={terminateRef}
              className="mt-6 rounded-lg border-2 border-red-400 bg-red-50/70 p-4"
            >
              <h3 className="text-center font-bold uppercase text-red-800">
                BIÊN BẢN THANH LÝ / CHẤM DỨT HỢP ĐỒNG
              </h3>
              <div className="mt-3 space-y-2">
                <p>
                  - Ngày chấm dứt / thanh lý hợp đồng:{' '}
                  {isTerminating ? (
                    <input
                      type="date"
                      required
                      value={form.ended_at}
                      onChange={(e) => setForm({ ...form, ended_at: e.target.value })}
                      className="inline-block rounded border-b-2 border-dashed border-red-500 bg-white px-2 py-0.5 font-sans text-sm font-semibold text-red-900 outline-none focus:border-solid focus:ring-2 focus:ring-red-200"
                    />
                  ) : (
                    <strong>{date(doc.ended_at || doc.end_date)}</strong>
                  )}
                </p>
                <div>
                  <p>- Lý do / ghi chú thanh lý:</p>
                  {isTerminating ? (
                    <textarea
                      rows={3}
                      value={form.end_reason}
                      onChange={(e) => setForm({ ...form, end_reason: e.target.value })}
                      placeholder="VD: Hết hạn hợp đồng, khách chuyển công tác, đã bàn giao phòng và hoàn trả tiền cọc..."
                      className="mt-1 w-full rounded-lg border-2 border-dashed border-red-400 bg-white p-2.5 font-serif text-[15px] text-slate-900 outline-none focus:border-solid focus:ring-2 focus:ring-red-200"
                    />
                  ) : (
                    <p className="pl-3 italic">
                      {doc.end_reason || 'Hai bên thống nhất thanh lý hợp đồng và bàn giao lại phòng.'}
                    </p>
                  )}
                </div>
                <p className="text-sm text-red-900">
                  - Kết quả: <strong>Phòng {doc.room_code}</strong> được bàn giao lại cho Bên A và chuyển về trạng thái <strong>Phòng trống</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Phần ký tên */}
          <div className="mt-10 grid grid-cols-2 gap-6 text-center">
            <div>
              <p className="font-bold uppercase">ĐẠI DIỆN BÊN A (CHO THUÊ)</p>
              <p className="text-sm italic">(Ký và ghi rõ họ tên)</p>
              <div className="h-20" />
              <p className="font-bold">Chủ nhà 57 Giảng Võ</p>
            </div>
            <div>
              <p className="font-bold uppercase">ĐẠI DIỆN BÊN B (NGƯỜI THUÊ)</p>
              <p className="text-sm italic">(Ký và ghi rõ họ tên)</p>
              <div className="h-20" />
              <p className="font-bold">{doc.tenant_name}</p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
