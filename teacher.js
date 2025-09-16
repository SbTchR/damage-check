// teacher.js
import { db } from "./firebase-config.js";
import {
  collection, query, where, onSnapshot,
  getDocs, updateDoc, doc, arrayRemove, arrayUnion, getDoc,
  setDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


// Shared DOM references
const dash              = document.getElementById("dash");
const globalView        = document.getElementById("globalView");
const headphoneView     = document.getElementById("headphoneView");
const tabPc             = document.getElementById("tabPc");
const tabGlobal         = document.getElementById("tabGlobal");
const tabHeadphones     = document.getElementById("tabHeadphones");
const pcSelect          = document.getElementById("pcSelect");
const onlyDamages       = document.getElementById("onlyDamages");
const onlyUnresToggleEl = document.getElementById("onlyUnres");
const pcHeadphoneSelect = document.getElementById("pcHeadphoneSelect");
const headphoneSelect   = document.getElementById("headphoneSelect");
const headphoneGrid     = document.getElementById("headphoneGrid");
const headphoneEmpty    = document.getElementById("headphoneEmpty");
const tbody             = document.getElementById("tbody");
const pcEmpty           = document.getElementById("pcEmpty");
const globalGrid        = document.getElementById("globalGrid");
const globalEmpty       = document.getElementById("globalEmpty");

const tabButtons = [tabPc, tabGlobal, tabHeadphones];
const tabPanels  = { dash, globalView, headphoneView };

function activateTab(targetId) {
  try {
    tabButtons.filter(Boolean).forEach(btn => {
      const isActive = btn.dataset.target === targetId;
      btn.classList.toggle("active", isActive);
    });
    Object.entries(tabPanels).forEach(([key, panel]) => {
      if (panel) panel.classList.toggle("active", key === targetId);
    });
  } catch (e) {
    console.error("activateTab error", e);
  }
}

function showPcView() {
  activateTab("dash");
  window.location.hash = "";
  drawTable();
}

function showGlobalViewTab() {
  activateTab("globalView");
  window.location.hash = "#global";
  showGlobalView();
}

async function showHeadphonesView() {
  activateTab("headphoneView");
  window.location.hash = "#headphones";
  await renderHeadphones();
}

// Wire up the main tabs
tabPc.onclick = showPcView;
tabGlobal.onclick = showGlobalViewTab;
tabHeadphones.onclick = showHeadphonesView;

let currentPC   = null;
let currentHeadphoneDetail = "";
let unresolved  = {keyboard:[],mouse:[],screen:[],headphones:[],other:[]};
let reportCache = []; // array of {when,user,items}
let unsubReports = null;
let unsubUnres   = null;

// Helper to detect headphone damage objects
function isHeadphoneDamage(val) { 
  return val && typeof val === "object" && ("description" in val) && ("numero" in val); 
}

function normalizeText(s){
  return String(s).trim().toLowerCase().replace(/\s+/g," ");
}

// Helper to compare headphone damage objects by description and number
function headphoneDamageEquals(a, b) {
  if (!isHeadphoneDamage(a) || !isHeadphoneDamage(b)) return false;
  return normalizeText(a.description) === normalizeText(b.description) &&
         normalizeText(a.numero)      === normalizeText(b.numero);
}

const SECTION_ORDER = ["keyboard","mouse","screen","headphones","other","none"];

function comparePcIds(a, b) {
  const numA = parseInt(a, 10);
  const numB = parseInt(b, 10);
  const validA = !Number.isNaN(numA);
  const validB = !Number.isNaN(numB);
  if (validA && validB) return numA - numB;
  if (validA) return -1;
  if (validB) return 1;
  return a.localeCompare(b, "fr", { numeric: true, sensitivity: "base" });
}

function keyForDamage(section, desc) {
  if (!section) return null;
  if (section === "headphones" && isHeadphoneDamage(desc)) {
    return `${section}|${normalizeText(desc.numero)}|${normalizeText(desc.description ?? desc.desc ?? "")}`;
  }
  if (typeof desc === "string") {
    return `${section}|${normalizeText(desc)}`;
  }
  if (desc && typeof desc === "object") {
    return `${section}|${JSON.stringify(desc)}`;
  }
  return null;
}

function formatDesc(section, desc) {
  if (section === "headphones" && isHeadphoneDamage(desc)) {
    const numero = desc.numero ?? "?";
    const text = desc.description ?? desc.desc ?? "";
    return `#${numero} – ${text}`;
  }
  if (typeof desc === "object" && desc !== null) {
    return desc.description ?? desc.desc ?? JSON.stringify(desc);
  }
  return String(desc ?? "");
}

function isNothingDamage(section, desc) {
  if (section === "headphones" && isHeadphoneDamage(desc)) {
    return normalizeText(desc.description ?? desc.desc ?? "") === "rien";
  }
  if (typeof desc === "string") {
    return normalizeText(desc) === "rien";
  }
  return false;
}

// Helper to remove an item from a report (by id), or delete the report if now empty
async function removeFromReport(repId, section, desc){
  const repRef = doc(db,"reports",repId);
  const repSnap = await getDoc(repRef);
  if (!repSnap.exists()) return;
  const repData = repSnap.data();
  const items = Array.isArray(repData.items)?repData.items:[];
  let newItems;
  if (section==="headphones" && isHeadphoneDamage(desc)){
    newItems = items.filter(it=> !(it.section===section && headphoneDamageEquals(it.desc, desc)));
  }else{
    newItems = items.filter(it=> !(it.section===section && normalizeText(it.desc)===normalizeText(desc)));
  }
  if (newItems.length){
    await setDoc(repRef,{items:newItems},{merge:true});
  }else{
    await deleteDoc(repRef);
  }
}


// Lance le tableau de bord dès le chargement
initDashboard();

async function initDashboard(){
  let pcIds = [];
  try {
    const pcsSnap = await getDocs(collection(db,"computers"));
    pcsSnap.forEach(snapshot => pcIds.push(snapshot.id));
  } catch (e) {
    console.warn("computers list failed, falling back to reports", e);
  }
  if (pcIds.length === 0) {
    try {
      const reps = await getDocs(collection(db, "reports"));
      const set = new Set();
      reps.forEach(ds => { const pc = ds.data().pcId; if (pc) set.add(pc); });
      pcIds = Array.from(set);
    } catch (e) {
      console.error("reports fallback failed", e);
    }
  }
  pcIds.sort(comparePcIds);

  if (pcSelect) {
    const frag = document.createDocumentFragment();
    pcIds.forEach(id => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = id;
      frag.appendChild(opt);
    });
    pcSelect.appendChild(frag);
  }

  const initialPc = pcSelect?.value || pcIds[0] || "";
  if (pcSelect && initialPc) {
    pcSelect.value = initialPc;
    subscribeToPc(initialPc);
  }

  pcSelect?.addEventListener("change", (evt) => {
    subscribeToPc(evt.target.value);
  });
  onlyDamages?.addEventListener("change", () => drawTable());
  onlyUnresToggleEl?.addEventListener("change", () => drawTable());
  pcHeadphoneSelect?.addEventListener("change", evt => {
    currentHeadphoneDetail = evt.target.value || "";
    drawTable();
  });
  headphoneSelect?.addEventListener("change", () => renderHeadphones());
  await refreshHeadphoneOptions();
}

