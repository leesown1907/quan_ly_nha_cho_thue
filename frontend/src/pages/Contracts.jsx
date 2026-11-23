import { useState } from 'react';
import { CalendarPlus, Edit3, Eye, FileText, Plus, XOctagon } from 'lucide-react';
import { api } from '../api';
import { useFeedback } from '../context/FeedbackContext';
import { useApi, useDebounce } from '../hooks/useApi';
import { addMonths, CONTRACT_STATUS, date, money, today } from '../utils/format';
import {
  Badge, Button, Card, EmptyState, ErrorBox, IconButton, Input, Modal, PageHeader,
  SearchInput, Select, Spinner, StatusBadge, Textarea,
} from '../components/ui';
import ContractWordModal from '../components/ContractWordModal';

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
  const [wordModal, setWordModal] = useState(null); // { contract, mode: 'view' | 'edit' | 'extend' | 'terminate' }
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
      const created = await api.post('/contracts', createModal);
      toast('Đã lập hợp đồng & chuyển phòng sang trạng thái "Đang cho thuê"');
      setCreateModal(null);
      reload();
      if (created) setWordModal({ contract: created, mode: 'view' });
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
        subtitle="Xem bản hợp đồng Word, chỉnh sửa trực tiếp điều khoản, gia hạn hoặc lập biên bản thanh lý"
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
                      <IconButton
                        icon={Eye}
                        title="Xem hợp đồng (Bản Word)"
                        onClick={() => setWordModal({ contract: c, mode: 'view' })}
                      />
                      {c.status === 'active' && (
                        <>
                          <IconButton
                            icon={Edit3}
                            title="Cập nhật trực tiếp trên bản Word"
                            onClick={() => setWordModal({ contract: c, mode: 'edit' })}
                          />
                          <IconButton
                            icon={CalendarPlus}
                            variant="brand"
                            title="Gia hạn trên bản Word"
                            onClick={() => setWordModal({ contract: c, mode: 'extend' })}
                          />
                          <IconButton
                            icon={XOctagon}
                            variant="danger"
                            title="Kết thúc / Thanh lý trên bản Word"
                            onClick={() => setWordModal({ contract: c, mode: 'terminate' })}
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

      {/* Lập hợp đồng mới */}
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

      {/* Xem / Cập nhật / Gia hạn / Kết thúc trực tiếp trên Hợp đồng bản Word */}
      {wordModal && (
        <ContractWordModal
          contract={wordModal.contract}
          initialMode={wordModal.mode}
          canEdit
          onClose={() => setWordModal(null)}
          onSaved={() => reload()}
        />
      )}
    </div>
  );
}
