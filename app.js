const calls = ["K1ABC", "W3XYZ", "VE3QSO", "G4ARC", "JA1HAM", "VK2LOG"];
const typed = document.getElementById("typed");
const utc = document.getElementById("utc");
const utc2 = document.getElementById("utc2");

function zulu() {
  const d = new Date();
  const h = String(d.getUTCHours()).padStart(2, "0");
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  const s = String(d.getUTCSeconds()).padStart(2, "0");
  if (utc) utc.textContent = `${h}${m}z`;
  if (utc2) utc2.textContent = `${h}:${m}:${s}`;
}
zulu();
setInterval(zulu, 1000);

let callIndex = 0;
let charIndex = 0;
let erasing = false;

function typeCall() {
  if (!typed) return;
  const word = calls[callIndex];
  if (!erasing) {
    typed.textContent = word.slice(0, ++charIndex);
    if (charIndex === word.length) {
      erasing = true;
      setTimeout(typeCall, 1600);
      return;
    }
  } else {
    typed.textContent = word.slice(0, --charIndex);
    if (charIndex === 0) {
      erasing = false;
      callIndex = (callIndex + 1) % calls.length;
    }
  }
  setTimeout(typeCall, erasing ? 50 : 140);
}
typeCall();
