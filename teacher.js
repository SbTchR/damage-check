// teacher.js
import { db } from "./firebase-config.js";
import {
  collection, query, where, onSnapshot, orderBy,
  getDocs, updateDoc, doc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const PASSWORD = "Patefacite";           // change-le si tu veux

login.onclick = ()=>{
  if (pwd.value===PASSWORD){
    document.getElementById("dash").classList.remove("hidden");
    initDashboard();
  }else{
    alert("Mot de passe incorrect");
  }
};

async function initDashboard(){
  /* Remplir la liste des PC */
  const pcs = await getDocs(collection(db,"computers"));
  pcs.forEach(snapshot=>{
    const opt=document.createElement("option");
    opt.value=snapshot.id; opt.textContent=snapshot.id;
    pcSelect.appendChild(opt);
  });
  pcSelect.onchange = render;
  onlyDamages.onchange = render;
  render();
}

function render(){
  const pc = pcSelect.value || "01";
  const q = query(collection(db,"reports"),
          where("pcId","==",pc),
          orderBy("when","desc"));
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
            <td>${d.resolved?"✅":"❌"}</td>
            <td><button data-id="${docSnap.id}" ${d.resolved?"disabled":""}>Réglé</button></td>`;
          tbody.appendChild(tr);
        });
      });
  });
}

tbody.addEventListener("click", async e=>{
  if(e.target.tagName!=="BUTTON") return;
  const id = e.target.dataset.id;
  await updateDoc(doc(db,"reports",id),{resolved:true});
});

function label(sec){
  return {keyboard:"Clavier",mouse:"Souris",screen:"Écran",other:"Autres",none:"—"}[sec];
}