function subscribeToPc(pc){
  if (!pc || pc === currentPC) {
    drawTable();
    return;
  }
  currentPC = pc;

  if (pcHeadphoneSelect) {
    pcHeadphoneSelect.value = "";
    currentHeadphoneDetail = "";
  }

  if (unsubReports) { unsubReports(); unsubReports=null; }
  if (unsubUnres)   { unsubUnres();   unsubUnres=null; }

  reportCache = [];
  unresolved  = {keyboard:[],mouse:[],screen:[],headphones:[],other:[]};
  drawTable();

  unsubUnres = onSnapshot(doc(db,"computers",pc),(snap)=>{
      if (snap.exists()){
          unresolved = snap.data();
      } else {
          unresolved = {keyboard:[],mouse:[],screen:[],headphones:[],other:[]};
      }
      drawTable();
      refreshHeadphoneOptions();
  });

  const q = query(collection(db,"reports"), where("pcId","==",pc));
  unsubReports = onSnapshot(q,(snap)=>{
      reportCache = [];
      snap.forEach(ds=>{
        const d = ds.data();
        d._id = ds.id;           // keep the doc id for later deletion
        reportCache.push(d);
      });
      reportCache.sort((a,b)=> (b.when?.seconds || 0) - (a.when?.seconds || 0));
      drawTable();
  });
}

