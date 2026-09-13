const btn = document.getElementById("menuBtn");
const links = document.getElementById("navLinks");
if (btn && links) {
  btn.addEventListener("click", () => {
    const open = links.style.display === "flex";
    links.style.display = open ? "none" : "flex";
    links.style.flexDirection = "column";
    links.style.position = "absolute";
    links.style.top = "72px";
    links.style.right = "20px";
    links.style.background = "#0B1B2B";
    links.style.border = "1px solid rgba(0,212,255,.16)";
    links.style.padding = "14px";
    links.style.borderRadius = "12px";
  });
}
