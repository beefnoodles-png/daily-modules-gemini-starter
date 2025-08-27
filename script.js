// UI Elements
const $ = (sel) => document.querySelector(sel);
const picker = $("#modulePicker");
const moduleList = $("#moduleList");
const themeToggle = $("#themeToggle");
const addModuleBtn = $("#addModule");
const confirmAddBtn = $("#confirmAdd");

// GridStack instance
let grid;

// Available module types
const MODULE_TYPES = {
  comfort: { title: "每日跳脫舒適圈", w: 4, h: 4 },
  invest: { title: "每日投資小知識", w: 4, h: 4 },
  song: { title: "每日一首新歌推薦", w: 4, h: 4 },
  jp_word: { title: "每日學一個日文單字", w: 4, h: 4 },
  kr_word: { title: "每日學一個韓文單字", w: 4, h: 4 },
  en_word: { title: "每日學一個英文單字", w: 4, h: 4 },
};

// Application state
const state = {
  // 預設解鎖 Pro（重骰）
  isPro: JSON.parse(localStorage.getItem("isPro") ?? "true"),
  modules: [], // This will be populated from localStorage or defaults
};

// --- Main Functions ---

function initializeGrid() {
  const GS = window.GridStack;
  if (!GS) {
    console.error('GridStack 尚未載入，請確認 CDN 腳本是否成功載入');
    return;
  }
  grid = GS.init({
    cellHeight: 80,
    column: 12,
    margin: 10,
    float: true, // Allow widgets to float to the top
  });

  // Save layout changes
  grid.on('change', (event, items) => {
    saveModules();
  });
}

function renderModules() {
  if (!grid) {
    console.error('GridStack 尚未初始化，跳過渲染');
    return;
  }
  grid.removeAll(); // Clear existing widgets
  const savedModules = JSON.parse(localStorage.getItem("modules")) || [];

  if (savedModules.length === 0) {
    // Add default modules if none are saved
    const defaultLayout = [
      { type: 'comfort', x: 0, y: 0, w: 4, h: 4 },
      { type: 'invest', x: 4, y: 0, w: 4, h: 4 },
      { type: 'song', x: 8, y: 0, w: 4, h: 4 },
    ];
    defaultLayout.forEach(mod => addNewWidget(mod.type, mod));
  } else {
    state.modules = savedModules;
    state.modules.forEach(mod => {
      const contentHTML = createWidgetHTML(mod);
      grid.addWidget({ id: mod.id, x: mod.x, y: mod.y, w: mod.w, h: mod.h, content: contentHTML });
    });
  }
  updateModulePicker();
  // 同步按鈕狀態（解鎖重骰）
  syncProButtons();
}

function addNewWidget(type, options = {}) {
  const moduleInfo = MODULE_TYPES[type];
  if (!moduleInfo) return;

  const newModule = {
    id: options.id || crypto.randomUUID(),
    type: type,
    title: moduleInfo.title,
    lastRolledISO: null,
    lastResult: null,
    lastSource: null,
    x: options.x, // x, y, w, h will be set by GridStack
    y: options.y,
    w: options.w || moduleInfo.w,
    h: options.h || moduleInfo.h,
  };
  
  const contentHTML = createWidgetHTML(newModule);
  grid.addWidget({ id: newModule.id, w: newModule.w, h: newModule.h, autoPosition: true, content: contentHTML });

  // Add to state and save
  if (!state.modules.find(m => m.id === newModule.id)) {
      state.modules.push(newModule);
  }
  saveModules();
  updateModulePicker();
  // 新增後同步按鈕狀態
  syncProButtons();
}

