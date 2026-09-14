const calls = ["K1ABC", "W3SK", "VE3QSO", "G4ARC", "JA1HAM", "VK2LOG"];
const typed = document.getElementById("typed");
const utc = document.getElementById("utc");
const year = document.getElementById("year");
const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.getElementById("site-nav");

function updateTime() {
  const now = new Date();
  const hours = String(now.getUTCHours()).padStart(2, "0");
  const minutes = String(now.getUTCMinutes()).padStart(2, "0");
  const seconds = String(now.getUTCSeconds()).padStart(2, "0");
  if (utc) utc.textContent = `${hours}:${minutes}:${seconds}z`;
}

updateTime();
setInterval(updateTime, 1000);
if (year) year.textContent = new Date().getFullYear();

let callIndex = 0;
let charIndex = 0;
let erasing = false;

function typeCall() {
  if (!typed) return;
  const word = calls[callIndex];

  if (!erasing) {
    charIndex += 1;
    typed.textContent = word.slice(0, charIndex);
    if (charIndex === word.length) {
      erasing = true;
      window.setTimeout(typeCall, 1500);
      return;
    }
  } else {
    charIndex -= 1;
    typed.textContent = word.slice(0, charIndex);
    if (charIndex === 0) {
      erasing = false;
      callIndex = (callIndex + 1) % calls.length;
    }
  }

  window.setTimeout(typeCall, erasing ? 55 : 125);
}

typeCall();

if (navToggle && siteNav) {
  navToggle.addEventListener("click", () => {
    const open = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!open));
    siteNav.classList.toggle("open", !open);
  });

  siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navToggle.setAttribute("aria-expanded", "false");
      siteNav.classList.remove("open");
    });
  });
}
