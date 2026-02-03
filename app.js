const STORAGE_KEY = "hangclub.v1";
const FAMILY_CODE_KEY = "hangclub.familyCode";
const FAMILY_LOCK_KEY = "hangclub.familyLock";
const SOUND_KEY = "hangclub.sound";

const SUPABASE_URL = "https://ipadjstmrjdmsbnhfsqy.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_dAJcMGQoP-Dje3Bvx9b-OQ_ewbjKycl";

let supabaseClient = null;
let syncChannel = null;
let familyCode = localStorage.getItem(FAMILY_CODE_KEY) || "";
let isSyncing = false;
let soundOn = localStorage.getItem(SOUND_KEY) !== "off";
let cleanOnLoad = false;

const badgeList = [
  {
    id: "first-hang",
    icon: "🎉",
    title: "First Hang",
    desc: "Log your very first hang.",
    check: (stats) => stats.totalLogs >= 1,
  },
  {
    id: "streak-3",
    icon: "🔥",
    title: "3-Day Streak",
    desc: "Hang three days in a row.",
    check: (stats) => stats.streak >= 3,
  },
  {
    id: "streak-7",
    icon: "🗓️",
    title: "7-Day Streak",
    desc: "Hang every day for a week.",
    check: (stats) => stats.streak >= 7,
  },
  {
    id: "streak-14",
    icon: "🏅",
    title: "14-Day Streak",
    desc: "Two weeks strong.",
    check: (stats) => stats.streak >= 14,
  },
  {
    id: "streak-30",
    icon: "🏆",
    title: "30-Day Streak",
    desc: "A full month of hanging.",
    check: (stats) => stats.streak >= 30,
  },
  {
    id: "hang-60",
    icon: "⏱️",
    title: "Minute Maker",
    desc: "Hang for 60 seconds.",
    check: (stats) => stats.best >= 60,
  },
  {
    id: "hang-90",
    icon: "💪",
    title: "Iron Grip",
    desc: "Hang for 90 seconds.",
    check: (stats) => stats.best >= 90,
  },
  {
    id: "hang-120",
    icon: "⚡",
    title: "Two Minute Hero",
    desc: "Hang for 120 seconds.",
    check: (stats) => stats.best >= 120,
  },
  {
    id: "hang-180",
    icon: "🚀",
    title: "Three Minute Star",
    desc: "Hang for 180 seconds.",
    check: (stats) => stats.best >= 180,
  },
  {
    id: "hang-300",
    icon: "🌟",
    title: "Five Minute Legend",
    desc: "Hang for 300 seconds.",
    check: (stats) => stats.best >= 300,
  },
  {
    id: "early-bird",
    icon: "🐦",
    title: "Early Bird",
    desc: "Log a hang before 8am.",
    hidden: true,
    check: (_, ctx) => ctx.lastLog && ctx.lastLog.hour < 8,
  },
  {
    id: "night-owl",
    icon: "🦉",
    title: "Night Owl",
    desc: "Log a hang after 9pm.",
    hidden: true,
    check: (_, ctx) => ctx.lastLog && ctx.lastLog.hour >= 21,
  },
  {
    id: "weekend-warrior",
    icon: "🏕️",
    title: "Weekend Warrior",
    desc: "Hang on a Saturday or Sunday.",
    hidden: true,
    check: (_, ctx) => ctx.lastLog && (ctx.lastLog.day === 0 || ctx.lastLog.day === 6),
  },
  {
    id: "new-pr",
    icon: "🥇",
    title: "New PR",
    desc: "Beat your personal best.",
    hidden: true,
    check: (stats, ctx) => ctx.isNewPr,
  },
  {
    id: "tiny-step",
    icon: "🐾",
    title: "Tiny Step",
    desc: "Improve by 5+ seconds in one day.",
    hidden: true,
    check: (_, ctx) => ctx.improvedBy >= 5,
  },
  {
    id: "note-taker",
    icon: "📝",
    title: "Note Taker",
    desc: "Leave 5 hang notes.",
    hidden: true,
    check: (_, ctx) => ctx.noteCount >= 5,
  },
  {
    id: "comeback-kid",
    icon: "🎈",
    title: "Comeback Kid",
    desc: "Return after a 3+ day break.",
    hidden: true,
    check: (_, ctx) => ctx.gapDays >= 3,
  },
];

const defaultData = () => ({
  users: [
    {
      id: "tushar",
      name: "Tushar",
      color: "#f06449",
    },
    {
      id: "navya",
      name: "Navya",
      color: "#2d6a4f",
    },
    {
      id: "aarna",
      name: "Aarna",
      color: "#f9c74f",
    },
  ],
  logs: {},
  earned: {},
  version: 1,
  lastUpdated: null,
  weeklyQuest: null,
  cleanedOnce: false,
});

const state = loadState();