function formatResult(mod) {
  const d = mod.lastResult || {};
  switch (mod.type) {
    case 'comfort':
      return `<div class="space-y-1 text-sm"><div class="font-medium">${d.title || '今日挑戰'}</div><div>${d.text || ''}</div><div class="text-xs text-zinc-500">${d.safety ? `注意：${d.safety}` : ''}</div></div>`;
    case 'invest':
      return `<div class="space-y-1 text-sm"><div class="font-medium">${d.title || '今日投資小知識'}</div><div>${d.tip || ''}</div><div class="text-xs text-zinc-500">${d.example ? `例：${d.example}` : ''}${d.disclaimer ? `｜${d.disclaimer}` : ''}</div></div>`;
    case 'song':
      return `<div class="space-y-1 text-sm"><div class="font-medium">${d.title || '今日一首歌'}</div><div>${d.song ? `♫ ${d.song}` : ''}${d.artist ? ` — ${d.artist}` : ''}</div><div class="text-xs text-zinc-500">${d.reason || ''}</div></div>`;
    case 'jp_word':
      return `<div class="space-y-1 text-sm"><div class="font-medium">${d.word || ''}</div><div class="text-xs text-zinc-500">${d.reading || ''}</div><div>${d.meaning_zh || ''}</div><div class="text-xs text-zinc-500">${d.example || ''}</div></div>`;
    case 'kr_word':
      return `<div class="space-y-1 text-sm"><div class="font-medium">${d.word || ''}</div><div class="text-xs text-zinc-500">${d.reading || ''}</div><div>${d.meaning_zh || ''}</div><div class="text-xs text-zinc-500">${d.example || ''}</div></div>`;
    case 'en_word':
      return `<div class="space-y-1 text-sm"><div class="font-medium">${d.word || ''} <span class="text-xs text-zinc-500">${d.pos || ''}</span></div><div>${d.meaning_zh || ''}</div><div class="text-xs text-zinc-500">${d.example || ''}</div></div>`;
    default:
      return `<div class="text-sm whitespace-pre-wrap">${typeof d === 'string' ? d : JSON.stringify(d, null, 2)}</div>`;
  }
}

function createWidgetHTML(mod) {
    const today = new Date().toISOString().split('T')[0];
    const canRoll = state.isPro || mod.lastRolledISO !== today;

    return `
    <div class="flex flex-col h-full p-4">
      <header class="flex items-center justify-between mb-2">
        <h3 class="font-semibold text-sm mr-2">${mod.title}</h3>
        <button data-remove-id="${mod.id}" class="text-xs text-zinc-500 hover:text-red-500 transition-colors">移除</button>
      </header>
      <main class="flex-grow min-h-0">
        <div class="text-sm bg-zinc-100 dark:bg-zinc-900 rounded p-3 h-full overflow-auto" data-content>
          ${mod.lastResult ? formatResult(mod) : '點擊產生按鈕來獲得今日結果。'}
        </div>
      </main>
      <footer class="mt-2 flex items-center gap-2">
        <button data-generate="${mod.id}" class="px-3 py-1 rounded bg-zinc-900 text-white dark:bg-white dark:text-black text-sm disabled:opacity-50" ${!canRoll ? 'disabled' : ''}>
          產生
        </button>
        <button data-reroll="${mod.id}" class="px-3 py-1 rounded border border-zinc-300 dark:border-zinc-700 text-sm disabled:opacity-50" ${!state.isPro ? 'disabled' : ''}>
          ${state.isPro ? "重骰" : "重骰 (Pro)"}
        </button>
      </footer>
      <div class="mt-1 text-[11px] text-zinc-500">來源：<span data-source>${mod.lastSource || '未知'}</span></div>
    </div>`;
}


async function generateContent(moduleId) {
    const mod = state.modules.find(m => m.id === moduleId);
    if (!mod) return;

    const widgetEl = grid.getGridItems().find(item => item.gridstackNode.id === moduleId);
    const contentEl = widgetEl.querySelector('[data-content]');
    if (contentEl) contentEl.textContent = '思考中...';

    try {
      // 最多嘗試 3 次，若與上一筆完全相同，則重試（避免重骰無變化）
      const previousRaw = JSON.stringify(mod.lastResult || {});
      let attempts = 0;
      let data;
      while (attempts < 3) {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ module: mod.type }),
        });
        const payload = await res.json();
        // 若 API 失敗（有 error），顯示提示，不覆蓋舊結果
        if (payload && payload.error) {
          if (contentEl) contentEl.textContent = '請稍後嘗試';
          // 更新來源顯示（非 gemini）
          const srcElErr = widgetEl.querySelector('[data-source]');
          if (srcElErr) srcElErr.textContent = payload.source || '未知';
          return;
        }
        data = payload;
        const candidateRaw = JSON.stringify((payload && payload.data) || payload || {});
        if (candidateRaw !== previousRaw) break;
        attempts++;
      }

      // 若來源不是 gemini，一律顯示提示，不覆蓋舊內容
      const source = data.source || '未知';
      if (source !== 'gemini') {
        if (contentEl) contentEl.textContent = '請稍後嘗試';
        const srcElInfo = widgetEl.querySelector('[data-source]');
        if (srcElInfo) srcElInfo.textContent = source;
        return;
      }
      mod.lastResult = data.data || data;
      mod.lastSource = source;
      mod.lastRolledISO = new Date().toISOString().split('T')[0];
      if (contentEl) contentEl.innerHTML = formatResult(mod);
      saveModules();
      // 更新產生按鈕狀態
      const genBtn = widgetEl.querySelector(`[data-generate="${moduleId}"]`);
      if (genBtn) genBtn.disabled = true;
      const srcEl = widgetEl.querySelector('[data-source]');
      if (srcEl) srcEl.textContent = mod.lastSource;

    } catch (e) {
      if (contentEl) contentEl.textContent = '請稍後嘗試';
    }
}


