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
  render();
}

function render(){
  const pc = pcSelect.value || "01";
  if (pc === currentPC) return;
  currentPC = pc;

  // stop previous listeners
  if (unsubReports) unsubReports();
  if (unsubUnres)   unsubUnres();

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

function drawTable(){
  tbody.innerHTML = "";

  const added = new Set();

  // helper to push a row
  const pushRow = (sec, desc, whenStr, userStr, isUnres) =>{
    const key = `${sec}|${desc}`;
    if (added.has(key)) return;
    added.add(key);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${whenStr}</td>
      <td>${userStr}</td>
      <td>${label(sec)}</td>
      <td>${desc}</td>
      <td>${isUnres ? "❌" : "✅"}</td>
      <td>
        <button data-sec="${sec}"
                data-desc="${encodeURIComponent(desc)}"
                data-res="${isUnres}">
          ${isUnres ? "Marquer réglé" : "Marquer non réglé"}
        </button>
      </td>`;
    tbody.appendChild(tr);
  };

  // A) unresolved arrays
  ["keyboard","mouse","screen","other"].forEach(sec=>{
    unresolved[sec].forEach(desc=>{
      pushRow(sec, desc, "", "", true);
    });
  });

  // B) reports cache
  reportCache.forEach(r=>{
    const whenStr = r.when ? new Date(r.when.seconds*1000).toLocaleString() : "";
    const userStr = r.user ?? "";
    r.items.forEach(item=>{
      if(onlyDamages.checked && item.desc==="rien") return;
      const isUnres = unresolved[item.section]?.includes(item.desc);
      pushRow(item.section, item.desc, whenStr, userStr, isUnres);
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