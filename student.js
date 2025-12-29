// Empêche la fermeture de la fenêtre tant que le formulaire n'a pas été envoyé, actif dès la première interaction
let isSubmitted = false;
let userHasInteracted = false;
function activateBeforeUnload() {
  if (!userHasInteracted) {
    userHasInteracted = true;
    window.addEventListener("beforeunload", blockUnload);
  }
}
function blockUnload(e) {
  if (!isSubmitted) {
    e.preventDefault();
    e.returnValue = "";
    return "";
  }
}

// Active la protection seulement à l'affichage de la première vraie section
// show(0) est déjà appelé plus bas, donc on ajoute les activateurs ici
// (évite attachement multiple des listeners)
// (voir plus bas pour show(0))
// Ces listeners ne seront activés qu'une fois à la première interaction
window.addEventListener("keydown", activateBeforeUnload, { once: true });
window.addEventListener("mousedown", activateBeforeUnload, { once: true });
window.addEventListener("touchstart", activateBeforeUnload, { once: true });

// Change le titre si l'élève essaie d'aller ailleurs
window.onblur = function() {
  document.title = "⚠️ Reviens sur le formulaire !";
};
window.onfocus = function() {
  document.title = "Questionnaire de dégâts";
};
// student.js
import { db } from "./firebase-config.js";
import {
  doc, getDoc, getDocs, setDoc, updateDoc, arrayUnion, addDoc, collection, serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const attentionEmojis = ["🧚‍♂️","🧜‍♀️","🏄‍♂️","👀","🐷","🔎","🦊","💥","✨","🐔","🦄","🍓","🍿","🍤","🏖️","🪂","🧙"];
function randomAttentionEmoji(){
  return attentionEmojis[Math.floor(Math.random()*attentionEmojis.length)];
}

const headphoneDamageMap = new Map(); // { numero -> Map(normalizedText, {text, raw}) }

function normalizeDamageText(value){
  return String(value ?? "").trim().toLowerCase();
}

function normalizeReportText(value){
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function extractReportText(section, value){
  if (section === "headphones") {
    if (value && typeof value === "object") {
      return value.description ?? value.desc ?? "";
    }
    return String(value ?? "");
  }
  if (value && typeof value === "object") {
    if (typeof value.text === "string") return value.text;
    if (typeof value.description === "string") return value.description;
    if (typeof value.desc === "string") return value.desc;
  }
  return String(value ?? "");
}

function isNoHeadphoneDamage(value){
  const text = normalizeReportText(extractReportText("headphones", value));
  return text.includes("aucun dégât") || text.includes("aucun degat");
}

function reportItemKey(section, value){
  if (!section) return "";
  if (section === "headphones") {
    const obj = value && typeof value === "object"
      ? value
      : { numero: "", description: extractReportText(section, value) };
    const numero = normalizeReportText(obj.numero ?? "");
    const desc = normalizeReportText(obj.description ?? obj.desc ?? "");
    return `headphones|${numero}|${desc}`;
  }
  const text = extractReportText(section, value);
  return `${section}|${normalizeReportText(text)}`;
}

function sanitizeSessionItems(items){
  return (Array.isArray(items) ? items : [])
    .filter(item => item && typeof item.section === "string")
    .map(item => {
      const desc = item.desc;
      if (desc && typeof desc === "object") {
        const cleaned = {};
        if ("numero" in desc) cleaned.numero = String(desc.numero ?? "").trim();
        if ("description" in desc) cleaned.description = String(desc.description ?? "");
        if ("desc" in desc) cleaned.desc = String(desc.desc ?? "");
        return { section: item.section, desc: cleaned };
      }
      return { section: item.section, desc: String(desc ?? "") };
    });
}

/* ------ Paramètres URL ------ */
const params = new URLSearchParams(location.search);
const pcId   = params.get("pc");
const userId = params.get("user");

document.getElementById("pcId").textContent   = pcId;
document.getElementById("userId").textContent = userId;

/* ------ Sélecteurs pour la boîte modale ------ */
const modal     = document.getElementById("modal");
const saveBtn   = document.getElementById("save");
const cancelBtn = document.getElementById("cancel");

/* ------ Modal mot de passe prof ------ */
const pwdModal  = document.getElementById("pwdModal");
const newList   = document.getElementById("newList");
const pwdInput  = document.getElementById("pwdInput");
const pwdOk     = document.getElementById("pwdOk");
const pwdCancel = document.getElementById("pwdCancel");
const PROF_PWD  = "0dga";

let sessionRef = null;

async function startSession(){
  try {
    sessionRef = await addDoc(collection(db, "report_sessions"), {
      pcId: pcId ?? "",
      user: userId ?? "",
      startedAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
      status: "in_progress",
      step: "welcome",
      items: [],
      hasRealDamage: false
    });
  } catch (err) {
    console.warn("startSession", err);
  }
}

async function touchSession(extra = {}){
  if (!sessionRef) return;
  try {
    await updateDoc(sessionRef, { lastSeen: serverTimestamp(), ...extra });
  } catch (err) {
    console.warn("touchSession", err);
  }
}

await startSession();

/* ------ Récupérer dégâts non résolus ------ */
const pcRef = doc(db, "computers", pcId);
const pcSnap = await getDoc(pcRef);
if (!pcSnap.exists()) {
  // crée le doc vide si besoin
  await setDoc(pcRef, { keyboard: [], mouse: [], screen: [], other: [], headphones: [] });
}

const data = (await getDoc(pcRef)).data();
const headphoneExistingWrapper = document.getElementById("headphones-existing");
const headphoneDamageList = document.getElementById("list-headphones");
if (headphoneExistingWrapper) headphoneExistingWrapper.classList.add("hidden");

const headphoneInitial = Array.isArray(data.headphones) ? data.headphones : [];
["keyboard","mouse","screen","other"].forEach(sec=>{
  const ul = document.getElementById(`list-${sec}`);
  if (!ul || !data[sec]) return;
  data[sec].forEach(d => {
    const li = document.createElement("li");
    const wrapper = document.createElement("span");
    const bullet = document.createElement("span");
    bullet.className = "damage-bullet";
    bullet.textContent = randomAttentionEmoji();
    const textSpan = document.createElement("span");
    if (typeof d === "object" && d !== null) {
      textSpan.textContent = d.text || d.description || d.desc || JSON.stringify(d);
    } else {
      textSpan.textContent = d;
    }
    wrapper.appendChild(bullet);
    wrapper.appendChild(textSpan);
    li.appendChild(wrapper);
    ul.appendChild(li);
  });
});

async function loadHeadphoneDamages(){
  headphoneDamageMap.clear();
  try {
    const snaps = await getDocs(collection(db, "computers"));
    snaps.forEach(docSnap => {
      const arr = Array.isArray(docSnap.data()?.headphones) ? docSnap.data().headphones : [];
      arr.forEach(item => addHeadphoneDamageToMapRaw(item));
    });
  } catch (err) {
    console.error("loadHeadphoneDamages", err);
  }

  headphoneInitial.forEach(item => addHeadphoneDamageToMapRaw(item));
}

function addHeadphoneDamageToMapRaw(item){
  const obj = item && typeof item === "object" ? item : { numero: "", description: String(item ?? "") };
  const num = String(obj.numero || "").trim();
  if (!num) return;
  const text = obj.text || obj.description || obj.desc || String(item ?? "");
  const key = normalizeDamageText(text);
  let inner = headphoneDamageMap.get(num);
  if (!inner) {
    inner = new Map();
    headphoneDamageMap.set(num, inner);
  }
  if (!inner.has(key)) {
    inner.set(key, { text, raw: obj });
  }
}

function addHeadphoneDamageToMap(numero, description){
  const obj = { numero, description };
  addHeadphoneDamageToMapRaw(obj);
}

function renderHeadphoneDamageList(numero){
  if (!headphoneDamageList || !headphoneExistingWrapper) return;
  headphoneDamageList.innerHTML = "";
  const num = numero.trim();
  if (!num) {
    headphoneExistingWrapper.classList.add("hidden");
    return;
  }
  headphoneExistingWrapper.classList.remove("hidden");
  const inner = headphoneDamageMap.get(num);
  if (!inner || inner.size === 0) {
    const li = document.createElement("li");
    li.textContent = "Aucun dégât signalé pour cette paire.";
    headphoneDamageList.appendChild(li);
    return;
  }
  inner.forEach(entry => {
    const li = document.createElement("li");
    const wrapper = document.createElement("span");
    const bullet = document.createElement("span");
    bullet.className = "damage-bullet";
    bullet.textContent = randomAttentionEmoji();
    const textSpan = document.createElement("span");
    textSpan.textContent = entry.text;
    wrapper.appendChild(bullet);
    wrapper.appendChild(textSpan);
    li.appendChild(wrapper);
    headphoneDamageList.appendChild(li);
  });
}

await loadHeadphoneDamages();

/* ------ Gestion des boutons ------ */
let pendingReports = [];   // on stocke avant d'envoyer tout d'un coup

function haveRealDamage(){
  return pendingReports.some(r=>{
    if (r.section === "none") return false;
    if (r.section === "headphones"){
      // objet {numero, description:"aucun dégât"} OU string "aucun dégât"
      if (typeof r.desc === "object"){
        return (r.desc.description || "").toLowerCase().indexOf("aucun dégât") === -1;
      }
      return (r.desc || "").toLowerCase().indexOf("aucun dégât") === -1;
    }
    return true;          // tout autre section = vrai dégât
  });
}

function syncSessionItems(){
  const items = sanitizeSessionItems(pendingReports);
  void touchSession({ items, hasRealDamage: haveRealDamage() });
}


  /* ------ Navigation de section ------ */

  const sections = [
    document.getElementById('section-welcome'),
    document.getElementById('section-keyboard'),
    document.getElementById('section-mouse'),
    document.getElementById('section-screen'),
    document.getElementById('section-headphones'),
    document.getElementById('section-other'),
    document.getElementById('section-rules')       // nouvelle étape
  ];

  const pendingPanel = document.createElement("div");
  pendingPanel.id = "pendingPanel";
  pendingPanel.className = "pending-panel hidden";
  pendingPanel.innerHTML = `
    <h4>Signalements de cette session</h4>
    <ul id="pendingList" class="pending-list"></ul>
  `;
  const pendingList = pendingPanel.querySelector("#pendingList");
  if (newList) newList.classList.add("pending-list");

  function isDisplayablePendingItem(item){
    if (!item || !item.section) return false;
    if (item.section === "none") return false;
    if (item.section === "headphones" && isNoHeadphoneDamage(item.desc)) return false;
    const text = extractReportText(item.section, item.desc);
    return normalizeReportText(text) !== "";
  }

  function formatPendingItemText(item){
    if (item.section === "headphones" && item.desc && typeof item.desc === "object") {
      const num = String(item.desc.numero ?? "").trim();
      const desc = item.desc.description ?? item.desc.desc ?? "";
      return `N°${num} : ${desc}`;
    }
    return extractReportText(item.section, item.desc);
  }

  function getDisplayablePendingItems(){
    const items = [];
    pendingReports.forEach((item, index) => {
      if (!isDisplayablePendingItem(item)) return;
      items.push({
        index,
        text: `${label(item.section)} : ${formatPendingItemText(item)}`
      });
    });
    return items;
  }

  function updatePwdModalState(){
    if (!pwdModal || !pwdOk) return;
    const needPwd = haveRealDamage();
    if (pwdInput) {
      pwdInput.disabled = !needPwd;
      if (!needPwd) pwdInput.value = "";
      pwdInput.placeholder = needPwd
        ? "🔑 Mot de passe prof (indice : aucun dégat f0netik)"
        : "Aucun mot de passe nécessaire";
    }
    pwdOk.textContent = needPwd ? "Valider" : "Valider sans mot de passe";
  }

  function renderPendingLists(){
    const displayItems = getDisplayablePendingItems();

    if (pendingList) {
      pendingList.innerHTML = "";
      displayItems.forEach(({ index, text }) => {
        const li = document.createElement("li");
        li.className = "pending-item";
        const textSpan = document.createElement("span");
        textSpan.className = "pending-item-text";
        textSpan.textContent = text;
        const actions = document.createElement("div");
        actions.className = "pending-actions";
        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.dataset.action = "edit";
        editBtn.dataset.index = String(index);
        editBtn.textContent = "Modifier";
        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.dataset.action = "remove";
        deleteBtn.dataset.index = String(index);
        deleteBtn.textContent = "Supprimer";
        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);
        li.appendChild(textSpan);
        li.appendChild(actions);
        pendingList.appendChild(li);
      });
    }

    if (newList) {
      newList.innerHTML = "";
      if (!displayItems.length) {
        const emptyLi = document.createElement("li");
        emptyLi.className = "pending-empty";
        emptyLi.textContent = "Aucun dégât à valider.";
        newList.appendChild(emptyLi);
      } else {
        displayItems.forEach(({ index, text }) => {
          const li = document.createElement("li");
          li.className = "pending-item";
          const textSpan = document.createElement("span");
          textSpan.className = "pending-item-text";
          textSpan.textContent = text;
          const actions = document.createElement("div");
          actions.className = "pending-actions";
          const deleteBtn = document.createElement("button");
          deleteBtn.type = "button";
          deleteBtn.dataset.action = "remove";
          deleteBtn.dataset.index = String(index);
          deleteBtn.textContent = "Supprimer";
          actions.appendChild(deleteBtn);
          li.appendChild(textSpan);
          li.appendChild(actions);
          newList.appendChild(li);
        });
      }
    }

    pendingPanel.classList.toggle("hidden", displayItems.length === 0);
    updatePwdModalState();
  }

  function attachPendingPanel(section){
    if (!section || section.id === "section-welcome") return;
    section.appendChild(pendingPanel);
  }

  function handlePendingListClick(event){
    const btn = event.target.closest("button");
    if (!btn) return;
    const action = btn.dataset.action;
    const index = Number(btn.dataset.index);
    if (!Number.isInteger(index)) return;
    if (action === "remove") {
      pendingReports.splice(index, 1);
      syncSessionItems();
      renderPendingLists();
      return;
    }
    if (action === "edit") {
      const item = pendingReports[index];
      if (!item) return;
      openModal(item.section, index);
    }
  }

  pendingList?.addEventListener("click", handlePendingListClick);
  newList?.addEventListener("click", handlePendingListClick);

  // --- Gestion écouteurs
  const headphoneRadios = document.getElementsByName("headphoneUse");
  const headphoneDetails = document.getElementById("headphone-details");
  const headphoneNumber = document.getElementById("headphoneNumber");
  const newHeadphoneDamage = document.getElementById("newHeadphoneDamage");
  const btnNoHeadphone = document.getElementById("btnNoHeadphone");
  const noHeadphoneDamage = document.getElementById("noHeadphoneDamage");

  if (headphoneRadios && headphoneDetails && btnNoHeadphone) {
    headphoneRadios.forEach(radio => {
      radio.onchange = () => {
        if (radio.value === "oui" && radio.checked) {
          headphoneDetails.classList.remove("hidden");
          btnNoHeadphone.classList.add("hidden");
          renderHeadphoneDamageList(headphoneNumber.value.trim());
        } else if (radio.value === "non" && radio.checked) {
          headphoneDetails.classList.add("hidden");
          btnNoHeadphone.classList.remove("hidden");
          renderHeadphoneDamageList("");
        }
      };
    });
    btnNoHeadphone.onclick = nextSection;
  }

  if (headphoneNumber) {
    if (headphoneNumber.tagName === "SELECT") {
      headphoneNumber.innerHTML = "";
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Sélectionner...";
      headphoneNumber.appendChild(placeholder);
      for (let i = 1; i <= 30; i++) {
        const opt = document.createElement("option");
        opt.value = String(i);
        opt.textContent = String(i);
        headphoneNumber.appendChild(opt);
      }
      headphoneNumber.addEventListener("change", () => {
        renderHeadphoneDamageList(headphoneNumber.value.trim());
      });
    } else {
      headphoneNumber.addEventListener("input", () => {
        renderHeadphoneDamageList(headphoneNumber.value.trim());
      });
    }
  }

  if (newHeadphoneDamage) {
    newHeadphoneDamage.onclick = () => {
      openModal("headphones");
    };
  }

  // --- Bouton "Aucun dégât" écouteurs ---
  if (noHeadphoneDamage){
    noHeadphoneDamage.onclick = () => {
      const num = headphoneNumber.value.trim();
      if (!num) { alert("Merci d’indiquer le numéro des écouteurs."); return; }
      // On enregistre la simple utilisation sans dégât
      pendingReports.push({ section:"headphones", desc:{ numero:num, description:"aucun dégât" }});
      syncSessionItems();
      renderPendingLists();
      // On passe à la section suivante SANS toucher à computers/headphones
      if (headphoneNumber.tagName === "SELECT") headphoneNumber.value = "";
      renderHeadphoneDamageList("");
      nextSection();
    };
  }

  // --- Section Règles ---
  const rulesAgree  = document.getElementById("rulesAgree");
  const rulesFinish = document.getElementById("rulesFinish");

  async function handlePwdSubmit(){
    if (haveRealDamage()) {
      if (pwdInput.value !== PROF_PWD) { alert("Mot de passe incorrect"); return; }
    }
    await sendReports();
  }

  function openValidationModal(){
    renderPendingLists();
    pwdModal.classList.remove("hidden");
    void touchSession({ status: "awaiting_validation" });
    updatePwdModalState();
    pwdOk.onclick = handlePwdSubmit;
    pwdCancel.onclick = () => {
      pwdModal.classList.add("hidden");
      void touchSession({ status: "in_progress" });
    };
  }

  if (rulesAgree && rulesFinish) {
    rulesAgree.onchange = () => {
      if (rulesAgree.checked) {
        rulesFinish.classList.remove("hidden");
      } else {
        rulesFinish.classList.add("hidden");
      }
    };
    rulesFinish.onclick = async () => {
      // Si des dégâts ont été signalés (pendingReports contient autre chose que "none"),
      // on affiche la validation prof (mot de passe). Sinon on envoie directement.
      if (haveRealDamage()) {
        openValidationModal();
      } else {
        await sendReports();
      }
    };
  }

  let current = 0;

  // -------- Barre de progression --------
  const progressBar = document.createElement("div");
  progressBar.style.position = "fixed";
  progressBar.style.top = "0";
  progressBar.style.left = "0";
  progressBar.style.height = "8px";
  progressBar.style.width = "100%";
  progressBar.style.background = "#e0e0e0";
  progressBar.style.zIndex = "9999";
  const fillBar = document.createElement("div");
  fillBar.style.height = "100%";
  fillBar.style.width = "0%";
  fillBar.style.background = "linear-gradient(90deg, #0077ff, #00e0ff)";
  fillBar.style.transition = "width 0.3s";
  progressBar.appendChild(fillBar);
  document.body.appendChild(progressBar);

  function updateProgressBar() {
    let percent = Math.round((current+1)/sections.length*100);
    fillBar.style.width = percent + "%";
  }
  // Appelle updateProgressBar à chaque changement de section
  function show(i){
    sections.forEach((s,idx)=>s.classList.toggle("hidden",idx!==i));
    updateProgressBar();
    const stepKey = sections[i]?.id ? sections[i].id.replace("section-", "") : "";
    if (stepKey) {
      void touchSession({ step: stepKey });
    }
    attachPendingPanel(sections[i]);
    renderPendingLists();
    if (sections[i].id === "section-headphones") {
      headphoneRadios.forEach(r => r.checked = false);
      headphoneDetails.classList.add("hidden");
      headphoneNumber.value = "";
      if (btnNoHeadphone) btnNoHeadphone.classList.add("hidden");
      if (noHeadphoneDamage) noHeadphoneDamage.classList.remove("hidden");
    }
    if (sections[i].id === "section-rules" && rulesAgree && rulesFinish){
      rulesAgree.checked = false;
      rulesFinish.classList.add("hidden");
    }
  }
  show(current);

  const welcomeBtn = document.getElementById("welcomeStart");
  if (welcomeBtn) {
    welcomeBtn.onclick = () => {
      current = 1;
      show(current);
    };
  }

  document.body.addEventListener("click", e=>{
    /* avancer / reculer entre sections */
    if (e.target.dataset.back !== undefined){
      previousSection();
      return;
    }
    const sec = e.target.dataset.sec;
    if (!sec) return;

    if ("nothing" in e.target.dataset){
        nextSection();
    }

    if ("new" in e.target.dataset){
        openModal(sec);
    }
  });

  /* ------ Modale nouveau dégât ------ */
  function openModal(sec, editIndex = null){
    const isEdit = Number.isInteger(editIndex);
    const existingItem = isEdit ? pendingReports[editIndex] : null;
    if (isEdit && !existingItem) return;
    const existingText = existingItem ? extractReportText(sec, existingItem.desc) : "";
    document.getElementById("modal-title").textContent =
        `${isEdit ? "Modifier" : "Nouveau"} dégât – ${label(sec)}`;
    document.getElementById("damageDesc").value = existingText;
    modal.classList.remove("hidden");

    saveBtn.onclick = async () => {
        const txt = document.getElementById("damageDesc").value.trim();
        if(!txt) return;
        if (sec === "headphones") {
          const existingNum = existingItem && typeof existingItem.desc === "object"
            ? String(existingItem.desc.numero ?? "").trim()
            : "";
          const num = existingNum || (headphoneNumber ? headphoneNumber.value.trim() : "");
          if (!num) { alert("Merci d'indiquer le numéro de la paire d'écouteurs."); return; }
          const hpObj = { numero: num, description: txt };
          if (isEdit) {
            pendingReports[editIndex] = { section: sec, desc: hpObj };
          } else {
            pendingReports.push({ section: sec, desc: hpObj });
          }
        } else if (isEdit) {
          pendingReports[editIndex].desc = txt;
        } else {
          pendingReports.push({ section:sec, desc:txt });
        }
        syncSessionItems();
        renderPendingLists();
        closeModal();
        if (!isEdit) nextSection();
    };
    cancelBtn.onclick = closeModal;
  }
  function closeModal(){ modal.classList.add("hidden"); }

  /* ------ Suite des sections ou envoi final ------ */
  async function nextSection(){
    current++;
    if (current < sections.length){
      show(current);
    } else {
        if (haveRealDamage()){
            // afficher la modale prof
            openValidationModal();
        } else {
            await sendReports();
        }
    }
  }

  function buildComputerUpdates(items){
    const allowed = new Set(["keyboard","mouse","screen","headphones","other"]);
    const updates = {};
    const seen = new Set();
    (Array.isArray(items) ? items : []).forEach(item => {
      const section = item?.section;
      if (!allowed.has(section)) return;
      const desc = item?.desc;
      if (section === "headphones" && isNoHeadphoneDamage(desc)) return;
      const key = reportItemKey(section, desc);
      if (!key || seen.has(key)) return;
      seen.add(key);
      if (section === "headphones") {
        const numero = desc && typeof desc === "object" ? String(desc.numero ?? "").trim() : "";
        const description = extractReportText(section, desc);
        if (!numero || !description) return;
        if (!updates.headphones) updates.headphones = [];
        updates.headphones.push({ numero, description });
      } else {
        const text = extractReportText(section, desc);
        if (!text) return;
        if (!updates[section]) updates[section] = [];
        updates[section].push(text);
      }
    });

    const fieldUpdates = {};
    Object.entries(updates).forEach(([section, values]) => {
      if (values.length) fieldUpdates[section] = arrayUnion(...values);
    });
    return fieldUpdates;
  }

  async function sendReports(){
      // Marquer immédiatement la soumission pour désactiver beforeunload
      isSubmitted = true;
      window.removeEventListener("beforeunload", blockUnload);
      window.onbeforeunload = null;               // supprime tout handler résiduel

      if (pendingReports.length === 0){
          // Ajoute un enregistrement unique contenant date & heure pour conserver chaque connexion
          const now    = new Date();
          const stamp  = now.toLocaleString("fr-CH", { hour: "2-digit", minute: "2-digit", second:"2-digit" });
          const day    = now.toLocaleDateString("fr-CH");
          pendingReports.push({
              section: "none",
              desc   : `${day} ${stamp}`   // ex. 24.5.2025 14:07:32
          });
      }
      const batch = writeBatch(db);
      const reportRef = doc(collection(db,"reports"));
      batch.set(reportRef, {
        pcId, user:userId, when: serverTimestamp(), items: pendingReports, resolved:false
      });
      const pcUpdates = buildComputerUpdates(pendingReports);
      if (Object.keys(pcUpdates).length) {
        batch.update(pcRef, pcUpdates);
      }
      if (sessionRef) {
        const sessionItems = sanitizeSessionItems(pendingReports);
        batch.update(sessionRef, {
          status: "validated",
          validatedAt: serverTimestamp(),
          lastSeen: serverTimestamp(),
          items: sessionItems,
          hasRealDamage: haveRealDamage()
        });
      }
      await batch.commit();
      isSubmitted = true;
      window.removeEventListener("beforeunload", blockUnload);
      window.onbeforeunload = null;               // supprime tout handler résiduel
      alert("Merci ! Tu peux fermer cette fenêtre.");
      window.close();
  }

  function previousSection(){
    if (current>0){
      current--;
      show(current);

    }
  }

  function label(sec){
    return {keyboard:"Clavier",mouse:"Souris",screen:"Écran",headphones:"Écouteurs",other:"Autres"}[sec];
  }

  updateProgressBar();
