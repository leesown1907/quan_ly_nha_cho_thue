import 'dotenv/config';
import { initDb, exec } from './index.js';
import { seed } from './seed.js';

// Xóa toàn bộ dữ liệu và khởi tạo lại dữ liệu mẫu
await initDb();
await exec('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
await initDb();
await seed();
console.log('✔ Đã đặt lại cơ sở dữ liệu');
process.exit(0);
