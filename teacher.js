// teacher.js
import { db } from "./firebase-config.js";
import {
  collection, query, where, onSnapshot,
  getDocs, updateDoc, doc, arrayRemove, arrayUnion, getDoc,
  setDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


// Headphones view elements
const tabHeadphones      = document.getElementById("tabHeadphones");
const headphoneView      = document.getElementById("headphoneView");
const filterHeadphone    = document.getElementById("filterHeadphone");
const filterHeadphoneBtn = document.getElementById("filterHeadphoneBtn");
const headphoneTbody     = document.getElementById("headphoneTbody");

// Main view elements and tab handling
const dash = document.getElementById("dash");
const globalView = document.getElementById("globalView");
const tabPc = document.getElementById("tabPc");
const tabGlobal = document.getElementById("tabGlobal");

function showPcView() {
  dash.style.display = "";
  globalView.style.display = "none";
  headphoneView.style.display = "none";
  window.location.hash = "";
}
function showGlobalViewTab() {
  dash.style.display = "none";
  globalView.style.display = "";
  headphoneView.style.display = "none";
  window.location.hash = "#global";
  if (window.showGlobalView) window.showGlobalView();
}

// Wire up the main tabs
tabPc.onclick = showPcView;
tabGlobal.onclick = showGlobalViewTab;
tabHeadphones.onclick = showHeadphonesView;

let currentPC   = "01";
let unresolved  = {keyboard:[],mouse:[],screen:[],headphones:[],other:[]};
let reportCache = []; // array of {when,user,items}
let unsubReports = null;
let unsubUnres   = null;
let onlyUnresToggle = null;

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
  /* Remplir la liste des PC */
  const pcs = await getDocs(collection(db,"computers"));
  pcs.forEach(snapshot=>{
    const opt=document.createElement("option");
    opt.value=snapshot.id; opt.textContent=snapshot.id;
    pcSelect.appendChild(opt);
  });

  if (!pcSelect.value && pcSelect.options.length){
    pcSelect.value = pcSelect.options[0].value;
  }
  pcSelect.onchange = render;
  onlyDamages.onchange = render;
  onlyUnresToggle = document.getElementById("onlyUnres"); // peut être null au début
  if (onlyUnresToggle) onlyUnresToggle.onchange = render;
  render();
}

function render(){
  const pc = pcSelect.value || "01";

  // quick guard to avoid extra work when only filter checkboxes toggled
  if (pc === currentPC && event?.type!=="change") {
    drawTable();
    return;
  }
  currentPC = pc;

  // stop previous listeners
  if (unsubReports) { unsubReports(); unsubReports=null; }
  if (unsubUnres)   { unsubUnres();   unsubUnres=null; }

  // 1) listen to unresolved list
  unsubUnres = onSnapshot(doc(db,"computers",pc),(snap)=>{
      if (snap.exists()){
          unresolved = snap.data();
      } else {
          unresolved = {keyboard:[],mouse:[],screen:[],headphones:[],other:[]};
      }
      drawTable();
  });

  // 2) listen to related reports
  const q = query(collection(db,"reports"), where("pcId","==",pc));
  unsubReports = onSnapshot(q,(snap)=>{
      reportCache = [];
      snap.forEach(ds=>{
        const d = ds.data();
        d._id = ds.id;           // keep the doc id for later deletion
        reportCache.push(d);
      });
      reportCache.sort((a,b)=> b.when?.seconds - a.when?.seconds);
      drawTable();
  });
}