async function drawTable() {
  if (!tbody) return;
  tbody.innerHTML = "";

  if (currentHeadphoneDetail) {
    await drawHeadphoneDetail(currentHeadphoneDetail);
    return;
  }

  pcEmpty?.textContent = "Aucun signalement pour ce poste.";
  pcEmpty?.classList.add("hidden");

  const latestMap = new Map();
  reportCache.forEach(r => {
    const when = r.when ? new Date(r.when.seconds * 1000) : null;
    const whenTs = when ? when.getTime() : 0;
    const whenStr = when ? when.toLocaleString() : "";
    const userStr = r.user ?? "";
    const items = Array.isArray(r.items) ? r.items : [];
    items.forEach(item => {
      const key = keyForDamage(item.section, item.desc);
      if (!key) return;
      if (onlyDamages?.checked && isNothingDamage(item.section, item.desc)) return;
      const existing = latestMap.get(key);
      if (!existing || whenTs > existing.whenTs) {
        latestMap.set(key, {
          section: item.section,
          desc: item.desc,
          when,
          whenTs,
          whenStr,
          user: userStr,
          reportId: r._id
        });
      }
    });
  });

  const unresolvedMap = new Map();
  const allKeys = new Set(latestMap.keys());
  SECTION_ORDER.forEach(section => {
    const arr = Array.isArray(unresolved[section]) ? unresolved[section] : [];
    arr.forEach(desc => {
      if (onlyDamages?.checked && isNothingDamage(section, desc)) return;
      const key = keyForDamage(section, desc);
      if (!key) return;
      unresolvedMap.set(key, desc);
      allKeys.add(key);
    });
  });

  const rows = [];
  allKeys.forEach(key => {
    const base = latestMap.get(key);
    const section = base?.section || key.split("|")[0] || "other";
    const desc = base?.desc ?? unresolvedMap.get(key);
    if (desc === undefined) return;
    const isUnres = unresolvedMap.has(key);
    if (onlyUnresToggleEl?.checked && !isUnres) return;
    rows.push({
      section,
      desc,
      descText: formatDesc(section, desc),
      whenStr: base?.whenStr || "",
      whenTs: base?.whenTs || 0,
      user: base?.user || "",
      isUnres,
      reportId: base?.reportId || ""
    });
  });

  rows.sort((a,b)=>{
    const orderDiff = SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section);
    if (orderDiff !== 0) return orderDiff;
    return (b.whenTs - a.whenTs);
  });

  let currentSection = null;
  rows.forEach(row => {
    if (row.section !== currentSection) {
      currentSection = row.section;
      const heading = document.createElement("tr");
      heading.className = "section-row";
      heading.innerHTML = `<td colspan="6">${label(row.section)}</td>`;
      tbody.appendChild(heading);
    }
    const statusClass = row.isUnres ? "danger" : "success";
    const statusLabel = row.isUnres ? "❌ Non réglé" : "✅ Réglé";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${label(row.section)}</td>
        <td>${row.descText}</td>
        <td>${row.whenStr}</td>
        <td>${row.user}</td>
        <td><span class="tag-status ${statusClass}">${statusLabel}</span></td>
        <td>
          <div class="action-group">
            <button data-action="toggle"
                    data-pc="${currentPC}"
                    data-rep="${row.reportId}"
                    data-sec="${row.section}"
                    data-desc="${encodeURIComponent(JSON.stringify(row.desc))}"
                    data-res="${row.isUnres}">
              ${row.isUnres ? "Marquer réglé" : "Marquer non réglé"}
            </button>
            <button data-action="delete"
                    data-pc="${currentPC}"
                    data-rep="${row.reportId}"
                    data-sec="${row.section}"
                    data-desc="${encodeURIComponent(JSON.stringify(row.desc))}">
              Supprimer
            </button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });

  if (rows.length === 0) {
    pcEmpty?.classList.remove("hidden");
  }
}

