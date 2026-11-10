import { useState } from 'react';
import { DoorOpen, Edit3, Eye, Plus, Trash2, Users } from 'lucide-react';
import { api } from '../api';
import { useFeedback } from '../context/FeedbackContext';
import { useApi, useDebounce } from '../hooks/useApi';
import { CONTRACT_STATUS, date, money, ROOM_STATUS } from '../utils/format';
import {
  Button, Card, EmptyState, ErrorBox, IconButton, InfoRow, Input, Modal, PageHeader,
  SearchInput, Select, Spinner, StatusBadge, Textarea,
} from '../components/ui';

const EMPTY = { code: '', floor: 1, area: 22, base_price: 3500000, max_occupants: 2, status: 'available', description: '' };

export default function Rooms() {
  const { toast, confirm } = useFeedback();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [floor, setFloor] = useState('');
  const q = useDebounce(search);

  const { data: rooms, loading, error, reload } = useApi(
    () => api.get('/rooms', { search: q, status, floor }),
    [q, status, floor],
  );

  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null);

  const openDetail = async (id) => {
    try { setDetail(await api.get(`/rooms/${id}`)); } catch (e) { toast(e.message, 'error'); }
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (form.id) {
        await api.put(`/rooms/${form.id}`, form);
        toast('Đã cập nhật thông tin phòng');
      } else {
        await api.post('/rooms', form);
        toast('Đã thêm phòng mới');
      }
      setForm(null);
      reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (room) => {
    const ok = await confirm({
      title: `Xóa phòng ${room.code}?`,
      message: 'Chỉ xóa được phòng đang trống và chưa từng có hợp đồng.',
      danger: true,
      confirmText: 'Xóa phòng',
    });
    if (!ok) return;
    try {
      await api.del(`/rooms/${room.id}`);
      toast('Đã xóa phòng');
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="Quản lý phòng cho thuê"
        subtitle="Cập nhật mã phòng, diện tích, giá thuê và trạng thái (Trống / Đang cho thuê / Đang sửa chữa)"
        actions={<Button icon={Plus} onClick={() => setForm({ ...EMPTY })}>Thêm phòng</Button>}
      />

      <Card bodyClass="p-4" className="mb-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo mã phòng, người thuê, mô tả..." />
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tất cả trạng thái</option>
            <option value="available">Phòng trống</option>
            <option value="occupied">Đang cho thuê</option>
            <option value="maintenance">Đang sửa chữa</option>
          </Select>
          <Select value={floor} onChange={(e) => setFloor(e.target.value)}>
            <option value="">Tất cả các tầng</option>
            {[1, 2, 3, 4, 5].map((f) => <option key={f} value={f}>Tầng {f}</option>)}
          </Select>
        </div>
      </Card>

      {loading ? <Spinner /> : error ? <ErrorBox error={error} onRetry={reload} /> : rooms.length === 0 ? (
        <Card><EmptyState title="Không tìm thấy phòng phù hợp" icon={DoorOpen} /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((r) => (
            <div key={r.id} className="card flex flex-col justify-between p-5 transition hover:shadow-md">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-medium text-slate-400">Tầng {r.floor}</span>
                    <h3 className="text-lg font-bold text-slate-800">Phòng {r.code}</h3>
                  </div>
                  <StatusBadge map={ROOM_STATUS} value={r.status} />
                </div>

                <p className="mt-3 text-xl font-bold text-brand-600">
                  {money(r.base_price)} <span className="text-xs font-normal text-slate-500">/ tháng</span>
                </p>

                <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
                  <span>Diện tích: <strong>{r.area} m²</strong></span>
                  <span>• Tối đa: <strong>{r.max_occupants} người</strong></span>
                </div>

                {r.description && <p className="mt-2 line-clamp-2 text-xs text-slate-500">{r.description}</p>}

                {r.tenant_name ? (
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-blue-50/70 px-3 py-2 text-xs text-blue-900">
                    <Users className="h-4 w-4 shrink-0 text-blue-600" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{r.tenant_name} ({r.occupants} người)</p>
                      <p className="text-[11px] text-blue-700">HĐ đến {date(r.contract_end_date)}</p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-400">
                    Chưa có người thuê
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-end gap-1 border-t border-slate-100 pt-3">
                <IconButton icon={Eye} title="Chi tiết" onClick={() => openDetail(r.id)} />
                <IconButton icon={Edit3} title="Chỉnh sửa" onClick={() => setForm({ ...r })} />
                <IconButton icon={Trash2} variant="danger" title="Xóa phòng" onClick={() => remove(r)} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? `Chỉnh sửa phòng ${form.code}` : 'Thêm phòng mới'}>
        {form && (
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Mã phòng" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="VD: P101" />
              <Input label="Tầng" type="number" min="0" required value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} />
              <Input label="Diện tích (m²)" type="number" step="0.5" min="1" required value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
              <Input label="Giá thuê cơ bản (đ/tháng)" type="number" step="50000" min="0" required value={form.base_price} onChange={(e) => setForm({ ...form, base_price: e.target.value })} />
              <Input label="Số người ở tối đa" type="number" min="1" required value={form.max_occupants} onChange={(e) => setForm({ ...form, max_occupants: e.target.value })} />
              <Select
                label="Trạng thái phòng"
                value={form.status}
                disabled={form.status === 'occupied'}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                hint={form.status === 'occupied' ? 'Tự động về "Phòng trống" khi thanh lý hợp đồng' : undefined}
              >
                <option value="available">Phòng trống</option>
                <option value="maintenance">Đang sửa chữa</option>
                {form.status === 'occupied' && <option value="occupied">Đang cho thuê</option>}
              </Select>
            </div>
            <Textarea label="Mô tả / tiện nghi" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Điều hòa, nóng lạnh, ban công..." />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setForm(null)}>Hủy</Button>
              <Button type="submit" loading={saving}>Lưu thông tin</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `Chi tiết phòng ${detail.code}` : ''} size="lg">
        {detail && (
          <div className="space-y-4">
            <div className="grid gap-x-8 sm:grid-cols-2">
              <InfoRow label="Mã phòng">{detail.code}</InfoRow>
              <InfoRow label="Trạng thái"><StatusBadge map={ROOM_STATUS} value={detail.status} /></InfoRow>
              <InfoRow label="Tầng">Tầng {detail.floor}</InfoRow>
              <InfoRow label="Diện tích">{detail.area} m²</InfoRow>
              <InfoRow label="Giá thuê cơ bản">{money(detail.base_price)} / tháng</InfoRow>
              <InfoRow label="Số người tối đa">{detail.max_occupants} người</InfoRow>
              <InfoRow label="Người đang thuê">{detail.tenant_name || 'Chưa có'}</InfoRow>
              <InfoRow label="Số điện thoại">{detail.tenant_phone || '—'}</InfoRow>
            </div>
            {detail.description && <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{detail.description}</p>}

            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-700">Lịch sử hợp đồng của phòng</h4>
              {!detail.contracts?.length ? (
                <p className="text-sm text-slate-400">Chưa có hợp đồng nào</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Mã HĐ</th><th>Người thuê</th><th>Từ ngày</th><th>Đến ngày</th><th>Giá thuê</th><th>Trạng thái</th></tr></thead>
                    <tbody>
                      {detail.contracts.map((c) => (
                        <tr key={c.id}>
                          <td className="font-medium">{c.code}</td>
                          <td>{c.tenant_name}</td>
                          <td>{date(c.start_date)}</td>
                          <td>{date(c.ended_at || c.end_date)}</td>
                          <td>{money(c.monthly_rent)}</td>
                          <td><StatusBadge map={CONTRACT_STATUS} value={c.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
