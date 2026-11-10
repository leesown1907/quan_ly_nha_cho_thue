import { useState } from 'react';
import { CalendarPlus, Edit3, Eye, FileText, Plus, XOctagon } from 'lucide-react';
import { api } from '../api';
import { useFeedback } from '../context/FeedbackContext';
import { useApi, useDebounce } from '../hooks/useApi';
import { addMonths, CONTRACT_STATUS, date, money, today } from '../utils/format';
import {
  Badge, Button, Card, EmptyState, ErrorBox, IconButton, InfoRow, Input, Modal, PageHeader,
  SearchInput, Select, Spinner, StatusBadge, Textarea,
} from '../components/ui';

export default function Contracts() {
  const { toast } = useFeedback();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const q = useDebounce(search);

  const { data: contracts, loading, error, reload } = useApi(
    () => api.get('/contracts', { search: q, status }),
    [q, status],
  );

  const [createModal, setCreateModal] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [extendModal, setExtendModal] = useState(null);
  const [termModal, setTermModal] = useState(null);
  const [detail, setDetail] = useState(null);
  const [saving, setSaving] = useState(false);

  const openCreate = async () => {
    try {
      const [rooms, tenants] = await Promise.all([
        api.get('/rooms', { status: 'available' }),
        api.get('/tenants'),
      ]);
      const r0 = rooms[0];
      const start = today();
      setCreateModal({
        rooms,
        tenants,
        room_id: r0?.id || '',
        tenant_id: tenants[0]?.id || '',
        start_date: start,
        end_date: addMonths(start, 12),
        monthly_rent: r0?.base_price || 3500000,
        deposit: r0?.base_price || 3500000,
        payment_day: 5,
        occupants: 1,
        terms: 'Thanh toán trước ngày 5 hằng tháng. Giữ gìn vệ sinh, an ninh chung. Báo trước 30 ngày khi chấm dứt hợp đồng.',
      });
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const onRoomSelect = (roomId) => {
    const r = createModal.rooms.find((x) => x.id === Number(roomId));
    setCreateModal({
      ...createModal,
      room_id: roomId,
      monthly_rent: r ? r.base_price : createModal.monthly_rent,
      deposit: r ? r.base_price : createModal.deposit,
    });
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/contracts', createModal);
      toast('Đã lập hợp đồng & chuyển phòng sang trạng thái "Đang cho thuê"');
      setCreateModal(null);
      reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/contracts/${editModal.id}`, editModal);
      toast('Đã cập nhật hợp đồng');
      setEditModal(null);
      reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const submitExtend = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/contracts/${extendModal.id}/extend`, {
        end_date: extendModal.end_date,
        monthly_rent: extendModal.monthly_rent,
      });
      toast('Đã gia hạn hợp đồng');
      setExtendModal(null);
      reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const submitTerminate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/contracts/${termModal.id}/terminate`, {
        ended_at: termModal.ended_at,
        end_reason: termModal.end_reason,
      });
      toast('Đã thanh lý hợp đồng & chuyển phòng về "Phòng trống"');
      setTermModal(null);
      reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Quản lý hợp đồng thuê phòng"
        subtitle="Lập hợp đồng mới, cập nhật điều khoản, gia hạn hoặc thanh lý hợp đồng"
        actions={<Button icon={Plus} onClick={openCreate}>Lập hợp đồng mới</Button>}
      />

      <Card bodyClass="p-4" className="mb-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <SearchInput className="sm:col-span-2" value={search} onChange={setSearch} placeholder="Tìm theo mã HĐ, mã phòng, tên hoặc SĐT người thuê..." />
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tất cả hợp đồng</option>
            <option value="active">Đang hiệu lực</option>
            <option value="ended">Đã kết thúc</option>
          </Select>
        </div>
      </Card>

      <Card bodyClass="p-0">
        {loading ? <Spinner /> : error ? <div className="p-4"><ErrorBox error={error} onRetry={reload} /></div> : contracts.length === 0 ? (
          <EmptyState title="Chưa có hợp đồng nào" icon={FileText} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã HĐ</th>
                  <th>Phòng</th>
                  <th>Người thuê</th>
                  <th>Thời hạn</th>
                  <th>Giá thuê</th>
                  <th>Tiền cọc</th>
                  <th>Trạng thái</th>
                  <th className="text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => (
                  <tr key={c.id}>
                    <td className="font-semibold text-slate-800">{c.code}</td>
                    <td><Badge color="blue">Phòng {c.room_code}</Badge></td>
                    <td>
                      <p className="font-medium text-slate-800">{c.tenant_name}</p>
                      <p className="text-xs text-slate-500">{c.tenant_phone} • {c.occupants} người</p>
                    </td>
                    <td>
                      <p>{date(c.start_date)} → {date(c.ended_at || c.end_date)}</p>
                      {c.status === 'active' && c.days_left <= 30 && (
                        <span className="text-xs font-medium text-amber-600">
                          {c.days_left < 0 ? `Quá hạn ${-c.days_left} ngày` : `Còn ${c.days_left} ngày`}
                        </span>
                      )}
                    </td>
                    <td className="font-medium">{money(c.monthly_rent)}</td>
                    <td>{money(c.deposit)}</td>
                    <td><StatusBadge map={CONTRACT_STATUS} value={c.status} /></td>
                    <td className="text-right">
                      <IconButton icon={Eye} title="Xem hợp đồng" onClick={() => setDetail(c)} />
                      {c.status === 'active' && (
                        <>
                          <IconButton icon={Edit3} title="Sửa điều khoản" onClick={() => setEditModal({ ...c })} />
                          <IconButton
                            icon={CalendarPlus}
                            variant="brand"
                            title="Gia hạn hợp đồng"
                            onClick={() => setExtendModal({ ...c, end_date: addMonths(c.end_date, 6) })}
                          />
                          <IconButton
                            icon={XOctagon}
                            variant="danger"
                            title="Kết thúc / Thanh lý"
                            onClick={() => setTermModal({ ...c, ended_at: today(), end_reason: '' })}
                          />
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Lập hợp đồng */}
      <Modal open={!!createModal} onClose={() => setCreateModal(null)} title="Lập hợp đồng thuê phòng mới" size="lg">
        {createModal && (createModal.rooms.length === 0 ? (
          <p className="text-sm text-slate-600">Hiện không có phòng trống để lập hợp đồng mới.</p>
        ) : (
          <form onSubmit={submitCreate} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Phòng trống" required value={createModal.room_id} onChange={(e) => onRoomSelect(e.target.value)}>
                {createModal.rooms.map((r) => (
                  <option key={r.id} value={r.id}>Phòng {r.code} — {r.area}m² — {money(r.base_price)}</option>
                ))}
              </Select>
              <Select label="Người thuê" required value={createModal.tenant_id} onChange={(e) => setCreateModal({ ...createModal, tenant_id: e.target.value })}>
                {createModal.tenants.map((t) => (
                  <option key={t.id} value={t.id}>{t.full_name} ({t.phone})</option>
                ))}
              </Select>
              <Input label="Ngày bắt đầu" type="date" required value={createModal.start_date} onChange={(e) => setCreateModal({ ...createModal, start_date: e.target.value })} />
              <Input label="Ngày kết thúc" type="date" required value={createModal.end_date} onChange={(e) => setCreateModal({ ...createModal, end_date: e.target.value })} />
              <Input label="Giá thuê (đ/tháng)" type="number" step="50000" required value={createModal.monthly_rent} onChange={(e) => setCreateModal({ ...createModal, monthly_rent: e.target.value })} />
              <Input label="Tiền đặt cọc (đ)" type="number" step="50000" required value={createModal.deposit} onChange={(e) => setCreateModal({ ...createModal, deposit: e.target.value })} />
              <Input label="Số người ở" type="number" min="1" required value={createModal.occupants} onChange={(e) => setCreateModal({ ...createModal, occupants: e.target.value })} />
              <Input label="Ngày hẹn thanh toán hàng tháng" type="number" min="1" max="28" required value={createModal.payment_day} onChange={(e) => setCreateModal({ ...createModal, payment_day: e.target.value })} />
            </div>
            <Textarea label="Điều khoản hợp đồng" value={createModal.terms} onChange={(e) => setCreateModal({ ...createModal, terms: e.target.value })} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setCreateModal(null)}>Hủy</Button>
              <Button type="submit" loading={saving}>Lập hợp đồng</Button>
            </div>
          </form>
        ))}
      </Modal>

      {/* Sửa hợp đồng */}
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title={editModal ? `Cập nhật hợp đồng ${editModal.code}` : ''}>
        {editModal && (
          <form onSubmit={submitEdit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Ngày kết thúc" type="date" required value={editModal.end_date} onChange={(e) => setEditModal({ ...editModal, end_date: e.target.value })} />
              <Input label="Giá thuê (đ/tháng)" type="number" step="50000" required value={editModal.monthly_rent} onChange={(e) => setEditModal({ ...editModal, monthly_rent: e.target.value })} />
              <Input label="Tiền cọc (đ)" type="number" step="50000" required value={editModal.deposit} onChange={(e) => setEditModal({ ...editModal, deposit: e.target.value })} />
              <Input label="Số người ở" type="number" min="1" required value={editModal.occupants} onChange={(e) => setEditModal({ ...editModal, occupants: e.target.value })} />
            </div>
            <Textarea label="Điều khoản" value={editModal.terms || ''} onChange={(e) => setEditModal({ ...editModal, terms: e.target.value })} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditModal(null)}>Hủy</Button>
              <Button type="submit" loading={saving}>Lưu thay đổi</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Gia hạn */}
      <Modal open={!!extendModal} onClose={() => setExtendModal(null)} title={extendModal ? `Gia hạn hợp đồng ${extendModal.code}` : ''} size="sm">
        {extendModal && (
          <form onSubmit={submitExtend} className="space-y-4">
            <p className="text-sm text-slate-600">
              Phòng <strong>{extendModal.room_code}</strong> — {extendModal.tenant_name}. Hạn hiện tại: <strong>{date(extendModal.end_date)}</strong>.
            </p>
            <Input label="Gia hạn đến ngày" type="date" required value={extendModal.end_date} onChange={(e) => setExtendModal({ ...extendModal, end_date: e.target.value })} />
            <Input label="Giá thuê áp dụng (đ/tháng)" type="number" step="50000" required value={extendModal.monthly_rent} onChange={(e) => setExtendModal({ ...extendModal, monthly_rent: e.target.value })} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setExtendModal(null)}>Hủy</Button>
              <Button type="submit" loading={saving}>Xác nhận gia hạn</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Kết thúc */}
      <Modal open={!!termModal} onClose={() => setTermModal(null)} title={termModal ? `Thanh lý hợp đồng ${termModal.code}` : ''} size="sm">
        {termModal && (
          <form onSubmit={submitTerminate} className="space-y-4">
            <p className="text-sm text-slate-600">
              Khi kết thúc hợp đồng, phòng <strong>{termModal.room_code}</strong> sẽ tự động chuyển về trạng thái <strong>Phòng trống</strong>.
            </p>
            <Input label="Ngày thanh lý" type="date" required value={termModal.ended_at} onChange={(e) => setTermModal({ ...termModal, ended_at: e.target.value })} />
            <Textarea label="Lý do / ghi chú thanh lý" value={termModal.end_reason} onChange={(e) => setTermModal({ ...termModal, end_reason: e.target.value })} placeholder="Hết hạn hợp đồng, khách trả phòng..." />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setTermModal(null)}>Hủy</Button>
              <Button type="submit" variant="danger" loading={saving}>Xác nhận kết thúc</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Chi tiết */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `Chi tiết hợp đồng ${detail.code}` : ''}>
        {detail && (
          <div className="space-y-3">
            <InfoRow label="Mã hợp đồng">{detail.code}</InfoRow>
            <InfoRow label="Trạng thái"><StatusBadge map={CONTRACT_STATUS} value={detail.status} /></InfoRow>
            <InfoRow label="Phòng">Phòng {detail.room_code} (Tầng {detail.room_floor} • {detail.room_area} m²)</InfoRow>
            <InfoRow label="Người thuê">{detail.tenant_name} — {detail.tenant_phone}</InfoRow>
            <InfoRow label="CCCD">{detail.tenant_id_card || '—'}</InfoRow>
            <InfoRow label="Số người ở">{detail.occupants} người</InfoRow>
            <InfoRow label="Thời hạn">{date(detail.start_date)} → {date(detail.end_date)}</InfoRow>
            <InfoRow label="Giá thuê hàng tháng">{money(detail.monthly_rent)}</InfoRow>
            <InfoRow label="Tiền đặt cọc">{money(detail.deposit)}</InfoRow>
            <InfoRow label="Ngày thanh toán">Ngày {detail.payment_day} hằng tháng</InfoRow>
            {detail.ended_at && <InfoRow label="Ngày thanh lý">{date(detail.ended_at)} ({detail.end_reason || 'Không ghi lý do'})</InfoRow>}
            {detail.terms && (
              <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                <p className="mb-1 font-semibold text-slate-700">Điều khoản:</p>
                {detail.terms}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
