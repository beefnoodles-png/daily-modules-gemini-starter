// minimal state & UI logic
const $ = (sel) => document.querySelector(sel);
const bento = $("#bento");
const picker = $("#modulePicker");

const defaultModules = [
  { type: "comfort", title: "每日跳脫舒適圈" },
  { type: "invest", title: "每日投資小知識" },
  { type: "song", title: "每日一首新歌推薦" },
  { type: "jp_word", title: "每日學一個日文單字" },
  { type: "en_word", title: "每日學一個英文單字" },
];

const state = {
  isPro: JSON.parse(localStorage.getItem("isPro") ?? "false"),
  theme: localStorage.getItem("theme") || "system",
  modules: JSON.parse(localStorage.getItem("modules") || "[]"),
};

function persist() {
  localStorage.setItem("modules", JSON.stringify(state.modules));
  localStorage.setItem("theme", state.theme);
}

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function createCard(mod) {
  const card = document.createElement("div");
  card.className = "border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col gap-3 bg-white/50 dark:bg-white/5 backdrop-blur";
  card.dataset.id = mod.id;

  const header = document.createElement("div");
  header.className = "flex items-center justify-between";
  header.innerHTML = \`<h3 class="font-semibold">\${mod.title}</h3>
  <button class="text-xs text-zinc-500 hover:text-red-500" data-remove>移除</button>\`;

  const result = document.createElement("pre");
  result.className = "text-sm whitespace-pre-wrap bg-zinc-50 dark:bg-zinc-900 rounded p-3 min-h-[3.5rem]";
  result.textContent = mod.lastResult ? JSON.stringify(mod.lastResult, null, 2) : "今天要抽一個結果～";

  const actions = document.createElement("div");
  actions.className = "flex items-center gap-2";
  const btnGen = document.createElement("button");
  btnGen.className = "px-3 py-1 rounded bg-zinc-900 text-white dark:bg-white dark:text-black text-sm disabled:opacity-50";
  btnGen.textContent = "產生";
  const btnReroll = document.createElement("button");
  btnReroll.className = "px-3 py-1 rounded border border-zinc-300 dark:border-zinc-700 text-sm";
  btnReroll.textContent = state.isPro ? "重骰" : "重骰（Pro）";
  btnReroll.disabled = !state.isPro;

  function canRoll(mod) {
    const key = todayKey();
    return mod.lastRolledISO !== key;
  }

  async function doCall() {
    result.textContent = "思考中…";
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: mod.type }),
      });
      const data = await res.json();
      mod.lastResult = data.data || data;
      mod.lastRolledISO = todayKey();
      result.textContent = JSON.stringify(mod.lastResult, null, 2);
      persist();
    } catch (e) {
      result.textContent = "失敗了，晚點再試～";
    }
    updateButtons();
  }

  function updateButtons() {
    const rolled = !canRoll(mod);
    btnGen.disabled = rolled;
  }

  btnGen.addEventListener("click", () => doCall());
  btnReroll.addEventListener("click", () => doCall());
  header.querySelector("[data-remove]").addEventListener("click", () => {
    state.modules = state.modules.filter(m => m.id !== mod.id);
    persist();
    render();
  });

  actions.append(btnGen, btnReroll);
  card.append(header, result, actions);
  // store position index in attribute for Sortable
  return card;
}

function render() {
  bento.innerHTML = "";
  state.modules.forEach(mod => {
    bento.appendChild(createCard(mod));
  });
}

function ensureInitial() {
  if (state.modules.length === 0) {
    // start with 3 modules for demo
    state.modules = defaultModules.slice(0,3).map((m, i) => ({
      id: crypto.randomUUID(),
      type: m.type,
      title: m.title,
      position: i,
      lastRolledISO: null,
      lastResult: null,
    }));
    persist();
  }
}

ensureInitial();
render();

// Drag & drop with Sortable
new Sortable(bento, {
  animation: 150,
  onEnd: () => {
    const ids = Array.from(bento.children).map(el => el.dataset.id);
    // reorder state.modules based on ids
    state.modules.sort((a,b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    persist();
  }
});

// Theme toggle
$("#themeToggle").addEventListener("click", () => {
  const current = document.documentElement.classList.contains("dark") ? "dark" : "light";
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.classList.toggle("dark");
  state.theme = next;
  persist();
});

// Add module dialog
$("#addModule").addEventListener("click", () => picker.showModal());
$("#confirmAdd").addEventListener("click", (e) => {
  e.preventDefault();
  const checks = picker.querySelectorAll("input[type=checkbox]:checked");
  checks.forEach(chk => {
    const found = defaultModules.find(m => m.type === chk.value);
    if (!found) return;
    state.modules.push({
      id: crypto.randomUUID(),
      type: found.type,
      title: found.title,
      position: state.modules.length,
      lastRolledISO: null,
      lastResult: null,
    });
  });
  picker.close();
  persist();
  render();
});
