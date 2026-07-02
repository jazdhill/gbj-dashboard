/* =========================================================================
   Shared behavior for every page: the hamburger menu, the feedback button
   and popup, the shared form submit, and the About-page countdown.

   EDIT THESE FOUR THINGS:
   ========================================================================= */
const CONFIG = {
  // What the site is called (used in page titles and the About/Methodology copy).
  siteName: "Good Jobs Dashboard",

  // Where feedback goes: submitted invisibly to this Google Form (visitors
  // never leave the page), which forwards each response to the Trello board
  // via an Apps Script "on form submit" trigger.
  googleForm: {
    id: "1FAIpQLSeqB3PL9fHPLei33-ZMYkSSkOjvlsP9W1tCknitd0GQ3sChPw",
    entries: {
      type: "entry.57094035",
      message: "entry.293152144",
      email: "entry.841890536",
      page: "entry.324452247",
    },
  },

  // Your personal / research site, linked from the About page.
  websiteUrl: "https://example.com",

  // Countdown target on the About page: the next CPS data release.
  // Set this to the real date when you know it.
  nextUpdate: "2026-09-15T00:00:00",
};

/* ---- The dashboard's info-circle icon, as inline SVG ------------------ */
function infoIcon() {
  return `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="11" fill="var(--amber)"/>
    <circle cx="12" cy="7.4" r="1.5" fill="var(--bg-deep)"/>
    <rect x="10.6" y="10.2" width="2.8" height="7.2" rx="1.2" fill="var(--bg-deep)"/>
  </svg>`;
}

/* ---- Build the menu and feedback UI on every page --------------------- */
const LINKS = [
  { href: "index.html",       label: "Good Jobs Index" },
  { href: "about.html",       label: "About" },
  { href: "methodology.html", label: "Methodology" },
  { href: "learn.html",       label: "Learn" },
  { href: "feedback.html",    label: "Feedback" },
];

function currentFile() {
  const path = location.pathname.split("/").pop();
  return path === "" ? "index.html" : path;
}

function buildChrome() {
  const here = currentFile();

  // Hamburger button
  const toggle = document.createElement("button");
  toggle.className = "nav-toggle";
  toggle.setAttribute("aria-label", "Open menu");
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", "site-menu");
  toggle.innerHTML = "<span></span>";

  // Menu panel
  const menu = document.createElement("nav");
  menu.className = "nav-menu";
  menu.id = "site-menu";
  menu.hidden = true;
  menu.innerHTML = LINKS.map(l => {
    const current = l.href === here ? ' aria-current="page"' : "";
    return `<a href="${l.href}"${current}>${l.label}</a>`;
  }).join("");

  document.body.appendChild(toggle);
  document.body.appendChild(menu);

  function setOpen(open) {
    menu.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }
  toggle.addEventListener("click", () => setOpen(menu.hidden));
  document.addEventListener("click", (e) => {
    if (!menu.hidden && !menu.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });

  // Feedback floating button (hidden on the dedicated feedback page)
  if (here !== "feedback.html") {
    const fab = document.createElement("button");
    fab.className = "fab";
    fab.innerHTML = `${infoIcon()}<span>Give feedback</span>`;
    fab.addEventListener("click", openModal);
    document.body.appendChild(fab);
  }

  buildModal();
}

/* ---- Feedback popup --------------------------------------------------- */
function feedbackFormMarkup(idPrefix) {
  return `
    <form class="fb-form" data-fb-form novalidate>
      <span class="fb-label">What kind of note is this?</span>
      <div class="fb-segment">
        <input type="radio" id="${idPrefix}-fb" name="type" value="Feedback" checked>
        <label for="${idPrefix}-fb">Give feedback</label>
        <input type="radio" id="${idPrefix}-bug" name="type" value="Bug Report">
        <label for="${idPrefix}-bug">Report a bug</label>
      </div>
      <span class="fb-label" for="${idPrefix}-msg">Your note</span>
      <textarea id="${idPrefix}-msg" class="fb-textarea" name="message"
        placeholder="Tell us what you noticed…" required></textarea>
      <input class="fb-input" type="email" name="email"
        placeholder="Email (optional, so we can follow up)">
      <button type="submit" class="fb-submit">Send</button>
      <div class="fb-status" role="status" aria-live="polite"></div>
    </form>`;
}

function buildModal() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "fb-modal";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="fb-modal-title">
      <div class="modal-head">
        ${infoIcon()}
        <span class="modal-title" id="fb-modal-title">Give feedback</span>
        <button class="modal-close" aria-label="Close">&times;</button>
      </div>
      <p class="muted" style="font-size:.92rem">Spotted something off, or have a suggestion? Your note comes straight to us.</p>
      ${feedbackFormMarkup("modal")}
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector(".modal-close").addEventListener("click", closeModal);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  wireForm(overlay.querySelector("[data-fb-form]"));
}

