import { DB } from "https://deno.land/x/sqlite/mod.ts";
import {   expectedQuestions, totalQuestions} from "./static/FileValidation.js";

const db = new DB("Data.db");
const subTable = "RESUME_APPLICATIONS";
const userTable = "accounts";
const sessionTable = "sessions";
const sessionTime = 3600 * 72 * 1000;

const questions = expectedQuestions;
const questionFields = questions.map(q => "q" + q).join(", ");
const createFields = questions.map(q => "q" + q + " TEXT").join(", ");

function makeMarks(n) {
  return "(" + Array(n).fill("?").join(", ") + ")";
}

db.execute(
  `CREATE TABLE IF NOT EXISTS ${subTable} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ShieldID TEXT UNIQUE,
    ${createFields},
    filename TEXT,
    filecontents TEXT
  )`
);

db.execute(
  `CREATE TABLE IF NOT EXISTS ${userTable} (
    username TEXT PRIMARY KEY,
    password TEXT,
    access TEXT,
    ShieldID TEXT,
    name TEXT
  )`
);

db.execute(
  `CREATE TABLE IF NOT EXISTS ${sessionTable} (
    sessionid TEXT PRIMARY KEY,
    username TEXT,
    expiration INTEGER
  )`
);

export function addSubmission(data, filename, contents) {
  const values = [data.ShieldID];
  for (let q of questions) {
    values.push(data[q]);
  }
  values.push(filename);
  values.push(contents);
  return db.query(
    `INSERT OR REPLACE INTO ${subTable} (ShieldID, ${questionFields}, filename, filecontents) VALUES ${makeMarks(totalQuestions + 3)}`,
    values
  );
}

export function getAllSubmissions() {
  const result = [];
  const q = db.prepareQuery(`SELECT id, ShieldID, ${questionFields} FROM ${subTable} ORDER BY ShieldID ASC LIMIT 50`);
  for (let row of q.iter()) {
    const id = row[0];
    const ShieldID = row[1];
    const info = db.query(`SELECT name FROM ${userTable} WHERE ShieldID = ?`, [ShieldID]);
    const name = info[0] ? info[0][0] : "";
    const entry = { id, ShieldID, name };
    for (let i = 0; i < questions.length; i++) {
      entry["q" + questions[i]] = row[i + 2];
    }
    result.push(entry);
  }
  q.finalize();
  return result;
}

function countBlanks() {
  const blanks = Array(totalQuestions).fill(0);
  const subs = getAllSubmissions();
  for (let s of subs) {
    for (let i = 0; i < questions.length; i++) {
      const val = s["q" + questions[i]];
      if (!val || val.trim() === "") blanks[i]++;
    }
  }
  return blanks;
}

export function analyzeSubmissions() {
  const total = db.query(`SELECT COUNT(*) FROM ${subTable}`)[0][0];
  const ids = db.query(`SELECT DISTINCT ShieldID FROM ${subTable}`).map(row => row[0]);
  const blanks = countBlanks();
  return { count: total, ShieldIDList: ids, blankQuestions: blanks };
}

export function addAccount(u, p, a, id, n) {
  return db.query(
    `INSERT OR REPLACE INTO ${userTable} (username, password, access, ShieldID, name) VALUES (?, ?, ?, ?, ?)`,
    [u, p, a, id, n]
  );
}

export function getAccount(u) {
  const r = db.query(`SELECT * FROM ${userTable} WHERE username = ?`, [u]);
  if (r.length === 0) return null;
  const [username, password, access, ShieldID, name] = r[0];
  return { username, password, access, ShieldID, name };
}

export function getName(id) {
  return db.query(`SELECT name FROM ${userTable} WHERE ShieldID = ?`, [id]);
}

export function newSession(u) {
  const sid = crypto.randomUUID();
  const exp = Date.now() + sessionTime;
  db.query(`INSERT INTO ${sessionTable} (sessionid, username, expiration) VALUES (?, ?, ?)`, [sid, u, exp]);
  return sid;
}

export function getSession(sid) {
  if (!sid) return null;
  const r = db.query(`SELECT username, expiration FROM ${sessionTable} WHERE sessionid = ?`, [sid]);
  if (r.length === 0) return null;
  const [username, expiration] = r[0];
  if (expiration > Date.now()) return { sessionid: sid, username, expiration };
  return null;
}

export function close() {
  db.close();
}
