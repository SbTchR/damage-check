import { db } from "./firebase-config.js";
import {
  collection, query, where, onSnapshot, getDocs, updateDoc, doc,
  arrayRemove, arrayUnion, getDoc, setDoc, deleteDoc, writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const $ = id => document.getElementById(id);

const dash = $("dash");
const globalView = $("globalView");
const headphoneView = $("headphoneView");
const sessionView = $("sessionView");
const followupView = $("followupView");
const tabPc = $("tabPc");
const tabGlobal = $("tabGlobal");
const tabHeadphones = $("tabHeadphones");
const tabSessions = $("tabSessions");
const tabFollowup = $("tabFollowup");

const pcSelect = $("pcSelect");
const pcHeadphoneSelect = $("pcHeadphoneSelect");
const pcDamageSearch = $("pcDamageSearch");
const pcSort = $("pcSort");
const onlyDamages = $("onlyDamages");
const onlyUnresToggleEl = $("onlyUnres");
const pcResultCount = $("pcResultCount");
const deleteComputerButton = $("deleteComputer");
const tbody = $("tbody");
const pcEmpty = $("pcEmpty");

const globalGrid = $("globalGrid");
const globalEmpty = $("globalEmpty");
const globalSearch = $("globalSearch");
const globalHideNotImportant = $("globalHideNotImportant");
const globalHideEmpty = $("globalHideEmpty");
const globalSort = $("globalSort");
const globalToolbar = $("globalToolbar");
const globalMobileFilters = $("globalMobileFilters");
const globalMobileFilterState = $("globalMobileFilterState");
const globalResultCount = $("globalResultCount");
const globalFilterSummary = $("globalFilterSummary");
const metricAll = $("metricAll");
const metricImportant = $("metricImportant");
const metricComputers = $("metricComputers");
const metricNotImportant = $("metricNotImportant");

const headphoneSelect = $("headphoneSelect");
const headphoneSearch = $("headphoneSearch");
const headphoneHideNotImportant = $("headphoneHideNotImportant");
const headphoneGrid = $("headphoneGrid");
const headphoneEmpty = $("headphoneEmpty");
const headphoneResultCount = $("headphoneResultCount");

const sessionDateFrom = $("sessionDateFrom");
const sessionDateTo = $("sessionDateTo");
const sessionMinCount = $("sessionMinCount");
const studentSessionSort = $("studentSessionSort");
const sessionPcFilter = $("sessionPcFilter");
const sessionUserSearch = $("sessionUserSearch");
const sessionHasDamage = $("sessionHasDamage");
const sessionSort = $("sessionSort");
const sessionReset = $("sessionReset");
const sessionSelectPage = $("sessionSelectPage");
const sessionSelectFiltered = $("sessionSelectFiltered");
const sessionSelectionCount = $("sessionSelectionCount");
const sessionDeleteSelected = $("sessionDeleteSelected");
const sessionResultCount = $("sessionResultCount");
const sessionResultLabel = $("sessionResultLabel");
const sessionSelectPageLabel = $("sessionSelectPageLabel");
const sessionTableBody = $("sessionTableBody");
const sessionTableShell = $("sessionTableShell");
const sessionEmpty = $("sessionEmpty");
const sessionPagination = $("sessionPagination");
const studentSessionGroups = $("studentSessionGroups");
const studentSessionEmpty = $("studentSessionEmpty");

const followupSearch = $("followupSearch");
const followupSort = $("followupSort");
const followupReset = $("followupReset");
const followupResultCount = $("followupResultCount");
const followupList = $("followupList");
const followupEmpty = $("followupEmpty");
const toast = $("toast");

const tabButtons = [tabPc, tabGlobal, tabHeadphones, tabSessions, tabFollowup];
const tabPanels = { dash, globalView, headphoneView, sessionView, followupView };
const SECTION_ORDER = ["keyboard", "mouse", "screen", "headphones", "other", "none"];
const SESSION_STALE_SECONDS = 15 * 60;
const SESSION_STALE_MS = SESSION_STALE_SECONDS * 1000;
const SESSION_STALE_LABEL = `${Math.round(SESSION_STALE_SECONDS / 60)} min`;
const SESSION_PAGE_SIZE = 50;
const REPORT_SESSION_MATCH_MS = 5 * 60 * 1000;
const USAGE_DEDUPE_MS = 2 * 60 * 1000;
const PREFERENCES_KEY = "damage-dashboard-preferences-v2";

let currentPC = null;
let currentHeadphoneDetail = "";
let unresolved = emptyComputer();
let reportCache = [];
let sessionCache = [];
let sessionDataLoaded = false;
let overviewCardsCache = null;
let dashboardCollectionsCache = null;
let dashboardCollectionsPromise = null;
let pcReportsLoaded = false;
let pcUnresolvedLoaded = false;
let unsubReports = null;
let unsubUnres = null;
let unsubSessions = null;
let toastTimer = null;
let followupRenderVersion = 0;
let sessionPage = 1;
let isDeletingSessions = false;
let isDeletingComputer = false;
const selectedSessionIds = new Set();
const expandedSessionIds = new Set();
const studentSessionLimits = new Map();
const expandedStudentKeys = new Set();

function emptyComputer() {
  return { keyboard: [], mouse: [], screen: [], headphones: [], other: [] };
}

function iconMarkup(name) {
  const icons = {
    computer: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
    keyboard: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M6 13h.01M9 13h.01M12 13h.01M15 13h.01M18 13h.01M8 16h8"/></svg>',
    mouse: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 2v6"/></svg>',
    screen: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
    headphones: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M4 14h3v6H5a1 1 0 0 1-1-1v-5ZM20 14h-3v6h2a1 1 0 0 0 1-1v-5Z"/></svg>',
    other: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m14.7 6.3 3-3a4 4 0 0 1-5 5l-7.4 7.4a2 2 0 1 0 3 3l7.4-7.4a4 4 0 0 1 5-5l-3 3-3-3Z"/></svg>',
    calendar: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
    check: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m5 12 4 4L19 6"/></svg>',
    flag: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 21V4m0 1h10l-1.5 3L15 11H5"/></svg>',
    trash: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>'
  };
  return icons[name] || icons.other;
}

function sectionIconName(section) {
  return SECTION_ORDER.includes(section) && section !== "none" ? section : "other";
}

function label(section) {
  return ({ keyboard: "Clavier", mouse: "Souris", screen: "Écran", headphones: "Écouteurs", other: "Autres", none: "Non classé" })[section] || section;
}

function normalizeText(value) {
  return String(value ?? "").trim().toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
}

function isHeadphoneDamage(value) {
  return value && typeof value === "object" && ("description" in value) && ("numero" in value);
}

function parseHeadphoneText(text) {
  const match = String(text ?? "").trim().match(/n[°ºo]\s*(\d+)\s*[:\-–]\s*(.+)/i);
  return match ? { numero: match[1], description: match[2].trim() } : null;
}

function toHeadphoneObj(value) {
  if (value && typeof value === "object") return { ...value };
  const text = String(value ?? "");
  return parseHeadphoneText(text) || { numero: "", description: text };
}

function extractDamageText(section, value) {
  if (section === "headphones") {
    if (value && typeof value === "object") return value.description ?? value.desc ?? "";
    return String(value ?? "");
  }
  if (value && typeof value === "object") return value.text ?? value.description ?? value.desc ?? "";
  return String(value ?? "");
}

function isNotImportantDamage(_section, value) {
  return Boolean(value && typeof value === "object" && value.notImportant);
}

function headphoneDamageEquals(a, b) {
  if (!isHeadphoneDamage(a) || !isHeadphoneDamage(b)) return false;
  return normalizeText(a.description) === normalizeText(b.description) && normalizeText(a.numero) === normalizeText(b.numero);
}

function matchesDamage(section, stored, target) {
  if (section === "headphones") return headphoneDamageEquals(toHeadphoneObj(stored), toHeadphoneObj(target));
  return normalizeText(extractDamageText(section, stored)) === normalizeText(extractDamageText(section, target));
}

function makeNotImportantValue(section, stored, target) {
  if (section === "headphones") return { ...toHeadphoneObj(stored ?? target), notImportant: true };
  return { text: extractDamageText(section, stored ?? target), notImportant: true };
}

function makeImportantValue(section, stored, target) {
  if (section === "headphones") {
    const next = toHeadphoneObj(stored ?? target);
    delete next.notImportant;
    return next;
  }
  return extractDamageText(section, stored ?? target);
}

function keyForDamage(section, value) {
  if (!section) return null;
  if (section === "headphones") {
    const obj = toHeadphoneObj(value);
    return `${section}|${normalizeText(obj.numero)}|${normalizeText(obj.description ?? obj.desc ?? "")}`;
  }
  return `${section}|${normalizeText(extractDamageText(section, value))}`;
}

function formatDesc(section, value) {
  if (section !== "headphones") return extractDamageText(section, value);
  const obj = toHeadphoneObj(value);
  return obj.numero ? `N° ${obj.numero} — ${obj.description ?? obj.desc ?? ""}` : extractDamageText(section, value);
}

function isNothingDamage(section, value) {
  const text = normalizeText(extractDamageText(section, value));
  return text === "rien" || text.includes("aucun degat");
}

function comparePcIds(a, b) {
  const numA = Number.parseInt(a, 10);
  const numB = Number.parseInt(b, 10);
  const validA = !Number.isNaN(numA);
  const validB = !Number.isNaN(numB);
  if (validA && validB && numA !== numB) return numA - numB;
  if (validA !== validB) return validA ? -1 : 1;
  return String(a).localeCompare(String(b), "fr", { numeric: true, sensitivity: "base" });
}

function timestampToMs(value) {
  if (!value) return 0;
  if (typeof value === "object") {
    if (typeof value.seconds === "number") return value.seconds * 1000;
    if (typeof value.toDate === "function") return value.toDate().getTime();
  }
  if (typeof value === "number") return value < 1e12 ? value * 1000 : value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getReportWhenTs(report) {
  return timestampToMs(report?.when) || timestampToMs(report?.date) || timestampToMs(report?.createdAt) || timestampToMs(report?.timestamp) || 0;
}

function getReportUser(report) {
  return String(report?.user ?? report?.userId ?? report?.username ?? report?.utilisateur ?? report?.eleve ?? "");
}

function formatDateTime(value) {
  const ms = typeof value === "number" ? value : timestampToMs(value);
  return ms ? new Date(ms).toLocaleString("fr-CH", { dateStyle: "short", timeStyle: "short" }) : "Date inconnue";
}

function formatDateGroup(ms) {
  return ms ? new Date(ms).toLocaleDateString("fr-CH", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "Date inconnue";
}

function dateGroupKey(ms) {
  if (!ms) return "unknown";
  const date = new Date(ms);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatCount(value, singular, plural = `${singular}s`) {
  return `${value.toLocaleString("fr-CH")} ${value === 1 ? singular : plural}`;
}

function showToast(message) {
  if (!toast) return;
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.remove("hidden");
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 3200);
}

async function loadDashboardCollections() {
  const fresh = dashboardCollectionsCache && (Date.now() - dashboardCollectionsCache.loadedAt) < 30_000;
  if (fresh) return dashboardCollectionsCache;
  if (dashboardCollectionsPromise) return dashboardCollectionsPromise;
  dashboardCollectionsPromise = Promise.all([
    getDocs(collection(db, "computers")),
    getDocs(collection(db, "reports"))
  ]).then(([computers, reports]) => {
    dashboardCollectionsCache = { computers, reports, loadedAt: Date.now() };
    return dashboardCollectionsCache;
  }).finally(() => { dashboardCollectionsPromise = null; });
  return dashboardCollectionsPromise;
}

function invalidateDashboardCollections() {
  dashboardCollectionsCache = null;
  dashboardCollectionsPromise = null;
  overviewCardsCache = null;
}

function readPreferences() {
  try {
    return { groupBy: "computer", hideNotImportant: false, hideEmpty: true, sort: "newest", ...JSON.parse(localStorage.getItem(PREFERENCES_KEY) || "{}") };
  } catch {
    return { groupBy: "computer", hideNotImportant: false, hideEmpty: true, sort: "newest" };
  }
}

function saveOverviewPreferences() {
  const groupBy = document.querySelector('input[name="globalGroup"]:checked')?.value || "computer";
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify({
    groupBy,
    hideNotImportant: Boolean(globalHideNotImportant?.checked),
    hideEmpty: Boolean(globalHideEmpty?.checked),
    sort: globalSort?.value || "newest"
  }));
}

function applyGlobalFilterLayout() {
  const mobile = window.matchMedia("(max-width: 680px)").matches;
  if (!globalToolbar || !globalMobileFilters) return;
  if (mobile) {
    globalToolbar.classList.add("mobile-collapsed");
    globalMobileFilters.setAttribute("aria-expanded", "false");
  } else {
    globalToolbar.classList.remove("mobile-collapsed");
    globalMobileFilters.setAttribute("aria-expanded", "true");
  }
}

function toggleGlobalMobileFilters() {
  if (!globalToolbar || !globalMobileFilters) return;
  const collapsed = globalToolbar.classList.toggle("mobile-collapsed");
  globalMobileFilters.setAttribute("aria-expanded", String(!collapsed));
}

function setHash(value) {
  history.replaceState(null, "", `${location.pathname}${location.search}${value}`);
}

function activateTab(targetId) {
  let activeButton = null;
  tabButtons.filter(Boolean).forEach(button => {
    const active = button.dataset.target === targetId;
    if (active) activeButton = button;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  Object.entries(tabPanels).forEach(([id, panel]) => panel?.classList.toggle("active", id === targetId));
  if (activeButton && window.matchMedia("(max-width: 680px)").matches) {
    window.requestAnimationFrame(() => activeButton.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" }));
  }
}

function showPcView() { activateTab("dash"); setHash(""); drawTable(); }
async function showGlobalViewTab() { activateTab("globalView"); setHash("#global"); await showGlobalView(); }
async function showHeadphonesView() { activateTab("headphoneView"); setHash("#headphones"); await renderHeadphones(); }
function showSessionsView() { activateTab("sessionView"); setHash("#sessions"); renderSessions(); }
async function showFollowupView() { activateTab("followupView"); setHash("#followup"); await renderFollowups(); }

tabPc?.addEventListener("click", showPcView);
tabGlobal?.addEventListener("click", showGlobalViewTab);
tabHeadphones?.addEventListener("click", showHeadphonesView);
tabSessions?.addEventListener("click", showSessionsView);
tabFollowup?.addEventListener("click", showFollowupView);

function createButton(labelText, action, options = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `btn${options.variant ? ` ${options.variant}` : ""}`;
  button.dataset.action = action;
  if (options.icon) button.insertAdjacentHTML("afterbegin", iconMarkup(options.icon));
  const labelSpan = document.createElement("span");
  labelSpan.textContent = labelText;
  button.appendChild(labelSpan);
  if (options.title) button.title = options.title;
  Object.entries(options.data || {}).forEach(([key, value]) => { button.dataset[key] = String(value ?? ""); });
  return button;
}

function encodeDamage(value) {
  return encodeURIComponent(JSON.stringify(value));
}

function decodeDamage(value) {
  const decoded = decodeURIComponent(value || "");
  try { return JSON.parse(decoded); } catch { return decoded; }
}

function createDamageActions(issue, pc, unresolvedNow = true) {
  const actions = document.createElement("div");
  actions.className = "damage-actions action-group";
  const baseData = { pc, sec: issue.section, desc: encodeDamage(issue.desc), rep: issue.reportId || "" };
  actions.appendChild(createButton(unresolvedNow ? "Régler" : "Rouvrir", "toggle", { icon: "check", variant: "primary", data: { ...baseData, res: unresolvedNow } }));
  if (unresolvedNow) {
    actions.appendChild(createButton(issue.isNotImportant ? "Rendre important" : "Pas important", "not-important", { icon: "flag", data: { ...baseData, ni: issue.isNotImportant } }));
  }
  actions.appendChild(createButton("Supprimer", "delete", { icon: "trash", variant: "danger", data: baseData }));
  return actions;
}

async function removeFromReport(repId, section, desc) {
  if (!repId) return false;
  const repRef = doc(db, "reports", repId);
  const repSnap = await getDoc(repRef);
  if (!repSnap.exists()) return false;
  const items = Array.isArray(repSnap.data().items) ? repSnap.data().items : [];
  const next = items.filter(item => !(item.section === section && matchesDamage(section, item.desc, desc)));
  if (next.length === items.length) return false;
  if (next.length) await setDoc(repRef, { items: next }, { merge: true });
  else await deleteDoc(repRef);
  return true;
}

async function removeFromAnyReport(pc, section, desc) {
  const reports = await getDocs(query(collection(db, "reports"), where("pcId", "==", pc)));
  for (const snapshot of reports.docs) {
    if (await removeFromReport(snapshot.id, section, desc)) return;
  }
}

async function markNotImportant(pc, section, desc, shouldBeNotImportant) {
  const pcRef = doc(db, "computers", pc);
  const snapshot = await getDoc(pcRef);
  if (!snapshot.exists()) return;
  const values = Array.isArray(snapshot.data()?.[section]) ? snapshot.data()[section] : [];
  let modified = false;
  const next = values.map(value => {
    if (!matchesDamage(section, value, desc)) return value;
    modified = true;
    return shouldBeNotImportant ? makeNotImportantValue(section, value, desc) : makeImportantValue(section, value, desc);
  });
  if (modified) await setDoc(pcRef, { [section]: next }, { merge: true });
}

async function handleDamageAction(button) {
  const action = button.dataset.action;
  const pc = button.dataset.pc || currentPC;
  const section = button.dataset.sec;
  const desc = decodeDamage(button.dataset.desc);
  const reportId = button.dataset.rep || "";
  if (!action || !pc || !section) return;

  button.disabled = true;
  try {
    const pcRef = doc(db, "computers", pc);
    if (action === "delete") {
      if (!window.confirm("Supprimer définitivement ce dégât et son signalement ?")) return;
      const snapshot = await getDoc(pcRef);
      if (snapshot.exists()) {
        const values = Array.isArray(snapshot.data()?.[section]) ? snapshot.data()[section] : [];
        const next = values.filter(value => !matchesDamage(section, value, desc));
        if (next.length !== values.length) await setDoc(pcRef, { [section]: next }, { merge: true });
      }
      if (!(await removeFromReport(reportId, section, desc))) await removeFromAnyReport(pc, section, desc);
      showToast("Le dégât a été supprimé.");
    } else if (action === "not-important") {
      await markNotImportant(pc, section, desc, button.dataset.ni !== "true");
      showToast(button.dataset.ni === "true" ? "Le dégât est de nouveau important." : "Le dégât est marqué comme pas important.");
    } else if (action === "toggle") {
      const unresolvedNow = button.dataset.res === "true";
      if (unresolvedNow) await updateDoc(pcRef, { [section]: arrayRemove(desc) });
      else await updateDoc(pcRef, { [section]: arrayUnion(desc) });
      showToast(unresolvedNow ? "Le dégât est marqué comme réglé." : "Le dégât est rouvert.");
    }
    invalidateDashboardCollections();
    await Promise.all([drawTable(), showGlobalView(), renderHeadphones(), followupView?.classList.contains("active") ? renderFollowups() : Promise.resolve()]);
  } catch (error) {
    console.error("handleDamageAction", error);
    window.alert("L’action n’a pas pu être enregistrée. Réessaie dans un instant.");
  } finally {
    button.disabled = false;
  }
}

async function deleteDocumentRefs(refs) {
  for (let index = 0; index < refs.length; index += 400) {
    const batch = writeBatch(db);
    refs.slice(index, index + 400).forEach(ref => batch.delete(ref));
    await batch.commit();
  }
}

async function deleteCurrentComputer() {
  if (!currentPC || isDeletingComputer) return;
  const pc = currentPC;
  isDeletingComputer = true;
  if (deleteComputerButton) {
    deleteComputerButton.disabled = true;
    deleteComputerButton.textContent = "Vérification…";
  }
  try {
    const [reports, sessions] = await Promise.all([
      getDocs(query(collection(db, "reports"), where("pcId", "==", pc))),
      getDocs(query(collection(db, "report_sessions"), where("pcId", "==", pc)))
    ]);
    const expected = `PC ${pc}`;
    const answer = window.prompt(
      `Cette suppression effacera ${expected}, ${formatCount(reports.size, "signalement")} et ${formatCount(sessions.size, "session")} de la base.\n\nCette action est irréversible. Pour confirmer, saisissez exactement : ${expected}`
    );
    if (answer === null) return;
    if (answer.trim() !== expected) {
      window.alert("La confirmation ne correspond pas. Aucun élément n’a été supprimé.");
      return;
    }
    if (deleteComputerButton) deleteComputerButton.textContent = "Suppression…";
    await deleteDocumentRefs([
      ...reports.docs.map(snapshot => snapshot.ref),
      ...sessions.docs.map(snapshot => snapshot.ref),
      doc(db, "computers", pc)
    ]);
    invalidateDashboardCollections();
    showToast(`${expected} et son historique ont été supprimés.`);
    window.setTimeout(() => location.reload(), 650);
  } catch (error) {
    console.error("deleteCurrentComputer", error);
    window.alert("La suppression n’a pas pu être terminée. Actualisez la page avant de vérifier les éléments restants ou de réessayer.");
  } finally {
    isDeletingComputer = false;
    if (deleteComputerButton) {
      deleteComputerButton.disabled = false;
      deleteComputerButton.textContent = "Supprimer cet ordinateur";
    }
  }
}

async function initDashboard() {
  const preferences = readPreferences();
  const preferredGroup = document.querySelector(`input[name="globalGroup"][value="${preferences.groupBy}"]`);
  if (preferredGroup) preferredGroup.checked = true;
  if (globalHideNotImportant) globalHideNotImportant.checked = preferences.hideNotImportant;
  if (globalHideEmpty) globalHideEmpty.checked = preferences.hideEmpty;
  if (globalSort) globalSort.value = preferences.sort;

  let pcIds = [];
  const headphoneNumbers = new Set();
  try {
    const pcs = await getDocs(collection(db, "computers"));
    pcs.forEach(snapshot => {
      pcIds.push(snapshot.id);
      (Array.isArray(snapshot.data()?.headphones) ? snapshot.data().headphones : []).forEach(value => {
        const number = String(toHeadphoneObj(value).numero || "").trim();
        if (number) headphoneNumbers.add(number);
      });
    });
  } catch (error) {
    console.warn("computers list failed", error);
  }
  if (!pcIds.length) {
    const reports = await getDocs(collection(db, "reports"));
    pcIds = Array.from(new Set(reports.docs.map(snapshot => snapshot.data().pcId).filter(Boolean)));
  }
  pcIds.sort(comparePcIds);
  populateHeadphoneSelects(Array.from(headphoneNumbers).sort(comparePcIds));
  pcIds.forEach(id => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = id;
    pcSelect?.appendChild(option);
  });

  if (pcSelect && pcIds.length) {
    pcSelect.value = pcIds[0];
    subscribeToPc(pcIds[0]);
  }

  pcSelect?.addEventListener("change", event => subscribeToPc(event.target.value));
  deleteComputerButton?.addEventListener("click", deleteCurrentComputer);
  [onlyDamages, onlyUnresToggleEl, pcSort].forEach(control => control?.addEventListener("change", drawTable));
  pcDamageSearch?.addEventListener("input", drawTable);
  pcHeadphoneSelect?.addEventListener("change", event => { currentHeadphoneDetail = event.target.value || ""; drawTable(); });

  document.querySelectorAll('input[name="globalGroup"]').forEach(input => input.addEventListener("change", () => { saveOverviewPreferences(); renderGlobalView(); }));
  [globalHideNotImportant, globalHideEmpty, globalSort].forEach(control => control?.addEventListener("change", () => { saveOverviewPreferences(); renderGlobalView(); }));
  globalSearch?.addEventListener("input", renderGlobalView);
  globalMobileFilters?.addEventListener("click", toggleGlobalMobileFilters);
  window.matchMedia("(max-width: 680px)").addEventListener?.("change", applyGlobalFilterLayout);
  applyGlobalFilterLayout();

  headphoneSelect?.addEventListener("change", renderHeadphones);
  headphoneSearch?.addEventListener("input", renderHeadphones);
  headphoneHideNotImportant?.addEventListener("change", renderHeadphones);

  [sessionDateFrom, sessionDateTo, sessionPcFilter, sessionHasDamage, sessionSort].forEach(control => control?.addEventListener("change", sessionFiltersChanged));
  [sessionMinCount, studentSessionSort].forEach(control => control?.addEventListener("change", sessionFiltersChanged));
  document.querySelectorAll('input[name="sessionViewMode"]').forEach(input => input.addEventListener("change", sessionModeChanged));
  sessionUserSearch?.addEventListener("input", sessionFiltersChanged);
  sessionReset?.addEventListener("click", resetSessionFilters);
  sessionSelectPage?.addEventListener("change", toggleSessionPageSelection);
  sessionSelectFiltered?.addEventListener("click", toggleAllFilteredSessions);
  sessionDeleteSelected?.addEventListener("click", deleteSelectedSessions);
  sessionPagination?.addEventListener("click", handlePaginationClick);

  followupSearch?.addEventListener("input", renderFollowups);
  followupSort?.addEventListener("change", renderFollowups);
  followupReset?.addEventListener("click", () => {
    if (followupSearch) followupSearch.value = "";
    if (followupSort) followupSort.value = "newest";
    renderFollowups();
  });

  subscribeSessions();

  if (location.hash === "#followup") await showFollowupView();
  else if (location.hash === "#global") await showGlobalViewTab();
  else if (location.hash === "#headphones") await showHeadphonesView();
  else if (location.hash === "#sessions") showSessionsView();
  else showPcView();
}

function subscribeToPc(pc) {
  if (!pc || pc === currentPC) { drawTable(); return; }
  currentPC = pc;
  if (deleteComputerButton) deleteComputerButton.disabled = false;
  currentHeadphoneDetail = "";
  if (pcHeadphoneSelect) pcHeadphoneSelect.value = "";
  unsubReports?.();
  unsubUnres?.();
  reportCache = [];
  unresolved = emptyComputer();
  pcReportsLoaded = false;
  pcUnresolvedLoaded = false;
  drawTable();

  unsubUnres = onSnapshot(doc(db, "computers", pc), snapshot => {
    unresolved = snapshot.exists() ? { ...emptyComputer(), ...snapshot.data() } : emptyComputer();
    pcUnresolvedLoaded = true;
    drawTable();
  }, error => console.warn("computer subscription", error));

  unsubReports = onSnapshot(query(collection(db, "reports"), where("pcId", "==", pc)), snapshot => {
    reportCache = snapshot.docs.map(item => ({ ...item.data(), _id: item.id })).sort((a, b) => getReportWhenTs(b) - getReportWhenTs(a));
    pcReportsLoaded = true;
    drawTable();
  }, error => console.warn("reports subscription", error));
}

function buildPcRows() {
  const latestMap = new Map();
  reportCache.forEach(report => {
    const whenTs = getReportWhenTs(report);
    (Array.isArray(report.items) ? report.items : []).forEach(item => {
      const key = keyForDamage(item.section, item.desc);
      if (!key || (onlyDamages?.checked && isNothingDamage(item.section, item.desc))) return;
      if (!latestMap.has(key) || whenTs > latestMap.get(key).whenTs) {
        latestMap.set(key, { section: item.section, desc: item.desc, whenTs, user: getReportUser(report), reportId: report._id });
      }
    });
  });

  const unresolvedMap = new Map();
  const allKeys = new Set(latestMap.keys());
  SECTION_ORDER.forEach(section => {
    const values = Array.isArray(unresolved[section]) ? unresolved[section] : [];
    values.forEach(desc => {
      if (onlyDamages?.checked && isNothingDamage(section, desc)) return;
      const key = keyForDamage(section, desc);
      if (!key) return;
      unresolvedMap.set(key, desc);
      allKeys.add(key);
    });
  });

  const needle = normalizeText(pcDamageSearch?.value);
  const rows = [];
  allKeys.forEach(key => {
    const report = latestMap.get(key);
    const section = report?.section || key.split("|")[0] || "other";
    const desc = unresolvedMap.get(key) ?? report?.desc;
    if (desc === undefined) return;
    const isUnres = unresolvedMap.has(key);
    if (onlyUnresToggleEl?.checked && !isUnres) return;
    const row = {
      section, desc, isUnres,
      descText: formatDesc(section, desc),
      whenTs: report?.whenTs || 0,
      user: report?.user || "",
      reportId: report?.reportId || "",
      isNotImportant: isNotImportantDamage(section, desc)
    };
    const searchable = normalizeText(`${label(section)} ${row.descText} ${row.user} ${formatDateTime(row.whenTs)}`);
    if (!needle || searchable.includes(needle)) rows.push(row);
  });

  if (!onlyUnresToggleEl?.checked) {
    eligibleSessions()
      .filter(session => String(session.pcId || "") === String(currentPC || ""))
      .forEach(session => {
        const lastStep = labelStep(session.step);
        const row = {
          rowType: "session",
          section: "session",
          componentText: "Formulaire",
          groupText: "Formulaires non validés",
          descText: `Formulaire non validé · Dernière étape : ${lastStep}`,
          whenTs: sessionStartMs(session),
          user: String(session.user || "").trim() || "Élève inconnu",
          isUnres: false,
          isNotImportant: false
        };
        const searchable = normalizeText(`${row.componentText} ${row.descText} ${row.user} ${formatDateTime(row.whenTs)}`);
        if (!needle || searchable.includes(needle)) rows.push(row);
      });
  }

  const sortMode = pcSort?.value || "component";
  rows.sort((a, b) => {
    if (sortMode === "newest") return b.whenTs - a.whenTs;
    if (sortMode === "oldest") return (a.whenTs || Number.MAX_SAFE_INTEGER) - (b.whenTs || Number.MAX_SAFE_INTEGER);
    const sectionRank = section => {
      if (section === "session") return 0;
      const index = SECTION_ORDER.indexOf(section);
      return index >= 0 ? index + 1 : SECTION_ORDER.length + 1;
    };
    const sectionDiff = sectionRank(a.section) - sectionRank(b.section);
    return sectionDiff || (b.whenTs - a.whenTs);
  });
  return rows;
}

async function drawTable() {
  if (!tbody) return;
  if (currentHeadphoneDetail) { await drawHeadphoneDetail(currentHeadphoneDetail); return; }
  tbody.replaceChildren();
  pcEmpty?.classList.add("hidden");
  if (!pcReportsLoaded || !pcUnresolvedLoaded || !sessionDataLoaded) {
    if (pcResultCount) pcResultCount.textContent = "Chargement…";
    if (pcEmpty) pcEmpty.textContent = "Chargement de l’historique…";
    pcEmpty?.classList.remove("hidden");
    return;
  }
  const rows = buildPcRows();
  const abandonedCount = rows.filter(row => row.rowType === "session").length;
  if (pcResultCount) {
    pcResultCount.textContent = abandonedCount
      ? `${formatCount(rows.length, "entrée")} · ${formatCount(abandonedCount, "formulaire non validé", "formulaires non validés")}`
      : formatCount(rows.length, "résultat");
  }

  let currentSection = null;
  rows.forEach(row => {
    if ((pcSort?.value || "component") === "component" && row.section !== currentSection) {
      currentSection = row.section;
      const heading = document.createElement("tr");
      heading.className = "section-row";
      const cell = document.createElement("td");
      cell.colSpan = 6;
      cell.textContent = row.groupText || label(row.section);
      heading.appendChild(cell);
      tbody.appendChild(heading);
    }
    const tr = document.createElement("tr");
    tr.className = row.rowType === "session" ? "unvalidated-session" : (row.isNotImportant ? "not-important" : (row.isUnres ? "needs-attention" : ""));
    [row.componentText || label(row.section), row.descText, row.whenTs ? formatDateTime(row.whenTs) : "—", row.user || "—"].forEach((text, index) => {
      const td = document.createElement("td");
      td.textContent = text;
      if (index === 1) td.className = "description-cell";
      tr.appendChild(td);
    });
    const statusCell = document.createElement("td");
    const status = document.createElement("span");
    status.className = `status ${row.rowType === "session" ? "warning" : (row.isUnres ? (row.isNotImportant ? "neutral" : "danger") : "success")}`;
    status.textContent = row.rowType === "session" ? "Non validé" : (row.isUnres ? (row.isNotImportant ? "Pas important" : "À traiter") : "Réglé");
    statusCell.appendChild(status);
    tr.appendChild(statusCell);
    const actionCell = document.createElement("td");
    if (row.rowType === "session") {
      actionCell.className = "history-placeholder";
      actionCell.textContent = "Historique";
    } else {
      actionCell.appendChild(createDamageActions(row, currentPC, row.isUnres));
    }
    tr.appendChild(actionCell);
    tbody.appendChild(tr);
  });

  if (!rows.length) {
    if (pcEmpty) pcEmpty.textContent = "Aucun signalement ne correspond aux filtres.";
    pcEmpty?.classList.remove("hidden");
  }
}

async function loadOverviewData() {
  if (overviewCardsCache) return overviewCardsCache;
  const { computers, reports } = await loadDashboardCollections();
  const latestByPc = new Map();
  reports.forEach(snapshot => {
    const report = snapshot.data();
    if (!report.pcId) return;
    if (!latestByPc.has(report.pcId)) latestByPc.set(report.pcId, new Map());
    const whenTs = getReportWhenTs(report);
    (Array.isArray(report.items) ? report.items : []).forEach(item => {
      const key = keyForDamage(item.section, item.desc);
      if (!key || isNothingDamage(item.section, item.desc)) return;
      const existing = latestByPc.get(report.pcId).get(key);
      if (!existing || whenTs > existing.whenTs) {
        latestByPc.get(report.pcId).set(key, { whenTs, user: getReportUser(report), reportId: snapshot.id });
      }
    });
  });

  const cards = [];
  computers.forEach(snapshot => {
    const pcId = snapshot.id;
    const data = snapshot.data() || {};
    const issues = [];
    SECTION_ORDER.filter(section => section !== "headphones" && section !== "none").forEach(section => {
      (Array.isArray(data[section]) ? data[section] : []).forEach(desc => {
        if (isNothingDamage(section, desc)) return;
        const meta = latestByPc.get(pcId)?.get(keyForDamage(section, desc)) || {};
        issues.push({
          pcId, section, desc, descText: extractDamageText(section, desc),
          whenTs: meta.whenTs || 0, user: meta.user || "", reportId: meta.reportId || "",
          isNotImportant: isNotImportantDamage(section, desc)
        });
      });
    });
    cards.push({ pcId, issues });
  });
  cards.sort((a, b) => comparePcIds(a.pcId, b.pcId));
  overviewCardsCache = cards;
  return cards;
}

function updateOverviewMetrics(cards) {
  const issues = cards.flatMap(card => card.issues);
  const important = issues.filter(issue => !issue.isNotImportant).length;
  const affected = cards.filter(card => card.issues.length).length;
  if (metricAll) metricAll.textContent = issues.length.toLocaleString("fr-CH");
  if (metricImportant) metricImportant.textContent = important.toLocaleString("fr-CH");
  if (metricComputers) metricComputers.textContent = affected.toLocaleString("fr-CH");
  if (metricNotImportant) metricNotImportant.textContent = (issues.length - important).toLocaleString("fr-CH");
}

function createDamageGroup(titleText, count, metaText, iconName = "computer") {
  const group = document.createElement("details");
  group.className = "damage-group";
  group.open = true;
  const summary = document.createElement("summary");
  const icon = document.createElement("span");
  icon.className = "group-icon";
  icon.innerHTML = iconMarkup(iconName);
  const title = document.createElement("span");
  title.className = "group-title";
  title.textContent = titleText;
  const countEl = document.createElement("span");
  countEl.className = "group-count";
  countEl.textContent = formatCount(count, "dégât");
  const meta = document.createElement("span");
  meta.className = "group-meta";
  meta.textContent = metaText;
  summary.append(icon, title, countEl, meta);
  group.appendChild(summary);
  return group;
}

function appendOverviewDamageRow(parent, issue, showPc = false) {
  const row = document.createElement("div");
  row.className = "damage-row";
  const component = document.createElement("div");
  component.className = "damage-component";
  component.innerHTML = iconMarkup(sectionIconName(issue.section));
  const componentText = document.createElement("span");
  componentText.textContent = showPc ? `PC ${issue.pcId} · ${label(issue.section)}` : label(issue.section);
  component.appendChild(componentText);
  const description = document.createElement("div");
  description.className = "damage-description";
  description.textContent = issue.descText;
  const meta = document.createElement("div");
  meta.className = "damage-meta";
  meta.textContent = `${issue.whenTs ? formatDateTime(issue.whenTs) : "Date inconnue"}${issue.user ? ` · ${issue.user}` : ""}`;
  const status = document.createElement("span");
  status.className = `status ${issue.isNotImportant ? "neutral" : "danger"}`;
  status.textContent = issue.isNotImportant ? "Pas important" : "À traiter";
  row.append(component, description, meta, status, createDamageActions(issue, issue.pcId, true));
  parent.appendChild(row);
}

function filterOverviewIssue(issue, needle) {
  if (globalHideNotImportant?.checked && issue.isNotImportant) return false;
  if (!needle) return true;
  return normalizeText(`PC ${issue.pcId} ${label(issue.section)} ${issue.descText} ${issue.user} ${formatDateTime(issue.whenTs)}`).includes(needle);
}

function renderGlobalView() {
  if (!globalGrid || !overviewCardsCache) return;
  globalGrid.replaceChildren();
  if (globalEmpty) globalEmpty.textContent = "Aucun dégât ne correspond aux filtres.";
  globalEmpty?.classList.add("hidden");
  const cards = overviewCardsCache;
  updateOverviewMetrics(cards);
  const needle = normalizeText(globalSearch?.value);
  const groupBy = document.querySelector('input[name="globalGroup"]:checked')?.value || "computer";
  const newestFirst = globalSort?.value !== "oldest";
  if (globalHideEmpty) globalHideEmpty.disabled = groupBy === "date";
  let displayedIssues = 0;
  let displayedGroups = 0;

  if (groupBy === "computer") {
    cards.forEach(card => {
      const pcMatches = needle && normalizeText(`pc ${card.pcId}`).includes(needle);
      const issues = card.issues.filter(issue => filterOverviewIssue(issue, pcMatches ? "" : needle));
      if (globalHideEmpty?.checked && !issues.length) return;
      if (needle && !pcMatches && !issues.length) return;
      issues.sort((a, b) => newestFirst ? b.whenTs - a.whenTs : (a.whenTs || Number.MAX_SAFE_INTEGER) - (b.whenTs || Number.MAX_SAFE_INTEGER));
      const latest = Math.max(0, ...issues.map(issue => issue.whenTs));
      const group = createDamageGroup(`PC ${card.pcId}`, issues.length, latest ? `Dernier signalement : ${formatDateTime(latest)}` : "Aucun dégât en attente");
      if (issues.length) issues.forEach(issue => appendOverviewDamageRow(group, issue));
      else {
        const empty = document.createElement("div");
        empty.className = "damage-row group-empty";
        empty.textContent = "Aucun dégât en attente.";
        group.appendChild(empty);
      }
      globalGrid.appendChild(group);
      displayedIssues += issues.length;
      displayedGroups += 1;
    });
  } else {
    const groups = new Map();
    cards.flatMap(card => card.issues).filter(issue => filterOverviewIssue(issue, needle)).forEach(issue => {
      const key = dateGroupKey(issue.whenTs);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(issue);
    });
    const keys = Array.from(groups.keys()).sort((a, b) => {
      if (a === "unknown") return 1;
      if (b === "unknown") return -1;
      return newestFirst ? b.localeCompare(a) : a.localeCompare(b);
    });
    keys.forEach(key => {
      const issues = groups.get(key).sort((a, b) => comparePcIds(a.pcId, b.pcId));
      const ms = key === "unknown" ? 0 : issues[0]?.whenTs;
      const computerCount = new Set(issues.map(issue => issue.pcId)).size;
      const group = createDamageGroup(formatDateGroup(ms), issues.length, formatCount(computerCount, "ordinateur"), "calendar");
      issues.forEach(issue => appendOverviewDamageRow(group, issue, true));
      globalGrid.appendChild(group);
      displayedIssues += issues.length;
      displayedGroups += 1;
    });
  }

  if (globalResultCount) {
    globalResultCount.textContent = groupBy === "computer"
      ? `${formatCount(displayedGroups, "ordinateur")} · ${formatCount(displayedIssues, "dégât")}`
      : `${formatCount(displayedIssues, "dégât")} · ${formatCount(displayedGroups, "date")}`;
  }
  const filters = [];
  if (globalHideNotImportant?.checked) filters.push("dégâts pas importants masqués");
  if (groupBy === "computer" && globalHideEmpty?.checked) filters.push("ordinateurs sans dégât masqués");
  if (globalFilterSummary) globalFilterSummary.textContent = filters.join(" · ");
  if (globalMobileFilterState) globalMobileFilterState.textContent = filters.length ? filters.join(" · ") : "Aucun filtre masquant";
  if (!displayedGroups) globalEmpty?.classList.remove("hidden");
}

async function showGlobalView() {
  if (!globalGrid) return;
  try {
    if (!overviewCardsCache) {
      globalGrid.replaceChildren();
      if (globalEmpty) globalEmpty.textContent = "Chargement de la vue d’ensemble…";
      globalEmpty?.classList.remove("hidden");
      globalView?.setAttribute("aria-busy", "true");
    }
    await loadOverviewData();
    renderGlobalView();
  } catch (error) {
    console.error("showGlobalView", error);
    globalEmpty?.classList.remove("hidden");
    if (globalEmpty) globalEmpty.textContent = "Impossible de charger la vue d’ensemble.";
  } finally {
    globalView?.removeAttribute("aria-busy");
  }
}

async function fetchHeadphoneIssues() {
  const { computers, reports } = await loadDashboardCollections();
  const latestMap = new Map();
  reports.forEach(snapshot => {
    const report = snapshot.data();
    if (!report.pcId) return;
    const whenTs = getReportWhenTs(report);
    (Array.isArray(report.items) ? report.items : []).filter(item => item.section === "headphones").forEach(item => {
      const key = `${report.pcId}|${keyForDamage("headphones", item.desc)}`;
      if (!latestMap.has(key) || whenTs > latestMap.get(key).whenTs) latestMap.set(key, { whenTs, user: getReportUser(report), reportId: snapshot.id });
    });
  });

  const byNumber = new Map();
  computers.forEach(snapshot => {
    const pcId = snapshot.id;
    (Array.isArray(snapshot.data()?.headphones) ? snapshot.data().headphones : []).forEach(desc => {
      const obj = toHeadphoneObj(desc);
      if (!obj.numero || !extractDamageText("headphones", obj)) return;
      const meta = latestMap.get(`${pcId}|${keyForDamage("headphones", obj)}`) || {};
      if (!byNumber.has(String(obj.numero))) byNumber.set(String(obj.numero), []);
      byNumber.get(String(obj.numero)).push({
        pcId, section: "headphones", desc: obj, descText: extractDamageText("headphones", obj),
        whenTs: meta.whenTs || 0, user: meta.user || "", reportId: meta.reportId || "",
        isNotImportant: isNotImportantDamage("headphones", obj)
      });
    });
  });
  const numbers = Array.from(byNumber.keys()).sort(comparePcIds);
  return { numbers, cards: numbers.map(numero => ({ numero, items: byNumber.get(numero).sort((a, b) => b.whenTs - a.whenTs) })) };
}

function populateHeadphoneSelects(numbers) {
  [headphoneSelect, pcHeadphoneSelect].forEach((select, index) => {
    if (!select) return;
    const current = select.value;
    select.replaceChildren();
    const first = document.createElement("option");
    first.value = "";
    first.textContent = index === 0 ? "Tous les écouteurs" : "— Aucun —";
    select.appendChild(first);
    numbers.forEach(number => {
      const option = document.createElement("option");
      option.value = number;
      option.textContent = `N° ${number}`;
      select.appendChild(option);
    });
    if (numbers.includes(current)) select.value = current;
  });
}

async function renderHeadphones() {
  if (!headphoneGrid) return;
  try {
    headphoneGrid.replaceChildren();
    if (headphoneEmpty) headphoneEmpty.textContent = "Chargement des écouteurs…";
    headphoneEmpty?.classList.remove("hidden");
    headphoneView?.setAttribute("aria-busy", "true");
    const { numbers, cards } = await fetchHeadphoneIssues();
    populateHeadphoneSelects(numbers);
    headphoneGrid.replaceChildren();
    if (headphoneEmpty) headphoneEmpty.textContent = "Aucun signalement d’écouteurs ne correspond aux filtres.";
    headphoneEmpty?.classList.add("hidden");
    const target = headphoneSelect?.value || "";
    const needle = normalizeText(headphoneSearch?.value);
    let issueCount = 0;
    cards.filter(card => !target || card.numero === target).forEach(card => {
      const items = card.items.filter(item => {
        if (headphoneHideNotImportant?.checked && item.isNotImportant) return false;
        return !needle || normalizeText(`${item.pcId} ${item.descText} ${item.user}`).includes(needle);
      });
      if (!items.length) return;
      const article = document.createElement("article");
      article.className = "headphone-card";
      const header = document.createElement("header");
      const title = document.createElement("h3");
      title.textContent = `Écouteur n° ${card.numero}`;
      const count = document.createElement("span");
      count.className = "group-count";
      count.textContent = formatCount(items.length, "dégât");
      header.append(title, count);
      article.appendChild(header);
      const list = document.createElement("ul");
      list.className = "issue-list";
      items.forEach(item => {
        const li = document.createElement("li");
        li.className = "issue-item";
        const text = document.createElement("span");
        const strong = document.createElement("strong");
        strong.textContent = `PC ${item.pcId}`;
        text.append(strong, document.createTextNode(` · ${item.descText}`));
        const meta = document.createElement("small");
        meta.className = "damage-meta";
        meta.textContent = ` — ${item.whenTs ? formatDateTime(item.whenTs) : "Date inconnue"}${item.user ? ` · ${item.user}` : ""}`;
        text.appendChild(meta);
        const actions = createDamageActions(item, item.pcId, true);
        actions.classList.add("issue-actions");
        li.append(text, actions);
        list.appendChild(li);
      });
      article.appendChild(list);
      headphoneGrid.appendChild(article);
      issueCount += items.length;
    });
    if (headphoneResultCount) headphoneResultCount.textContent = formatCount(issueCount, "dégât");
    if (!issueCount) headphoneEmpty?.classList.remove("hidden");
  } catch (error) {
    console.error("renderHeadphones", error);
    headphoneEmpty?.classList.remove("hidden");
    if (headphoneEmpty) headphoneEmpty.textContent = "Impossible de charger les écouteurs.";
  } finally {
    headphoneView?.removeAttribute("aria-busy");
  }
}

async function drawHeadphoneDetail(numero) {
  tbody.replaceChildren();
  if (pcEmpty) pcEmpty.textContent = "Chargement de l’écouteur…";
  pcEmpty?.classList.remove("hidden");
  const { numbers, cards } = await fetchHeadphoneIssues();
  populateHeadphoneSelects(numbers);
  const card = cards.find(item => item.numero === numero);
  const needle = normalizeText(pcDamageSearch?.value);
  const rows = (card?.items || []).filter(item => !needle || normalizeText(`${item.pcId} ${item.descText} ${item.user}`).includes(needle));
  pcEmpty?.classList.add("hidden");
  if (pcResultCount) pcResultCount.textContent = formatCount(rows.length, "résultat");
  rows.forEach(item => {
    const tr = document.createElement("tr");
    tr.className = item.isNotImportant ? "not-important" : "needs-attention";
    const values = [label("headphones"), `PC ${item.pcId} · ${item.descText}`, item.whenTs ? formatDateTime(item.whenTs) : "—", item.user || "—"];
    values.forEach((value, index) => {
      const td = document.createElement("td");
      td.textContent = value;
      if (index === 1) td.className = "description-cell";
      tr.appendChild(td);
    });
    const statusCell = document.createElement("td");
    const status = document.createElement("span");
    status.className = `status ${item.isNotImportant ? "neutral" : "danger"}`;
    status.textContent = item.isNotImportant ? "Pas important" : "À traiter";
    statusCell.appendChild(status);
    tr.appendChild(statusCell);
    const actionCell = document.createElement("td");
    actionCell.appendChild(createDamageActions(item, item.pcId, true));
    tr.appendChild(actionCell);
    tbody.appendChild(tr);
  });
  if (!rows.length) {
    if (pcEmpty) pcEmpty.textContent = "Aucun dégât pour cet écouteur.";
    pcEmpty?.classList.remove("hidden");
  }
  if (pcHeadphoneSelect) pcHeadphoneSelect.value = numero;
}

function sessionLastSeenMs(session) {
  return timestampToMs(session?.lastSeen) || timestampToMs(session?.startedAt);
}

function sessionStartMs(session) {
  return timestampToMs(session?.startedAt) || sessionLastSeenMs(session);
}

function labelStep(step) {
  const cleaned = String(step ?? "").replace(/^section-/, "");
  return ({ welcome: "Accueil", keyboard: "Clavier", mouse: "Souris", screen: "Écran", headphones: "Écouteurs", other: "Autres", rules: "Règles" })[cleaned] || cleaned || "—";
}

function isSessionDamageItem(item) {
  if (!item?.section || item.section === "none") return false;
  const text = normalizeText(extractDamageText(item.section, item.desc));
  return Boolean(text) && !text.includes("aucun degat");
}

function eligibleSessions() {
  const now = Date.now();
  return sessionCache.filter(session => {
    if ((session?.status || "in_progress") === "validated") return false;
    const lastSeen = sessionLastSeenMs(session);
    return !lastSeen || (now - lastSeen) >= SESSION_STALE_MS;
  });
}

function sessionViewMode() {
  return document.querySelector('input[name="sessionViewMode"]:checked')?.value || "all";
}

function applySessionModeVisibility() {
  const grouped = sessionViewMode() === "student";
  document.querySelectorAll(".student-mode-only").forEach(element => element.classList.toggle("hidden", !grouped));
  document.querySelectorAll(".all-mode-only").forEach(element => element.classList.toggle("hidden", grouped));
  sessionTableShell?.classList.toggle("hidden", grouped);
  studentSessionGroups?.classList.toggle("hidden", !grouped);
  if (!grouped) studentSessionEmpty?.classList.add("hidden");
  if (sessionResultLabel) sessionResultLabel.textContent = grouped ? "élèves" : "sessions";
  if (sessionSelectPageLabel) sessionSelectPageLabel.textContent = grouped ? "Sélectionner les sessions affichées" : "Sélectionner la page";
}

function dateInputBoundary(value, endOfDay = false) {
  if (!value) return 0;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}`);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function filteredSessions() {
  const from = dateInputBoundary(sessionDateFrom?.value);
  const to = dateInputBoundary(sessionDateTo?.value, true);
  const pc = sessionPcFilter?.value || "";
  const user = normalizeText(sessionUserSearch?.value);
  const onlyWithDamage = Boolean(sessionHasDamage?.checked);
  const result = eligibleSessions().filter(session => {
    const start = sessionStartMs(session);
    if (from && (!start || start < from)) return false;
    if (to && (!start || start > to)) return false;
    if (pc && String(session.pcId || "") !== pc) return false;
    if (user && !normalizeText(session.user).includes(user)) return false;
    if (onlyWithDamage && !session.hasRealDamage) return false;
    return true;
  });
  const mode = sessionSort?.value || "newest";
  result.sort((a, b) => {
    if (mode === "computer") return comparePcIds(a.pcId || "", b.pcId || "") || (sessionStartMs(b) - sessionStartMs(a));
    return mode === "oldest" ? sessionStartMs(a) - sessionStartMs(b) : sessionStartMs(b) - sessionStartMs(a);
  });
  return result;
}

function groupSessionsByStudent() {
  const groups = new Map();
  filteredSessions().forEach(session => {
    const displayName = String(session.user || "").trim();
    const key = normalizeText(displayName);
    if (!key) return;
    if (!groups.has(key)) groups.set(key, { key, user: displayName, items: [], latest: 0 });
    const group = groups.get(key);
    group.items.push(session);
    group.latest = Math.max(group.latest, sessionStartMs(session));
  });
  const minimumExclusive = Number.parseInt(sessionMinCount?.value, 10) || 2;
  const result = Array.from(groups.values()).filter(group => group.items.length > minimumExclusive);
  result.forEach(group => group.items.sort((a, b) => sessionStartMs(b) - sessionStartMs(a)));
  const mode = studentSessionSort?.value || "count";
  result.sort((a, b) => {
    if (mode === "name") return a.user.localeCompare(b.user, "fr", { sensitivity: "base" });
    if (mode === "latest") return b.latest - a.latest || b.items.length - a.items.length;
    return b.items.length - a.items.length || b.latest - a.latest;
  });
  return result;
}

function groupedDisplayedSessions() {
  return groupSessionsByStudent().flatMap(group => group.items);
}

function populateSessionPcFilter() {
  if (!sessionPcFilter) return;
  const current = sessionPcFilter.value;
  const ids = Array.from(new Set(eligibleSessions().map(session => String(session.pcId || "")).filter(Boolean))).sort(comparePcIds);
  sessionPcFilter.replaceChildren();
  const all = document.createElement("option");
  all.value = "";
  all.textContent = "Tous les ordinateurs";
  sessionPcFilter.appendChild(all);
  ids.forEach(id => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = `PC ${id}`;
    sessionPcFilter.appendChild(option);
  });
  if (ids.includes(current)) sessionPcFilter.value = current;
}

function subscribeSessions() {
  if (!sessionTableBody || unsubSessions) return;
  unsubSessions = onSnapshot(collection(db, "report_sessions"), snapshot => {
    sessionDataLoaded = true;
    sessionCache = snapshot.docs.map(item => ({ ...item.data(), _id: item.id }));
    const available = new Set(sessionCache.map(item => item._id));
    Array.from(selectedSessionIds).forEach(id => { if (!available.has(id)) selectedSessionIds.delete(id); });
    Array.from(expandedSessionIds).forEach(id => { if (!available.has(id)) expandedSessionIds.delete(id); });
    populateSessionPcFilter();
    renderSessions();
    if (currentPC) drawTable();
    if (followupView?.classList.contains("active")) renderFollowups();
  }, error => {
    console.warn("subscribeSessions", error);
    sessionDataLoaded = true;
    sessionCache = [];
    renderSessions();
    if (currentPC) drawTable();
  });
}

function sessionFiltersChanged() {
  sessionPage = 1;
  selectedSessionIds.clear();
  expandedSessionIds.clear();
  studentSessionLimits.clear();
  expandedStudentKeys.clear();
  renderSessions();
}

function sessionModeChanged() {
  if (sessionViewMode() === "student") {
    if (sessionPcFilter) sessionPcFilter.value = "";
    if (sessionHasDamage) sessionHasDamage.checked = false;
  }
  sessionFiltersChanged();
}

function resetSessionFilters() {
  if (sessionDateFrom) sessionDateFrom.value = "";
  if (sessionDateTo) sessionDateTo.value = "";
  if (sessionPcFilter) sessionPcFilter.value = "";
  if (sessionUserSearch) sessionUserSearch.value = "";
  if (sessionHasDamage) sessionHasDamage.checked = false;
  if (sessionSort) sessionSort.value = "newest";
  if (sessionMinCount) sessionMinCount.value = "2";
  if (studentSessionSort) studentSessionSort.value = "count";
  sessionFiltersChanged();
}

function addSessionMetadata(list, labelText, valueText) {
  const term = document.createElement("dt");
  term.textContent = labelText;
  const value = document.createElement("dd");
  value.textContent = valueText || "—";
  list.append(term, value);
}

function appendSessionDetailsRow(session) {
  const row = document.createElement("tr");
  row.className = "details-row";
  const cell = document.createElement("td");
  cell.colSpan = 7;
  const panel = document.createElement("div");
  panel.className = "session-details-panel";
  const metaSection = document.createElement("section");
  const metaTitle = document.createElement("h4");
  metaTitle.textContent = "Métadonnées de la session";
  const meta = document.createElement("dl");
  meta.className = "session-meta";
  addSessionMetadata(meta, "Ordinateur", session.pcId ? `PC ${session.pcId}` : "PC inconnu");
  addSessionMetadata(meta, "Élève", session.user || "Élève inconnu");
  addSessionMetadata(meta, "Démarré", formatDateTime(session.startedAt));
  addSessionMetadata(meta, "Dernière activité", formatDateTime(session.lastSeen));
  addSessionMetadata(meta, "Dernière étape", labelStep(session.step));
  addSessionMetadata(meta, "Statut", session.status === "awaiting_validation" ? "Validation non faite" : "Session abandonnée");
  metaSection.append(metaTitle, meta);

  const damageSection = document.createElement("section");
  const damageTitle = document.createElement("h4");
  damageTitle.textContent = "Détails des dégâts saisis";
  damageSection.appendChild(damageTitle);
  const items = (Array.isArray(session.items) ? session.items : []).filter(isSessionDamageItem);
  if (items.length) {
    const list = document.createElement("ul");
    list.className = "session-detail-list";
    items.forEach(item => {
      const li = document.createElement("li");
      li.textContent = `${label(item.section)} : ${formatDesc(item.section, item.desc)}`;
      list.appendChild(li);
    });
    damageSection.appendChild(list);
  } else {
    const empty = document.createElement("p");
    empty.className = "damage-meta";
    empty.textContent = session.hasRealDamage ? "Dégâts saisis, mais détail manquant." : "Aucun dégât saisi.";
    damageSection.appendChild(empty);
  }
  panel.append(metaSection, damageSection);
  cell.appendChild(panel);
  row.appendChild(cell);
  sessionTableBody.appendChild(row);
}

function renderSessionPagination(total, totalPages, startIndex, pageItems) {
  sessionPagination.replaceChildren();
  if (!total) {
    sessionPagination.classList.add("hidden");
    return;
  }
  sessionPagination.classList.remove("hidden");
  const range = document.createElement("span");
  range.textContent = `${startIndex + 1}–${startIndex + pageItems.length} sur ${total.toLocaleString("fr-CH")}`;
  const buttons = document.createElement("div");
  buttons.className = "pagination-buttons";
  const previous = createButton("Précédent", "page", { data: { pageAction: "previous" } });
  previous.classList.add("page-btn");
  previous.disabled = sessionPage === 1;
  buttons.appendChild(previous);
  const candidates = new Set([1, totalPages, sessionPage - 1, sessionPage, sessionPage + 1]);
  Array.from(candidates).filter(page => page >= 1 && page <= totalPages).sort((a, b) => a - b).forEach(page => {
    const button = createButton(String(page), "page", { data: { page } });
    button.classList.add("page-btn");
    if (page === sessionPage) { button.classList.add("active"); button.setAttribute("aria-current", "page"); }
    buttons.appendChild(button);
  });
  const next = createButton("Suivant", "page", { data: { pageAction: "next" } });
  next.classList.add("page-btn");
  next.disabled = sessionPage === totalPages;
  buttons.appendChild(next);
  sessionPagination.append(range, buttons);
}

function updateSessionSelectionControls(filtered, pageItems) {
  const grouped = sessionViewMode() === "student";
  const pageIds = pageItems.map(item => item._id);
  const selectedOnPage = pageIds.filter(id => selectedSessionIds.has(id)).length;
  if (sessionSelectPage) {
    sessionSelectPage.checked = Boolean(pageIds.length) && selectedOnPage === pageIds.length;
    sessionSelectPage.indeterminate = selectedOnPage > 0 && selectedOnPage < pageIds.length;
    sessionSelectPage.disabled = !pageIds.length;
  }
  const allFilteredSelected = filtered.length > 0 && filtered.every(item => selectedSessionIds.has(item._id));
  if (sessionSelectFiltered) {
    const period = sessionDateFrom?.value || sessionDateTo?.value;
    sessionSelectFiltered.textContent = allFilteredSelected
      ? "Désélectionner les résultats"
      : grouped
        ? `Sélectionner les ${filtered.length.toLocaleString("fr-CH")} sessions affichées`
        : `Sélectionner les ${filtered.length.toLocaleString("fr-CH")} résultats ${period ? "de la période" : "filtrés"}`;
    sessionSelectFiltered.disabled = !filtered.length;
  }
  const count = selectedSessionIds.size;
  if (sessionSelectionCount) sessionSelectionCount.textContent = `${count.toLocaleString("fr-CH")} ${count === 1 ? "sélectionnée" : "sélectionnées"}`;
  if (sessionDeleteSelected) sessionDeleteSelected.disabled = !count || isDeletingSessions;
}

function appendStudentSessionRow(tbodyElement, session) {
  const row = document.createElement("tr");
  row.dataset.sessionId = session._id;
  const checkCell = document.createElement("td");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "row-check";
  checkbox.dataset.action = "select-session";
  checkbox.dataset.sessionId = session._id;
  checkbox.checked = selectedSessionIds.has(session._id);
  checkbox.setAttribute("aria-label", `Sélectionner la session du ${formatDateTime(sessionStartMs(session))}`);
  checkCell.appendChild(checkbox);
  row.appendChild(checkCell);
  [formatDateTime(sessionStartMs(session)), session.pcId ? `PC ${session.pcId}` : "PC inconnu", labelStep(session.step)].forEach(value => {
    const cell = document.createElement("td");
    cell.textContent = value;
    row.appendChild(cell);
  });
  const damageCell = document.createElement("td");
  const damageStatus = document.createElement("span");
  damageStatus.className = `status ${session.hasRealDamage ? "danger" : "success"}`;
  damageStatus.textContent = session.hasRealDamage ? "Dégât saisi" : "Aucun dégât";
  damageCell.appendChild(damageStatus);
  row.appendChild(damageCell);
  const actionCell = document.createElement("td");
  actionCell.className = "session-row-actions";
  actionCell.appendChild(createButton("Supprimer", "delete-session", { icon: "trash", variant: "danger", data: { sessionId: session._id } }));
  row.appendChild(actionCell);
  tbodyElement.appendChild(row);
}

function renderStudentSessionGroups() {
  if (!studentSessionGroups) return;
  const groups = groupSessionsByStudent();
  const displayed = groups.flatMap(group => group.items);
  studentSessionGroups.replaceChildren();
  if (studentSessionEmpty) studentSessionEmpty.textContent = "Aucun élève ne dépasse le nombre d’abandons choisi.";
  studentSessionEmpty?.classList.toggle("hidden", Boolean(groups.length));
  if (sessionResultCount) sessionResultCount.textContent = groups.length.toLocaleString("fr-CH");

  groups.forEach((group, groupIndex) => {
    const details = document.createElement("details");
    details.className = "student-session-group";
    details.open = expandedStudentKeys.has(group.key) || (groupIndex === 0 && expandedStudentKeys.size === 0);
    if (details.open) expandedStudentKeys.add(group.key);
    details.addEventListener("toggle", () => {
      if (details.open) expandedStudentKeys.add(group.key);
      else expandedStudentKeys.delete(group.key);
    });
    const summary = document.createElement("summary");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "row-check";
    checkbox.dataset.action = "select-student-sessions";
    checkbox.dataset.studentKey = group.key;
    const selectedCount = group.items.filter(item => selectedSessionIds.has(item._id)).length;
    checkbox.checked = selectedCount === group.items.length;
    checkbox.indeterminate = selectedCount > 0 && selectedCount < group.items.length;
    checkbox.setAttribute("aria-label", `Sélectionner les sessions de ${group.user}`);
    checkbox.addEventListener("click", event => event.stopPropagation());
    const name = document.createElement("span");
    name.className = "student-name";
    name.textContent = group.user;
    const count = document.createElement("span");
    count.className = "group-count";
    count.textContent = formatCount(group.items.length, "abandon");
    const last = document.createElement("span");
    last.className = "student-last";
    last.textContent = `Dernier abandon : ${formatDateTime(group.latest)}`;
    summary.append(checkbox, name, count, last);
    details.appendChild(summary);

    const tableWrapper = document.createElement("div");
    tableWrapper.className = "table-shell";
    const table = document.createElement("table");
    table.className = "student-session-table";
    table.innerHTML = "<thead><tr><th>Sélection</th><th>Date et heure</th><th>Ordinateur</th><th>Dernière étape</th><th>Contenu</th><th>Action</th></tr></thead>";
    const body = document.createElement("tbody");
    const limit = studentSessionLimits.get(group.key) || 20;
    group.items.slice(0, limit).forEach(session => appendStudentSessionRow(body, session));
    table.appendChild(body);
    tableWrapper.appendChild(table);
    if (group.items.length > limit) {
      const moreBar = document.createElement("div");
      moreBar.className = "pagination";
      const text = document.createElement("span");
      text.textContent = `${limit.toLocaleString("fr-CH")} sur ${group.items.length.toLocaleString("fr-CH")} sessions`;
      const more = createButton(`Afficher ${Math.min(20, group.items.length - limit)} de plus`, "more-student-sessions", { data: { studentKey: group.key } });
      moreBar.append(text, more);
      tableWrapper.appendChild(moreBar);
    }
    details.appendChild(tableWrapper);
    studentSessionGroups.appendChild(details);
  });
  updateSessionSelectionControls(displayed, displayed);
}

function renderSessions() {
  if (!sessionTableBody) return;
  applySessionModeVisibility();
  if (!sessionDataLoaded) {
    sessionTableBody.replaceChildren();
    if (sessionResultCount) sessionResultCount.textContent = "…";
    if (sessionEmpty) sessionEmpty.textContent = "Chargement des sessions…";
    sessionEmpty?.classList.remove("hidden");
    sessionPagination?.classList.add("hidden");
    if (sessionSelectPage) sessionSelectPage.disabled = true;
    if (sessionSelectFiltered) sessionSelectFiltered.disabled = true;
    if (sessionDeleteSelected) sessionDeleteSelected.disabled = true;
    if (sessionViewMode() === "student") {
      studentSessionGroups?.replaceChildren();
      if (studentSessionEmpty) studentSessionEmpty.textContent = "Chargement des sessions…";
      studentSessionEmpty?.classList.remove("hidden");
    }
    return;
  }
  if (sessionViewMode() === "student") {
    renderStudentSessionGroups();
    return;
  }
  if (sessionEmpty) sessionEmpty.textContent = "Aucune session non validée ne correspond aux filtres.";
  const filtered = filteredSessions();
  if (sessionResultCount) sessionResultCount.textContent = filtered.length.toLocaleString("fr-CH");
  const totalPages = Math.max(1, Math.ceil(filtered.length / SESSION_PAGE_SIZE));
  sessionPage = Math.min(Math.max(sessionPage, 1), totalPages);
  const startIndex = (sessionPage - 1) * SESSION_PAGE_SIZE;
  const pageItems = filtered.slice(startIndex, startIndex + SESSION_PAGE_SIZE);
  sessionTableBody.replaceChildren();
  sessionEmpty?.classList.toggle("hidden", Boolean(pageItems.length));

  pageItems.forEach(session => {
    const row = document.createElement("tr");
    row.dataset.sessionId = session._id;
    const checkCell = document.createElement("td");
    checkCell.className = "check-cell";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "row-check";
    checkbox.dataset.action = "select-session";
    checkbox.dataset.sessionId = session._id;
    checkbox.checked = selectedSessionIds.has(session._id);
    checkbox.setAttribute("aria-label", `Sélectionner la session de ${session.user || "l’élève inconnu"} sur le PC ${session.pcId || "inconnu"}`);
    checkCell.appendChild(checkbox);
    row.appendChild(checkCell);
    [session.pcId ? `PC ${session.pcId}` : "PC inconnu", formatDateTime(sessionStartMs(session)), session.user || "Élève inconnu", labelStep(session.step)].forEach(value => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });
    const damageCell = document.createElement("td");
    const damageStatus = document.createElement("span");
    damageStatus.className = `status ${session.hasRealDamage ? "danger" : "success"}`;
    damageStatus.textContent = session.hasRealDamage ? "Oui" : "Non";
    damageCell.appendChild(damageStatus);
    row.appendChild(damageCell);
    const actionsCell = document.createElement("td");
    actionsCell.className = "actions-cell";
    const actions = document.createElement("div");
    actions.className = "action-group";
    const expanded = expandedSessionIds.has(session._id);
    const detailButton = createButton(expanded ? "Masquer le détail" : "Voir le détail", "toggle-session-detail", { data: { sessionId: session._id } });
    detailButton.setAttribute("aria-expanded", String(expanded));
    const deleteButton = createButton("Supprimer", "delete-session", { icon: "trash", variant: "danger", data: { sessionId: session._id } });
    actions.append(detailButton, deleteButton);
    actionsCell.appendChild(actions);
    row.appendChild(actionsCell);
    sessionTableBody.appendChild(row);
    if (expanded) appendSessionDetailsRow(session);
  });

  updateSessionSelectionControls(filtered, pageItems);
  renderSessionPagination(filtered.length, totalPages, startIndex, pageItems);
}

function currentSessionPageItems() {
  if (sessionViewMode() === "student") return groupedDisplayedSessions();
  const filtered = filteredSessions();
  const start = (sessionPage - 1) * SESSION_PAGE_SIZE;
  return filtered.slice(start, start + SESSION_PAGE_SIZE);
}

function toggleSessionPageSelection() {
  const items = currentSessionPageItems();
  items.forEach(item => sessionSelectPage.checked ? selectedSessionIds.add(item._id) : selectedSessionIds.delete(item._id));
  renderSessions();
}

function toggleAllFilteredSessions() {
  const filtered = sessionViewMode() === "student" ? groupedDisplayedSessions() : filteredSessions();
  const allSelected = filtered.length && filtered.every(item => selectedSessionIds.has(item._id));
  filtered.forEach(item => allSelected ? selectedSessionIds.delete(item._id) : selectedSessionIds.add(item._id));
  renderSessions();
}

function handlePaginationClick(event) {
  const button = event.target.closest("button[data-action='page']");
  if (!button || button.disabled) return;
  if (button.dataset.pageAction === "previous") sessionPage -= 1;
  else if (button.dataset.pageAction === "next") sessionPage += 1;
  else sessionPage = Number.parseInt(button.dataset.page, 10) || sessionPage;
  renderSessions();
  sessionView?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteSessions(ids) {
  for (let index = 0; index < ids.length; index += 400) {
    const batch = writeBatch(db);
    ids.slice(index, index + 400).forEach(id => batch.delete(doc(db, "report_sessions", id)));
    await batch.commit();
  }
}

async function deleteSelectedSessions() {
  const ids = Array.from(selectedSessionIds);
  if (!ids.length || isDeletingSessions) return;
  if (!window.confirm(`Supprimer définitivement ${formatCount(ids.length, "session")} ? Cette action est irréversible.`)) return;
  isDeletingSessions = true;
  if (sessionDeleteSelected) { sessionDeleteSelected.disabled = true; sessionDeleteSelected.textContent = "Suppression…"; }
  try {
    await deleteSessions(ids);
    selectedSessionIds.clear();
    expandedSessionIds.clear();
    showToast(`${formatCount(ids.length, "session")} supprimée${ids.length > 1 ? "s" : ""}.`);
  } catch (error) {
    console.error("deleteSelectedSessions", error);
    window.alert("La suppression groupée n’a pas pu être terminée. Actualise la page avant de réessayer.");
  } finally {
    isDeletingSessions = false;
    if (sessionDeleteSelected) sessionDeleteSelected.textContent = "Supprimer la sélection";
    renderSessions();
  }
}

async function deleteSingleSession(id, button) {
  if (!id || !window.confirm("Supprimer définitivement cette session ?")) return;
  button.disabled = true;
  try {
    await deleteDoc(doc(db, "report_sessions", id));
    selectedSessionIds.delete(id);
    expandedSessionIds.delete(id);
    showToast("La session a été supprimée.");
  } catch (error) {
    console.error("delete session", error);
    window.alert("La session n’a pas pu être supprimée.");
    button.disabled = false;
  }
}

function sessionCompleted(session) {
  return session?.status === "validated";
}

function sessionEndMs(session) {
  return timestampToMs(session?.validatedAt) || sessionLastSeenMs(session);
}

function matchingValidatedSession(report, sessions = sessionCache) {
  const reportWhen = getReportWhenTs(report);
  const reportUser = normalizeText(getReportUser(report));
  if (!reportWhen || !reportUser || !report?.pcId) return null;
  return sessions
    .filter(session => sessionCompleted(session) && String(session.pcId || "") === String(report.pcId) && normalizeText(session.user) === reportUser)
    .map(session => ({ session, distance: Math.abs(sessionEndMs(session) - reportWhen) }))
    .filter(candidate => candidate.distance <= REPORT_SESSION_MATCH_MS)
    .sort((a, b) => a.distance - b.distance)[0]?.session || null;
}

function buildUsageEvents(reportSnapshots) {
  const events = sessionCache
    .filter(session => sessionStartMs(session) && String(session.user || "").trim())
    .map(session => ({
      id: `session:${session._id}`,
      sessionId: session._id,
      pcId: String(session.pcId || ""),
      user: String(session.user || "").trim(),
      whenTs: sessionStartMs(session),
      completed: sessionCompleted(session),
      source: "session"
    }));

  reportSnapshots.forEach(snapshot => {
    const report = { ...snapshot.data(), _id: snapshot.id };
    if (!report.pcId || !getReportWhenTs(report) || !getReportUser(report)) return;
    if (matchingValidatedSession(report)) return;
    events.push({
      id: `report:${snapshot.id}`,
      reportId: snapshot.id,
      pcId: String(report.pcId),
      user: getReportUser(report),
      whenTs: getReportWhenTs(report),
      completed: true,
      source: "report"
    });
  });
  return events;
}

function previousUsesForIssue(issue, events, reportById) {
  if (!issue.whenTs) return [];
  const report = reportById.get(issue.reportId);
  const currentSession = report ? matchingValidatedSession(report) : null;
  const candidates = events
    .filter(event => event.pcId === String(issue.pcId) && event.whenTs < issue.whenTs)
    .filter(event => !currentSession || event.sessionId !== currentSession._id)
    .filter(event => !issue.reportId || event.reportId !== issue.reportId)
    .sort((a, b) => b.whenTs - a.whenTs);
  const result = [];
  for (const event of candidates) {
    const nearDuplicate = result.some(existing => normalizeText(existing.user) === normalizeText(event.user) && Math.abs(existing.whenTs - event.whenTs) <= USAGE_DEDUPE_MS);
    if (nearDuplicate) continue;
    result.push(event);
    if (result.length === 3) break;
  }
  return result;
}

async function buildFollowupEntries() {
  const [cards, collections] = await Promise.all([loadOverviewData(), loadDashboardCollections()]);
  const reportById = new Map();
  collections.reports.forEach(snapshot => reportById.set(snapshot.id, { ...snapshot.data(), _id: snapshot.id }));
  const events = buildUsageEvents(collections.reports.docs);
  return cards.flatMap(card => card.issues)
    .filter(issue => !issue.isNotImportant)
    .map(issue => ({ ...issue, previousUses: previousUsesForIssue(issue, events, reportById) }));
}

function appendFollowupMetadata(list, labelText, valueText) {
  const term = document.createElement("dt");
  term.textContent = labelText;
  const value = document.createElement("dd");
  value.textContent = valueText || "—";
  list.append(term, value);
}

function createPreviousUseRow(use, index) {
  const row = document.createElement("div");
  row.className = "previous-use";
  const rank = document.createElement("span");
  rank.className = "use-index";
  rank.textContent = String(index + 1);
  const user = document.createElement("span");
  user.className = "use-user";
  user.textContent = use.user || "Élève inconnu";
  const time = document.createElement("span");
  time.className = "use-time";
  time.textContent = formatDateTime(use.whenTs);
  const status = document.createElement("span");
  status.className = `status ${use.completed ? "success" : "warning"}`;
  status.textContent = use.completed ? "Formulaire rempli" : "Formulaire non validé";
  row.append(rank, user, time, status);
  return row;
}

function createFollowupGroup(entry, index) {
  const details = document.createElement("details");
  details.className = "investigation-group";
  details.open = index === 0;
  const summary = document.createElement("summary");
  const alert = document.createElement("span");
  alert.className = "investigation-alert";
  alert.textContent = "!";
  alert.setAttribute("aria-hidden", "true");
  const pc = document.createElement("span");
  pc.className = "investigation-pc";
  pc.textContent = `PC ${entry.pcId}`;
  const component = document.createElement("span");
  component.className = "investigation-component";
  component.textContent = label(entry.section);
  const damage = document.createElement("span");
  damage.className = "investigation-damage";
  damage.textContent = entry.descText || "Dégât sans description";
  const date = document.createElement("span");
  date.className = "investigation-meta";
  date.textContent = entry.whenTs ? formatDateTime(entry.whenTs) : "Date inconnue";
  const reporter = document.createElement("span");
  reporter.className = "investigation-meta investigation-reporter";
  reporter.textContent = entry.user || "Élève inconnu";
  summary.append(alert, pc, component, damage, date, reporter);
  details.appendChild(summary);

  const panel = document.createElement("div");
  panel.className = "investigation-panel";
  const reportSection = document.createElement("section");
  reportSection.className = "investigation-section";
  const reportTitle = document.createElement("h3");
  reportTitle.textContent = "Dégât signalé";
  const meta = document.createElement("dl");
  meta.className = "investigation-report-meta";
  appendFollowupMetadata(meta, "Signalé par", entry.user || "Élève inconnu");
  appendFollowupMetadata(meta, "Date et heure", entry.whenTs ? formatDateTime(entry.whenTs) : "Date inconnue");
  appendFollowupMetadata(meta, "Ordinateur", `PC ${entry.pcId}`);
  appendFollowupMetadata(meta, "Composant", label(entry.section));
  appendFollowupMetadata(meta, "Description", entry.descText || "Dégât sans description");
  const openPc = createButton("Ouvrir la fiche du PC", "open-investigation-pc", { data: { pc: entry.pcId } });
  reportSection.append(reportTitle, meta, openPc);

  const previousSection = document.createElement("section");
  previousSection.className = "investigation-section";
  const previousTitle = document.createElement("h3");
  previousTitle.textContent = "3 utilisations précédentes";
  const list = document.createElement("div");
  list.className = "previous-use-list";
  entry.previousUses.forEach((use, useIndex) => list.appendChild(createPreviousUseRow(use, useIndex)));
  if (!entry.previousUses.length) {
    const empty = document.createElement("p");
    empty.className = "damage-meta";
    empty.textContent = "Aucune utilisation antérieure n’a été retrouvée pour cet ordinateur.";
    list.appendChild(empty);
  } else if (entry.previousUses.length < 3) {
    const partial = document.createElement("p");
    partial.className = "damage-meta";
    partial.textContent = `Seulement ${formatCount(entry.previousUses.length, "utilisation")} retrouvée${entry.previousUses.length > 1 ? "s" : ""}.`;
    list.appendChild(partial);
  }
  previousSection.append(previousTitle, list);
  panel.append(reportSection, previousSection);
  details.appendChild(panel);
  return details;
}

async function renderFollowups() {
  if (!followupList) return;
  const renderVersion = ++followupRenderVersion;
  followupList.replaceChildren();
  if (followupResultCount) followupResultCount.textContent = "…";
  if (followupEmpty) {
    followupEmpty.textContent = sessionDataLoaded ? "Chargement des enquêtes…" : "Chargement des sessions et des signalements…";
    followupEmpty.classList.remove("hidden");
  }
  if (!sessionDataLoaded) return;
  try {
    const entries = await buildFollowupEntries();
    if (renderVersion !== followupRenderVersion) return;
    const needle = normalizeText(followupSearch?.value);
    const filtered = entries.filter(entry => !needle || normalizeText(`PC ${entry.pcId} ${label(entry.section)} ${entry.descText} ${entry.user} ${entry.previousUses.map(use => use.user).join(" ")}`).includes(needle));
    const mode = followupSort?.value || "newest";
    filtered.sort((a, b) => {
      if (mode === "computer") return comparePcIds(a.pcId, b.pcId) || b.whenTs - a.whenTs;
      return mode === "oldest" ? (a.whenTs || Number.MAX_SAFE_INTEGER) - (b.whenTs || Number.MAX_SAFE_INTEGER) : b.whenTs - a.whenTs;
    });
    followupList.replaceChildren();
    filtered.forEach((entry, index) => followupList.appendChild(createFollowupGroup(entry, index)));
    if (followupResultCount) followupResultCount.textContent = filtered.length.toLocaleString("fr-CH");
    if (followupEmpty) {
      followupEmpty.textContent = "Aucun dégât important ne correspond à la recherche.";
      followupEmpty.classList.toggle("hidden", Boolean(filtered.length));
    }
  } catch (error) {
    console.error("renderFollowups", error);
    if (renderVersion !== followupRenderVersion) return;
    if (followupResultCount) followupResultCount.textContent = "—";
    if (followupEmpty) followupEmpty.textContent = "Les enquêtes n’ont pas pu être chargées.";
  }
}

tbody?.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (button) handleDamageAction(button);
});

globalGrid?.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (button) handleDamageAction(button);
});

headphoneGrid?.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (button) handleDamageAction(button);
});

followupList?.addEventListener("click", event => {
  const button = event.target.closest("button[data-action='open-investigation-pc']");
  if (!button) return;
  const pc = button.dataset.pc;
  if (!pc || !Array.from(pcSelect?.options || []).some(option => option.value === pc)) return;
  pcSelect.value = pc;
  subscribeToPc(pc);
  showPcView();
});

sessionTableBody?.addEventListener("change", event => {
  const checkbox = event.target.closest('input[data-action="select-session"]');
  if (!checkbox) return;
  if (checkbox.checked) selectedSessionIds.add(checkbox.dataset.sessionId);
  else selectedSessionIds.delete(checkbox.dataset.sessionId);
  updateSessionSelectionControls(filteredSessions(), currentSessionPageItems());
});

sessionTableBody?.addEventListener("click", async event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const id = button.dataset.sessionId;
  if (!id) return;
  if (button.dataset.action === "toggle-session-detail") {
    if (expandedSessionIds.has(id)) expandedSessionIds.delete(id);
    else expandedSessionIds.add(id);
    renderSessions();
    return;
  }
  if (button.dataset.action === "delete-session") {
    await deleteSingleSession(id, button);
  }
});

studentSessionGroups?.addEventListener("change", event => {
  const checkbox = event.target.closest("input[data-action]");
  if (!checkbox) return;
  if (checkbox.dataset.action === "select-session") {
    if (checkbox.checked) selectedSessionIds.add(checkbox.dataset.sessionId);
    else selectedSessionIds.delete(checkbox.dataset.sessionId);
  } else if (checkbox.dataset.action === "select-student-sessions") {
    const group = groupSessionsByStudent().find(item => item.key === checkbox.dataset.studentKey);
    group?.items.forEach(item => checkbox.checked ? selectedSessionIds.add(item._id) : selectedSessionIds.delete(item._id));
  }
  renderStudentSessionGroups();
});

studentSessionGroups?.addEventListener("click", async event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  if (button.dataset.action === "more-student-sessions") {
    const key = button.dataset.studentKey;
    studentSessionLimits.set(key, (studentSessionLimits.get(key) || 20) + 20);
    expandedStudentKeys.add(key);
    renderStudentSessionGroups();
  } else if (button.dataset.action === "delete-session") {
    await deleteSingleSession(button.dataset.sessionId, button);
  }
});

window.addEventListener("hashchange", () => {
  if (location.hash === "#global") showGlobalViewTab();
  else if (location.hash === "#headphones") showHeadphonesView();
  else if (location.hash === "#sessions") showSessionsView();
  else if (location.hash === "#followup") showFollowupView();
  else showPcView();
});

initDashboard().catch(error => {
  console.error("initDashboard", error);
  window.alert("Le tableau de bord n’a pas pu être chargé.");
});
