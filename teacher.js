// teacher.js
import { db } from "./firebase-config.js";
import {
  collection, query, where, onSnapshot,
  getDocs, updateDoc, doc, arrayRemove, arrayUnion, getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

async function render(){
  const pc = pcSelect.value || "01";

  // 1. Récupère la liste actuelle des dégâts NON réglés pour ce poste
  const pcSnap = await getDoc(doc(db,"computers",pc));
  const unresolved = pcSnap.exists() ? pcSnap.data() : {keyboard:[],mouse:[],screen:[],other:[]};

  // 2. Écoute les rapports pour ce poste
  const q = query(collection(db,"reports"),
          where("pcId","==",pc));
  onSnapshot(q, snap=>{
      tbody.innerHTML="";
      const shown = new Set();   // garde trace des "section|desc" déjà affichés

      // 1. lignes issues des rapports
      snap.forEach(docSnap=>{
        const d = docSnap.data();
        d.items.forEach(item=>{
          if(onlyDamages.checked && item.desc==="rien") return;

          const key = `${item.section}|${item.desc}`;
          const isUnresolved = unresolved[item.section]?.includes(item.desc);
          shown.add(key);

          const tr=document.createElement("tr");
          tr.innerHTML = `
  <td>${d.when?.toDate().toLocaleString() ?? ""}</td>
  <td>${d.user ?? ""}</td>
  <td>${label(item.section)}</td>
  <td>${item.desc}</td>
  <td>${isUnresolved ? "❌" : "✅"}</td>
  <td>
      <button data-id="${docSnap.id}"
              data-sec="${item.section}"
              data-desc="${encodeURIComponent(item.desc)}"
              data-res="${isUnresolved}">
          ${isUnresolved ? "Marquer réglé" : "Marquer non réglé"}
      </button>
  </td>`;
          tbody.appendChild(tr);
        });
      });

      // 2. lignes restantes non encore montrées (toujours non réglées)
      ["keyboard","mouse","screen","other"].forEach(sec=>{
        unresolved[sec].forEach(desc=>{
          const key = `${sec}|${desc}`;
          if (shown.has(key)) return;  // déjà ajouté via un rapport
          const tr=document.createElement("tr");
          tr.innerHTML = `
  <td></td>
  <td></td>
  <td>${label(sec)}</td>
  <td>${desc}</td>
  <td>❌</td>
  <td>
      <button data-id=""
              data-sec="${sec}"
              data-desc="${encodeURIComponent(desc)}"
              data-res="true">
          Marquer réglé
      </button>
  </td>`;
          tbody.appendChild(tr);
        });
      });
  });
}

tbody.addEventListener("click", async e=>{
  if(e.target.tagName!=="BUTTON") return;

  const id      = e.target.dataset.id;
  const section = e.target.dataset.sec;
  const desc    = decodeURIComponent(e.target.dataset.desc);
  const unresolvedNow  = e.target.dataset.res === "true";
  const pc      = pcSelect.value;

  let reportRef = null;
  if (id){
     reportRef = doc(db,"reports",id);
  }

  const pcRef = doc(db,"computers", pc);
  if (unresolvedNow){
      // marquer comme réglé → retirer du tableau
      await updateDoc(pcRef, {
        [section]: arrayRemove(desc)
      });
  } else {
      // marquer comme non réglé → réinsérer
      await updateDoc(pcRef, {
        [section]: arrayUnion(desc)
      });
  }
});

function label(sec){
  return {keyboard:"Clavier",mouse:"Souris",screen:"Écran",other:"Autres",none:"—"}[sec];
}