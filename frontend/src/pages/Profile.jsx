import { useState } from 'react';
import { KeyRound, Save } from 'lucide-react';
import { api, setToken } from '../api';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../context/FeedbackContext';
import { useApi } from '../hooks/useApi';
import { date } from '../utils/format';
import { Button, Card, InfoRow, Input, PageHeader } from '../components/ui';

export default function Profile() {
  const { user, setUser, isAdmin } = useAuth();
  const { toast } = useFeedback();
  const { data: tenant } = useApi(() => (!isAdmin ? api.get('/tenants/me') : Promise.resolve(null)), [isAdmin]);

  const [profile, setProfile] = useState({
    full_name: user?.full_name || '',
    phone: user?.phone || '',
    email: user?.email || '',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  const [pwd, setPwd] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [savingPwd, setSavingPwd] = useState(false);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await api.put('/auth/profile', profile);
      setUser(res.user);
      toast('Đã cập nhật thông tin cá nhân');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const changePwd = async (e) => {
    e.preventDefault();
    if (pwd.new_password !== pwd.confirm_password) {
      toast('Mật khẩu xác nhận không khớp', 'error');
      return;
    }
    setSavingPwd(true);
    try {
      const res = await api.post('/auth/change-password', pwd);
      setToken(res.token);
      setPwd({ current_password: '', new_password: '', confirm_password: '' });
      toast('Đã đổi mật khẩu thành công');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Thông tin cá nhân & bảo mật"
        subtitle="Xem hồ sơ đã đăng ký, cập nhật thông tin liên hệ và đổi mật khẩu"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Thông tin tài khoản">
          <form onSubmit={saveProfile} className="space-y-4">
            <Input label="Tên đăng nhập" disabled value={user?.username || ''} />
            <Input label="Họ và tên" required value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
            <Input label="Số điện thoại" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
            <Input label="Email" type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
            <Button type="submit" icon={Save} loading={savingProfile}>Lưu thông tin</Button>
          </form>
        </Card>

        <Card title="Đổi mật khẩu">
          <form onSubmit={changePwd} className="space-y-4">
            <Input
              label="Mật khẩu hiện tại"
              type="password"
              required
              value={pwd.current_password}
              onChange={(e) => setPwd({ ...pwd, current_password: e.target.value })}
            />
            <Input
              label="Mật khẩu mới (ít nhất 6 ký tự)"
              type="password"
              required
              value={pwd.new_password}
              onChange={(e) => setPwd({ ...pwd, new_password: e.target.value })}
            />
            <Input
              label="Nhập lại mật khẩu mới"
              type="password"
              required
              value={pwd.confirm_password}
              onChange={(e) => setPwd({ ...pwd, confirm_password: e.target.value })}
            />
            <Button type="submit" icon={KeyRound} loading={savingPwd}>Đổi mật khẩu</Button>
          </form>
        </Card>
      </div>

      {tenant && (
        <Card title="Hồ sơ cư trú đã đăng ký với chủ nhà">
          <div className="grid gap-x-8 sm:grid-cols-2">
            <InfoRow label="Họ và tên">{tenant.full_name}</InfoRow>
            <InfoRow label="Phòng đang thuê">{tenant.room_code ? `Phòng ${tenant.room_code}` : 'Chưa có'}</InfoRow>
            <InfoRow label="Số CCCD">{tenant.id_card || '—'}</InfoRow>
            <InfoRow label="Ngày sinh">{date(tenant.birth_date)}</InfoRow>
            <InfoRow label="Giới tính">{tenant.gender || '—'}</InfoRow>
            <InfoRow label="Nghề nghiệp">{tenant.occupation || '—'}</InfoRow>
            <InfoRow label="Quê quán">{tenant.hometown || '—'}</InfoRow>
          </div>
        </Card>
      )}
    </div>
  );
}
