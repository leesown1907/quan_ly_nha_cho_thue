import { HttpError } from '../utils/http.js';

const CONNECTION_CODES = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', '57P01', '57P03', '08000', '08003', '08006']);

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Dữ liệu gửi lên không đúng định dạng JSON' });
  }
  switch (err?.code) {
    case '23505':
      return res.status(409).json({ message: 'Dữ liệu bị trùng lặp (mã hoặc tên đã tồn tại)' });
    case '23503':
      return res.status(409).json({ message: 'Không thể thực hiện vì dữ liệu đang được tham chiếu bởi bản ghi khác' });
    case '23514':
    case '22P02':
    case '22007':
    case '22008':
      return res.status(400).json({ message: 'Dữ liệu không hợp lệ, vui lòng kiểm tra lại' });
    default:
      break;
  }
  if (CONNECTION_CODES.has(err?.code)) {
    return res.status(503).json({ message: 'Không thể kết nối cơ sở dữ liệu, vui lòng thử lại sau' });
  }
  console.error('[ERROR]', err);
  return res.status(500).json({ message: 'Lỗi hệ thống, vui lòng thử lại sau' });
}