const form = document.getElementById("log-form");
const userSelect = document.getElementById("user-select");
const secondsInput = document.getElementById("seconds");
const dateInput = document.getElementById("hang-date");
const noteInput = document.getElementById("note");
const teamBoard = document.getElementById("team-board");
const badgeGrid = document.getElementById("badge-grid");
const toast = document.getElementById("toast");
const debugPanel = document.getElementById("debug-panel");
const debugLogEl = document.getElementById("debug-log");
const debugCopy = document.getElementById("debug-copy");
const debugClear = document.getElementById("debug-clear");
const debugDump = document.getElementById("debug-dump");
const DEBUG_ENABLED = new URLSearchParams(window.location.search).get("debug") === "1" || localStorage.getItem("hangclub.debug") === "on";
let debugEntries = [];
const metricTotal = document.getElementById("metric-total");
const metricLongest = document.getElementById("metric-longest");
const resetDemo = document.getElementById("reset-demo");
const addUser = document.getElementById("add-user");
const exportButton = document.getElementById("export-data");
const importInput = document.getElementById("import-data");
const toggleBadges = document.getElementById("toggle-badges");
const copyCodeButton = document.getElementById("copy-code");
const copyLinkButton = document.getElementById("copy-link");
const clearDataButton = document.getElementById("clear-data");
const reminder = document.getElementById("reminder");
const reminderText = document.getElementById("reminder-text");
const reminderLog = document.getElementById("reminder-log");
const teamProgress = document.getElementById("team-progress");
const teamProgressLabel = document.getElementById("team-progress-label");
const questName = document.getElementById("quest-name");
const questDesc = document.getElementById("quest-desc");
const questProgress = document.getElementById("quest-progress");
const questLabel = document.getElementById("quest-label");
const newQuestButton = document.getElementById("new-quest");
const toggleSoundButton = document.getElementById("toggle-sound");
const avatarModal = document.getElementById("avatar-modal");
const avatarGrid = document.getElementById("avatar-grid");
const avatarClose = document.getElementById("avatar-close");
const familyCodeInput = document.getElementById("family-code");
const connectSyncButton = document.getElementById("connect-sync");
const newCodeButton = document.getElementById("new-code");
const syncStatus = document.getElementById("sync-status");

let showAllBadges = false;
let selectedUserId = null;
const FAMILY_PARAM = new URLSearchParams(window.location.search).get("family");
const AVATAR_SET = ["🧗", "🌈", "⭐", "🐉", "🦊", "🐼", "🐸", "🦁", "🐯", "🦄", "🐙", "🪐", "🍀", "🎈", "🎉", "🏄", "🏹", "🧠", "🧸", "🐬", "🦋", "🐢", "🦖", "🦉"];

init();

function ensureDefaultUsers() {
  if (!state.users || state.users.length === 0) {
    debugLog("ensureDefaultUsers", { action: "restore" });
    state.users = defaultData().users;
    saveState({ sync: false, mark: false });
  }
}

function init() {
  if (!state.cleanedOnce) {
    state.logs = {};
    state.earned = {};
    state.cleanedOnce = true;
    state.lastUpdated = null;
    cleanOnLoad = true;
    saveState({ sync: false, mark: false });
  }
  ensureDefaultUsers();
  normalizeUsers();
  selectedUserId = state.users[0] ? state.users[0].id : null;
  dateInput.value = todayLocal();
  ensureWeeklyQuest();
  render();
  bindEvents();
  initDebugPanel();
  debugLog("init", { users: (state.users || []).map((u) => u.name) });
  initSync();
  if (FAMILY_PARAM) {
    familyCodeInput.value = FAMILY_PARAM;
    connectSync(FAMILY_PARAM);
  }
}

function ensureUserId(user) {
  if (!user) return null;
  const canonicalId = slugifyName(user.name) || user.id;
  if (canonicalId && canonicalId !== user.id) {
    mergeUserData(canonicalId, user.id);
    user.id = canonicalId;
  }
  return user;
}

function slugifyName(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function ensureUniqueId(base, existing) {
  if (!existing.has(base)) return base;
  let i = 2;
  let candidate = `${base}-${i}`;
  while (existing.has(candidate)) {
    i += 1;
    candidate = `${base}-${i}`;
  }
  return candidate;
}

function mergeUserData(targetId, sourceId) {
  if (!sourceId || targetId === sourceId) return;
  const sourceLogs = state.logs[sourceId] || {};
  const targetLogs = state.logs[targetId] || {};
  Object.keys(sourceLogs).forEach((date) => {
    const s = sourceLogs[date];
    const t = targetLogs[date];
    if (!t) {
      targetLogs[date] = s;
    } else {
      const st = s.timestamp || "";
      const tt = t.timestamp || "";
      targetLogs[date] = st > tt ? s : t;
    }
  });
  state.logs[targetId] = targetLogs;
  delete state.logs[sourceId];

  const sourceEarned = state.earned[sourceId] || {};
  const targetEarned = state.earned[targetId] || {};
  state.earned[targetId] = { ...targetEarned, ...sourceEarned };
  delete state.earned[sourceId];
}

function normalizeUsers() {
  const seenIds = new Set();
  const byName = new Map();
  const normalized = [];

  state.users.forEach((user) => {
    const nameKey = user.name.trim().toLowerCase();
    const existing = byName.get(nameKey);
    if (existing) {
      mergeUserData(existing.id, user.id);
      return;
    }

    let baseId = slugifyName(user.name);
    if (!baseId) baseId = user.id || crypto.randomUUID();
    const newId = ensureUniqueId(baseId, seenIds);
    if (newId != user.id) {
      mergeUserData(newId, user.id);
      user.id = newId;
    }
    seenIds.add(newId);
    byName.set(nameKey, user);
    normalized.push(user);
  });

  state.users = normalized;
}

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return defaultData();
  try {
    const parsed = JSON.parse(stored);
    if (!parsed.lastUpdated) parsed.lastUpdated = null;
    return parsed;
  } catch (err) {
    console.warn("Failed to parse saved data, starting fresh.");
    return defaultData();
  }
}

