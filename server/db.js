import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const db = new sqlite3.Database(path.join(__dirname, 'messages.db'));

export function initDB(){
  db.serialize(()=>{
    db.run(`CREATE TABLE IF NOT EXISTS messages(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      nickname TEXT,
      content TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('wall','note')),
      created_at INTEGER NOT NULL
    )`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_created ON messages(created_at DESC)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_user ON messages(user_id)`);
  });
}
```

## server/package.json
```json
{
  "name": "messagewall-api",
  "type": "module",
  "version": "1.0.0",
  "scripts": {
    "dev": "node server/index.js",
    "start": "node server/index.js"
  },
  "dependencies": {
    "cookie-parser": "^1.4.6",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "sqlite3": "^5.1.6",
    "uuid": "^9.0.1"
  }
}