async function drawHeadphoneDetail(numero) {
  if (!tbody) return;
  tbody.innerHTML = "";
  pcEmpty?.textContent = "Aucun dégât pour cet écouteur.";
  pcEmpty?.classList.add("hidden");

  const { numbers, cards } = await fetchHeadphoneIssues();
  populateHeadphoneSelects(numbers);
  const card = cards.find(c => c.numero === numero);

  if (!card || !card.items.length) {
    pcEmpty?.classList.remove("hidden");
    return;
  }

  const rows = [];
  card.items.forEach(item => {
    if (onlyDamages?.checked && isNothingDamage("headphones", item.desc)) return;
    rows.push(item);
  });

  if (!rows.length) {
    pcEmpty?.classList.remove("hidden");
    return;
  }

  rows.sort((a, b) => b.whenTs - a.whenTs);
  rows.forEach(item => {
    const tr = document.createElement("tr");
    const compTd = document.createElement("td");
    compTd.textContent = label("headphones");
    const descTd = document.createElement("td");
    const strong = document.createElement("strong");
    strong.textContent = `PC ${item.pcId}`;
    descTd.appendChild(strong);
    descTd.appendChild(document.createTextNode(` · ${item.descText}`));
    const dateTd = document.createElement("td");
    dateTd.textContent = item.whenStr || "";
    const userTd = document.createElement("td");
    userTd.textContent = item.user || "";
    const statusTd = document.createElement("td");
    const statusSpan = document.createElement("span");
    statusSpan.className = "tag-status danger";
    statusSpan.textContent = "❌ Non réglé";
    statusTd.appendChild(statusSpan);
    const actionTd = document.createElement("td");
    const actionGroup = document.createElement("div");
    actionGroup.className = "action-group";
    actionGroup.innerHTML = `
      <button data-action="toggle"
              data-pc="${item.pcId}"
              data-sec="headphones"
              data-desc="${encodeURIComponent(JSON.stringify(item.desc))}"
              data-rep="${item.reportId}"
              data-res="true">
        Marquer réglé
      </button>
      <button data-action="delete"
              data-pc="${item.pcId}"
              data-sec="headphones"
              data-desc="${encodeURIComponent(JSON.stringify(item.desc))}"
              data-rep="${item.reportId}">
        Supprimer
      </button>`;
    actionTd.appendChild(actionGroup);
    tr.appendChild(compTd);
    tr.appendChild(descTd);
    tr.appendChild(dateTd);
    tr.appendChild(userTd);
    tr.appendChild(statusTd);
    tr.appendChild(actionTd);
    tbody.appendChild(tr);
  });
  if (pcHeadphoneSelect) pcHeadphoneSelect.value = numero;
}

tbody.addEventListener("click", async ev=>{
  const btn = ev.target.closest("button");
  if(!btn) return;
  const action  = btn.dataset.action || "toggle";
  const section = btn.dataset.sec;
  const descRaw = decodeURIComponent(btn.dataset.desc);
  let desc;
  try {
    desc = JSON.parse(descRaw);
  } catch {
    desc = descRaw;
  }
  const unresolvedNow = btn.dataset.res === "true";
  const targetPc = btn.dataset.pc || currentPC;
  if (!targetPc) return;
  const pcRef = doc(db,"computers", targetPc);

  if (action === "delete") {
    if (!window.confirm("Supprimer définitivement ce dégât ?")) return;
    const pcSnap = await getDoc(pcRef);
    if (!pcSnap.exists()) return;
    const data = pcSnap.data() ?? {};
    const arr = Array.isArray(data[section]) ? data[section] : [];
    let newArr;
    if (section === "headphones" && isHeadphoneDamage(desc)) {
      newArr = arr.filter(d => !headphoneDamageEquals(d, desc));
    } else {
      newArr = arr.filter(d => normalizeText(d) !== normalizeText(desc));
    }
    await setDoc(pcRef, { [section]: newArr }, { merge: true });
    const repId = btn.dataset.rep;
    if (repId){
      await removeFromReport(repId, section, desc);
    }
    btn.closest("tr")?.remove();
    if (globalGrid) showGlobalView();
    if (headphoneGrid) renderHeadphones();
    if (currentHeadphoneDetail) await drawTable();
    return; // done
  }

  if (section === "headphones" && isHeadphoneDamage(desc)) {
    // For headphone damage objects, remove the object from array (no regle field)
    await updateDoc(pcRef, { [section]: arrayRemove(desc) });
  } else if (isHeadphoneDamage(desc)) {
    // This case no longer applies, but keep fallback for safety
    // For headphone damage objects, update the regle property inside the array
    const pcSnap = await getDoc(pcRef);
    if (!pcSnap.exists()) return;
    const data = pcSnap.data() ?? {};
    const arr = Array.isArray(data[section]) ? data[section] : [];

    // Find index of the object to update
    const idx = arr.findIndex(d => isHeadphoneDamage(d) && headphoneDamageEquals(d, desc));
    if (idx === -1) return; // not found, nothing to do

    // Update regle property accordingly
    const newObj = {...arr[idx], regle: !unresolvedNow};
    const newArr = [...arr];
    newArr[idx] = newObj;

    // Replace entire array with setDoc (merge:false to update field)
    await setDoc(pcRef, {[section]: newArr}, {merge:true});
  } else {
    // For primitive desc, use arrayRemove/arrayUnion as before
    if (unresolvedNow){
        await updateDoc(pcRef, {[section]: arrayRemove(desc)});
    } else {
        await updateDoc(pcRef, {[section]: arrayUnion(desc)});
    }
  }
  if (globalGrid) showGlobalView();
  if (headphoneGrid) renderHeadphones();
  if (currentHeadphoneDetail) await drawTable();
});

