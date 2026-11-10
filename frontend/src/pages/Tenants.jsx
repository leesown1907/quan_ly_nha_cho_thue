import { useState } from 'react';
import { Edit3, Eye, Plus, RotateCcw, Trash2, UserPlus } from 'lucide-react';
import { api } from '../api';
import { useFeedback } from '../context/FeedbackContext';
import { useApi, useDebounce } from '../hooks/useApi';
import { CONTRACT_STATUS, date, money, TENANT_STATUS } from '../utils/format';
import {
  Badge, Button, Card, EmptyState, ErrorBox, IconButton, InfoRow, Input, Modal, PageHeader,
  SearchInput, Select, Spinner, StatusBadge, Textarea,
} from '../components/ui';

const EMPTY = {
  full_name: '', phone: '', email: '', id_card: '', birth_date: '', gender: 'Nam',
  hometown: '', occupation: '', note: '', create_account: false, username: '', password: '',
};

export default function Tenants() {
  const { toast, confirm } = useFeedback();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const q = useDebounce(search);

  const { data: tenants, loading, error, reload } = useApi(
    () => api.get('/tenants', { search: q, status }),
    [q, status],
  );

  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null);

  const openDetail = async (id) => {
    try { setDetail(await api.get(`/tenants/${id}`)); } catch (e) { toast(e.message, 'error'); }
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (form.id) {
        await api.put(`/tenants/${form.id}`, form);
        toast('Đã cập nhật thông tin người thuê');
      } else {
        await api.post('/tenants', form);
        toast('Đã thêm người thuê mới');
      }
      setForm(null);
      reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t) => {
    const ok = await confirm({
      title: `Xóa / lưu trữ "${t.full_name}"?`,
      message: 'Nếu người thuê đã có lịch sử hợp đồng, hồ sơ sẽ được chuyển sang trạng thái "Đã chuyển đi" để phục vụ tra cứu.',
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await api.del(`/tenants/${t.id}`);
      toast(res.message);
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const restore = async (t) => {
    try {
      await api.post(`/tenants/${t.id}/restore`);
      toast('Đã khôi phục hồ sơ người thuê');
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="Quản lý người thuê"
        subtitle="Lưu trữ hồ sơ khách thuê, liên kết tài khoản đăng nhập và tra cứu lịch sử thuê phòng"
        actions={<Button icon={Plus} onClick={() => setForm({ ...EMPTY })}>Thêm người thuê</Button>}
      />

      <Card bodyClass="p-4" className="mb-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <SearchInput className="sm:col-span-2" value={search} onChange={setSearch} placeholder="Tìm theo họ tên, số điện thoại, CCCD, mã phòng..." />
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tất cả trạng thái</option>
            <option value="active">Đang thuê / Hoạt động</option>
            <option value="moved_out">Đã chuyển đi (Lịch sử)</option>
          </Select>
        </div>
      </Card>

      <Card bodyClass="p-0">
        {loading ? <Spinner /> : error ? <div className="p-4"><ErrorBox error={error} onRetry={reload} /></div> : tenants.length === 0 ? (
          <EmptyState title="Chưa có người thuê nào" icon={UserPlus} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Họ tên</th>
                  <th>Điện thoại</th>
                  <th>CCCD</th>
                  <th>Phòng đang thuê</th>
                  <th>Tài khoản</th>
                  <th>Trạng thái</th>
                  <th className="text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <p className="font-semibold text-slate-800">{t.full_name}</p>
                      <p className="text-xs text-slate-500">{t.occupation || t.hometown || ''}</p>
                    </td>
                    <td>{t.phone}</td>
                    <td>{t.id_card || '—'}</td>
                    <td>{t.room_code ? <Badge color="blue">Phòng {t.room_code}</Badge> : <span className="text-slate-400">Chưa gán</span>}</td>
                    <td>{t.username ? <code className="rounded bg-slate-100 px-2 py-0.5 text-xs">{t.username}</code> : <span className="text-xs text-slate-400">Chưa cấp</span>}</td>
                    <td><StatusBadge map={TENANT_STATUS} value={t.status} /></td>
                    <td className="text-right">
                      <IconButton icon={Eye} title="Chi tiết & lịch sử" onClick={() => openDetail(t.id)} />
                      <IconButton icon={Edit3} title="Chỉnh sửa" onClick={() => setForm({ ...t, birth_date: t.birth_date || '' })} />
                      {t.status === 'moved_out' && <IconButton icon={RotateCcw} variant="brand" title="Khôi phục" onClick={() => restore(t)} />}
                      <IconButton icon={Trash2} variant="danger" title="Xóa / Lưu trữ" onClick={() => remove(t)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Cập nhật người thuê' : 'Thêm người thuê mới'} size="lg">
        {form && (
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Họ và tên" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              <Input label="Số điện thoại" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Input label="Số CCCD / CMND" value={form.id_card || ''} onChange={(e) => setForm({ ...form, id_card: e.target.value })} />
              <Input label="Email" type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Input label="Ngày sinh" type="date" value={form.birth_date || ''} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
              <Select label="Giới tính" value={form.gender || 'Nam'} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
                <option value="Khác">Khác</option>
              </Select>
              <Input label="Quê quán / Địa chỉ thường trú" value={form.hometown || ''} onChange={(e) => setForm({ ...form, hometown: e.target.value })} />
              <Input label="Nghề nghiệp / Nơi làm việc" value={form.occupation || ''} onChange={(e) => setForm({ ...form, occupation: e.target.value })} />
            </div>
            <Textarea label="Ghi chú" value={form.note || ''} onChange={(e) => setForm({ ...form, note: e.target.value })} />

            {!form.id && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.create_account}
                    onChange={(e) => setForm({ ...form, create_account: e.target.checked })}
                  />
                  Cấp tài khoản đăng nhập cho người thuê này
                </label>
                {form.create_account && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Input label="Tên đăng nhập" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="VD: tenant12" />
                    <Input label="Mật khẩu khởi tạo" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Tối thiểu 6 ký tự" />
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setForm(null)}>Hủy</Button>
              <Button type="submit" loading={saving}>Lưu hồ sơ</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `Hồ sơ: ${detail.full_name}` : ''} size="lg">
        {detail && (
          <div className="space-y-4">
            <div className="grid gap-x-8 sm:grid-cols-2">
              <InfoRow label="Họ và tên">{detail.full_name}</InfoRow>
              <InfoRow label="Trạng thái"><StatusBadge map={TENANT_STATUS} value={detail.status} /></InfoRow>
              <InfoRow label="Số điện thoại">{detail.phone}</InfoRow>
              <InfoRow label="Email">{detail.email || '—'}</InfoRow>
              <InfoRow label="CCCD">{detail.id_card || '—'}</InfoRow>
              <InfoRow label="Ngày sinh">{date(detail.birth_date)}</InfoRow>
              <InfoRow label="Giới tính">{detail.gender || '—'}</InfoRow>
              <InfoRow label="Nghề nghiệp">{detail.occupation || '—'}</InfoRow>
              <InfoRow label="Quê quán">{detail.hometown || '—'}</InfoRow>
              <InfoRow label="Tài khoản hệ thống">{detail.username || 'Chưa cấp'}</InfoRow>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-700">Lịch sử hợp đồng thuê phòng</h4>
              {!detail.contracts?.length ? (
                <p className="text-sm text-slate-400">Chưa có hợp đồng nào</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Mã HĐ</th><th>Phòng</th><th>Bắt đầu</th><th>Kết thúc</th><th>Giá thuê</th><th>Trạng thái</th></tr></thead>
                    <tbody>
                      {detail.contracts.map((c) => (
                        <tr key={c.id}>
                          <td className="font-medium">{c.code}</td>
                          <td>Phòng {c.room_code}</td>
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