function saveState({ sync = true, mark = true } = {}) {
  if (mark) markUpdated();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  debugLog("saveState", { sync, mark, lastUpdated: state.lastUpdated });
  if (sync) pushState();
}

function bindEvents() {
  form.addEventListener("submit", handleSubmit);
  userSelect.addEventListener("change", () => {
    selectedUserId = userSelect.value;
  });
  resetDemo.addEventListener("click", () => {
    Object.assign(state, defaultData());
    seedDemoData();
    saveState();
  debugLog("member: updated", { userId });
    render();
    toastMsg("Demo data reset.");
  });
  addUser.addEventListener("click", () => {
    const name = prompt("New member name?");
    if (!name) return;
    const baseId = slugifyName(name);
    const newUser = {
      id: baseId || crypto.randomUUID(),
      name: name.trim().slice(0, 20),
      color: randomColor(),
      avatar: "😊",
    };
    ensureDefaultUsers();
    normalizeUsers();
    state.users.push(newUser);
    ensureDefaultUsers();
    normalizeUsers();
    saveState();
  debugLog("member: updated", { userId });
    render();
    openAvatarPicker(newUser.id);
  });
  exportButton.addEventListener("click", exportData);
  importInput.addEventListener("change", importData);
  toggleBadges.addEventListener("click", () => {
    showAllBadges = !showAllBadges;
    toggleBadges.textContent = showAllBadges ? "Show Earned" : "Show All";
    renderBadges();
  });
  if (newQuestButton) {
    newQuestButton.addEventListener("click", () => {
      state.weeklyQuest = null;
      ensureWeeklyQuest(true);
      saveState();
  debugLog("member: updated", { userId });
      render();
    });
  }
  if (toggleSoundButton) {
    toggleSoundButton.addEventListener("click", () => {
      soundOn = !soundOn;
      localStorage.setItem(SOUND_KEY, soundOn ? "on" : "off");
      toggleSoundButton.textContent = soundOn ? "Sound: On" : "Sound: Off";
    });
  }
  if (reminderLog) {
    reminderLog.addEventListener("click", () => {
      secondsInput.focus();
    });
  }
  if (avatarClose) {
    avatarClose.addEventListener("click", closeAvatarPicker);
  }
  copyCodeButton.addEventListener("click", () => {
    if (!familyCodeInput.value.trim()) return;
    navigator.clipboard.writeText(familyCodeInput.value.trim());
    toastMsg("Family code copied.");
  });
  copyLinkButton.addEventListener("click", () => {
    if (!familyCodeInput.value.trim()) return;
    const url = new URL(window.location.href);
    url.searchParams.set("family", normalizeCode(familyCodeInput.value));
    navigator.clipboard.writeText(url.toString());
    toastMsg("Share link copied.");
  });
  clearDataButton.addEventListener("click", () => {
    const confirmed = confirm("Clear all hang data for this device and family? This cannot be undone.");
    if (!confirmed) return;
    clearAllData();
  });
  familyCodeInput.addEventListener("input", () => {
    if (isFamilyLocked()) {
      toastMsg("Family code is locked. Use the existing code.");
      familyCodeInput.value = familyCode;
    }
  });
  connectSyncButton.addEventListener("click", () => {
    const code = familyCodeInput.value.trim();
    if (!code) return;
    connectSync(code);
    lockFamilyCode();
    updateFamilyUiState();
  });
  newCodeButton.addEventListener("click", () => {
    const code = randomFamilyCode();
    familyCodeInput.value = code;
    connectSync(code);
    lockFamilyCode();
    updateFamilyUiState();
  });
}

function handleSubmit(event) {
  event.preventDefault();
  debugLog("submit: start", { selected: userSelect.value, selectedName: userSelect.options[userSelect.selectedIndex]?.dataset?.name || "" });
  let selectedUser = getUserBySelection();
  const seconds = parseInt(secondsInput.value, 10);
  const date = dateInput.value;
  if (!selectedUser || !seconds || !date) {
    debugLog("submit: blocked", { selectedUser: !!selectedUser, seconds, date });
    return;
  }
  selectedUser = ensureUserId(selectedUser);
  const userId = selectedUser.id;
  if (!state.logs[userId]) state.logs[userId] = {};
  debugLog("submit: saving", { userId, name: selectedUser.name, date, seconds });
  state.logs[userId][date] = {
    seconds,
    note: noteInput.value.trim(),
    timestamp: new Date().toISOString(),
  };
  updateBadges(userId);
  const stats = getStats(userId);
  if ([3, 7, 14, 30].includes(stats.streak)) {
    celebrateStreak(stats.streak);
  }
  updateWeeklyProgress();
  saveState();
  debugLog("member: updated", { userId });
  render();
  secondsInput.value = "";
  noteInput.value = "";
  dateInput.value = todayLocal();
  toastMsg("Hang saved! Nice work.");
}

