const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const DATA_DIR = process.env.ARCQSO_DATA_DIR || path.join(__dirname, "..", "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
function ensure() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]");
}
function readUsers() { ensure(); return JSON.parse(fs.readFileSync(USERS_FILE, "utf8")); }
function writeUsers(users) { ensure(); fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2)); }
function publicUser(u) {
  if (!u) return null;
  return { id: u.id, email: u.email, callsign: u.callsign || "", name: u.name || "", photo: u.photo || "", plans: u.plans || [], stripeCustomerId: u.stripeCustomerId || null, licenseKey: u.licenseKey || null };
}
function findByEmail(email) { return readUsers().find((u) => u.email === email.toLowerCase().trim()); }
function findById(id) { return readUsers().find((u) => u.id === id); }
function findByCustomer(customerId) { return readUsers().find((u) => u.stripeCustomerId === customerId); }
function upsertUser(partial) {
  const users = readUsers();
  const idx = users.findIndex((u) => u.id === partial.id || u.email === partial.email);
  if (idx === -1) {
    const user = { id: partial.id || crypto.randomUUID(), licenseKey: partial.licenseKey || crypto.randomBytes(12).toString("hex"), plans: [], createdAt: new Date().toISOString(), ...partial };
    users.push(user); writeUsers(users); return user;
  }
  users[idx] = { ...users[idx], ...partial }; writeUsers(users); return users[idx];
}
function setPlan(userId, plan, status) {
  const users = readUsers();
  const u = users.find((x) => x.id === userId);
  if (!u) return null;
  u.plans = (u.plans || []).filter((p) => p.plan !== plan);
  if (status && status !== "canceled") u.plans.push({ plan, status, updatedAt: new Date().toISOString() });
  writeUsers(users); return u;
}
module.exports = { DATA_DIR, publicUser, findByEmail, findById, findByCustomer, upsertUser, setPlan };
