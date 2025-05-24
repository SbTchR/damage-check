// teacher.js
import { db } from "./firebase-config.js";
import {
  collection, query, where, onSnapshot,
  getDocs, updateDoc, doc, arrayRemove, arrayUnion, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentPC   = "01";
let unresolved  = {keyboard:[],mouse:[],screen:[],other:[]};
let reportCache = []; // array of {when,user,items}
let unsubReports = null;
let unsubUnres   = null;
let onlyUnresToggle = null;

// Helper to detect headphone damage objects
function isHeadphoneDamage(val) { 
  return val && typeof val === "object" && ("description" in val) && ("numero" in val); 
}

// Helper to compare headphone damage objects by description and number
function headphoneDamageEquals(a, b) {
  if (!isHeadphoneDamage(a) || !isHeadphoneDamage(b)) return false;
  return a.description === b.description && a.numero === b.numero;
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
          unresolved = {keyboard:[],mouse:[],screen:[],other:[]};
      }
      drawTable();
  });

  // 2) listen to related reports
  const q = query(collection(db,"reports"), where("pcId","==",pc));
  unsubReports = onSnapshot(q,(snap)=>{
      reportCache = [];
      snap.forEach(ds=> reportCache.push(ds.data()));
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
          <button data-sec="${item.section}"
                  data-desc="${encodeURIComponent(JSON.stringify(item.desc))}"
                  data-res="${isUnres}">
            ${isUnres ? "Marquer réglé" : "Marquer non réglé"}
          </button>
        </td>`;
      tbody.appendChild(tr);
    });
  });
}

tbody.addEventListener("click", async ev=>{
  if(ev.target.tagName !== "BUTTON") return;
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
        latest[pc][key] = { when, section: item.section, desc: item.desc };
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
          isUnres = false; // We don't have regle info for primitives here
        }
        const key = `${sec}|${typeof desc === "object" ? JSON.stringify(desc) : desc}`;
        const found = latest[pcId]?.[key];
        const when = found ? found.when : new Date(0);
        const whenStr = found ? found.when.toLocaleString() : "";
        rows.push({
          pcId,
          sec,
          desc,
          descText,
          isUnres,
          when,
          whenStr,
        });
      });
    });
  });

  // 2. Trier les dégâts du plus récent au plus ancien
  rows.sort((a, b) => b.when - a.when);

  // 3. Afficher
  rows.forEach(({pcId, sec, desc, descText, isUnres, whenStr}) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${pcId}</td>
      <td>${whenStr}</td>
      <td>${label(sec)}</td>
      <td>${descText}</td>
      <td>${isUnres ? "❌" : "✅"}</td>
      <td>
        <button data-pc="${pcId}" data-sec="${sec}" data-desc="${encodeURIComponent(JSON.stringify(desc))}">
          Marquer réglé
        </button>
      </td>`;
    globalTbody.appendChild(tr);
  });

}

document.getElementById("globalTbody").addEventListener("click", async ev => {
  if (ev.target.tagName !== "BUTTON") return;
  const pc = ev.target.dataset.pc;
  const section = ev.target.dataset.sec;
  const descRaw = decodeURIComponent(ev.target.dataset.desc);
  let desc;
  try {
    desc = JSON.parse(descRaw);
  } catch {
    desc = descRaw;
  }
  if (!window.confirm("Confirmer le marquage comme réglé ?")) return;
  const pcRef = doc(db, "computers", pc);

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