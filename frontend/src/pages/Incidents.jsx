import { useState } from 'react';
import { Edit3, Plus, Trash2, Wrench } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../context/FeedbackContext';
import { useApi, useDebounce } from '../hooks/useApi';
import { CATEGORY, datetime, INCIDENT_STATUS, PRIORITY } from '../utils/format';
import {
  Badge, Button, Card, EmptyState, ErrorBox, IconButton, Input, Modal, PageHeader,
  SearchInput, Select, Spinner, StatusBadge, Textarea,
} from '../components/ui';

const EMPTY = { title: '', category: 'electric', priority: 'medium', description: '' };

export default function Incidents() {
  const { isAdmin } = useAuth();
  const { toast, confirm } = useFeedback();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const q = useDebounce(search);

  const { data: items, loading, error, reload } = useApi(
    () => api.get('/incidents', { search: q, status, priority }),
    [q, status, priority],
  );

  const [createModal, setCreateModal] = useState(null);
  const [updateModal, setUpdateModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const submitCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/incidents', createModal);
      toast('Đã gửi báo cáo sự cố cho chủ nhà');
      setCreateModal(null);
      reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const submitUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/incidents/${updateModal.id}`, {
        status: updateModal.status,
        admin_note: updateModal.admin_note,
      });
      toast('Đã cập nhật trạng thái xử lý & gửi thông báo cho người thuê');
      setUpdateModal(null);
      reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (inc) => {
    const ok = await confirm({ title: `Xóa báo cáo "${inc.title}"?`, danger: true });
    if (!ok) return;
    try {
      await api.del(`/incidents/${inc.id}`);
      toast('Đã xóa báo cáo sự cố');
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="Báo cáo & xử lý sự cố"
        subtitle={isAdmin
          ? 'Tiếp nhận sự cố từ người thuê, cập nhật tiến độ sửa chữa và lưu lịch sử'
          : 'Gửi thông báo hỏng thiết bị hoặc sự cố tại phòng để chủ nhà kiểm tra, sửa chữa'}
        actions={!isAdmin && (
          <Button icon={Plus} onClick={() => setCreateModal({ ...EMPTY })}>Gửi báo cáo sự cố</Button>
        )}
      />

      <Card bodyClass="p-4" className="mb-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo tiêu đề, mã phòng, người gửi..." />
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tất cả trạng thái</option>
            <option value="pending">Chờ tiếp nhận</option>
            <option value="in_progress">Đang xử lý</option>
            <option value="resolved">Đã xử lý</option>
            <option value="rejected">Từ chối</option>
          </Select>
          <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">Tất cả mức độ</option>
            <option value="high">Khẩn cấp</option>
            <option value="medium">Trung bình</option>
            <option value="low">Thấp</option>
          </Select>
        </div>
      </Card>

      {loading ? <Spinner /> : error ? <ErrorBox error={error} onRetry={reload} /> : items.length === 0 ? (
        <Card><EmptyState title="Chưa có báo cáo sự cố nào" icon={Wrench} /></Card>
      ) : (
        <div className="space-y-3">
          {items.map((inc) => (
            <div key={inc.id} className="card flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge color="blue">Phòng {inc.room_code}</Badge>
                  <StatusBadge map={PRIORITY} value={inc.priority} />
                  <StatusBadge map={INCIDENT_STATUS} value={inc.status} />
                  <span className="text-xs text-slate-400">• {CATEGORY[inc.category] || inc.category}</span>
                </div>
                <h3 className="text-base font-bold text-slate-800">{inc.title}</h3>
                <p className="text-sm text-slate-600">{inc.description}</p>
                {inc.admin_note && (
                  <p className="rounded-lg bg-brand-50 px-3 py-1.5 text-xs text-brand-800">
                    <strong>Phản hồi của chủ nhà:</strong> {inc.admin_note}
                  </p>
                )}
                <p className="text-xs text-slate-400">
                  Người báo: {inc.tenant_name || '—'} ({inc.tenant_phone || '—'}) • Gửi lúc {datetime(inc.created_at)}
                  {inc.resolved_at && ` • Hoàn tất ${datetime(inc.resolved_at)}`}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={Edit3}
                    onClick={() => setUpdateModal({ ...inc, admin_note: inc.admin_note || '' })}
                  >
                    Cập nhật xử lý
                  </Button>
                )}
                {(isAdmin || inc.status === 'pending') && (
                  <IconButton icon={Trash2} variant="danger" title="Xóa" onClick={() => remove(inc)} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Người thuê gửi báo cáo */}
      <Modal open={!!createModal} onClose={() => setCreateModal(null)} title="Gửi báo cáo sự cố tại phòng">
        {createModal && (
          <form onSubmit={submitCreate} className="space-y-4">
            <Input
              label="Tiêu đề sự cố"
              required
              value={createModal.title}
              onChange={(e) => setCreateModal({ ...createModal, title: e.target.value })}
              placeholder="VD: Điều hòa không mát, vòi nước rò rỉ..."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Phân loại" value={createModal.category} onChange={(e) => setCreateModal({ ...createModal, category: e.target.value })}>
                {Object.entries(CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
              <Select label="Mức độ ưu tiên" value={createModal.priority} onChange={(e) => setCreateModal({ ...createModal, priority: e.target.value })}>
                <option value="low">Thấp</option>
                <option value="medium">Trung bình</option>
                <option value="high">Khẩn cấp</option>
              </Select>
            </div>
            <Textarea
              label="Mô tả chi tiết tình trạng"
              required
              value={createModal.description}
              onChange={(e) => setCreateModal({ ...createModal, description: e.target.value })}
              placeholder="Mô tả rõ vị trí, triệu chứng và thời gian thuận tiện để kiểm tra..."
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setCreateModal(null)}>Hủy</Button>
              <Button type="submit" loading={saving}>Gửi báo cáo</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Chủ nhà cập nhật */}
      <Modal open={!!updateModal} onClose={() => setUpdateModal(null)} title="Cập nhật tình trạng xử lý sự cố" size="sm">
        {updateModal && (
          <form onSubmit={submitUpdate} className="space-y-4">
            <p className="text-sm text-slate-600">
              <strong>[Phòng {updateModal.room_code}]</strong> {updateModal.title}
            </p>
            <Select label="Trạng thái xử lý" value={updateModal.status} onChange={(e) => setUpdateModal({ ...updateModal, status: e.target.value })}>
              <option value="pending">Chờ tiếp nhận</option>
              <option value="in_progress">Đang xử lý / sửa chữa</option>
              <option value="resolved">Đã xử lý xong</option>
              <option value="rejected">Từ chối</option>
            </Select>
            <Textarea
              label="Ghi chú / phản hồi cho người thuê"
              value={updateModal.admin_note}
              onChange={(e) => setUpdateModal({ ...updateModal, admin_note: e.target.value })}
              placeholder="Đã hẹn thợ, đã thay thiết bị mới..."
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setUpdateModal(null)}>Hủy</Button>
              <Button type="submit" loading={saving}>Lưu & Thông báo</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
