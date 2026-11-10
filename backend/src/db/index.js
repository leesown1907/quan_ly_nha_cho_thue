import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATE_OID = 1082;

let impl = null;
export let dbMode = 'unknown';

/**
 * Khởi tạo kết nối CSDL.
 * - Có DATABASE_URL  => dùng PostgreSQL server qua thư viện `pg`.
 * - Không có         => dùng PostgreSQL nhúng (PGlite), dữ liệu lưu trên đĩa.
 */
export async function initDb() {
  if (process.env.DATABASE_URL) {
    pg.types.setTypeParser(DATE_OID, (v) => v); // giữ DATE dạng 'YYYY-MM-DD'
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
    impl = {
      query: (text, params) => pool.query(text, params),
      exec: (sql) => pool.query(sql),
      async transaction(fn) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await fn({ query: (t, p) => client.query(t, p) });
          await client.query('COMMIT');
          return result;
        } catch (err) {
          await client.query('ROLLBACK').catch(() => {});
          throw err;
        } finally {
          client.release();
        }
      },
    };
    dbMode = 'postgresql';
  } else {
    const { PGlite } = await import('@electric-sql/pglite');
    const dir = path.resolve(__dirname, '../../', process.env.PGLITE_DIR || 'data/pgdata');
    fs.mkdirSync(dir, { recursive: true });
    const db = new PGlite(dir, { parsers: { [DATE_OID]: (v) => v } });
    await db.waitReady;
    impl = {
      query: (text, params) => db.query(text, params),
      exec: (sql) => db.exec(sql),
      transaction: (fn) => db.transaction((tx) => fn({ query: (t, p) => tx.query(t, p) })),
    };
    dbMode = 'pglite';
  }

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await impl.exec(schema);
}

export const query = (text, params = []) => impl.query(text, params);
export const exec = (sql) => impl.exec(sql);
export const transaction = (fn) => impl.transaction(fn);
/** Đối tượng có hàm query dùng chung (ngoài transaction) */
export const db = { query: (t, p = []) => impl.query(t, p) };