function label(sec){
  const map = {
    keyboard: "⌨️ Clavier",
    mouse: "🖱️ Souris",
    screen: "🖥️ Écran",
    headphones: "🎧 Écouteurs",
    other: "🛠️ Autres",
    none: "—"
  };
  return map[sec] || sec;
}

// ----- VUE D'ENSEMBLE -----
async function showGlobalView() {
  if (!globalGrid) return;
  globalGrid.innerHTML = "";
  globalEmpty?.classList.add("hidden");

  const pcsSnap = await getDocs(collection(db, "computers"));
  const reportsSnap = await getDocs(collection(db, "reports"));

  const latestByPc = new Map();
  reportsSnap.forEach(ds => {
    const r = ds.data();
    const pc = r.pcId;
    if (!pc) return;
    const when = r.when ? new Date(r.when.seconds * 1000) : null;
    const whenTs = when ? when.getTime() : 0;
    const whenStr = when ? when.toLocaleString() : "";
    const user = r.user ?? "";
    const items = Array.isArray(r.items) ? r.items : [];
    if (!latestByPc.has(pc)) latestByPc.set(pc, new Map());
    const map = latestByPc.get(pc);
    items.forEach(item => {
      const key = keyForDamage(item.section, item.desc);
      if (!key) return;
      if (isNothingDamage(item.section, item.desc)) return;
      const existing = map.get(key);
      if (!existing || whenTs > existing.whenTs) {
        map.set(key, {
          section: item.section,
          desc: item.desc,
          whenStr,
          whenTs,
          user,
          reportId: ds.id
        });
      }
    });
  });

  const cards = [];
  pcsSnap.forEach(pcSnap => {
    const pcId = pcSnap.id;
    const data = pcSnap.data() ?? {};
    const issues = [];
    SECTION_ORDER.forEach(section => {
      const arr = Array.isArray(data[section]) ? data[section] : [];
      arr.forEach(desc => {
        if (isNothingDamage(section, desc)) return;
        const key = keyForDamage(section, desc);
        if (!key) return;
        const latest = latestByPc.get(pcId)?.get(key);
        const reporter = latest?.user ? `Signalé par ${latest.user}` : "Signalé";
        const datePart = latest?.whenStr ? ` le ${latest.whenStr}` : " à une date inconnue";
        issues.push({
          section,
          desc,
          descText: formatDesc(section, desc),
          tooltip: `${reporter}${datePart}`,
          reportId: latest?.reportId || "",
          whenTs: latest?.whenTs || 0
        });
      });
    });
    issues.sort((a,b)=>{
      const diff = SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section);
      if (diff !== 0) return diff;
      return (b.whenTs - a.whenTs);
    });
    const categorised = SECTION_ORDER
      .map(section => ({ section, items: issues.filter(it => it.section === section) }))
      .filter(cat => cat.items.length);
    cards.push({ pcId, issues, categorised });
  });

  cards.sort((a,b)=>comparePcIds(a.pcId, b.pcId));

  let totalIssues = 0;
  const frag = document.createDocumentFragment();
  cards.forEach(card => {
    const article = document.createElement("article");
    article.className = "pc-card";

    const header = document.createElement("header");
    const title = document.createElement("h3");
    title.textContent = `PC ${card.pcId}`;
    const count = document.createElement("span");
    count.textContent = card.issues.length ? `${card.issues.length} dégât(s)` : "RAS";
    header.appendChild(title);
    header.appendChild(count);
    article.appendChild(header);

    if (!card.categorised.length) {
      const empty = document.createElement("p");
      empty.className = "card-empty";
      empty.textContent = "Aucun dégât en attente.";
      article.appendChild(empty);
    } else {
      totalIssues += card.categorised.reduce((acc, cat) => acc + cat.items.length, 0);
      const sectionWrap = document.createElement("div");
      sectionWrap.className = "issue-sections";
      card.categorised.forEach(cat => {
        const sectionCard = document.createElement("section");
        sectionCard.className = "section-card";
        const headerRow = document.createElement("header");
        headerRow.innerHTML = `<span>${label(cat.section)}</span><span>${cat.items.length}</span>`;
        sectionCard.appendChild(headerRow);
        const list = document.createElement("ul");
        list.className = "issue-list";
        cat.items.forEach(issue => {
          const li = document.createElement("li");
          li.className = "issue-item";
          if (issue.tooltip) li.title = issue.tooltip;
          const text = document.createElement("span");
          text.textContent = issue.descText;
          li.appendChild(text);
          const actions = document.createElement("div");
          actions.className = "issue-actions";
          actions.innerHTML = `
            <button data-action="toggle"
                    data-pc="${card.pcId}"
                    data-sec="${issue.section}"
                    data-desc="${encodeURIComponent(JSON.stringify(issue.desc))}"
                    data-rep="${issue.reportId}"
                    data-res="true">✅</button>
            <button data-action="delete"
                    data-pc="${card.pcId}"
                    data-sec="${issue.section}"
                    data-desc="${encodeURIComponent(JSON.stringify(issue.desc))}"
                    data-rep="${issue.reportId}">🗑️</button>`;
          li.appendChild(actions);
          list.appendChild(li);
        });
        sectionCard.appendChild(list);
        sectionWrap.appendChild(sectionCard);
      });
      article.appendChild(sectionWrap);
    }
    frag.appendChild(article);
  });

  globalGrid.appendChild(frag);
  if (totalIssues === 0) {
    globalEmpty?.classList.remove("hidden");
  }
}

