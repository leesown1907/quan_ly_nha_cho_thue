import { useEffect, useState } from 'react';
import { Droplets, Edit3, Plus, Save, Trash2, Zap } from 'lucide-react';
import { api } from '../api';
import { useFeedback } from '../context/FeedbackContext';
import { useApi } from '../hooks/useApi';
import { money, UNIT } from '../utils/format';
import {
  Badge, Button, Card, ErrorBox, IconButton, Input, Modal, PageHeader, Select, Spinner, Textarea,
} from '../components/ui';

const EMPTY_SERVICE = { name: '', price: 100000, unit: 'room', description: '', is_active: true };

export default function Fees() {
  const { toast, confirm } = useFeedback();
  const { data, loading, error, reload } = useApi(() => api.get('/fees'), []);
  const [elecPrice, setElecPrice] = useState(3500);
  const [waterPrice, setWaterPrice] = useState(25000);
  const [savingPrices, setSavingPrices] = useState(false);

  const [serviceModal, setServiceModal] = useState(null);
  const [savingService, setSavingService] = useState(false);

  useEffect(() => {
    if (data) {
      setElecPrice(data.electricity_price);
      setWaterPrice(data.water_price);
    }
  }, [data]);

  const savePrices = async (e) => {
    e.preventDefault();
    setSavingPrices(true);
    try {
      await api.put('/fees/prices', { electricity_price: elecPrice, water_price: waterPrice });
      toast('Đã cập nhật đơn giá điện, nước & gửi thông báo cho người thuê');
      reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSavingPrices(false);
    }
  };

  const saveService = async (e) => {
    e.preventDefault();
    setSavingService(true);
    try {
      if (serviceModal.id) {
        await api.put(`/fees/services/${serviceModal.id}`, serviceModal);
        toast('Đã cập nhật khoản phí dịch vụ');
      } else {
        await api.post('/fees/services', serviceModal);
        toast('Đã thêm khoản phí dịch vụ');
      }
      setServiceModal(null);
      reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSavingService(false);
    }
  };

  const removeService = async (s) => {
    const ok = await confirm({ title: `Xóa dịch vụ "${s.name}"?`, danger: true });
    if (!ok) return;
    try {
      await api.del(`/fees/services/${s.id}`);
      toast('Đã xóa dịch vụ');
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Thiết lập đơn giá & danh mục phí dịch vụ"
        subtitle="Làm cơ sở dữ liệu chuẩn để tự động tổng hợp và xuất hóa đơn hàng tháng"
      />

      <Card title="Đơn giá điện, nước">
        <form onSubmit={savePrices} className="grid items-end gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-50 p-3 text-amber-600"><Zap className="h-5 w-5" /></div>
            <Input
              className="flex-1"
              label="Đơn giá điện (đ / kWh)"
              type="number"
              step="100"
              min="0"
              required
              value={elecPrice}
              onChange={(e) => setElecPrice(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600"><Droplets className="h-5 w-5" /></div>
            <Input
              className="flex-1"
              label="Đơn giá nước (đ / m³)"
              type="number"
              step="1000"
              min="0"
              required
              value={waterPrice}
              onChange={(e) => setWaterPrice(e.target.value)}
            />
          </div>
          <div>
            <Button type="submit" icon={Save} loading={savingPrices}>Cập nhật đơn giá</Button>
          </div>
        </form>
      </Card>

      <Card
        title="Danh mục phí dịch vụ cố định hàng tháng"
        actions={<Button size="sm" icon={Plus} onClick={() => setServiceModal({ ...EMPTY_SERVICE })}>Thêm khoản phí</Button>}
        bodyClass="p-0"
      >
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Tên dịch vụ</th>
                <th>Đơn giá</th>
                <th>Cách tính</th>
                <th>Mô tả</th>
                <th>Trạng thái</th>
                <th className="text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {data.services.map((s) => (
                <tr key={s.id}>
                  <td className="font-semibold text-slate-800">{s.name}</td>
                  <td className="font-medium text-brand-700">{money(s.price)}</td>
                  <td>Theo {UNIT[s.unit]} / tháng</td>
                  <td className="text-slate-500">{s.description || '—'}</td>
                  <td>
                    <Badge color={s.is_active ? 'green' : 'slate'}>
                      {s.is_active ? 'Đang áp dụng' : 'Tạm ngưng'}
                    </Badge>
                  </td>
                  <td className="text-right">
                    <IconButton icon={Edit3} title="Sửa" onClick={() => setServiceModal({ ...s })} />
                    <IconButton icon={Trash2} variant="danger" title="Xóa" onClick={() => removeService(s)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={!!serviceModal}
        onClose={() => setServiceModal(null)}
        title={serviceModal?.id ? 'Cập nhật phí dịch vụ' : 'Thêm khoản phí dịch vụ'}
        size="sm"
      >
        {serviceModal && (
          <form onSubmit={saveService} className="space-y-4">
            <Input label="Tên khoản phí" required value={serviceModal.name} onChange={(e) => setServiceModal({ ...serviceModal, name: e.target.value })} placeholder="VD: Internet, Vệ sinh, Gửi xe..." />
            <Input label="Đơn giá (đ/tháng)" type="number" step="5000" min="0" required value={serviceModal.price} onChange={(e) => setServiceModal({ ...serviceModal, price: e.target.value })} />
            <Select label="Đơn vị tính" value={serviceModal.unit} onChange={(e) => setServiceModal({ ...serviceModal, unit: e.target.value })}>
              <option value="room">Theo phòng (1 khoản / phòng)</option>
              <option value="person">Theo đầu người (nhân với số người ở trong HĐ)</option>
            </Select>
            <Textarea label="Mô tả" value={serviceModal.description || ''} onChange={(e) => setServiceModal({ ...serviceModal, description: e.target.value })} />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={serviceModal.is_active !== false}
                onChange={(e) => setServiceModal({ ...serviceModal, is_active: e.target.checked })}
              />
              Áp dụng khi tạo hóa đơn hàng tháng
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setServiceModal(null)}>Hủy</Button>
              <Button type="submit" loading={savingService}>Lưu</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
