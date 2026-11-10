import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle, CalendarClock, CreditCard, DoorOpen, FileWarning, TrendingUp, Users, Wrench,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import {
  date, INCIDENT_STATUS, INVOICE_STATUS, money, period, PRIORITY, shortMoney, today,
} from '../utils/format';
import {
  Badge, Button, Card, EmptyState, ErrorBox, Input, PageHeader, Spinner, StatCard, StatusBadge,
} from '../components/ui';

const PIE_COLORS = ['#10b981', '#4f46e5', '#f59e0b'];

function defaultFrom() {
  const d = new Date();
  d.setMonth(d.getMonth() - 5);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export default function Dashboard() {
  const { isAdmin } = useAuth();
  return isAdmin ? <AdminDashboard /> : <TenantDashboard />;
}

function AdminDashboard() {
  const nav = useNavigate();
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(today);
  const { data, loading, error, reload } = useApi(() => api.get('/stats/dashboard', { from, to }), [from, to]);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const pieData = [
    { name: 'Phòng trống', value: data.rooms.available },
    { name: 'Đang cho thuê', value: data.rooms.occupied },
    { name: 'Đang sửa chữa', value: data.rooms.maintenance },
  ];
  const chartData = data.monthly.map((m) => ({
    name: period(m.month),
    'Phát hành': m.invoiced,
    'Đã thu': m.collected,
  }));

  return (
    <div>
      <PageHeader
        title="Tổng quan & Thống kê — Nhà 57 Giảng Võ"
        subtitle="Theo dõi tình hình phòng, doanh thu, công nợ và sự cố theo thời gian"
        actions={(
          <div className="flex flex-wrap items-end gap-2">
            <Input type="date" label="Từ ngày" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" label="Đến ngày" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={DoorOpen}
          color="brand"
          label="Tình hình phòng"
          value={`${data.rooms.occupied}/${data.rooms.total} đang thuê`}
          sub={`${data.rooms.available} trống • ${data.rooms.maintenance} sửa chữa`}
        />
        <StatCard
          icon={TrendingUp}
          color="green"
          label="Doanh thu đã thu (trong kỳ)"
          value={money(data.money.revenue)}
          sub={`Tổng hóa đơn phát hành: ${money(data.money.invoiced)}`}
        />
        <StatCard
          icon={AlertCircle}
          color="red"
          label="Tổng công nợ chưa thu"
          value={money(data.debt.amount)}
          sub={`${data.debt.count} hóa đơn (${data.debt.overdue_count} quá hạn)`}
        />
        <StatCard
          icon={Users}
          color="blue"
          label="Khách đang thuê"
          value={`${data.tenants.active} người`}
          sub={`Sự cố chờ xử lý: ${data.incident_stats.pending + data.incident_stats.in_progress}`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Biểu đồ doanh thu & hóa đơn theo tháng" className="lg:col-span-2">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis tickFormatter={shortMoney} fontSize={12} />
                <Tooltip formatter={(v) => money(v)} />
                <Legend />
                <Bar dataKey="Phát hành" fill="#94a3b8" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Đã thu" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Tỷ lệ trạng thái phòng">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={(v) => `${v} phòng`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card
          title="Phòng còn công nợ"
          actions={<Button size="sm" variant="ghost" onClick={() => nav('/invoices?status=debt')}>Xem tất cả</Button>}
        >
          {data.debtors.length === 0 ? (
            <EmptyState title="Không có công nợ tồn đọng" />
          ) : (
            <div className="divide-y divide-slate-100">
              {data.debtors.map((d) => (
                <div key={d.room_code} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-semibold text-slate-800">{d.room_code} — {d.tenant_name}</p>
                    <p className="text-xs text-slate-500">{d.invoices} hóa đơn chưa tất toán</p>
                  </div>
                  <span className="font-semibold text-red-600">{money(d.debt)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          title="Hợp đồng sắp đến hạn (≤ 30 ngày)"
          actions={<Button size="sm" variant="ghost" onClick={() => nav('/contracts')}>Quản lý</Button>}
        >
          {data.expiring.length === 0 ? (
            <EmptyState title="Không có hợp đồng sắp hết hạn" icon={CalendarClock} />
          ) : (
            <div className="divide-y divide-slate-100">
              {data.expiring.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-semibold text-slate-800">{c.room_code} — {c.tenant_name}</p>
                    <p className="text-xs text-slate-500">Hết hạn: {date(c.end_date)}</p>
                  </div>
                  <Badge color={c.days_left <= 7 ? 'red' : 'amber'}>
                    {c.days_left < 0 ? `Quá hạn ${-c.days_left} ngày` : `Còn ${c.days_left} ngày`}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          title="Sự cố cần xử lý"
          actions={<Button size="sm" variant="ghost" onClick={() => nav('/incidents')}>Xem tất cả</Button>}
        >
          {data.incidents.length === 0 ? (
            <EmptyState title="Không có sự cố đang chờ" icon={Wrench} />
          ) : (
            <div className="divide-y divide-slate-100">
              {data.incidents.map((inc) => (
                <div key={inc.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-800">[{inc.room_code}] {inc.title}</p>
                    <div className="mt-1 flex gap-1.5">
                      <StatusBadge map={PRIORITY} value={inc.priority} />
                      <StatusBadge map={INCIDENT_STATUS} value={inc.status} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function TenantDashboard() {
  const nav = useNavigate();
  const { data, loading, error, reload } = useApi(() => api.get('/stats/tenant'), []);

  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const { contract, debt, latest_invoice: inv, readings, incidents } = data;

  return (
    <div>
      <PageHeader
        title="Tổng quan thông tin thuê phòng"
        subtitle="Theo dõi hợp đồng, hóa đơn, điện nước và báo cáo sự cố của phòng bạn"
        actions={<Button icon={Wrench} onClick={() => nav('/incidents')}>Gửi báo cáo sự cố</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={DoorOpen}
          color="brand"
          label="Phòng đang thuê"
          value={contract ? `Phòng ${contract.room_code}` : 'Chưa có'}
          sub={contract ? `Tầng ${contract.floor} • ${contract.area} m²` : undefined}
        />
        <StatCard
          icon={CalendarClock}
          color="blue"
          label="Thời hạn hợp đồng"
          value={contract ? date(contract.end_date) : '—'}
          sub={contract ? `Giá thuê: ${money(contract.monthly_rent)}/tháng` : undefined}
        />
        <StatCard
          icon={CreditCard}
          color={debt.amount > 0 ? 'red' : 'green'}
          label="Số tiền cần thanh toán"
          value={money(debt.amount)}
          sub={debt.count > 0 ? `${debt.count} hóa đơn • Hạn: ${date(debt.nearest_due)}` : 'Đã thanh toán đầy đủ'}
        />
        <StatCard
          icon={FileWarning}
          color="amber"
          label="Báo cáo sự cố"
          value={`${incidents.open} đang xử lý`}
          sub={`Tổng đã gửi: ${incidents.total}`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card
          title="Hóa đơn gần nhất"
          actions={<Button size="sm" variant="ghost" onClick={() => nav('/invoices')}>Xem tất cả hóa đơn</Button>}
        >
          {!inv ? (
            <EmptyState title="Chưa có hóa đơn" />
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">{inv.code} (Kỳ {period(inv.period)})</span>
                <StatusBadge map={INVOICE_STATUS} value={inv.status} />
              </div>
              <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-4">
                <div>
                  <p className="text-xs text-slate-500">Tổng tiền</p>
                  <p className="mt-0.5 font-bold text-slate-800">{money(inv.total)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Đã trả</p>
                  <p className="mt-0.5 font-bold text-emerald-600">{money(inv.paid_amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Còn nợ</p>
                  <p className="mt-0.5 font-bold text-red-600">{money(inv.remaining)}</p>
                </div>
              </div>
              <p className="text-xs text-slate-500">Hạn thanh toán: <strong>{date(inv.due_date)}</strong></p>
            </div>
          )}
        </Card>

        <Card
          title="Mức tiêu thụ điện nước các kỳ gần đây"
          actions={<Button size="sm" variant="ghost" onClick={() => nav('/readings')}>Chi tiết</Button>}
        >
          {readings.length === 0 ? (
            <EmptyState title="Chưa có dữ liệu chỉ số" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Kỳ</th><th>Điện (kWh)</th><th>Nước (m³)</th></tr>
                </thead>
                <tbody>
                  {readings.map((r) => (
                    <tr key={r.id}>
                      <td className="font-medium">{period(r.period)}</td>
                      <td>{r.elec_old} → {r.elec_new} (<strong>{r.elec_usage}</strong> kWh)</td>
                      <td>{r.water_old} → {r.water_new} (<strong>{r.water_usage}</strong> m³)</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