// ----- VUE ÉCOUTEURS -----
async function fetchHeadphoneIssues() {
  let pcsSnap, reportsSnap;
  try {
    pcsSnap = await getDocs(collection(db, "computers"));
  } catch (e) {
    console.warn("fetchHeadphoneIssues: computers read failed", e);
  }
  try {
    reportsSnap = await getDocs(collection(db, "reports"));
  } catch (e) {
    console.warn("fetchHeadphoneIssues: reports read failed", e);
  }

  const latestMap = new Map();
  reportsSnap?.forEach(ds => {
    const r = ds.data();
    const pcId = r.pcId;
    if (!pcId) return;
    const when = r.when ? new Date(r.when.seconds * 1000) : null;
    const whenTs = when ? when.getTime() : 0;
    const whenStr = when ? when.toLocaleString() : "";
    const user = r.user ?? "";
    const items = Array.isArray(r.items) ? r.items : [];
    items.forEach(item => {
      if (item.section !== "headphones") return;
      const key = keyForDamage("headphones", item.desc);
      if (!key) return;
      const existing = latestMap.get(key);
      if (!existing || whenTs > existing.whenTs) {
        latestMap.set(key, { whenTs, whenStr, user, reportId: ds.id, pcId });
      }
    });
  });

  const byNumber = new Map();
  pcsSnap?.forEach(pcSnap => {
    const pcId = pcSnap.id;
    const data = pcSnap.data() ?? {};
    const arr = Array.isArray(data.headphones) ? data.headphones : [];
    arr.forEach(desc => {
      if (!isHeadphoneDamage(desc)) return;
      const numero = String(desc.numero || "").trim();
      if (!numero) return;
      const key = keyForDamage("headphones", desc);
      const meta = latestMap.get(key) || {};
      if (!byNumber.has(numero)) byNumber.set(numero, []);
      byNumber.get(numero).push({
        section: "headphones",
        desc,
        descText: desc.description ?? desc.desc ?? "",
        pcId,
        whenTs: meta.whenTs || 0,
        whenStr: meta.whenStr || "",
        user: meta.user || "",
        reportId: meta.reportId || ""
      });
    });
  });

  const numbers = Array.from(byNumber.keys()).filter(Boolean).sort(comparePcIds);
  const cards = numbers.map(numero => {
    const items = byNumber.get(numero) || [];
    items.sort((a, b) => b.whenTs - a.whenTs);
    return { numero, items };
  });

  return { numbers, cards };
}

