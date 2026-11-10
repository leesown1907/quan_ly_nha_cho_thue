import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { api } from '../api';
import { useFeedback } from '../context/FeedbackContext';
import { useApi } from '../hooks/useApi';
import { datetime } from '../utils/format';
import {
  Badge, Button, Card, cx, EmptyState, ErrorBox, IconButton, PageHeader, Spinner, Tabs,
} from '../components/ui';

const TYPE_LABEL = {
  invoice: { label: 'Hóa đơn', color: 'blue' },
  payment: { label: 'Thanh toán', color: 'green' },
  contract: { label: 'Hợp đồng', color: 'brand' },
  fee: { label: 'Khoản phí', color: 'amber' },
  incident: { label: 'Sự cố', color: 'red' },
  general: { label: 'Hệ thống', color: 'slate' },
};

export default function Notifications() {
  const nav = useNavigate();
  const { toast } = useFeedback();
  const [tab, setTab] = useState('all');
  const { data, loading, error, reload } = useApi(
    () => api.get('/notifications', { limit: 100, unread: tab === 'unread' ? '1' : undefined }),
    [tab],
  );

  const readAll = async () => {
    await api.put('/notifications/read-all');
    toast('Đã đánh dấu tất cả thông báo là đã đọc');
    reload();
  };

  const openItem = async (n) => {
    if (!n.is_read) await api.put(`/notifications/${n.id}/read`);
    reload();
    if (n.link) nav(n.link);
  };

  const remove = async (id) => {
    await api.del(`/notifications/${id}`);
    reload();
  };

  return (
    <div>
      <PageHeader
        title="Thông báo hệ thống"
        subtitle="Tự động thông báo khi có hóa đơn mới, xác nhận thanh toán, thay đổi hợp đồng, đơn giá hoặc cập nhật sự cố"
        actions={data?.unread > 0 && (
          <Button variant="secondary" icon={CheckCheck} onClick={readAll}>
            Đánh dấu tất cả đã đọc ({data.unread})
          </Button>
        )}
      />

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'all', label: 'Tất cả thông báo' },
          { value: 'unread', label: 'Chưa đọc', count: data?.unread || 0 },
        ]}
      />

      <Card bodyClass="p-0">
        {loading ? <Spinner /> : error ? <div className="p-4"><ErrorBox error={error} onRetry={reload} /></div> : data.items.length === 0 ? (
          <EmptyState title="Không có thông báo" icon={Bell} />
        ) : (
          <div className="divide-y divide-slate-100">
            {data.items.map((n) => {
              const t = TYPE_LABEL[n.type] || TYPE_LABEL.general;
              return (
                <div
                  key={n.id}
                  className={cx('flex items-start justify-between gap-4 px-5 py-4 transition hover:bg-slate-50', !n.is_read && 'bg-brand-50/40')}
                >
                  <button onClick={() => openItem(n)} className="flex-1 text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge color={t.color}>{t.label}</Badge>
                      <span className={cx('text-sm', !n.is_read ? 'font-bold text-slate-900' : 'font-medium text-slate-700')}>
                        {n.title}
                      </span>
                      {!n.is_read && <span className="h-2 w-2 rounded-full bg-brand-600" />}
                    </div>
                    {n.message && <p className="mt-1 text-sm text-slate-600">{n.message}</p>}
                    <p className="mt-1 text-xs text-slate-400">{datetime(n.created_at)}</p>
                  </button>
                  <IconButton icon={Trash2} variant="danger" title="Xóa" onClick={() => remove(n.id)} />
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