function saveModules() {
  const moduleData = grid.save(false); // save(false) saves without content
  state.modules = moduleData.map(d => {
    const existing = state.modules.find(m => m.id === d.id);
    return { ...existing, x: d.x, y: d.y, w: d.w, h: d.h };
  });
  localStorage.setItem("modules", JSON.stringify(state.modules));
}


function updateModulePicker() {
    const existingTypes = state.modules.map(m => m.type);
    moduleList.innerHTML = ''; // Clear list
    Object.entries(MODULE_TYPES).forEach(([type, { title }]) => {
        const isAdded = existingTypes.includes(type);
        const label = document.createElement('label');
        label.className = "flex items-center gap-3";
        label.innerHTML = `
            <input type="checkbox" value="${type}" ${isAdded ? 'checked' : ''} />
            ${title}
        `;
        moduleList.appendChild(label);
    });
}

// 將模塊挑選器的選擇套用到佈局
function applyModulePickerChanges() {
  const currentlyAdded = new Set(state.modules.map(m => m.type));
  const toAdd = new Set();
  const toRemove = new Set();

  picker.querySelectorAll("input[type=checkbox]").forEach(chk => {
    if (chk.checked && !currentlyAdded.has(chk.value)) {
      toAdd.add(chk.value);
    } else if (!chk.checked && currentlyAdded.has(chk.value)) {
      toRemove.add(chk.value);
    }
  });

  toAdd.forEach(type => addNewWidget(type));

  toRemove.forEach(type => {
    const modToRemove = state.modules.find(m => m.type === type);
    if (modToRemove) {
      const itemEl = grid.getGridItems().find(i => i.gridstackNode?.id === modToRemove.id) ||
                     document.querySelector(`.grid-stack .grid-stack-item[gs-id="${modToRemove.id}"]`);
      if (itemEl) grid.removeWidget(itemEl);
      state.modules = state.modules.filter(m => m.id !== modToRemove.id);
    }
  });

  saveModules();
}

// 將所有卡片的重骰按鈕啟用、產生按鈕不受限
function syncProButtons() {
  if (!state.isPro) return;
  document.querySelectorAll('.grid-stack [data-reroll]').forEach(btn => {
    btn.disabled = false;
    btn.textContent = '重骰';
  });
  document.querySelectorAll('.grid-stack [data-generate]').forEach(btn => {
    btn.disabled = false;
  });
}


// --- Event Listeners ---

themeToggle.addEventListener("click", () => {
  document.documentElement.classList.toggle("dark");
  localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
});

addModuleBtn.addEventListener("click", () => {
    updateModulePicker();
    picker.showModal();
});

// 確保按下「加入」一定會套用選擇（Safari 對 dialog 事件有時不一致）
confirmAddBtn.addEventListener('click', (e) => {
  e.preventDefault();
  applyModulePickerChanges();
  picker.close('default');
});

// 仍保留 close 事件以相容鍵盤 Enter/ESC 關閉的情況
picker.addEventListener('close', () => {
  if (picker.returnValue === 'cancel') return;
  applyModulePickerChanges();
});


// Event delegation for widget buttons
document.querySelector('.grid-stack').addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button) return;

    const removeId = button.dataset.removeId;
    if (removeId) {
        grid.removeWidget(button.closest('.grid-stack-item'));
        state.modules = state.modules.filter(m => m.id !== removeId);
        saveModules();
        updateModulePicker();
        return;
    }

    const generateId = button.dataset.generate;
    if (generateId) {
        generateContent(generateId);
        return;
    }

    const rerollId = button.dataset.reroll;
    if (rerollId && state.isPro) {
        generateContent(rerollId);
        return;
    }
});


// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
  initializeGrid();
  renderModules();
  // 強制保存 Pro 狀態，確保重骰功能解鎖
  if (state.isPro !== true) {
    state.isPro = true;
    localStorage.setItem('isPro', 'true');
  }
  syncProButtons();
});