function populateHeadphoneSelects(numbers) {
  if (headphoneSelect) {
    const current = headphoneSelect.value;
    headphoneSelect.innerHTML = '<option value="">Tous</option>';
    numbers.forEach(num => {
      const opt = document.createElement("option");
      opt.value = num;
      opt.textContent = `N° ${num}`;
      headphoneSelect.appendChild(opt);
    });
    if (current && numbers.includes(current)) {
      headphoneSelect.value = current;
    } else {
       headphoneSelect.value = "";
    }
  }

  if (pcHeadphoneSelect) {
    const current = pcHeadphoneSelect.value;
    pcHeadphoneSelect.innerHTML = '<option value="">— Aucun —</option>';
    numbers.forEach(num => {
      const opt = document.createElement("option");
      opt.value = num;
      opt.textContent = `N° ${num}`;
      pcHeadphoneSelect.appendChild(opt);
    });
    if (current && numbers.includes(current)) {
      pcHeadphoneSelect.value = current;
    } else if (currentHeadphoneDetail && !numbers.includes(currentHeadphoneDetail)) {
      currentHeadphoneDetail = "";
      pcHeadphoneSelect.value = "";
    } else {
       pcHeadphoneSelect.value = "";
    }
  }
}

async function renderHeadphones() {
  if (!headphoneGrid) return;
  headphoneGrid.innerHTML = "";
  headphoneEmpty?.classList.add("hidden");

  const { numbers, cards } = await fetchHeadphoneIssues();
  populateHeadphoneSelects(numbers);

  const target = headphoneSelect?.value || "";
  const list = target ? cards.filter(card => card.numero === target) : cards;

  if (!list.length) {
    headphoneEmpty?.classList.remove("hidden");
    return;
  }

  const frag = document.createDocumentFragment();
  list.forEach(card => {
    const article = document.createElement("article");
    article.className = "headphone-card";

    const header = document.createElement("header");
    const title = document.createElement("h3");
    title.textContent = `Écouteur n°${card.numero}`;
    const count = document.createElement("span");
    count.textContent = `${card.items.length} dégât(s)`;
    header.appendChild(title);
    header.appendChild(count);
    article.appendChild(header);

    if (!card.items.length) {
      const empty = document.createElement("p");
      empty.className = "card-empty";
      empty.textContent = "Aucun dégât en attente.";
      article.appendChild(empty);
    } else {
      const listEl = document.createElement("ul");
      listEl.className = "issue-list";
      card.items.forEach(item => {
        const li = document.createElement("li");
        li.className = "issue-item";
        const span = document.createElement("span");
        const reporter = item.user ? `Signalé par ${item.user}` : "Signalement";
        const date = item.whenStr ? ` le ${item.whenStr}` : "";
        const strong = document.createElement("strong");
        strong.textContent = `PC ${item.pcId}`;
        span.appendChild(strong);
        span.appendChild(document.createTextNode(` · ${item.descText}`));
        span.title = `${reporter}${date}`;
        li.appendChild(span);
        const actions = document.createElement("div");
        actions.className = "issue-actions";
        actions.innerHTML = `
          <button data-action="toggle"
                  data-pc="${item.pcId}"
                  data-sec="headphones"
                  data-desc="${encodeURIComponent(JSON.stringify(item.desc))}"
                  data-rep="${item.reportId}"
                  data-res="true">✅</button>
          <button data-action="delete"
                  data-pc="${item.pcId}"
                  data-sec="headphones"
                  data-desc="${encodeURIComponent(JSON.stringify(item.desc))}"
                  data-rep="${item.reportId}">🗑️</button>`;
        li.appendChild(actions);
        listEl.appendChild(li);
      });
      article.appendChild(listEl);
    }

    frag.appendChild(article);
  });

  headphoneGrid.appendChild(frag);
}

