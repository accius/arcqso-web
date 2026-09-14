const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cookieSession = require("cookie-session");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const store = require("./lib/store");

const app = express();
const port = process.env.PORT || 3000;
const publicDir = path.join(__dirname, "public");
const uploadDir = path.join(publicDir, "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const stripeKey = process.env.STRIPE_SECRET_KEY || "";
const stripe = stripeKey ? require("stripe")(stripeKey) : null;
const prices = {
  desktop: process.env.STRIPE_PRICE_DESKTOP || "",
  mobile: process.env.STRIPE_PRICE_MOBILE || "",
};
const publicUrl = (process.env.PUBLIC_URL || "").replace(/\/$/, "");

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
      cb(null, `${req.session.userId}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype));
  },
});

app.set("trust proxy", 1);
app.use(cookieSession({
  name: "arcqso",
  keys: [process.env.SESSION_SECRET || "dev-only-change-me"],
  maxAge: 30 * 24 * 60 * 60 * 1000,
  sameSite: "lax",
}));

app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(400).send("webhook not configured");
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook error: ${err.message}`);
  }
  const obj = event.data.object;
  if (event.type === "checkout.session.completed") {
    const user = store.findById(obj.client_reference_id) || store.findByCustomer(obj.customer);
    if (user) {
      store.upsertUser({ id: user.id, stripeCustomerId: obj.customer });
      const plan = obj.metadata && obj.metadata.plan;
      if (plan) store.setPlan(user.id, plan, "active");
    }
  }
  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const user = store.findByCustomer(obj.customer);
    const priceId = obj.items && obj.items.data[0] && obj.items.data[0].price.id;
    let plan = null;
    if (priceId === prices.desktop) plan = "desktop";
    if (priceId === prices.mobile) plan = "mobile";
    if (user && plan) {
      const status = obj.status === "active" || obj.status === "trialing" ? obj.status : "canceled";
      store.setPlan(user.id, plan, event.type.endsWith("deleted") ? "canceled" : status);
    }
  }
  res.json({ received: true });
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(publicDir));
app.use(express.static(__dirname));

function requireUser(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: "Sign in first." });
  const user = store.findById(req.session.userId);
  if (!user) { req.session = null; return res.status(401).json({ error: "Sign in first." }); }
  req.user = user;
  next();
}

app.get("/api/me", (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  res.json({ user: store.publicUser(store.findById(req.session.userId)) });
});

app.post("/api/signup", async (req, res) => {
  const email = String(req.body.email || "").toLowerCase().trim();
  const password = String(req.body.password || "");
  const callsign = String(req.body.callsign || "").toUpperCase().trim();
  if (!email.includes("@") || password.length < 8) {
    return res.status(400).json({ error: "Use a real email and a password of at least 8 characters." });
  }
  if (store.findByEmail(email)) return res.status(409).json({ error: "That email already has an account. Sign in." });
  const user = store.upsertUser({
    email, callsign,
    passwordHash: await bcrypt.hash(password, 10),
    licenseKey: crypto.randomBytes(12).toString("hex"),
  });
  req.session.userId = user.id;
  res.json({ user: store.publicUser(user) });
});

app.post("/api/login", async (req, res) => {
  const email = String(req.body.email || "").toLowerCase().trim();
  const password = String(req.body.password || "");
  const user = store.findByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash || ""))) {
    return res.status(401).json({ error: "Email or password is wrong." });
  }
  req.session.userId = user.id;
  res.json({ user: store.publicUser(user) });
});

app.post("/api/logout", (req, res) => { req.session = null; res.json({ ok: true }); });

app.post("/api/profile", requireUser, (req, res) => {
  const user = store.upsertUser({
    id: req.user.id,
    callsign: String(req.body.callsign || "").toUpperCase().trim(),
    name: String(req.body.name || "").trim(),
  });
  res.json({ user: store.publicUser(user) });
});

app.post("/api/photo", requireUser, upload.single("photo"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Choose a photo." });
  const user = store.upsertUser({ id: req.user.id, photo: `/uploads/${req.file.filename}` });
  res.json({ user: store.publicUser(user) });
});

app.post("/api/checkout", requireUser, async (req, res) => {
  const plan = req.body.plan === "mobile" ? "mobile" : "desktop";
  if (!stripe || !prices[plan]) {
    return res.status(503).json({ error: "Stripe is not configured yet. Add STRIPE_SECRET_KEY and STRIPE_PRICE_* on Railway." });
  }
  try {
    let customerId = req.user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        metadata: { userId: req.user.id, callsign: req.user.callsign || "" },
      });
      customerId = customer.id;
      store.upsertUser({ id: req.user.id, stripeCustomerId: customerId });
    }
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: req.user.id,
      line_items: [{ price: prices[plan], quantity: 1 }],
      success_url: `${publicUrl || ""}/account.html?ok=${plan}`,
      cancel_url: `${publicUrl || ""}/account.html?canceled=1`,
      metadata: { plan, userId: req.user.id },
      allow_promotion_codes: true,
    });
    res.json({ url: session.url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/portal", requireUser, async (req, res) => {
  if (!stripe || !req.user.stripeCustomerId) {
    return res.status(400).json({ error: "No Stripe customer on this account yet. Start a subscription first." });
  }
  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: req.user.stripeCustomerId,
      return_url: `${publicUrl || ""}/account.html`,
    });
    res.json({ url: portal.url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/license/check", (req, res) => {
  const key = String(req.body.licenseKey || "").trim();
  const email = String(req.body.email || "").toLowerCase().trim();
  const user = store.findByEmail(email);
  if (!user || user.licenseKey !== key) return res.status(401).json({ ok: false, error: "Unknown license." });
  res.json({ ok: true, callsign: user.callsign || "", plans: user.plans || [], photo: user.photo || "" });
});

app.get(["/account", "/login", "/signup"], (_req, res) => {
  res.sendFile(path.join(publicDir, "account.html"));
});
app.get("/", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));

app.listen(port, "0.0.0.0", () => console.log(`ArcQSO site listening on ${port}`));