function render() {
  if (!state.users || state.users.length === 0) {
    ensureDefaultUsers();
  }
  renderUserSelect();
  updateWeeklyProgress();
  renderTeamBoard();
  renderBadges();
  renderMetrics();
  if (questName && questDesc && questProgress && questLabel) {
    renderQuest();
  }
  if (teamProgress && teamProgressLabel) {
    renderTeamProgress();
  }
  if (reminder && reminderText) {
    renderReminder();
  }
}

function getUserBySelection() {
  const selectedOption = userSelect.options[userSelect.selectedIndex];
  const selectedName = selectedOption ? selectedOption.dataset.name : "";
  const selectedId = selectedUserId || userSelect.value;
  const found =
    state.users.find((u) => u.id === selectedId) ||
    state.users.find((u) => u.name === selectedName) ||
    null;
  return ensureUserId(found);
}

function renderUserSelect() {
  userSelect.innerHTML = "";
  state.users.forEach((user) => {
    const option = document.createElement("option");
    option.value = user.id;
    option.textContent = user.name;
    option.dataset.name = user.name;
    userSelect.appendChild(option);
  });
  if (selectedUserId && Array.from(userSelect.options).some((o) => o.value === selectedUserId)) {
    userSelect.value = selectedUserId;
  } else {
    selectedUserId = userSelect.value;
  }

}

function renderTeamBoard() {
  teamBoard.innerHTML = "";
  const template = document.getElementById("member-template");

  state.users.forEach((user) => {
    const clone = template.content.cloneNode(true);
    const card = clone.querySelector(".member-card");
    const avatar = clone.querySelector(".avatar");
    const name = clone.querySelector(".member__name");
    const meta = clone.querySelector(".member__meta");
    const todayValue = clone.querySelector(".today");
    const bestValue = clone.querySelector(".best");
    const streakValue = clone.querySelector(".streak");
    const longestValue = clone.querySelector(".longest");
    const history = clone.querySelector(".member__history");
    const stickers = document.createElement("div");
    stickers.className = "member__stickers";
    const editButton = clone.querySelector(".member__edit");

    const stats = getStats(user.id);
    avatar.style.background = `linear-gradient(135deg, ${user.color}, #fff1d6)`;
    avatar.textContent = user.avatar || "";
    name.textContent = user.name;
    meta.textContent = stats.totalLogs
      ? `${stats.totalLogs} hangs logged`
      : "No hangs yet";
    todayValue.textContent = `${stats.today}s`;
    bestValue.textContent = `${stats.best}s`;
    streakValue.textContent = `${stats.streak} days`;
    longestValue.textContent = `${stats.longestStreak} days`;

    history.innerHTML = buildHistory(user.id);
    stickers.innerHTML = buildStickers(user.id);
    history.after(stickers);
    editButton.addEventListener("click", () => editMember(user.id));

    teamBoard.appendChild(clone);
  });
}

function renderBadges() {
  badgeGrid.innerHTML = "";
  const template = document.getElementById("badge-template");
  const earnedByUser = buildEarnedMap();

  badgeList.forEach((badge) => {
    const clone = template.content.cloneNode(true);
    const badgeEl = clone.querySelector(".badge");
    const title = clone.querySelector(".badge__title");
    const desc = clone.querySelector(".badge__desc");
    const stamp = clone.querySelector(".badge__stamp");

    const earnedUsers = earnedByUser[badge.id] || [];
    const isEarned = earnedUsers.length > 0;

    if (!isEarned) {
      badgeEl.classList.add("locked");
      stamp.textContent = "Not Yet";
    } else {
      stamp.textContent = `Earned (${earnedUsers.join(", ")})`;
    }

    if (!showAllBadges && !isEarned) return;

    title.textContent = badge.title;
    desc.textContent = badge.desc;
    badgeGrid.appendChild(clone);
  });
}

function renderMetrics() {
  let total = 0;
  let longest = 0;
  state.users.forEach((user) => {
    const stats = getStats(user.id);
    total += stats.totalLogs;
    longest = Math.max(longest, stats.best);
  });
  metricTotal.textContent = total.toString();
  metricLongest.textContent = `${longest}s`;
}

