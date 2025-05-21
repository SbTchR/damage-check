// teacher.js
import { db } from "./firebase-config.js";
import {
  collection, query, where, onSnapshot,
  getDocs, updateDoc, doc, arrayRemove, arrayUnion, getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentPC   = "01";
let unresolved  = {keyboard:[],mouse:[],screen:[],other:[]};
let reportCache = []; // array of {when,user,items}
let unsubReports = null;
let unsubUnres   = null;
let onlyUnresToggle = null;

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
      if (onlyDamages.checked && item.desc === "rien") return;

      const key = `${item.section}|${item.desc}`;
      if (shown.has(key)) return;          // un seul affichage par dégât
      shown.add(key);

      const isUnres = unresolved[item.section]?.includes(item.desc);
      if (onlyUnresToggle?.checked && !isUnres) return;   // filtre « non réglés »

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${whenStr}</td>
        <td>${userStr}</td>
        <td>${label(item.section)}</td>
        <td>${item.desc}</td>
        <td>${isUnres ? "❌" : "✅"}</td>
        <td>
          <button data-sec="${item.section}"
                  data-desc="${encodeURIComponent(item.desc)}"
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
  const desc    = decodeURIComponent(ev.target.dataset.desc);
  const unresolvedNow = ev.target.dataset.res === "true";
  const pcRef = doc(db,"computers", currentPC);

  if (unresolvedNow){
      await updateDoc(pcRef, {[section]: arrayRemove(desc)});
  } else {
      await updateDoc(pcRef, {[section]: arrayUnion(desc)});
  }
});

function label(sec){
  return {keyboard:"Clavier",mouse:"Souris",screen:"Écran",other:"Autres",none:"—"}[sec];
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
      if (item.desc === "rien") return;
      const key = `${item.section}|${item.desc}`;
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
    ["keyboard", "mouse", "screen", "other"].forEach(sec => {
      const arr = Array.isArray(data[sec]) ? data[sec] : [];
      arr.forEach(desc => {
        const key = `${sec}|${desc}`;
        const found = latest[pcId]?.[key];
        const when = found ? found.when : new Date(0);
        rows.push({
          pcId,
          sec,
          desc,
          when, // objet Date
          whenStr: found ? found.when.toLocaleString() : "",
        });
      });
    });
  });

  // 2. Trier les dégâts du plus récent au plus ancien
  rows.sort((a, b) => b.when - a.when);

  // 3. Afficher
  rows.forEach(({pcId, sec, desc, whenStr}) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${pcId}</td>
      <td>${whenStr}</td>
      <td>${label(sec)}</td>
      <td>${desc}</td>
      <td>❌</td>
      <td>
        <button data-pc="${pcId}" data-sec="${sec}" data-desc="${encodeURIComponent(desc)}">
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
  const desc = decodeURIComponent(ev.target.dataset.desc);
  if (!window.confirm("Confirmer le marquage comme réglé ?")) return;
  const pcRef = doc(db, "computers", pc);
  await updateDoc(pcRef, { [section]: arrayRemove(desc) });
  showGlobalView();
});

// Expose la fonction globalement pour l'utiliser via des attributs HTML
window.showGlobalView = showGlobalView;