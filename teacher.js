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

function render(){
  const pc = pcSelect.value || "01";
  const q = query(collection(db,"reports"),
          where("pcId","==",pc));
  onSnapshot(q, snap=>{
      tbody.innerHTML="";
      snap.forEach(docSnap=>{
        const d = docSnap.data();
        d.items.forEach(item=>{
          if(onlyDamages.checked && item.desc==="rien") return;
          const tr=document.createElement("tr");
          tr.innerHTML = `
  <td>${d.when?.toDate().toLocaleString()}</td>
  <td>${d.user}</td>
  <td>${label(item.section)}</td>
  <td>${item.desc}</td>
  <td>${d.resolved ? "✅" : "❌"}</td>
  <td>
      <button data-id="${docSnap.id}"
              data-sec="${item.section}"
              data-desc="${encodeURIComponent(item.desc)}"
              data-res="${d.resolved}">
          ${d.resolved ? "Marquer non réglé" : "Marquer réglé"}
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
  const resNow  = e.target.dataset.res === "true";
  const pc      = pcSelect.value;

  const reportRef = doc(db,"reports",id);

  // toggle resolved status
  await updateDoc(reportRef,{resolved:!resNow});

  const pcRef = doc(db,"computers", pc);
  if (!resNow){
      // we are marking as resolved → retirer du tableau
      await updateDoc(pcRef, {
        [section]: arrayRemove(desc)
      });
  }else{
      // on remet en non-réglé → réinsérer si absent
      await updateDoc(pcRef, {
        [section]: arrayUnion(desc)
      });
  }
});

function label(sec){
  return {keyboard:"Clavier",mouse:"Souris",screen:"Écran",other:"Autres",none:"—"}[sec];
}