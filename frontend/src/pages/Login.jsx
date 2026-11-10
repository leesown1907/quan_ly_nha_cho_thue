import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button, Input } from '../components/ui';

const DEMO_ACCOUNTS = [
  { label: 'Chủ nhà / Quản lý', user: 'admin', pass: 'admin123', desc: 'Toàn quyền quản lý hệ thống' },
  { label: 'Người thuê (P101)', user: 'tenant01', pass: '123456', desc: 'Nguyễn Văn An — đang thuê P101' },
  { label: 'Người thuê (P201)', user: 'tenant04', pass: '123456', desc: 'Phạm Thu Dung — đang thuê P201' },
];

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      nav('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const pickDemo = (acc) => {
    setUsername(acc.user);
    setPassword(acc.pass);
    setError('');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-600 via-brand-700 to-slate-900 p-4">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl md:grid-cols-5">
        <div className="flex flex-col justify-between bg-slate-900 p-8 text-white md:col-span-2">
          <div>
            <div className="inline-flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-2.5">
              <Building2 className="h-6 w-6 text-brand-100" />
              <span className="font-bold">Nhà 57 Giảng Võ</span>
            </div>
            <h1 className="mt-6 text-2xl font-bold leading-snug">
              Phần mềm Quản lý Nhà cho thuê
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Quản lý tập trung phòng, người thuê, hợp đồng, chỉ số điện nước, hóa đơn, thanh toán và báo cáo sự cố.
            </p>
          </div>

          <div className="mt-8 space-y-2 border-t border-white/10 pt-5 text-xs text-slate-400">
            <p className="font-semibold text-slate-200">Tài khoản dùng thử (bấm để điền):</p>
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.user}
                type="button"
                onClick={() => pickDemo(a)}
                className="block w-full rounded-xl bg-white/5 p-2.5 text-left transition hover:bg-white/15"
              >
                <div className="flex items-center justify-between font-medium text-white">
                  <span>{a.label}</span>
                  <code className="rounded bg-white/10 px-1.5 py-0.5 text-[11px]">{a.user} / {a.pass}</code>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400">{a.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={submit} className="flex flex-col justify-center p-8 sm:p-10 md:col-span-3">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Đăng nhập hệ thống</h2>
            <p className="mt-1 text-sm text-slate-500">Nhập tài khoản được cấp để tiếp tục</p>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <Input
              label="Tên đăng nhập"
              required
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ví dụ: admin hoặc tenant01"
            />
            <Input
              label="Mật khẩu"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu"
            />
          </div>

          <Button type="submit" size="lg" loading={loading} icon={KeyRound} className="mt-6 w-full">
            Đăng nhập
          </Button>
        </form>
      </div>
    </div>
  );
}
