import { uuid, isoNow, todayISO, showToast } from "./utils.js";
import { put, getAllLast, clearAll, metaGet, metaSet } from "./db.js";
import { loadSchemas, renderHeader, renderIndividual, validateParcel } from "./schema_engine.js";
import { loadChoices } from "./catalogs.js";
import { exportParcelasCSV } from "./export.js";

let schema;
const headerState={};
let individuals=[];

function setNetBadge(){
  const el=document.getElementById("netBadge");
  if(navigator.onLine){ el.textContent="ONLINE"; el.className="badge ok"; }
  else { el.textContent="OFFLINE"; el.className="badge off"; }
}

async function loadVersion(){
  try{ const res=await fetch("version.json",{cache:"no-store"}); const v=await res.json();
    document.getElementById("verBadge").textContent=`v${v.version}`;
  }catch{ document.getElementById("verBadge").textContent="v?"; }
}

async function getDeviceId(){
  const r=await metaGet("device_id");
  if(r?.value) return r.value;
  const id=uuid(); await metaSet("device_id",id); return id;
}

async function refreshSaved(){
  const last=await getAllLast(schema.store,10);
  const el=document.getElementById("savedList");
  if(!last.length){ el.textContent="Sin registros aún."; return; }
  el.innerHTML=last.map(r=>{
    const pc=r.header?.plot_code??""; const rod=r.header?.rodal??""; const dt=r.header?.date??"";
    const n=r.data?.individuals?.length??0;
    return `• ${dt} · Rodal ${rod} · Parcela ${pc} · ${n} individuos`;
  }).join("<br>");
}

async function renderAll(){
  await renderHeader(schema,document.getElementById("headerFields"),headerState);
  const list=document.getElementById("indList"); list.innerHTML="";
  for(let i=0;i<individuals.length;i++){
    const ind=individuals[i];
    const card=await renderIndividual(schema.individuals,ind,()=>{
      individuals.splice(i,1);
      individuals.forEach((x,idx)=>x.individual_seq=idx+1);
      renderAll();
    });
    list.appendChild(card);
  }
  document.getElementById("indCount").textContent=`Individuos: ${individuals.length}`;
  await refreshSaved();
}

function newParcel(){
  headerState.date=todayISO();
  headerState.project="Eletrans Palqui";
  headerState.rodal="";          // <-- RODAL visible
  headerState.plot_code="";
  headerState.observer="";
  headerState.utm_e="";
  headerState.utm_n="";
  headerState.utm_zone="19S";
  headerState.datum="WGS84";
  individuals=[];
  renderAll();
}

function addIndividual(){
  individuals.push({
    individual_seq: individuals.length+1,
    species:"",
    sobrevivencia:"",
    afectacion_por_incendio_en_individuos_vivos:"",
    respuesta_post_incendio_en_vivos:"",
    altura_del_rebrote:"",
    dano_adicional_no_atribuible_al_incendio:"",
    estado_del_tutor_coligue:"",
    estado_del_protector:"",
    estado_de_la_taza_de_recepcion_de_aguas:"",
    estado_del_bordo_semicircular:""
  });
  renderAll();
}

async function saveParcel(){
  const errs=validateParcel(schema,headerState,individuals);
  if(errs.length){ showToast(errs[0]); console.warn(errs); return; }
  const device_id=await getDeviceId();
  const rec={
    id: uuid(),
    form_type: "parcelas_veg",
    form_version: "v1",
    created_at: isoNow(),
    updated_at: isoNow(),
    device_id,
    header: {...headerState, utm_zone:"19S", datum:"WGS84"},
    data: { plot:{area_m2:500}, individuals: individuals.map(x=>({...x}))}
  };
  await put(schema.store,rec);
  showToast("Parcela guardada.");
  await refreshSaved();
}

async function setupSW(){
  const badge=document.getElementById("swBadge");
  const btn=document.getElementById("btnUpdate");
  if(!("serviceWorker" in navigator)){ badge.textContent="SW: no"; return; }
  try{
    const reg=await navigator.serviceWorker.register("./sw.js");
    badge.textContent="SW: ok";
    reg.addEventListener("updatefound",()=>{
      const nw=reg.installing;
      nw?.addEventListener("statechange",()=>{
        if(nw.state==="installed" && navigator.serviceWorker.controller){
          btn.style.display="inline-block";
          badge.textContent="SW: update";
        }
      });
    });
    btn.addEventListener("click",()=>{
      if(reg.waiting) reg.waiting.postMessage({type:"SKIP_WAITING"});
      let reloaded=false;
      navigator.serviceWorker.addEventListener("controllerchange",()=>{
        if(reloaded) return;
        reloaded=true
        window.location.reload();
      });
    });
    reg.update().catch(()=>{});
  }catch(e){ console.error(e); badge.textContent="SW: err"; }
}

async function main(){
  setNetBadge(); window.addEventListener("online",setNetBadge); window.addEventListener("offline",setNetBadge);
  await loadVersion();
  await loadChoices();
  const schemas=await loadSchemas();
  schema=schemas["parcelas_veg"];

  const btnTop = document.getElementById("btnAddInd");
  if (btnTop) btnTop.onclick = addIndividual;

  const btnBottom = document.getElementById("btnAddIndBottom");
  if (btnBottom) btnBottom.onclick = addIndividual;
  document.getElementById("btnSaveParcel").onclick=saveParcel;
  document.getElementById("btnNewParcel").onclick=()=>{ newParcel(); showToast("Nueva parcela."); };
  document.getElementById("btnExportParcelas").onclick=()=>exportParcelasCSV(schema);
  
  document.addEventListener("click", async (e) => {
    const t = e.target;
    if (!t) return;

    if (t.id === "btnClearAll") {
      e.preventDefault();

      const ok = confirm("¿Estás seguro que quieres borrar TODOS los registros guardados?");
      if (!ok) return;

      await clearAll(schema.store);

      alert("Registros eliminados correctamente.");
      location.reload();
    }
  });

  newParcel();
  await setupSW();
}

main();
