// Empêche la fermeture de la fenêtre tant que le formulaire n'a pas été envoyé, actif dès la première interaction
let isSubmitted = false;
let userHasInteracted = false;
function activateBeforeUnload() {
  if (!userHasInteracted) {
    userHasInteracted = true;
    window.addEventListener("beforeunload", blockUnload);
  }
}
function blockUnload(e) {
  if (!isSubmitted) {
    e.preventDefault();
    e.returnValue = "";
    return "";
  }
}

// Active la protection seulement à l'affichage de la première vraie section
// show(0) est déjà appelé plus bas, donc on ajoute les activateurs ici
// (évite attachement multiple des listeners)
// (voir plus bas pour show(0))
// Ces listeners ne seront activés qu'une fois à la première interaction
window.addEventListener("keydown", activateBeforeUnload, { once: true });
window.addEventListener("mousedown", activateBeforeUnload, { once: true });
window.addEventListener("touchstart", activateBeforeUnload, { once: true });

// Change le titre si l'élève essaie d'aller ailleurs
window.onblur = function() {
  document.title = "⚠️ Reviens sur le formulaire !";
};
window.onfocus = function() {
  document.title = "Questionnaire de dégâts";
};
// student.js
import { db } from "./firebase-config.js";
import {
  doc, getDoc, setDoc, updateDoc, arrayUnion, addDoc, collection, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const attentionEmojis = ["⚠️","🚨","❗","👀","📍","🔎","🛑","💥","✨","🔧"];
function randomAttentionEmoji(){
  return attentionEmojis[Math.floor(Math.random()*attentionEmojis.length)];
}

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
const PROF_PWD  = "0dga";

/* ------ Récupérer dégâts non résolus ------ */
const pcRef = doc(db, "computers", pcId);
const pcSnap = await getDoc(pcRef);
if (!pcSnap.exists()) {
  // crée le doc vide si besoin
  await setDoc(pcRef, { keyboard: [], mouse: [], screen: [], other: [], headphones: [] });
}

const data = (await getDoc(pcRef)).data();
["keyboard","mouse","screen","headphones","other"].forEach(sec=>{
  const ul = document.getElementById(`list-${sec}`);
  if (!ul || !data[sec]) return;
  data[sec].forEach(d => {
    const li = document.createElement("li");
    const wrapper = document.createElement("span");
    const bullet = document.createElement("span");
    bullet.className = "damage-bullet";
    bullet.textContent = randomAttentionEmoji();
    const textSpan = document.createElement("span");

    if (sec === "headphones" && typeof d === "object" && d !== null) {
      const label = d.description || d.desc || "";
      textSpan.textContent = `N°${d.numero || "?"} : ${label}`;
    } else if (typeof d === "object" && d !== null) {
      textSpan.textContent = d.text || d.description || d.desc || JSON.stringify(d);
    } else {
      textSpan.textContent = d;
    }

    wrapper.appendChild(bullet);
    wrapper.appendChild(textSpan);
    li.appendChild(wrapper);
    ul.appendChild(li);
  });
});

/* ------ Gestion des boutons ------ */
let pendingReports = [];   // on stocke avant d'envoyer tout d'un coup

function haveRealDamage(){
  return pendingReports.some(r=>{
    if (r.section === "none") return false;
    if (r.section === "headphones"){
      // objet {numero, description:"aucun dégât"} OU string "aucun dégât"
      if (typeof r.desc === "object"){
        return (r.desc.description || "").toLowerCase().indexOf("aucun dégât") === -1;
      }
      return (r.desc || "").toLowerCase().indexOf("aucun dégât") === -1;
    }
    return true;          // tout autre section = vrai dégât
  });
}


  /* ------ Navigation de section ------ */

  const sections = [
    document.getElementById('section-welcome'),
    document.getElementById('section-keyboard'),
    document.getElementById('section-mouse'),
    document.getElementById('section-screen'),
    document.getElementById('section-headphones'),
    document.getElementById('section-other'),
    document.getElementById('section-rules')       // nouvelle étape
  ];

  // --- Gestion écouteurs
  const headphoneRadios = document.getElementsByName("headphoneUse");
  const headphoneDetails = document.getElementById("headphone-details");
  const headphoneNumber = document.getElementById("headphoneNumber");
  const newHeadphoneDamage = document.getElementById("newHeadphoneDamage");
  const btnNoHeadphone = document.getElementById("btnNoHeadphone");
  const noHeadphoneDamage = document.getElementById("noHeadphoneDamage");

  if (headphoneRadios && headphoneDetails && btnNoHeadphone) {
    headphoneRadios.forEach(radio => {
      radio.onchange = () => {
        if (radio.value === "oui" && radio.checked) {
          headphoneDetails.classList.remove("hidden");
          btnNoHeadphone.classList.add("hidden");
        } else if (radio.value === "non" && radio.checked) {
          headphoneDetails.classList.add("hidden");
          btnNoHeadphone.classList.remove("hidden");
        }
      };
    });
    btnNoHeadphone.onclick = nextSection;
  }

  if (newHeadphoneDamage) {
    newHeadphoneDamage.onclick = () => {
      openModal("headphones");
    };
  }

  // --- Bouton "Aucun dégât" écouteurs ---
  if (noHeadphoneDamage){
    noHeadphoneDamage.onclick = () => {
      const num = headphoneNumber.value.trim();
      if (!num) { alert("Merci d’indiquer le numéro des écouteurs."); return; }
      // On enregistre la simple utilisation sans dégât
      pendingReports.push({ section:"headphones", desc:{ numero:num, description:"aucun dégât" }});
      // On passe à la section suivante SANS toucher à computers/headphones
      nextSection();
    };
  }

  // --- Section Règles ---
  const rulesAgree  = document.getElementById("rulesAgree");
  const rulesFinish = document.getElementById("rulesFinish");

  if (rulesAgree && rulesFinish) {
    rulesAgree.onchange = () => {
      if (rulesAgree.checked) {
        rulesFinish.classList.remove("hidden");
      } else {
        rulesFinish.classList.add("hidden");
      }
    };
    rulesFinish.onclick = async () => {
      // Si des dégâts ont été signalés (pendingReports contient autre chose que "none"),
      // on affiche la validation prof (mot de passe). Sinon on envoie directement.
      if (haveRealDamage()) {
        newList.innerHTML = "";
        pendingReports.forEach(r => {
          const li = document.createElement("li");
          let txt = r.desc;
          if (r.section === "headphones" && typeof r.desc === "object") {
            txt = `N°${r.desc.numero} : ${r.desc.description}`;
          }
          li.textContent = `${label(r.section)} : ${txt}`;
          newList.appendChild(li);
        });
        pwdModal.classList.remove("hidden");
        pwdOk.onclick = async () => {
          if (pwdInput.value !== PROF_PWD) { alert("Mot de passe incorrect"); return; }
          await sendReports();
        };
        pwdCancel.onclick = () => { pwdModal.classList.add("hidden"); };
      } else {
        await sendReports();
      }
    };
  }

  let current = 0;

  // -------- Barre de progression --------
  const progressBar = document.createElement("div");
  progressBar.style.position = "fixed";
  progressBar.style.top = "0";
  progressBar.style.left = "0";
  progressBar.style.height = "8px";
  progressBar.style.width = "100%";
  progressBar.style.background = "#e0e0e0";
  progressBar.style.zIndex = "9999";
  const fillBar = document.createElement("div");
  fillBar.style.height = "100%";
  fillBar.style.width = "0%";
  fillBar.style.background = "linear-gradient(90deg, #0077ff, #00e0ff)";
  fillBar.style.transition = "width 0.3s";
  progressBar.appendChild(fillBar);
  document.body.appendChild(progressBar);

  function updateProgressBar() {
    let percent = Math.round((current+1)/sections.length*100);
    fillBar.style.width = percent + "%";
  }
  // Appelle updateProgressBar à chaque changement de section
  function show(i){
    sections.forEach((s,idx)=>s.classList.toggle("hidden",idx!==i));
    updateProgressBar();
    if (sections[i].id === "section-headphones") {
      headphoneRadios.forEach(r => r.checked = false);
      headphoneDetails.classList.add("hidden");
      headphoneNumber.value = "";
      if (btnNoHeadphone) btnNoHeadphone.classList.add("hidden");
      if (noHeadphoneDamage) noHeadphoneDamage.classList.remove("hidden");
    }
    if (sections[i].id === "section-rules" && rulesAgree && rulesFinish){
      rulesAgree.checked = false;
      rulesFinish.classList.add("hidden");
    }
  }
  show(current);

  const welcomeBtn = document.getElementById("welcomeStart");
  if (welcomeBtn) {
    welcomeBtn.onclick = () => {
      current = 1;
      show(current);
    };
  }

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
        let desc = txt;
        if (sec === "headphones" && headphoneNumber) {
          const num = headphoneNumber.value.trim();
          if (!num) { alert("Merci d'indiquer le numéro de la paire d'écouteurs."); return; }
          const hpObj = { numero: num, description: txt };
          desc = `N°${hpObj.numero} : ${hpObj.description}`;
          pendingReports.push({ section: sec, desc: hpObj });
          await updateDoc(pcRef, { [sec]: arrayUnion({ numero: num, description: txt }) });
        } else {
          pendingReports.push({ section:sec, desc:txt });
          await updateDoc(pcRef, { [sec]: arrayUnion(txt) });
        }
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
        if (haveRealDamage()){
            // afficher la modale prof
            newList.innerHTML = "";
            pendingReports.forEach(r=>{
                const li=document.createElement("li");
                let txt = r.desc;
                if (r.section === "headphones" && typeof r.desc === "object") {
                    txt = `N°${r.desc.numero} : ${r.desc.description}`;
                }
                li.textContent = `${label(r.section)} : ${txt}`;
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
      // Marquer immédiatement la soumission pour désactiver beforeunload
      isSubmitted = true;
      window.removeEventListener("beforeunload", blockUnload);
      window.onbeforeunload = null;               // supprime tout handler résiduel

      if (pendingReports.length === 0){
          // Ajoute un enregistrement unique contenant date & heure pour conserver chaque connexion
          const now    = new Date();
          const stamp  = now.toLocaleString("fr-CH", { hour: "2-digit", minute: "2-digit", second:"2-digit" });
          const day    = now.toLocaleDateString("fr-CH");
          pendingReports.push({
              section: "none",
              desc   : `${day} ${stamp}`   // ex. 24.5.2025 14:07:32
          });
      }
      await addDoc(collection(db,"reports"), {
        pcId, user:userId, when: serverTimestamp(), items: pendingReports, resolved:false
      });
      isSubmitted = true;
      window.removeEventListener("beforeunload", blockUnload);
      window.onbeforeunload = null;               // supprime tout handler résiduel
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
    return {keyboard:"Clavier",mouse:"Souris",screen:"Écran",headphones:"Écouteurs",other:"Autres"}[sec];
  }

  updateProgressBar();
