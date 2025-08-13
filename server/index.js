import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { db, initDB } from './db.js';

const app = express();
const PORT = process.env.PORT || 5174;
const ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: ORIGIN, credentials: true }));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// cookie uid
app.use((req, res, next) => {
  let uid = req.cookies.uid;
  if (!uid) {
    uid = uuidv4();
    res.cookie('uid', uid, { httpOnly: true, sameSite: 'lax', maxAge: 365*24*3600*1000 });
  }
  req.uid = uid;
  next();
});

// rate limit (5s)
const lastMap = new Map();
const tooFast = (uid) => {
  const now = Date.now();
  const last = lastMap.get(uid) || 0;
  if (now - last < 5000) return true;
  lastMap.set(uid, now);
  return false;
};

// routes
app.get('/api/health', (_, res)=>res.json({ ok:true }));

app.get('/api/messages', (req, res) => {
  const type = (req.query.type||'wall').toLowerCase();
  const page = Math.max(parseInt(req.query.page||'1',10),1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize||'20',10),1), 100);
  const offset = (page-1)*pageSize;
  const all = type==='all';
  const sql = all
    ? `SELECT id,user_id,nickname,content,type,created_at FROM messages ORDER BY created_at DESC LIMIT ? OFFSET ?`
    : `SELECT id,user_id,nickname,content,type,created_at FROM messages WHERE type=? ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  const params = all? [pageSize, offset] : [type, pageSize, offset];
  db.all(sql, params, (err, rows)=>{
    if (err) return res.status(500).json({ error:'db_error' });
    res.json({ list: rows });
  });
});

app.get('/api/my-messages', (req, res)=>{
  const type = (req.query.type||'all').toLowerCase();
  const page = Math.max(parseInt(req.query.page||'1',10),1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize||'20',10),1), 100);
  const offset = (page-1)*pageSize;
  const uid = req.uid;
  let where = 'WHERE user_id=?';
  const params = [uid];
  if (type!=='all'){ where += ' AND type=?'; params.push(type); }
  db.all(`SELECT id,user_id,nickname,content,type,created_at FROM messages ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, pageSize, offset], (err, rows)=>{
    if (err) return res.status(500).json({ error:'db_error' });
    res.json({ list: rows });
  });
});

const escapeHTML = (s='')=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#39;');
const charCount = (s='')=>[...s].length;
const nickClamp = (n)=> (n?.trim()?.slice(0,16)) || '小纸条';

app.post('/api/messages', (req, res)=>{
  const { content, type='wall', nickname } = req.body || {};
  const uid = req.uid;
  if (tooFast(uid)) return res.status(429).json({ error:'too_frequent', message:'太快啦，等会再发~' });
  if (!content || typeof content!=='string' || !content.trim()) return res.status(400).json({ error:'bad_content' });
  const t = String(type).toLowerCase();
  if (!['wall','note'].includes(t)) return res.status(400).json({ error:'bad_type' });
  const cnt = charCount(content.trim());
  if (t==='note' && cnt>12) return res.status(400).json({ error:'too_long', message:'小纸条 ≤12 字' });
  if (t==='wall' && cnt>500) return res.status(400).json({ error:'too_long', message:'留言 ≤500 字' });
  const safe = escapeHTML(content.trim());
  const nick = nickClamp(nickname);
  const ts = Date.now();
  db.run(`INSERT INTO messages(user_id,nickname,content,type,created_at) VALUES (?,?,?,?,?)`, [uid,nick,safe,t,ts], function(err){
    if (err) return res.status(500).json({ error:'db_error' });
    res.json({ id:this.lastID, created_at: ts });
  });
});

initDB();
app.listen(PORT, ()=> console.log(`API on http://localhost:${PORT}`));