function openModal() {
  const m = document.getElementById("fb-modal");
  if (m) { m.hidden = false; m.querySelector("textarea").focus(); }
}
function closeModal() {
  const m = document.getElementById("fb-modal");
  if (m) m.hidden = true;
}

/* ---- Form submit: stays on the page, posts to Formspree -------------- */
function wireForm(form) {
  if (!form) return;
  const status = form.querySelector(".fb-status");
  const submit = form.querySelector(".fb-submit");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = form.querySelector('[name="message"]').value.trim();
    if (!message) {
      status.className = "fb-status err";
      status.textContent = "Add a quick note before sending.";
      return;
    }

    const data = {
      type: form.querySelector('[name="type"]:checked').value,
      message,
      email: form.querySelector('[name="email"]').value.trim(),
      page: location.href,
    };

    submit.disabled = true;
    status.className = "fb-status";
    status.textContent = "Sending…";

    try {
      const { id, entries } = CONFIG.googleForm;
      const params = new URLSearchParams();
      params.set(entries.type, data.type);
      params.set(entries.message, data.message);
      params.set(entries.email, data.email);
      params.set(entries.page, data.page);

      // Google Forms doesn't allow CORS, so the response is opaque (mode: "no-cors").
      // We can't read a status back — if the request itself doesn't throw, assume it sent.
      await fetch(`https://docs.google.com/forms/d/e/${id}/formResponse`, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
      status.className = "fb-status ok";
      status.textContent = "Thanks — your note is on its way.";
      form.reset();
    } catch (err) {
      status.className = "fb-status err";
      status.textContent = "That didn't send. Please try again in a moment.";
    } finally {
      submit.disabled = false;
    }
  });
}

/* ---- Countdown (only runs where #countdown exists) ------------------- */
function buildCountdown() {
  const el = document.getElementById("countdown");
  if (!el) return;
  const target = new Date(CONFIG.nextUpdate).getTime();

  function render() {
    const diff = target - Date.now();
    if (diff <= 0) {
      el.innerHTML = `<div class="count-cell" style="min-width:auto">
        <div class="count-num" style="font-size:1.3rem">New data is in</div>
        <div class="count-lab">refresh coming soon</div></div>`;
      return;
    }
    const days = Math.floor(diff / 86400000);
    const hrs  = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const cell = (n, l) => `<div class="count-cell"><div class="count-num">${n}</div><div class="count-lab">${l}</div></div>`;
    el.innerHTML = cell(days, "days") + cell(hrs, "hours") + cell(mins, "minutes");
  }
  render();
  setInterval(render, 30000);
}

/* ---- Fill any [data-site-name] and [data-website] placeholders -------- */
function fillPlaceholders() {
  document.querySelectorAll("[data-site-name]").forEach(n => n.textContent = CONFIG.siteName);
  document.querySelectorAll("[data-website]").forEach(a => {
    a.href = CONFIG.websiteUrl;
  });
}

/* ---- Load the classic Tableau embed, sized to fill the window ---------
   The share-generated embed code sizes the viz once, from the container's
   width at that instant, using a fixed 4:3 ratio. We size it explicitly
   in pixels to match the stage exactly instead, and redo that on every
   resize so it always fills the window. ----------------------------------- */
function loadViz() {
  const stage = document.querySelector(".viz-stage");
  const container = document.getElementById("viz1783014308655");
  if (!stage || !container) return;
  const viz = container.getElementsByTagName("object")[0];

  const fit = () => {
    viz.style.width = stage.clientWidth + "px";
    viz.style.height = stage.clientHeight + "px";
  };
  fit();
  window.addEventListener("resize", fit);

  const script = document.createElement("script");
  script.src = "https://public.tableau.com/javascripts/api/viz_v1.js";
  viz.parentNode.insertBefore(script, viz);
}

document.addEventListener("DOMContentLoaded", () => {
  buildChrome();
  buildCountdown();
  fillPlaceholders();
  loadViz();
  // Wire the full-page feedback form if present
  wireForm(document.querySelector("#feedback-page [data-fb-form]"));
});
