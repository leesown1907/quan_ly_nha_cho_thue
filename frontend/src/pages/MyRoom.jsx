import { DoorOpen, FileText } from 'lucide-react';
import { api } from '../api';
import { useApi } from '../hooks/useApi';
import { CONTRACT_STATUS, date, money, ROOM_STATUS } from '../utils/format';
import {
  Badge, Card, EmptyState, ErrorBox, InfoRow, PageHeader, Spinner, StatusBadge,
} from '../components/ui';

export default function MyRoom() {
  const { data: rooms, loading: l1, error: e1, reload } = useApi(() => api.get('/rooms'), []);
  const { data: contracts, loading: l2 } = useApi(() => api.get('/contracts'), []);

  if (l1 || l2) return <Spinner />;
  if (e1) return <ErrorBox error={e1} onRetry={reload} />;

  const room = rooms?.[0];
  const activeContract = contracts?.find((c) => c.status === 'active');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Thông tin phòng & hợp đồng thuê"
        subtitle="Chi tiết phòng đang thuê, điều khoản, tiền đặt cọc và thời hạn hợp đồng của bạn"
      />

      {!room && !activeContract ? (
        <Card><EmptyState title="Bạn hiện chưa có hợp đồng thuê phòng đang hiệu lực" icon={DoorOpen} /></Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {room && (
            <Card title={`Thông tin Phòng ${room.code}`}>
              <InfoRow label="Mã phòng">Phòng {room.code}</InfoRow>
              <InfoRow label="Tầng">Tầng {room.floor}</InfoRow>
              <InfoRow label="Diện tích">{room.area} m²</InfoRow>
              <InfoRow label="Giá phòng niêm yết">{money(room.base_price)} / tháng</InfoRow>
              <InfoRow label="Số người ở tối đa">{room.max_occupants} người</InfoRow>
              <InfoRow label="Trạng thái"><StatusBadge map={ROOM_STATUS} value={room.status} /></InfoRow>
              {room.description && (
                <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                  <strong>Mô tả & tiện nghi:</strong> {room.description}
                </div>
              )}
            </Card>
          )}

          {activeContract && (
            <Card title={`Hợp đồng đang hiệu lực (${activeContract.code})`}>
              <InfoRow label="Mã hợp đồng">{activeContract.code}</InfoRow>
              <InfoRow label="Trạng thái"><StatusBadge map={CONTRACT_STATUS} value={activeContract.status} /></InfoRow>
              <InfoRow label="Ngày bắt đầu">{date(activeContract.start_date)}</InfoRow>
              <InfoRow label="Ngày hết hạn">
                {date(activeContract.end_date)}{' '}
                <Badge color={activeContract.days_left <= 30 ? 'amber' : 'green'} className="ml-1">
                  {activeContract.days_left < 0 ? `Quá hạn ${-activeContract.days_left} ngày` : `Còn ${activeContract.days_left} ngày`}
                </Badge>
              </InfoRow>
              <InfoRow label="Giá thuê theo hợp đồng">{money(activeContract.monthly_rent)} / tháng</InfoRow>
              <InfoRow label="Tiền đặt cọc">{money(activeContract.deposit)}</InfoRow>
              <InfoRow label="Số người đăng ký ở">{activeContract.occupants} người</InfoRow>
              <InfoRow label="Ngày hẹn thanh toán">Ngày {activeContract.payment_day} hằng tháng</InfoRow>
              {activeContract.terms && (
                <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                  <strong>Điều khoản hợp đồng:</strong> {activeContract.terms}
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {contracts?.length > 1 && (
        <Card title="Lịch sử tất cả hợp đồng của tôi" bodyClass="p-0">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Mã HĐ</th><th>Phòng</th><th>Bắt đầu</th><th>Kết thúc</th><th>Giá thuê</th><th>Tiền cọc</th><th>Trạng thái</th></tr>
              </thead>
              <tbody>
                {contracts.map((c) => (
                  <tr key={c.id}>
                    <td className="font-semibold">{c.code}</td>
                    <td>Phòng {c.room_code}</td>
                    <td>{date(c.start_date)}</td>
                    <td>{date(c.ended_at || c.end_date)}</td>
                    <td>{money(c.monthly_rent)}</td>
                    <td>{money(c.deposit)}</td>
                    <td><StatusBadge map={CONTRACT_STATUS} value={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
