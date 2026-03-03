const DB_NAME="offline_forms_db"; const DB_VERSION=1;
function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);
req.onupgradeneeded=()=>{const db=req.result;
if(!db.objectStoreNames.contains("parcelas_veg")){const s=db.createObjectStore("parcelas_veg",{keyPath:"id"});s.createIndex("created_at","created_at",{unique:false});}
if(!db.objectStoreNames.contains("meta")) db.createObjectStore("meta",{keyPath:"key"});};
req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);});}
async function tx(storeName,mode,fn){const db=await openDB();return new Promise((resolve,reject)=>{const t=db.transaction(storeName,mode);const s=t.objectStore(storeName);let out;
Promise.resolve().then(()=>fn(s)).then(res=>out=res).catch(reject);
t.oncomplete=()=>resolve(out); t.onerror=()=>reject(t.error);});}
export async function put(storeName,val){return tx(storeName,"readwrite",s=>s.put(val));}
export async function getAll(storeName){return tx(storeName,"readonly",s=>s.getAll());}
export async function getAllLast(storeName,n=10){const all=await getAll(storeName);all.sort((a,b)=>(b.created_at||"").localeCompare(a.created_at||""));return all.slice(0,n);}
export async function metaGet(key){return tx("meta","readonly",s=>s.get(key));}
export async function metaSet(key,value){return tx("meta","readwrite",s=>s.put({key,value}));}