function getStats(userId) {
  const userLogs = state.logs[userId] || {};
  const entries = Object.entries(userLogs)
    .map(([date, info]) => ({ date, ...info }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const today = todayLocal();
  const todayEntry = userLogs[today];
  const best = entries.reduce((max, entry) => Math.max(max, entry.seconds), 0);

  const dates = entries.map((entry) => entry.date).sort();
  const streakInfo = getStreakInfo(dates, today);

  return {
    today: todayEntry ? todayEntry.seconds : 0,
    best,
    streak: streakInfo.current,
    longestStreak: streakInfo.longest,
    totalLogs: entries.length,
    recent: entries.slice(0, 5),
  };
}

function buildHistory(userId) {
  const stats = getStats(userId);
  if (!stats.recent.length) return "Start your first hang!";
  return stats.recent
    .map((entry) => {
      const note = entry.note ? ` — ${entry.note}` : "";
      return `${formatDate(entry.date)}: ${entry.seconds}s${note}`;
    })
    .join("<br>");
}

function getStreakInfo(dates, today) {
  if (!dates.length) return { current: 0, longest: 0 };
  const sorted = [...new Set(dates)].sort();
  let longest = 1;
  let current = 0;

  let streak = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    const diff = daysBetween(sorted[i - 1], sorted[i]);
    if (diff === 1) {
      streak += 1;
    } else if (diff > 1) {
      longest = Math.max(longest, streak);
      streak = 1;
    }
  }
  longest = Math.max(longest, streak);

  const lastDate = sorted[sorted.length - 1];
  const diffToToday = daysBetween(lastDate, today);
  if (diffToToday === 0) {
    current = 1;
    for (let i = sorted.length - 2; i >= 0; i -= 1) {
      if (daysBetween(sorted[i], sorted[i + 1]) === 1) {
        current += 1;
      } else {
        break;
      }
    }
  } else if (diffToToday === 1) {
    current = 0;
  }

  return { current, longest };
}

function updateBadges(userId) {
  const stats = getStats(userId);
  const lastLog = getLastLog(userId);
  const gapDays = lastLog && lastLog.prevDate ? daysBetween(lastLog.prevDate, lastLog.date) : 0;
  const ctx = {
    lastLog,
    gapDays,
    improvedBy: lastLog ? lastLog.improvedBy : 0,
    isNewPr: lastLog ? !!lastLog.isNewPr : false,
    noteCount: lastLog ? lastLog.noteCount : 0,
  };
  if (!state.earned[userId]) state.earned[userId] = {};

  badgeList.forEach((badge) => {
    const earned = state.earned[userId][badge.id];
    const qualifies = badge.check ? badge.check(stats, ctx) : false;
    if (!earned && qualifies) {
      state.earned[userId][badge.id] = new Date().toISOString();
      toastMsg(`${badge.title} unlocked for ${getUserName(userId)}!`);
    }
  });
}

function buildEarnedMap() {
  const map = {};
  state.users.forEach((user) => {
    const earned = state.earned[user.id] || {};
    Object.keys(earned).forEach((badgeId) => {
      if (!map[badgeId]) map[badgeId] = [];
      map[badgeId].push(user.name);
    });
  });
  return map;
}

function editMember(userId) {
  const user = state.users.find((member) => member.id === userId);
  if (!user) return;
  const name = prompt("Update name", user.name);
  if (name) {
    user.name = name.trim().slice(0, 20);
  }
  const color = prompt("Pick a color (hex)", user.color);
  if (color) {
    user.color = color.trim();
  }
  openAvatarPicker(user.id);
  saveState();
  debugLog("member: updated", { userId });
  render();
}

function getUserName(userId) {
  const user = state.users.find((member) => member.id === userId);
  return user ? user.name : "Someone";
}

function toastMsg(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2400);
}

function initSync() {
  familyCodeInput.value = familyCode;
  initSupabase();
  if (familyCode) {
    lockFamilyCode();
    connectSync(familyCode);
  } else {
    setSyncStatus("Not connected");
  }
  updateFamilyUiState();
}

function initSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    setSyncStatus("Add Supabase URL + anon key in app.js to enable sync.");
    return;
  }
  if (!window.supabase) {
    setSyncStatus("Supabase library failed to load.");
    return;
  }
  supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );
}

async function connectSync(code) {
  if (!supabaseClient) {
    setSyncStatus("Add Supabase URL + anon key in app.js to enable sync.");
    return;
  }
  familyCode = normalizeCode(code);
  localStorage.setItem(FAMILY_CODE_KEY, familyCode);
  familyCodeInput.value = familyCode;
  setSyncStatus("Connecting...");
  await syncWithRemote();
  subscribeRealtime();
}

async function syncWithRemote() {
  debugLog("syncWithRemote: start", { familyCode });
  if (!supabaseClient || !familyCode) return;
  const { data, error } = await supabaseClient
    .from("hang_data")
    .select("data, updated_at")
    .eq("family_code", familyCode);

  if (error) {
    debugLog("syncWithRemote: error", { message: error.message });
    setSyncStatus("Sync error. Check Supabase settings.");
    return;
  }

  const row = data && data[0];
  if (!row || !row.data) {
    debugLog("syncWithRemote: empty", {});
    await pushState();
    setSyncStatus(`Created family ${familyCode}.`);
    return;
  }

  const remoteState = row.data;
  const remoteUpdated = remoteState.lastUpdated || row.updated_at || "";
  const localUpdated = state.lastUpdated || "";

  if (!localUpdated || remoteUpdated > localUpdated) {
    debugLog("syncWithRemote: applyRemote", { remoteUpdated, localUpdated });
    const merged = mergeState(state, remoteState);
    Object.assign(state, merged);
    ensureDefaultUsers();
    normalizeUsers();
    saveState({ sync: false, mark: false });
    render();
    setSyncStatus(`Synced from family ${familyCode}.`);
  } else if (remoteUpdated < localUpdated) {
    debugLog("syncWithRemote: pushLocal", { remoteUpdated, localUpdated });
    await pushState();
  } else {
    debugLog("syncWithRemote: inSync", { remoteUpdated, localUpdated });
    setSyncStatus(`Connected to family ${familyCode}.`);
  }
}

