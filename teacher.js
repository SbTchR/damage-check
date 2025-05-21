// teacher.js
import { db } from "./firebase-config.js";
import {
  collection, query, where, onSnapshot,
  getDocs, updateDoc, doc, arrayRemove, arrayUnion, getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

function setTableHeader(cols) {
  // cols: tableau de textes de colonne, ex: ["PC", "Section", "Description"]
  const thead = document.querySelector("thead");
  thead.innerHTML =
    "<tr>" +
    cols.map(txt => `<th>${txt}</th>`).join("") +
    "</tr>";
}

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
  const allOpt = document.createElement("option");
  allOpt.value = "ALL";
  allOpt.textContent = "Vue d'ensemble";
  pcSelect.appendChild(allOpt);

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

  document.getElementById("onlyDamages").closest("label").style.display = (pc==="ALL" ? "none" : "");
  document.getElementById("onlyUnres").closest("label").style.display    = (pc==="ALL" ? "none" : "");

  // quick guard to avoid extra work when only filter checkboxes toggled
  if (pc === currentPC && event?.type!=="change") {
    drawTable();
    return;
  }
  currentPC = pc;

  // stop previous listeners
  if (unsubReports) { unsubReports(); unsubReports=null; }
  if (unsubUnres)   { unsubUnres();   unsubUnres=null; }

  if (pc === "ALL"){
      // écoute globale des computers
      unsubUnres = onSnapshot(collection(db,"computers"), snap=>{
         unresolvedMap = {}; // temp map pcId -> arrays
         snap.forEach(docSnap=>{
           unresolvedMap[docSnap.id]=docSnap.data();
         });
         drawOverview(unresolvedMap);
      });
      return;
  }

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
  setTableHeader(["Date", "Élève", "Section", "Description", "Statut", "Action"]);
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

function drawOverview(unresMap){
  setTableHeader(["PC", "Section", "Description"]);
  tbody.innerHTML = "";
  Object.entries(unresMap).forEach(([pcId, data])=>{
    ["keyboard","mouse","screen","other"].forEach(sec=>{
      data[sec].forEach(desc=>{
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${pcId}</td>
          <td>${label(sec)}</td>
          <td>${desc}</td>`;
        tbody.appendChild(tr);
      });
    });
  });
}

tbody.addEventListener("click", async ev=>{
  if (currentPC==="ALL") return;
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