function drawTable() {
  tbody.innerHTML = "";
  const shown = new Set();                 // pour éviter les doublons

  reportCache.forEach(r => {               // ← déjà trié du plus récent au plus ancien
    const whenStr = r.when
        ? new Date(r.when.seconds * 1000).toLocaleString()
        : "";
    const userStr = r.user ?? "";

    r.items.forEach(item => {
      // Determine description text and status
      let descText = "";
      let isUnres = false;
      if (isHeadphoneDamage(item.desc)) {
        descText = `#${item.desc.numero} - ${item.desc.description ?? item.desc.desc ?? ""}`;
        isUnres = (unresolved["headphones"] || []).some(d => headphoneDamageEquals(d, item.desc));
      } else if (typeof item.desc === "object") {
        // fallback: if object but not headphone damage, try description or toString
        descText = item.desc.description ?? item.desc.desc ?? JSON.stringify(item.desc);
        isUnres = true; // assume unresolved if no regle property
      } else {
        descText = item.desc;
        isUnres = unresolved[item.section]?.includes(item.desc);
      }

      if (onlyDamages.checked && descText === "rien") return;

      const key = `${item.section}|${typeof item.desc === "object" ? JSON.stringify(item.desc) : item.desc}`;
      const repId = r._id;
      if (shown.has(key)) return;          // un seul affichage par dégât
      shown.add(key);

      if (onlyUnresToggle?.checked && !isUnres) return;   // filtre « non réglés »

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${whenStr}</td>
        <td>${userStr}</td>
        <td>${label(item.section)}</td>
        <td>${descText}</td>
        <td>${isUnres ? "❌" : "✅"}</td>
        <td>
          <button data-action="toggle"
                  data-rep="${repId}"
                  data-sec="${item.section}"
                  data-desc="${encodeURIComponent(JSON.stringify(item.desc))}"
                  data-res="${isUnres}">
            ${isUnres ? "Marquer réglé" : "Marquer non réglé"}
          </button>
          <button data-action="delete"
                  data-rep="${repId}"
                  data-sec="${item.section}"
                  data-desc="${encodeURIComponent(JSON.stringify(item.desc))}">
            Supprimer
          </button>
        </td>`;
      tbody.appendChild(tr);
    });
  });
}

tbody.addEventListener("click", async ev=>{
  if(ev.target.tagName !== "BUTTON") return;
  const action  = ev.target.dataset.action || "toggle";
  const section = ev.target.dataset.sec;
  const descRaw = decodeURIComponent(ev.target.dataset.desc);
  let desc;
  try {
    desc = JSON.parse(descRaw);
  } catch {
    desc = descRaw;
  }
  const unresolvedNow = ev.target.dataset.res === "true";
  const pcRef = doc(db,"computers", currentPC);

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
    const repId = ev.target.dataset.rep;
    if (repId){
      await removeFromReport(repId, section, desc);
    }
    ev.target.closest("tr")?.remove();
    if (globalTbody) showGlobalView();
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
});

function label(sec){
  return {keyboard:"Clavier",mouse:"Souris",screen:"Écran",headphones:"Écouteurs",other:"Autres",none:"—"}[sec] || sec;
}

// ----- VUE D'ENSEMBLE -----
async function showGlobalView() {
  const globalTbody = document.getElementById("globalTbody");
  const globalThead = document.querySelector("#globalView thead");
  globalTbody.innerHTML = "";
  globalThead.innerHTML =
    "<tr><th>PC</th><th>Date</th><th>Type</th><th>Description</th><th>Statut</th><th>Action</th></tr>";
  // Récupérer tous les PC
  const pcsSnap = await getDocs(collection(db, "computers"));
  // Récupérer tous les rapports récents
  const reportsSnap = await getDocs(collection(db, "reports"));

  // Indexer tous les rapports pour trouver la date la plus récente par dégât/PC
  const latest = {}; // { pcId: { "section|desc": { when, section, desc } } }
  reportsSnap.forEach(ds => {
    const r = ds.data();
    const pc = r.pcId;
    const when = r.when ? new Date(r.when.seconds * 1000) : null;
    if (!pc || !when) return;
    if (!latest[pc]) latest[pc] = {};
    r.items.forEach(item => {
      // Ignore "rien" damage
      if ( (typeof item.desc === "string" && item.desc === "rien") ||
           (isHeadphoneDamage(item.desc) && (item.desc.description === "rien" || item.desc.desc === "rien")) ) return;
      const key = `${item.section}|${typeof item.desc === "object" ? JSON.stringify(item.desc) : item.desc}`;
      // Ne garde que la date la plus récente
      if (!latest[pc][key] || when > latest[pc][key].when) {
        latest[pc][key] = { when, section: item.section, desc: item.desc, _id: ds.id };
      }
    });
  });

  // 1. Rassembler tous les dégâts dans un tableau
  const rows = [];
  pcsSnap.forEach(pcSnap => {
    const pcId = pcSnap.id;
    const data = pcSnap.data() ?? {};
    ["keyboard", "mouse", "screen", "headphones", "other"].forEach(sec => {
      const arr = Array.isArray(data[sec]) ? data[sec] : [];
      arr.forEach(desc => {
        // Determine description text and unresolved status
        let descText = "";
        let isUnres = false;
        if (sec === "headphones" && isHeadphoneDamage(desc)) {
          descText = `#${desc.numero} - ${desc.description ?? desc.desc ?? ""}`;
          isUnres = (Array.isArray(data["headphones"]) ? data["headphones"] : []).some(d => headphoneDamageEquals(d, desc));
        } else if (typeof desc === "object") {
          descText = desc.description ?? desc.desc ?? JSON.stringify(desc);
          isUnres = true;
        } else {
          descText = desc;
          isUnres = true; // toujours non réglé pour la vue d'ensemble
        }
        const key = `${sec}|${typeof desc === "object" ? JSON.stringify(desc) : desc}`;
        const found = latest[pcId]?.[key];
        const when = found ? found.when : new Date(0);
        const whenStr = found ? found.when.toLocaleString() : "";
        const repId = found? found._id : null;
        rows.push({
          pcId,
          sec,
          desc,
          descText,
          isUnres,
          when,
          whenStr,
          repId,
        });
      });
    });
  });

  // 2. Trier les dégâts du plus récent au plus ancien
  rows.sort((a, b) => b.when - a.when);

  // 3. Afficher
  rows.forEach(({pcId, sec, desc, descText, isUnres, whenStr, repId}) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${pcId}</td>
      <td>${whenStr}</td>
      <td>${label(sec)}</td>
      <td>${descText}</td>
      <td>${isUnres ? "❌" : "✅"}</td>
      <td>
        <button data-action="toggle"
                data-pc="${pcId}" data-rep="${repId}" data-sec="${sec}" data-desc="${encodeURIComponent(JSON.stringify(desc))}">
          Marquer réglé
        </button>
        <button data-action="delete"
                data-pc="${pcId}" data-rep="${repId}" data-sec="${sec}" data-desc="${encodeURIComponent(JSON.stringify(desc))}">
          Supprimer
        </button>
      </td>`;
    globalTbody.appendChild(tr);
  });

}

// ----- VUE ÉCOUTEURS -----
async function showHeadphonesView() {
  // Hide other views
  dash.style.display       = "none";
  globalView.style.display = "none";
  headphoneView.style.display = "";

  window.location.hash = "#headphones";

  // Populate headphones table
  headphoneTbody.innerHTML = "";
  const seen = new Set();
  const reportsSnap = await getDocs(collection(db, "reports"));
  reportsSnap.forEach(ds => {
    const rep = ds.data();
    const items = Array.isArray(rep.items) ? rep.items : [];
    items.forEach(item => {
      if (item.section === "headphones") {
        let descObj = item.desc;
        if (typeof descObj === "string") {
          try { descObj = JSON.parse(descObj); } catch {}
        }
        const key = `${descObj.numero}|${normalizeText(descObj.description)}`;
        if (seen.has(key)) return;
        seen.add(key);
        const tr = document.createElement("tr");
        tr.dataset.num = String(descObj.numero).trim();
        const whenStr = rep.when ? new Date(rep.when.seconds * 1000).toLocaleString() : "";
        tr.innerHTML = `
          <td>${rep.pcId || ""}</td>
          <td>${whenStr}</td>
          <td>${rep.user || ""}</td>
          <td>${descObj.numero}</td>
          <td>${descObj.description}</td>
        `;
        headphoneTbody.appendChild(tr);
      }
    });
  });
}

// Filter functionality for headphones
filterHeadphoneBtn.onclick = () => {
  const filter = filterHeadphone.value.trim();
  Array.from(headphoneTbody.children).forEach(tr => {
    tr.style.display = (!filter || tr.dataset.num.includes(filter)) ? "" : "none";
  });
};

document.getElementById("globalTbody").addEventListener("click", async ev => {
  if (ev.target.tagName !== "BUTTON") return;
  const action  = ev.target.dataset.action || "toggle";
  const pc = ev.target.dataset.pc;
  const section = ev.target.dataset.sec;
  const descRaw = decodeURIComponent(ev.target.dataset.desc);
  let desc;
  try {
    desc = JSON.parse(descRaw);
  } catch {
    desc = descRaw;
  }
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
    const repId = ev.target.dataset.rep;
    if (repId){
      await removeFromReport(repId, section, desc);
    } else {
      // fallback : chercher tous les reports de ce PC et enlever l’item correspondant
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
          break; // found and fixed
        }
      }
    }
    ev.target.closest("tr")?.remove();
    if (globalTbody) showGlobalView();
    return; // done
  }
  if (!window.confirm("Confirmer le marquage comme réglé ?")) return;

  if (section === "headphones" && isHeadphoneDamage(desc)) {
    // For headphone damage objects, remove the object from array (no regle field)
    await updateDoc(pcRef, { [section]: arrayRemove(desc) });
  } else if (isHeadphoneDamage(desc)) {
    // For headphone damage objects, update regle to true
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
    // For primitive desc, remove from unresolved array
    await updateDoc(pcRef, { [section]: arrayRemove(desc) });
  }
  showGlobalView();
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