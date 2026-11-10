import { useEffect, useState } from 'react';
import { Check, Droplets, Gauge, Receipt, Save, Trash2, Zap } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../context/FeedbackContext';
import { useApi } from '../hooks/useApi';
import { currentPeriod, money, period, shiftPeriod, UNIT } from '../utils/format';
import {
  Badge, Button, Card, EmptyState, ErrorBox, IconButton, Input, PageHeader, Spinner, Tabs,
} from '../components/ui';

export default function Readings() {
  const { isAdmin } = useAuth();
  return isAdmin ? <AdminReadings /> : <TenantReadings />;
}

function AdminReadings() {
  const { toast, confirm } = useFeedback();
  const [tab, setTab] = useState('sheet');
  const [selectedPeriod, setSelectedPeriod] = useState(() => shiftPeriod(currentPeriod(), -1));

  return (
    <div>
      <PageHeader
        title="Quản lý chỉ số điện, nước"
        subtitle="Ghi nhận chỉ số công tơ định kỳ theo phòng; hệ thống tự tính tiền theo công thức (Chỉ số mới − Chỉ số cũ) × Đơn giá"
        actions={<Input type="month" label="Kỳ ghi chỉ số" value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)} />}
      />

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'sheet', label: `Bảng ghi chỉ số kỳ ${period(selectedPeriod)}` },
          { value: 'history', label: 'Lịch sử chỉ số các kỳ' },
        ]}
      />

      {tab === 'sheet'
        ? <ReadingSheet selectedPeriod={selectedPeriod} toast={toast} />
        : <ReadingHistory selectedPeriod={selectedPeriod} toast={toast} confirm={confirm} />}
    </div>
  );
}

