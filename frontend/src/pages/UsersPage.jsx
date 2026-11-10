import { useState } from 'react';
import { Edit3, Plus, Shield, Trash2 } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../context/FeedbackContext';
import { useApi, useDebounce } from '../hooks/useApi';
import { date } from '../utils/format';
import {
  Badge, Button, Card, EmptyState, ErrorBox, IconButton, Input, Modal, PageHeader,
  SearchInput, Select, Spinner,
} from '../components/ui';

const EMPTY = { username: '', password: '', full_name: '', phone: '', email: '', role: 'tenant', tenant_id: '', is_active: true };

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { toast, confirm } = useFeedback();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const q = useDebounce(search);

  const { data: users, loading, error, reload } = useApi(
    () => api.get('/users', { search: q, role }),
    [q, role],
  );
  const { data: tenants } = useApi(() => api.get('/tenants'), []);

  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (form.id) {
        await api.put(`/users/${form.id}`, form);
        toast('Đã cập nhật tài khoản & phân quyền');
      } else {
        await api.post('/users', form);
        toast('Đã tạo tài khoản mới');
      }
      setForm(null);
      reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (u) => {
    const ok = await confirm({ title: `Xóa tài khoản "${u.username}"?`, danger: true });
    if (!ok) return;
    try {
      await api.del(`/users/${u.id}`);
      toast('Đã xóa tài khoản');
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="Quản lý tài khoản & phân quyền"
        subtitle="Cấp phát tài khoản, phân quyền Chủ nhà / Người thuê và liên kết với hồ sơ người thuê"
        actions={<Button icon={Plus} onClick={() => setForm({ ...EMPTY })}>Cấp tài khoản mới</Button>}
      />

      <Card bodyClass="p-4" className="mb-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <SearchInput className="sm:col-span-2" value={search} onChange={setSearch} placeholder="Tìm theo tên đăng nhập, họ tên, số điện thoại..." />
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">Tất cả vai trò</option>
            <option value="admin">Chủ nhà / Quản lý</option>
            <option value="tenant">Người thuê</option>
          </Select>
        </div>
      </Card>

      <Card bodyClass="p-0">
        {loading ? <Spinner /> : error ? <div className="p-4"><ErrorBox error={error} onRetry={reload} /></div> : users.length === 0 ? (
          <EmptyState title="Không có tài khoản" icon={Shield} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Tên đăng nhập</th>
                  <th>Họ và tên</th>
                  <th>Điện thoại</th>
                  <th>Vai trò</th>
                  <th>Hồ sơ người thuê liên kết</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                  <th className="text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td><code className="rounded bg-slate-100 px-2 py-0.5 font-medium">{u.username}</code></td>
                    <td className="font-semibold text-slate-800">{u.full_name}</td>
                    <td>{u.phone || '—'}</td>
                    <td>
                      <Badge color={u.role === 'admin' ? 'brand' : 'blue'}>
                        {u.role === 'admin' ? 'Chủ nhà / Quản lý' : 'Người thuê'}
                      </Badge>
                    </td>
                    <td>{u.tenant_name || <span className="text-xs text-slate-400">—</span>}</td>
                    <td>
                      <Badge color={u.is_active ? 'green' : 'red'}>
                        {u.is_active ? 'Hoạt động' : 'Đã khóa'}
                      </Badge>
                    </td>
                    <td>{date(u.created_at)}</td>
                    <td className="text-right">
                      <IconButton icon={Edit3} title="Chỉnh sửa / phân quyền" onClick={() => setForm({ ...u, password: '', tenant_id: u.tenant_id || '' })} />
                      {u.id !== currentUser?.id && (
                        <IconButton icon={Trash2} variant="danger" title="Xóa" onClick={() => remove(u)} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? `Chỉnh sửa tài khoản ${form.username}` : 'Cấp tài khoản mới'}>
        {form && (
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Tên đăng nhập"
                required
                disabled={!!form.id}
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
              <Input
                label={form.id ? 'Mật khẩu mới (để trống nếu giữ nguyên)' : 'Mật khẩu khởi tạo'}
                type="password"
                required={!form.id}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <Input label="Họ và tên" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              <Input label="Số điện thoại" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Input label="Email" type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Select label="Vai trò phân quyền" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="tenant">Người thuê (chỉ xem dữ liệu phòng mình)</option>
                <option value="admin">Chủ nhà / Quản lý (toàn quyền)</option>
              </Select>
            </div>

            {form.role === 'tenant' && (
              <Select
                label="Liên kết với hồ sơ người thuê"
                value={form.tenant_id || ''}
                onChange={(e) => setForm({ ...form, tenant_id: e.target.value })}
                hint="Người thuê chỉ xem được phòng, hợp đồng và hóa đơn của hồ sơ được liên kết"
              >
                <option value="">— Chưa liên kết —</option>
                {(tenants || []).map((t) => (
                  <option key={t.id} value={t.id} disabled={t.user_id && t.user_id !== form.id}>
                    {t.full_name} ({t.phone}) {t.room_code ? `— Phòng ${t.room_code}` : ''}
                  </option>
                ))}
              </Select>
            )}

            {form.id && form.id !== currentUser?.id && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_active !== false}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                Cho phép đăng nhập (bỏ chọn để khóa tài khoản)
              </label>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setForm(null)}>Hủy</Button>
              <Button type="submit" loading={saving}>Lưu</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
