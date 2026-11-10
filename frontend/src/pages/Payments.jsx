import { useState } from 'react';
import { CreditCard } from 'lucide-react';
import { api } from '../api';
import { useApi, useDebounce } from '../hooks/useApi';
import { datetime, METHOD, money, period } from '../utils/format';
import {
  Badge, Card, EmptyState, ErrorBox, Input, PageHeader, SearchInput, Select, Spinner,
} from '../components/ui';

export default function Payments() {
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const q = useDebounce(search);

  const { data, loading, error, reload } = useApi(
    () => api.get('/payments', { search: q, method, from, to }),
    [q, method, from, to],
  );

  return (
    <div>
      <PageHeader
        title="Lịch sử giao dịch thanh toán"
        subtitle="Theo dõi các lần thu tiền hóa đơn và phương thức thanh toán qua các kỳ"
        actions={data && (
          <div className="rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
            Tổng đã thu: <strong className="font-bold">{money(data.total)}</strong> ({data.items.length} giao dịch)
          </div>
        )}
      />

      <Card bodyClass="p-4" className="mb-6">
        <div className="grid gap-3 sm:grid-cols-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Mã HĐ, phòng, người thuê..." />
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="">Tất cả hình thức</option>
            <option value="transfer">Chuyển khoản</option>
            <option value="cash">Tiền mặt</option>
            <option value="other">Khác</option>
          </Select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </Card>

      <Card bodyClass="p-0">
        {loading ? <Spinner /> : error ? <div className="p-4"><ErrorBox error={error} onRetry={reload} /></div> : data.items.length === 0 ? (
          <EmptyState title="Chưa có giao dịch thanh toán" icon={CreditCard} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Mã hóa đơn</th>
                  <th>Kỳ</th>
                  <th>Phòng</th>
                  <th>Người thuê</th>
                  <th>Số tiền</th>
                  <th>Hình thức</th>
                  <th>Người xác nhận</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id}>
                    <td>{datetime(p.paid_at)}</td>
                    <td className="font-semibold text-slate-800">{p.invoice_code}</td>
                    <td>{period(p.period)}</td>
                    <td><Badge color="blue">Phòng {p.room_code}</Badge></td>
                    <td>{p.tenant_name}</td>
                    <td className="font-bold text-emerald-600">{money(p.amount)}</td>
                    <td>{METHOD[p.method]}</td>
                    <td>{p.confirmed_by_name || '—'}</td>
                    <td className="text-slate-500">{p.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
