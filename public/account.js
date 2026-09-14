const authPanel = document.getElementById("auth-panel");
const desk = document.getElementById("desk");
const form = document.getElementById("auth-form");
const toggle = document.getElementById("toggle-auth");
const callRow = document.getElementById("call-row");
const title = document.getElementById("auth-title");
const lead = document.getElementById("auth-lead");
const submit = document.getElementById("auth-submit");
const err = document.getElementById("auth-err");
const billErr = document.getElementById("bill-err");
let mode = "login";
function showErr(el, msg) { if (!el) return; el.hidden = !msg; el.textContent = msg || ""; }
async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json", ...(opts.headers || {}) }, credentials: "same-origin", ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}
function renderUser(user) {
  if (!user) { authPanel.hidden = false; desk.hidden = true; return; }
  authPanel.hidden = true; desk.hidden = false;
  document.getElementById("hello").textContent = user.callsign || user.email;
  document.getElementById("email-line").textContent = user.email;
  document.getElementById("key-line").textContent = user.licenseKey ? `Desktop license key: ${user.licenseKey}` : "";
  document.querySelector("#profile-form [name=callsign]").value = user.callsign || "";
  document.querySelector("#profile-form [name=name]").value = user.name || "";
  document.getElementById("avatar").src = user.photo || "/assets/mark.svg";
  const plans = (user.plans || []).map((p) => `${p.plan} (${p.status})`);
  document.getElementById("plan-line").textContent = plans.length ? `Active: ${plans.join(", ")}` : "No active plan yet.";
}
toggle.addEventListener("click", () => {
  mode = mode === "login" ? "signup" : "login";
  callRow.hidden = mode === "login";
  title.textContent = mode === "login" ? "Sign in" : "Create account";
  lead.textContent = mode === "login" ? "Same account for the website and the desktop license check." : "Email, password, callsign. Then pick a yearly plan.";
  submit.textContent = mode === "login" ? "Sign in" : "Create account";
  toggle.textContent = mode === "login" ? "Need an account? Create one" : "Already have an account? Sign in";
});
form.addEventListener("submit", async (e) => {
  e.preventDefault(); showErr(err, "");
  try {
    const data = await api(mode === "login" ? "/api/login" : "/api/signup", { method: "POST", body: JSON.stringify({ email: form.email.value, password: form.password.value, callsign: form.callsign.value }) });
    renderUser(data.user);
  } catch (ex) { showErr(err, ex.message); }
});
document.getElementById("profile-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const data = await api("/api/profile", { method: "POST", body: JSON.stringify({ callsign: e.target.callsign.value, name: e.target.name.value }) });
    const file = document.getElementById("photo").files[0];
    if (file) {
      const photo = new FormData(); photo.append("photo", file);
      const res = await fetch("/api/photo", { method: "POST", body: photo, credentials: "same-origin" });
      const next = await res.json();
      if (!res.ok) throw new Error(next.error || "Photo failed");
      renderUser(next.user);
    } else renderUser(data.user);
  } catch (ex) { showErr(billErr, ex.message); }
});
document.querySelectorAll("[data-plan]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    showErr(billErr, "");
    try {
      const data = await api("/api/checkout", { method: "POST", body: JSON.stringify({ plan: btn.dataset.plan }) });
      window.location.href = data.url;
    } catch (ex) { showErr(billErr, ex.message); }
  });
});
document.getElementById("portal-btn").addEventListener("click", async () => {
  showErr(billErr, "");
  try {
    const data = await api("/api/portal", { method: "POST", body: "{}" });
    window.location.href = data.url;
  } catch (ex) { showErr(billErr, ex.message); }
});
document.getElementById("logout").addEventListener("click", async () => {
  await api("/api/logout", { method: "POST", body: "{}" });
  renderUser(null);
});
api("/api/me").then((d) => renderUser(d.user)).catch(() => renderUser(null));
