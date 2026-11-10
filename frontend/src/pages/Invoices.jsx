import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, CreditCard, Eye, Plus, Printer, Receipt, Trash2 } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../context/FeedbackContext';
import { useApi, useDebounce } from '../hooks/useApi';
import {
  currentPeriod, date, datetime, INVOICE_STATUS, METHOD, money, period, shiftPeriod,
} from '../utils/format';
import {
  Badge, Button, Card, EmptyState, ErrorBox, IconButton, InfoRow, Input, Modal, PageHeader,
  SearchInput, Select, Spinner, StatusBadge, Textarea,
} from '../components/ui';

export default function Invoices() {
  const { isAdmin } = useAuth();
  const { toast, confirm } = useFeedback();
  const [params] = useSearchParams();

  const [search, setSearch] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('');
  const [status, setStatus] = useState(params.get('status') || '');
  const q = useDebounce(search);

  const { data, loading, error, reload } = useApi(
    () => api.get('/invoices', { search: q, period: filterPeriod, status }),
    [q, filterPeriod, status],
  );

  const [genModal, setGenModal] = useState(null);
  const [payModal, setPayModal] = useState(null);
  const [detail, setDetail] = useState(null);
  const [saving, setSaving] = useState(false);

  const openDetail = async (id) => {
    try { setDetail(await api.get(`/invoices/${id}`)); } catch (e) { toast(e.message, 'error'); }
  };

  const generate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post('/invoices/generate', genModal);
      toast(res.message);
      setGenModal(null);
      reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmPayment = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.post(`/invoices/${payModal.invoice.id}/payments`, {
        amount: payModal.amount,
        method: payModal.method,
        note: payModal.note,
      });
      toast('Đã xác nhận thanh toán & gửi thông báo cho người thuê');
      setPayModal(null);
      if (detail?.id === updated.id) setDetail(updated);
      reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (inv) => {
    const ok = await confirm({ title: `Xóa hóa đơn ${inv.code}?`, danger: true });
    if (!ok) return;
    try {
      await api.del(`/invoices/${inv.id}`);
      toast('Đã xóa hóa đơn');
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const summary = data?.summary || { total: 0, paid: 0, remaining: 0 };

  return (
    <div>
      <PageHeader
        title={isAdmin ? 'Quản lý hóa đơn & công nợ' : 'Hóa đơn & công nợ của tôi'}
        subtitle="Tổng hợp tiền phòng, điện, nước và phí dịch vụ theo từng kỳ; theo dõi hạn thanh toán"
        actions={isAdmin && (
          <Button
            icon={Plus}
            onClick={() => setGenModal({ period: shiftPeriod(currentPeriod(), -1), due_date: '' })}
          >
            Xuất hóa đơn hàng kỳ
          </Button>
        )}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs text-slate-500">Tổng tiền hóa đơn (theo bộ lọc)</p>
          <p className="mt-1 text-xl font-bold text-slate-800">{money(summary.total)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500">Đã thanh toán</p>
          <p className="mt-1 text-xl font-bold text-emerald-600">{money(summary.paid)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500">Công nợ còn lại</p>
          <p className="mt-1 text-xl font-bold text-red-600">{money(summary.remaining)}</p>
        </div>
      </div>

      <Card bodyClass="p-4" className="mb-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo mã HĐ, mã phòng, người thuê..." />
          <Input type="month" value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)} />
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tất cả trạng thái</option>
            <option value="debt">Còn công nợ (Chưa trả đủ)</option>
            <option value="unpaid">Chưa thanh toán</option>
            <option value="partial">Thanh toán một phần</option>
            <option value="paid">Đã thanh toán</option>
          </Select>
        </div>
      </Card>

      <Card bodyClass="p-0">
        {loading ? <Spinner /> : error ? <div className="p-4"><ErrorBox error={error} onRetry={reload} /></div> : data.items.length === 0 ? (
          <EmptyState title="Chưa có hóa đơn nào" icon={Receipt} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã hóa đơn</th>
                  <th>Kỳ</th>
                  <th>Phòng / Người thuê</th>
                  <th>Tổng tiền</th>
                  <th>Đã trả</th>
                  <th>Còn nợ</th>
                  <th>Hạn TT</th>
                  <th>Trạng thái</th>
                  <th className="text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((inv) => (
                  <tr key={inv.id}>
                    <td className="font-semibold text-slate-800">{inv.code}</td>
                    <td>{period(inv.period)}</td>
                    <td>
                      <p className="font-medium text-slate-800">Phòng {inv.room_code}</p>
                      <p className="text-xs text-slate-500">{inv.tenant_name}</p>
                    </td>
                    <td className="font-semibold">{money(inv.total)}</td>
                    <td className="text-emerald-600">{money(inv.paid_amount)}</td>
                    <td className={inv.remaining > 0 ? 'font-semibold text-red-600' : 'text-slate-400'}>
                      {money(inv.remaining)}
                    </td>
                    <td>
                      <span>{date(inv.due_date)}</span>
                      {inv.overdue && <Badge color="red" className="ml-1.5">Quá hạn</Badge>}
                    </td>
                    <td><StatusBadge map={INVOICE_STATUS} value={inv.status} /></td>
                    <td className="text-right">
                      <IconButton icon={Eye} title="Xem chi tiết" onClick={() => openDetail(inv.id)} />
                      {isAdmin && inv.status !== 'paid' && (
                        <IconButton
                          icon={CheckCircle2}
                          variant="brand"
                          title="Xác nhận thanh toán"
                          onClick={() => setPayModal({ invoice: inv, amount: inv.remaining, method: 'transfer', note: '' })}
                        />
                      )}
                      {isAdmin && inv.paid_amount === 0 && (
                        <IconButton icon={Trash2} variant="danger" title="Xóa hóa đơn" onClick={() => remove(inv)} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Xuất hóa đơn */}
      <Modal open={!!genModal} onClose={() => setGenModal(null)} title="Xuất hóa đơn hàng kỳ" size="sm">
        {genModal && (
          <form onSubmit={generate} className="space-y-4">
            <p className="text-sm text-slate-600">
              Hệ thống sẽ tổng hợp <strong>tiền phòng + điện + nước + dịch vụ</strong> của tất cả phòng đang thuê đã ghi chỉ số điện nước trong kỳ.
            </p>
            <Input label="Kỳ tính tiền" type="month" required value={genModal.period} onChange={(e) => setGenModal({ ...genModal, period: e.target.value })} />
            <Input
              label="Hạn thanh toán (để trống = theo ngày hẹn trong HĐ)"
              type="date"
              value={genModal.due_date}
              onChange={(e) => setGenModal({ ...genModal, due_date: e.target.value })}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setGenModal(null)}>Hủy</Button>
              <Button type="submit" loading={saving}>Tạo & Xuất hóa đơn</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Xác nhận thanh toán */}
      <Modal open={!!payModal} onClose={() => setPayModal(null)} title="Xác nhận thanh toán hóa đơn" size="sm">
        {payModal && (
          <form onSubmit={confirmPayment} className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-slate-800">{payModal.invoice.code} — Phòng {payModal.invoice.room_code}</p>
              <p className="text-slate-600">Người thuê: {payModal.invoice.tenant_name}</p>
              <p className="mt-1">Số tiền còn phải thu: <strong className="text-red-600">{money(payModal.invoice.remaining)}</strong></p>
            </div>
            <Input
              label="Số tiền thực nhận (đ)"
              type="number"
              min="1000"
              max={payModal.invoice.remaining}
              required
              value={payModal.amount}
              onChange={(e) => setPayModal({ ...payModal, amount: e.target.value })}
            />
            <Select label="Hình thức thanh toán" value={payModal.method} onChange={(e) => setPayModal({ ...payModal, method: e.target.value })}>
              <option value="transfer">Chuyển khoản ngân hàng</option>
              <option value="cash">Tiền mặt</option>
              <option value="other">Khác</option>
            </Select>
            <Textarea label="Ghi chú giao dịch" value={payModal.note} onChange={(e) => setPayModal({ ...payModal, note: e.target.value })} placeholder="Mã giao dịch ngân hàng, người nộp..." />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setPayModal(null)}>Hủy</Button>
              <Button type="submit" variant="success" icon={CreditCard} loading={saving}>Xác nhận đã thu</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Chi tiết hóa đơn */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `Hóa đơn ${detail.code}` : ''} size="lg">
        {detail && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl bg-slate-50 p-4">
              <div>
                <p className="text-xs text-slate-500">Nhà 57 Giảng Võ • Kỳ {period(detail.period)}</p>
                <h4 className="text-lg font-bold text-slate-800">Phòng {detail.room_code} — {detail.tenant_name}</h4>
                <p className="text-xs text-slate-500">Ngày lập: {date(detail.issue_date)} • Hạn thanh toán: <strong>{date(detail.due_date)}</strong></p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge map={INVOICE_STATUS} value={detail.status} />
                <Button size="sm" variant="secondary" icon={Printer} onClick={() => window.print()}>In</Button>
              </div>
            </div>

            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Khoản mục</th><th>Số lượng</th><th>Đơn giá</th><th className="text-right">Thành tiền</th></tr>
                </thead>
                <tbody>
                  {detail.items.map((it) => (
                    <tr key={it.id}>
                      <td className="font-medium">{it.description}</td>
                      <td>{it.quantity}</td>
                      <td>{money(it.unit_price)}</td>
                      <td className="text-right font-semibold">{money(it.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ml-auto max-w-xs space-y-1">
              <InfoRow label="Tổng cộng">{money(detail.total)}</InfoRow>
              <InfoRow label="Đã thanh toán"><span className="text-emerald-600">{money(detail.paid_amount)}</span></InfoRow>
              <InfoRow label="Còn phải thanh toán"><span className="text-base font-bold text-red-600">{money(detail.remaining)}</span></InfoRow>
            </div>

            <div>
              <h5 className="mb-2 text-sm font-semibold text-slate-700">Lịch sử thanh toán của hóa đơn</h5>
              {detail.payments.length === 0 ? (
                <p className="text-sm text-slate-400">Chưa có giao dịch thanh toán</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Thời gian</th><th>Số tiền</th><th>Hình thức</th><th>Người xác nhận</th><th>Ghi chú</th></tr></thead>
                    <tbody>
                      {detail.payments.map((p) => (
                        <tr key={p.id}>
                          <td>{datetime(p.paid_at)}</td>
                          <td className="font-semibold text-emerald-600">{money(p.amount)}</td>
                          <td>{METHOD[p.method]}</td>
                          <td>{p.confirmed_by_name || '—'}</td>
                          <td>{p.note || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {isAdmin && detail.status !== 'paid' && (
              <div className="flex justify-end">
                <Button
                  variant="success"
                  icon={CheckCircle2}
                  onClick={() => setPayModal({ invoice: detail, amount: detail.remaining, method: 'transfer', note: '' })}
                >
                  Xác nhận thanh toán
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