async function pushState() {
  if (!supabaseClient || !familyCode || isSyncing) {
    debugLog("pushState: skip", { supabaseClient: !!supabaseClient, familyCode, isSyncing });
    return;
  }
  ensureDefaultUsers();
  debugLog("pushState: start", { familyCode, lastUpdated: state.lastUpdated, users: state.users.length });
  isSyncing = true;
  if (!state.lastUpdated) markUpdated();
  const payload = { ...state };
  const { error } = await supabaseClient.from("hang_data").upsert({
    family_code: familyCode,
    data: payload,
    updated_at: payload.lastUpdated,
  });
  isSyncing = false;
  if (error) {
    debugLog("syncWithRemote: error", { message: error.message });
    debugLog("pushState: error", { message: error.message });
    setSyncStatus("Sync failed. Check Supabase settings.");
    return;
  }
  debugLog("pushState: success", { familyCode });
  setSyncStatus(`Connected to family ${familyCode}.`);
}

function subscribeRealtime() {
  if (!supabaseClient || !familyCode) return;
  if (syncChannel) supabaseClient.removeChannel(syncChannel);

  syncChannel = supabaseClient
    .channel(`hang_data:${familyCode}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "hang_data",
        filter: `family_code=eq.${familyCode}`,
      },
      (payload) => {
        const remoteState = payload.new && payload.new.data;
        if (!remoteState) return;
        const remoteUpdated = remoteState.lastUpdated || "";
        const localUpdated = state.lastUpdated || "";
        if (remoteUpdated && remoteUpdated <= localUpdated) return;
        const merged = mergeState(state, remoteState);
    Object.assign(state, merged);
    ensureDefaultUsers();
    normalizeUsers();
        saveState({ sync: false, mark: false });
        render();
        toastMsg("Synced new hang from family.");
      }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setSyncStatus(`Live updates on (${familyCode}).`);
      }
    });
}

function setSyncStatus(message) {
  syncStatus.textContent = message;
}

function markUpdated() {
  state.lastUpdated = new Date().toISOString();
}

function normalizeCode(code) {
  return code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

function todayLocal() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
}

function daysBetween(dateA, dateB) {
  const a = new Date(`${dateA}T00:00:00`);
  const b = new Date(`${dateB}T00:00:00`);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function formatDate(date) {
  const [year, month, day] = date.split("-");
  return `${month}/${day}`;
}

function seedDemoData() {
  const base = todayLocal();
  const baseDate = new Date(`${base}T00:00:00`);
  const sample = [
    { daysAgo: 2, seconds: 32 },
    { daysAgo: 1, seconds: 38 },
    { daysAgo: 0, seconds: 42 },
  ];
  state.users.forEach((user, index) => {
    if (!state.logs[user.id]) state.logs[user.id] = {};
    sample.forEach((entry) => {
      const date = new Date(baseDate);
      date.setDate(date.getDate() - entry.daysAgo);
      const key = date.toISOString().slice(0, 10);
      state.logs[user.id][key] = {
        seconds: entry.seconds + index * 6,
        note: entry.daysAgo === 0 ? "Strong finish" : "",
        timestamp: new Date().toISOString(),
      };
    });
    updateBadges(user.id);
  });
}

function exportData() {
  const payload = JSON.stringify(state, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "hangclub-data.json";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed.users || !parsed.logs) throw new Error("Invalid file");
      Object.assign(state, parsed);
      saveState();
  debugLog("member: updated", { userId });
      render();
      toastMsg("Data imported.");
    } catch (error) {
      toastMsg("Import failed. Check the file format.");
    }
  };
  reader.readAsText(file);
}

function randomColor() {
  const palette = ["#f06449", "#2d6a4f", "#f9c74f", "#577590", "#9d4edd"];
  return palette[Math.floor(Math.random() * palette.length)];
}

function randomFamilyCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const pick = (pool) => pool[Math.floor(Math.random() * pool.length)];
  return `${pick(letters)}${pick(letters)}${pick(letters)}-${pick(
    digits
  )}${pick(digits)}${pick(digits)}`;
}


function clearAllData() {
  Object.assign(state, defaultData());
  state.cleanedOnce = true;
  saveState({ sync: false, mark: false });
  if (familyCode) {
    pushState();
  }
  render();
  toastMsg("All data cleared.");
}


function renderQuest() {
  if (!questName || !questDesc || !questProgress || !questLabel) return;
  ensureWeeklyQuest();
  const quest = state.weeklyQuest;
  if (!quest) return;
  const progress = getWeekSeconds();
  if (quest.progress !== progress) {
    quest.progress = progress;
  }
  questName.textContent = quest.title;
  questDesc.textContent = quest.desc;
  const percent = Math.min(100, Math.round((progress / quest.target) * 100));
  questProgress.style.width = `${percent}%`;
  questLabel.textContent = `${progress} / ${quest.target}`;
}

function renderTeamProgress() {
  if (!teamProgress || !teamProgressLabel) return;
  const total = getWeekSeconds();
  const target = state.weeklyQuest ? state.weeklyQuest.target : 0;
  const percent = target ? Math.min(100, Math.round((total / target) * 100)) : 0;
  teamProgress.style.width = `${percent}%`;
  teamProgressLabel.textContent = `${total} / ${target}s`;
}

function renderReminder() {
  if (!reminder || !reminderText) return;
  const today = todayLocal();
  const anyoneLogged = state.users.some((user) => (state.logs[user.id] || {})[today]);
  reminder.style.display = anyoneLogged ? "none" : "flex";
  reminderText.textContent = anyoneLogged ? "" : "No hangs logged today yet.";
}

function ensureWeeklyQuest(force = false) {
  const weekKey = getWeekKey();
  if (state.weeklyQuest && state.weeklyQuest.weekKey === weekKey && !force) return;
  const quests = [
    { id: "team-300", title: "Team 300", desc: "Reach 300 total seconds as a family.", target: 300 },
    { id: "team-500", title: "Team 500", desc: "Reach 500 total seconds this week.", target: 500 },
    { id: "team-700", title: "Team 700", desc: "Reach 700 total seconds this week.", target: 700 },
    { id: "team-1000", title: "Team 1000", desc: "Reach 1000 total seconds this week.", target: 1000 },
  ];
  const quest = quests[Math.floor(Math.random() * quests.length)];
  state.weeklyQuest = { ...quest, weekKey, progress: 0, completed: false };
  // Persist the quest so it stays consistent across refreshes/devices.
  saveState();
}

function updateWeeklyProgress()() {
  ensureWeeklyQuest();
  const total = getWeekSeconds();
  if (!state.weeklyQuest) return;
  state.weeklyQuest.progress = total;
  debugLog("weeklyProgress", { total, target: state.weeklyQuest.target, weekKey: state.weeklyQuest.weekKey });
  if (!state.weeklyQuest.completed && total >= state.weeklyQuest.target) {
    state.weeklyQuest.completed = true;
    toastMsg("Weekly quest completed! Awesome team work!");
    celebrateQuest();
  }
}

function getWeekSeconds() {
  const weekKey = getWeekKey();
  let total = 0;
  state.users.forEach((user) => {
    const logs = state.logs[user.id] || {};
    Object.keys(logs).forEach((date) => {
      if (getWeekKey(date) === weekKey) total += logs[date].seconds;
    });
  });
  return total;
}

function toUtcDateKey(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getWeekKey(dateInput) {
  let date;
  if (dateInput) {
    const parts = dateInput.split("-").map(Number);
    date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  } else {
    const now = new Date();
    date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
  const day = date.getUTCDay();
  const diff = (day + 6) % 7;
  date.setUTCDate(date.getUTCDate() - diff);
  return toUtcDateKey(date);
}


function buildStickers(userId) {
  const earned = state.earned[userId] || {};
  const earnedBadges = badgeList.filter((badge) => earned[badge.id]);
  if (!earnedBadges.length) return "";
  return earnedBadges.map((badge) => `<span class="sticker">${badge.icon || ""} ${badge.title}</span>`).join("");
}

function getLastLog(userId) {
  const logs = state.logs[userId] || {};
  const dates = Object.keys(logs).sort();
  if (!dates.length) return null;
  const date = dates[dates.length - 1];
  const prevDate = dates.length > 1 ? dates[dates.length - 2] : null;
  const time = new Date(logs[date].timestamp || `${date}T00:00:00`);
  const seconds = logs[date].seconds;
  const prevSeconds = prevDate ? logs[prevDate].seconds : null;
  const improvedBy = prevSeconds == null ? 0 : seconds - prevSeconds;
  const noteCount = sumNotes(userId);
  const best = getStats(userId).best;
  const isNewPr = seconds != null && seconds >= best && Object.keys(logs).length > 1;
  return {
    date,
    prevDate,
    hour: time.getHours(),
    day: time.getDay(),
    seconds,
    prevSeconds,
    improvedBy,
    noteCount,
    isNewPr,
  };
}

function celebrateStreak(streak) {
  launchConfetti();
  if (soundOn) beep(220, 0.12);
  toastMsg(`Streak bonus! ${streak} days in a row.`);
}

function celebrateQuest() {
  launchConfetti();
  if (soundOn) beep(330, 0.14);
}

function launchConfetti() {
  for (let i = 0; i < 28; i += 1) {
    const piece = document.createElement("div");
    piece.className = "confetti";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = ["#f06449", "#f9c74f", "#2d6a4f", "#577590"][i % 4];
    piece.style.setProperty("--drift", `${(Math.random() * 200 - 100).toFixed(0)}px`);
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 2000);
  }
}

function beep(freq, duration) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.value = 0.05;
    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, duration * 1000);
  } catch (e) {
    // ignore audio errors
  }
}


function openAvatarPicker(userId) {
  if (!avatarModal || !avatarGrid) return;
  const user = state.users.find((member) => member.id === userId);
  if (!user) return;
  avatarGrid.innerHTML = "";
  AVATAR_SET.forEach((emoji) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = emoji;
    btn.addEventListener("click", () => {
      user.avatar = emoji;
      saveState();
  debugLog("member: updated", { userId });
      render();
      closeAvatarPicker();
    });
    avatarGrid.appendChild(btn);
  });
  avatarModal.classList.add("show");
  avatarModal.setAttribute("aria-hidden", "false");
}

function closeAvatarPicker() {
  avatarModal.classList.remove("show");
  avatarModal.setAttribute("aria-hidden", "true");
}


function sumNotes(userId) {
  const logs = state.logs[userId] || {};
  return Object.values(logs).filter((log) => (log.note || "").trim().length > 0).length;
}


function mergeState(local, remote) {
  const merged = { ...local, ...remote };
  merged.users = mergeUsers(local.users || [], remote.users || []);
  merged.logs = mergeLogs(local.logs || {}, remote.logs || {});
  merged.earned = { ...(local.earned || {}), ...(remote.earned || {}) };
  merged.weeklyQuest = chooseWeeklyQuest(local, remote);
  merged.cleanedOnce = local.cleanedOnce || remote.cleanedOnce || false;
  merged.lastUpdated = maxTimestamp(local.lastUpdated, remote.lastUpdated);
  return merged;
}

function mergeUsers(localUsers, remoteUsers) {
  const byId = {};
  localUsers.forEach((u) => { byId[u.id] = u; });
  remoteUsers.forEach((u) => { byId[u.id] = u; });
  return Object.values(byId);
}

function mergeLogs(localLogs, remoteLogs) {
  const merged = { ...localLogs };
  Object.keys(remoteLogs).forEach((userId) => {
    if (!merged[userId]) merged[userId] = {};
    const localUserLogs = merged[userId];
    const remoteUserLogs = remoteLogs[userId] || {};
    Object.keys(remoteUserLogs).forEach((date) => {
      const localEntry = localUserLogs[date];
      const remoteEntry = remoteUserLogs[date];
      if (!localEntry) {
        localUserLogs[date] = remoteEntry;
      } else {
        const localTs = localEntry.timestamp || "";
        const remoteTs = remoteEntry.timestamp || "";
        localUserLogs[date] = remoteTs > localTs ? remoteEntry : localEntry;
      }
    });
  });
  return merged;
}

function chooseWeeklyQuest(local, remote) {
  const localUpdated = local.lastUpdated || "";
  const remoteUpdated = remote.lastUpdated || "";
  if (remoteUpdated > localUpdated) return remote.weeklyQuest || local.weeklyQuest;
  return local.weeklyQuest || remote.weeklyQuest;
}

function maxTimestamp(a, b) {
  if (!a) return b || null;
  if (!b) return a || null;
  return a > b ? a : b;
}


function lockFamilyCode() {
  localStorage.setItem(FAMILY_LOCK_KEY, "locked");
}

function isFamilyLocked() {
  return localStorage.getItem(FAMILY_LOCK_KEY) === "locked";
}

function updateFamilyUiState() {
  const locked = isFamilyLocked();
  if (locked) {
    newCodeButton.disabled = true;
    newCodeButton.textContent = "Code Locked";
    familyCodeInput.dataset.locked = "true";
  } else {
    newCodeButton.disabled = false;
    newCodeButton.textContent = "New Code";
    delete familyCodeInput.dataset.locked;
  }
}


function debugLog(label, data) {
  if (!DEBUG_ENABLED || !debugLogEl || !debugPanel) return;
  const time = new Date().toISOString().split("T")[1].replace("Z", "");
  let payload = "";
  try {
    payload = data !== undefined ? JSON.stringify(data) : "";
  } catch (e) {
    payload = "[unserializable]";
  }
  const line = `[${time}] ${label}${payload ? " :: " + payload : ""}`;
  debugEntries.push(line);
  debugLogEl.textContent = debugEntries.slice(-200).join("\n");
  debugPanel.classList.add("show");
}

function initDebugPanel() {
  if (!DEBUG_ENABLED || !debugPanel) return;
  debugPanel.classList.add("show");
  debugLog("debugPanel", { enabled: DEBUG_ENABLED, panel: !!debugPanel, dump: !!debugDump });
  if (debugCopy) {
    debugCopy.addEventListener("click", () => {
      navigator.clipboard.writeText(debugEntries.join("\n"));
      toastMsg("Debug log copied.");
    });
  }
  if (debugDump) {
    debugDump.addEventListener("click", () => {
      debugLog("dump", {
        users: state.users,
        logs: state.logs,
        earned: state.earned,
        lastUpdated: state.lastUpdated,
        familyCode,
        selectedUserId
      });
    });
  }
  if (debugClear) {
    debugClear.addEventListener("click", () => {
      debugEntries = [];
      debugLogEl.textContent = "";
    });
  }
}


if (DEBUG_ENABLED) {
  window.addEventListener("error", (event) => {
    try {
      debugLog("window.error", { message: event.message, filename: event.filename, lineno: event.lineno, colno: event.colno });
    } catch (e) {
      // ignore
    }
  });
  window.addEventListener("unhandledrejection", (event) => {
    try {
      debugLog("unhandledrejection", { reason: String(event.reason) });
    } catch (e) {
      // ignore
    }
  });
}


window.__dumpState = function() {
  if (!DEBUG_ENABLED) {
    console.warn("Debug not enabled");
    return;
  }
  debugLog("dump", {
    users: state.users,
    logs: state.logs,
    earned: state.earned,
    lastUpdated: state.lastUpdated,
    familyCode,
    selectedUserId
  });
};
