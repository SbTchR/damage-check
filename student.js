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
const PROF_PWD  = "Patefacite";

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
function openModal(sec){
  document.getElementById("modal-title").textContent =
      `Nouveau dégât – ${label(sec)}`;
  document.getElementById("damageDesc").value = "";
  modal.classList.remove("hidden");

  saveBtn.onclick = async () => {
      const txt = document.getElementById("damageDesc").value.trim();
      if(!txt) return;
      pendingReports.push({ section:sec, desc:txt });
      await updateDoc(pcRef, { [sec]: arrayUnion(txt) });
      closeModal();
      nextSection();
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
      if (pendingReports.length && !(pendingReports.length===1 && pendingReports[0].section==="none")){
          // afficher la modale prof
          newList.innerHTML = "";
          pendingReports.forEach(r=>{
              const li=document.createElement("li");
              li.textContent = `${label(r.section)} : ${r.desc}`;
              newList.appendChild(li);
          });
          pwdModal.classList.remove("hidden");
          pwdOk.onclick = async ()=>{
              if (pwdInput.value!==PROF_PWD){ alert("Mot de passe incorrect"); return; }
              await sendReports();
          };
          pwdCancel.onclick = ()=>{ pwdModal.classList.add("hidden"); };
      } else {
          await sendReports();
      }
  }
}

async function sendReports(){
    if (pendingReports.length === 0){
        pendingReports.push({section:"none", desc:"rien"});
    }
    await addDoc(collection(db,"reports"), {
      pcId, user:userId, when: serverTimestamp(), items: pendingReports, resolved:false
    });
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
  return {keyboard:"Clavier",mouse:"Souris",screen:"Écran",other:"Autres"}[sec];
}