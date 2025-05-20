// student.js
import { db } from "./firebase-config.js";
import {
  doc, getDoc, setDoc, updateDoc, arrayUnion, addDoc, collection, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/* ------ Paramètres URL ------ */
const params = new URLSearchParams(location.search);
const pcId   = params.get("pc");
const userId = params.get("user");

document.getElementById("pcId").textContent   = pcId;
document.getElementById("userId").textContent = userId;

/* ------ Récupérer dégâts non résolus ------ */
const pcRef = doc(db, "computers", pcId);
const pcSnap = await getDoc(pcRef);
if (!pcSnap.exists()) {
  // crée le doc vide si besoin
  await setDoc(pcRef, { keyboard: [], mouse: [], screen: [], other: [] });
}

const data = (await getDoc(pcRef)).data();
["keyboard","mouse","screen","other"].forEach(sec=>{
  const ul = document.getElementById(`list-${sec}`);
  data[sec].forEach(d => {
    const li = document.createElement("li"); li.textContent = d; ul.appendChild(li);
  });
});

/* ------ Navigation de section ------ */
let current = 0;
const sections = Array.from(document.querySelectorAll(".section"));
function show(i){
  sections.forEach((s,idx)=>s.classList.toggle("hidden",idx!==i));
}
show(current);

/* ------ Gestion des boutons ------ */
let pendingReports = [];   // on stocke avant d'envoyer tout d'un coup

document.body.addEventListener("click", e=>{
  const sec = e.target.dataset.sec;
  if (!sec) return;

  /* Rien à signaler */
  if ("nothing" in e.target.dataset){
      nextSection();
  }

  /* Nouveau dégât */
  if ("new" in e.target.dataset){
      openModal(sec);
  }
});

/* ------ Modale nouveau dégât ------ */
function openModal(sec){
  document.getElementById("modal-title").textContent =
      `Nouveau dégât – ${label(sec)}`;
  document.getElementById("damageDesc").value = "";
  modal.classList.remove("hidden");

  save.onclick = async ()=>{
      const txt = document.getElementById("damageDesc").value.trim();
      if(!txt) return;
      pendingReports.push({ section:sec, desc:txt });
      // ajoute sur l'écran pour l'élève suivant
      await updateDoc(pcRef, { [sec]: arrayUnion(txt) });
      closeModal();
      nextSection();
  };
  cancel.onclick = closeModal;
}
function closeModal(){ modal.classList.add("hidden"); }

/* ------ Suite des sections ou envoi final ------ */
async function nextSection(){
  current++;
  if (current < sections.length){
    show(current);
  }else{
    // envoyer tous les rapports
    if (pendingReports.length===0){
        pendingReports.push({section:"none", desc:"rien"});
    }
    await addDoc(collection(db,"reports"), {
      pcId, user:userId, when: serverTimestamp(), items: pendingReports, resolved:false
    });
    alert("Merci ! Tu peux fermer cette fenêtre.");
    window.close();   // Safari fermera si autorisé
  }
}

function label(sec){
  return {keyboard:"Clavier",mouse:"Souris",screen:"Écran",other:"Autres"}[sec];
}