async function refreshHeadphoneOptions() {
  const { numbers } = await fetchHeadphoneIssues();
  populateHeadphoneSelects(numbers);
}

async function handleExternalAction(btn) {
  const action  = btn.dataset.action || "toggle";
  const pc      = btn.dataset.pc;
  const section = btn.dataset.sec;
  const descRaw = decodeURIComponent(btn.dataset.desc || "");
  let desc;
  try {
    desc = JSON.parse(descRaw);
  } catch {
    desc = descRaw;
  }
  if (!pc || !section) return;
  const pcRef = doc(db, "computers", pc);

  if (action === "delete") {
    if (!window.confirm("Supprimer définitivement ce dégât ?")) return;
    const pcSnap = await getDoc(pcRef);
    if (!pcSnap.exists()) return;
    const data = pcSnap.data() ?? {};
    const arr = Array.isArray(data[section]) ? data[section] : [];
    let newArr;
    if (section === "headphones" && isHeadphoneDamage(desc)) {
      newArr = arr.filter(d => !headphoneDamageEquals(d, desc));
    } else {
      newArr = arr.filter(d => normalizeText(d) !== normalizeText(desc));
    }
    await setDoc(pcRef, { [section]: newArr }, { merge: true });
    const repId = btn.dataset.rep;
    if (repId){
      await removeFromReport(repId, section, desc);
    } else {
      const q = query(collection(db,"reports"), where("pcId","==",pc));
      const reports = await getDocs(q);
      for (const ds of reports.docs){
        const repData = ds.data();
        const items = Array.isArray(repData.items)?repData.items:[];
        let newItems;
        if (section==="headphones" && isHeadphoneDamage(desc)){
          newItems = items.filter(it=> !(it.section===section && headphoneDamageEquals(it.desc, desc)));
        }else{
          newItems = items.filter(it=> !(it.section===section && normalizeText(it.desc)===normalizeText(desc)));
        }
        if (newItems.length !== items.length){
          if (newItems.length){
            await setDoc(ds.ref,{items:newItems},{merge:true});
          }else{
            await deleteDoc(ds.ref);
          }
          break;
        }
      }
    }
  } else {
    if (!window.confirm("Confirmer le marquage comme réglé ?")) return;
    if (section === "headphones" && isHeadphoneDamage(desc)) {
      await updateDoc(pcRef, { [section]: arrayRemove(desc) });
    } else if (isHeadphoneDamage(desc)) {
      const pcSnap = await getDoc(pcRef);
      if (!pcSnap.exists()) return;
      const data = pcSnap.data() ?? {};
      const arr = Array.isArray(data[section]) ? data[section] : [];
      const idx = arr.findIndex(d => isHeadphoneDamage(d) && headphoneDamageEquals(d, desc));
      if (idx === -1) return;
      const newObj = {...arr[idx], regle: true};
      const newArr = [...arr];
      newArr[idx] = newObj;
      await setDoc(pcRef, {[section]: newArr}, {merge:true});
    } else {
      await updateDoc(pcRef, { [section]: arrayRemove(desc) });
    }
  }

  await showGlobalView();
  if (headphoneGrid) await renderHeadphones();
  if (currentHeadphoneDetail) await drawTable();
}

globalGrid?.addEventListener("click", async ev => {
  const btn = ev.target.closest("button");
  if (!btn) return;
  await handleExternalAction(btn);
});

headphoneGrid?.addEventListener("click", async ev => {
  const btn = ev.target.closest("button");
  if (!btn) return;
  await handleExternalAction(btn);
});

// Expose la fonction globalement pour l'utiliser via des attributs HTML
window.showGlobalView = showGlobalView;

// Load appropriate view on page load based on URL hash
if (window.location.hash === "#global") {
  showGlobalViewTab();
} else if (window.location.hash === "#headphones") {
  showHeadphonesView();
} else {
  showPcView();
}