function ReadingSheet({ selectedPeriod, toast }) {
  const { data, loading, error, reload } = useApi(
    () => api.get('/readings/sheet', { period: selectedPeriod }),
    [selectedPeriod],
  );
  const [rows, setRows] = useState([]);
  const [savingId, setSavingId] = useState(null);
  const [savingAll, setSavingAll] = useState(false);

  useEffect(() => {
    if (!data) return;
    setRows(data.rooms.map((r) => ({
      ...r,
      elec_old: r.elec_old ?? r.prev_elec ?? 0,
      elec_new: r.elec_new ?? r.prev_elec ?? 0,
      water_old: r.water_old ?? r.prev_water ?? 0,
      water_new: r.water_new ?? r.prev_water ?? 0,
    })));
  }, [data]);

  const updateRow = (roomId, field, value) => {
    setRows((list) => list.map((r) => (r.room_id === roomId ? { ...r, [field]: value } : r)));
  };

  const saveOne = async (row) => {
    setSavingId(row.room_id);
    try {
      await api.post('/readings', {
        room_id: row.room_id,
        period: selectedPeriod,
        elec_old: row.elec_old,
        elec_new: row.elec_new,
        water_old: row.water_old,
        water_new: row.water_new,
      });
      toast(`Đã lưu chỉ số phòng ${row.room_code}`);
      reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSavingId(null);
    }
  };

  const saveAllOccupied = async () => {
    setSavingAll(true);
    let count = 0;
    try {
      for (const r of rows.filter((x) => x.status === 'occupied' && !x.invoiced)) {
        await api.post('/readings', {
          room_id: r.room_id,
          period: selectedPeriod,
          elec_old: r.elec_old,
          elec_new: r.elec_new,
          water_old: r.water_old,
          water_new: r.water_new,
        });
        count += 1;
      }
      toast(`Đã lưu chỉ số cho ${count} phòng đang thuê`);
      reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSavingAll(false);
    }
  };

  const generateAllInvoices = async () => {
    try {
      const res = await api.post('/invoices/generate', { period: selectedPeriod });
      toast(res.message);
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  return (
    <Card
      title={`Đơn giá hiện hành: Điện ${money(data.electricity_price)}/kWh • Nước ${money(data.water_price)}/m³`}
      actions={(
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" icon={Save} loading={savingAll} onClick={saveAllOccupied}>
            Lưu tất cả phòng đang thuê
          </Button>
          <Button size="sm" icon={Receipt} onClick={generateAllInvoices}>
            Xuất hóa đơn kỳ {period(selectedPeriod)}
          </Button>
        </div>
      )}
      bodyClass="p-0"
    >
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Phòng</th>
              <th>Khách thuê</th>
              <th>Điện cũ</th>
              <th>Điện mới</th>
              <th>Tiêu thụ điện</th>
              <th>Nước cũ</th>
              <th>Nước mới</th>
              <th>Tiêu thụ nước</th>
              <th>Trạng thái</th>
              <th className="text-right">Lưu</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const eUse = Math.max(0, Number(r.elec_new) - Number(r.elec_old));
              const wUse = Math.max(0, Number(r.water_new) - Number(r.water_old));
              return (
                <tr key={r.room_id}>
                  <td className="font-semibold">Phòng {r.room_code}</td>
                  <td>{r.tenant_name || <span className="text-xs text-slate-400">Phòng trống</span>}</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      disabled={r.invoiced}
                      className="input w-24"
                      value={r.elec_old}
                      onChange={(e) => updateRow(r.room_id, 'elec_old', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      disabled={r.invoiced}
                      className="input w-24"
                      value={r.elec_new}
                      onChange={(e) => updateRow(r.room_id, 'elec_new', e.target.value)}
                    />
                  </td>
                  <td>
                    <span className="font-medium">{eUse} kWh</span>
                    <span className="block text-xs text-slate-500">{money(eUse * data.electricity_price)}</span>
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      disabled={r.invoiced}
                      className="input w-20"
                      value={r.water_old}
                      onChange={(e) => updateRow(r.room_id, 'water_old', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      disabled={r.invoiced}
                      className="input w-20"
                      value={r.water_new}
                      onChange={(e) => updateRow(r.room_id, 'water_new', e.target.value)}
                    />
                  </td>
                  <td>
                    <span className="font-medium">{wUse} m³</span>
                    <span className="block text-xs text-slate-500">{money(wUse * data.water_price)}</span>
                  </td>
                  <td>
                    {r.invoiced ? (
                      <Badge color="blue">Đã lập HĐ</Badge>
                    ) : r.reading_id ? (
                      <Badge color="green">Đã ghi</Badge>
                    ) : (
                      <Badge color="amber">Chưa ghi</Badge>
                    )}
                  </td>
                  <td className="text-right">
                    <Button
                      size="sm"
                      variant={r.reading_id ? 'secondary' : 'primary'}
                      disabled={r.invoiced}
                      loading={savingId === r.room_id}
                      icon={r.reading_id ? Check : Save}
                      onClick={() => saveOne(r)}
                    >
                      Lưu
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ReadingHistory({ toast, confirm }) {
  const [filterPeriod, setFilterPeriod] = useState('');
  const { data: items, loading, error, reload } = useApi(
    () => api.get('/readings', { period: filterPeriod }),
    [filterPeriod],
  );

  const remove = async (row) => {
    const ok = await confirm({ title: `Xóa chỉ số phòng ${row.room_code} kỳ ${period(row.period)}?`, danger: true });
    if (!ok) return;
    try {
      await api.del(`/readings/${row.id}`);
      toast('Đã xóa bản ghi chỉ số');
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <Card
      title="Lịch sử chỉ số đã ghi"
      actions={<Input type="month" value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)} />}
      bodyClass="p-0"
    >
      {loading ? <Spinner /> : error ? <div className="p-4"><ErrorBox error={error} onRetry={reload} /></div> : items.length === 0 ? (
        <EmptyState title="Chưa có dữ liệu chỉ số" icon={Gauge} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Kỳ</th><th>Phòng</th><th>Chỉ số điện</th><th>Tiền điện</th><th>Chỉ số nước</th><th>Tiền nước</th><th>Hóa đơn</th><th />
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{period(r.period)}</td>
                  <td>Phòng {r.room_code}</td>
                  <td>{r.elec_old} → {r.elec_new} ({r.elec_usage} kWh)</td>
                  <td className="font-medium">{money(r.elec_amount)}</td>
                  <td>{r.water_old} → {r.water_new} ({r.water_usage} m³)</td>
                  <td className="font-medium">{money(r.water_amount)}</td>
                  <td>{r.invoiced ? <Badge color="green">Đã xuất</Badge> : <Badge color="slate">Chưa xuất</Badge>}</td>
                  <td className="text-right">
                    {!r.invoiced && <IconButton icon={Trash2} variant="danger" title="Xóa" onClick={() => remove(r)} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function TenantReadings() {
  const { data: readings, loading, error, reload } = useApi(() => api.get('/readings'), []);
  const { data: fees } = useApi(() => api.get('/fees'), []);

  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Theo dõi điện, nước & phí dịch vụ"
        subtitle="Đối chiếu chỉ số công tơ hàng kỳ và danh mục đơn giá áp dụng tại Nhà 57 Giảng Võ"
      />

      {fees && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="card flex items-center gap-4 p-4">
            <div className="rounded-xl bg-amber-50 p-3 text-amber-600"><Zap className="h-6 w-6" /></div>
            <div>
              <p className="text-xs text-slate-500">Đơn giá điện</p>
              <p className="text-lg font-bold text-slate-800">{money(fees.electricity_price)} / kWh</p>
            </div>
          </div>
          <div className="card flex items-center gap-4 p-4">
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600"><Droplets className="h-6 w-6" /></div>
            <div>
              <p className="text-xs text-slate-500">Đơn giá nước</p>
              <p className="text-lg font-bold text-slate-800">{money(fees.water_price)} / m³</p>
            </div>
          </div>
          <div className="card p-4">
            <p className="text-xs font-semibold uppercase text-slate-400">Phí dịch vụ hàng tháng</p>
            <div className="mt-2 space-y-1 text-sm">
              {fees.services.map((s) => (
                <div key={s.id} className="flex justify-between">
                  <span>{s.name}</span>
                  <span className="font-medium">{money(s.price)}/{UNIT[s.unit]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <Card title="Bảng chỉ số điện, nước các kỳ" bodyClass="p-0">
        {readings.length === 0 ? (
          <EmptyState title="Chưa có chỉ số điện nước" icon={Gauge} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Kỳ</th>
                  <th>Phòng</th>
                  <th>Điện (cũ → mới)</th>
                  <th>Tiêu thụ điện</th>
                  <th>Thành tiền điện</th>
                  <th>Nước (cũ → mới)</th>
                  <th>Tiêu thụ nước</th>
                  <th>Thành tiền nước</th>
                </tr>
              </thead>
              <tbody>
                {readings.map((r) => (
                  <tr key={r.id}>
                    <td className="font-semibold">{period(r.period)}</td>
                    <td>Phòng {r.room_code}</td>
                    <td>{r.elec_old} → {r.elec_new}</td>
                    <td><strong>{r.elec_usage}</strong> kWh</td>
                    <td className="font-medium text-brand-700">{money(r.elec_amount)}</td>
                    <td>{r.water_old} → {r.water_new}</td>
                    <td><strong>{r.water_usage}</strong> m³</td>
                    <td className="font-medium text-brand-700">{money(r.water_amount)}</td>
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
