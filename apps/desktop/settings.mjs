import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';
export const defaults = { profileId:'default', textModel:'gpt-5.4-mini', realtimeModel:'gpt-realtime', voice:'marin', maxSessionMinutes:10, apps:[], startupGreeting:true, weatherLocation:null, elevenVoiceId:'', startAtLogin:false, standbyEnabled:false, wakeClapEnabled:true, wakeVoiceEnabled:true, greetingMusicEnabled:true };
export function validateSettings(value) {
  if(!value || typeof value!=='object' || Array.isArray(value)) throw new Error('Configuração inválida.');
  const result = {};
  for (const key of ['textModel','realtimeModel']) if (value[key] !== undefined) {
    if (typeof value[key] !== 'string' || !/^[a-zA-Z0-9._:-]{1,120}$/.test(value[key])) throw new Error('Identificador de modelo inválido.');
    result[key]=value[key];
  }
  if(value.profileId!==undefined){if(typeof value.profileId!=='string'||!/^[a-z0-9_-]{1,64}$/.test(value.profileId))throw new Error('Perfil inválido. Use letras minúsculas, números, _ ou -.');result.profileId=value.profileId;}
  if(value.voice!==undefined){if(!['alloy','ash','ballad','coral','echo','sage','shimmer','verse','marin','cedar'].includes(value.voice))throw new Error('Voz inválida.');result.voice=value.voice;}
  if(value.maxSessionMinutes!==undefined){const n=value.maxSessionMinutes;if(!Number.isInteger(n)||n<1||n>30)throw new Error('A sessão deve durar de 1 a 30 minutos.');result.maxSessionMinutes=n;}
  if(value.startupGreeting!==undefined){if(typeof value.startupGreeting!=='boolean')throw new Error('Escolha se deseja a saudação ao iniciar.');result.startupGreeting=value.startupGreeting;}
  for(const key of ['startAtLogin','standbyEnabled','wakeClapEnabled','wakeVoiceEnabled','greetingMusicEnabled'])if(value[key]!==undefined){if(typeof value[key]!=='boolean')throw new Error('A opção de início, espera ou áudio deve ser verdadeira ou falsa.');result[key]=value[key];}
  if(value.elevenVoiceId!==undefined){if(typeof value.elevenVoiceId!=='string'||!/^([A-Za-z0-9_-]{1,128})?$/.test(value.elevenVoiceId))throw new Error('Identificador de voz ElevenLabs inválido.');result.elevenVoiceId=value.elevenVoiceId;}
  if(value.weatherLocation!==undefined){
    const loc=value.weatherLocation;
    if(loc===null)result.weatherLocation=null;
    else {
      if(!loc||Object.getPrototypeOf(loc)!==Object.prototype||Object.keys(loc).some(k=>!['name','latitude','longitude'].includes(k))||typeof loc.name!=='string'||!loc.name.trim()||loc.name.length>120||/[\u0000-\u001f<>]/.test(loc.name)||!Number.isFinite(loc.latitude)||loc.latitude < -90||loc.latitude > 90||!Number.isFinite(loc.longitude)||loc.longitude < -180||loc.longitude > 180)throw new Error('Informe uma cidade e coordenadas válidas para a previsão do tempo.');
      result.weatherLocation={name:loc.name.trim(),latitude:loc.latitude,longitude:loc.longitude};
    }
  }
  if(result.standbyEnabled===true)result.startupGreeting=true;
  return result;
}
function checkedSecret(value){if(typeof value!=='string'||value.length>512||/[\r\n\0]/.test(value))throw new Error('Chave inválida.');return value.trim();}
export class SettingsStore {
  constructor(dir, crypto) {this.dir=dir;this.crypto=crypto;mkdirSync(dir,{recursive:true});this.path=join(dir,'settings.json');this.secretPath=join(dir,'credentials.bin');try{const stored=JSON.parse(readFileSync(this.path,'utf8'));this.value={...defaults,...validateSettings(stored),workspaceRoot:typeof stored.workspaceRoot==='string'?stored.workspaceRoot:undefined,apps:Array.isArray(stored.apps)?stored.apps.filter(a=>a&&typeof a.id==='string'&&typeof a.path==='string'&&typeof a.label==='string'):[]};}catch{this.value={...defaults,apps:[]};}}
  get(){return structuredClone(this.value);}
  write(extra){this.value={...this.value,...extra};const temp=this.path+'.tmp';writeFileSync(temp,JSON.stringify(this.value,null,2),{mode:0o600});renameSync(temp,this.path);return this.get();}
  save(value){const valid=validateSettings(value);if((valid.standbyEnabled??this.value.standbyEnabled)===true)valid.startupGreeting=true;const openai=value.apiKey!==undefined?checkedSecret(value.apiKey):'',eleven=value.elevenApiKey!==undefined?checkedSecret(value.elevenApiKey):'';if(openai)this.setSecret(openai);if(eleven)this.#saveSecret(join(this.dir,'credentials-eleven.bin'),eleven);return this.write(valid);}
  #saveSecret(file,key){if(!this.crypto.isEncryptionAvailable())throw new Error('O armazenamento protegido do sistema não está disponível.');const data=this.crypto.encryptString(key);writeFileSync(file+'.tmp',data,{mode:0o600});renameSync(file+'.tmp',file);}
  #readSecret(file,fallback){try{if(existsSync(file)&&this.crypto.isEncryptionAvailable())return this.crypto.decryptString(readFileSync(file));}catch{}return fallback||'';}
  setSecret(key){this.#saveSecret(this.secretPath,checkedSecret(key));}
  getSecret(){return this.#readSecret(this.secretPath,process.env.OPENAI_API_KEY);}
  getElevenSecret(){return this.#readSecret(join(this.dir,'credentials-eleven.bin'),process.env.ELEVENLABS_API_KEY);}
  public(){const s=this.get();return {...s,apps:s.apps.map(({id,label})=>({id,label})),hasKey:Boolean(this.getSecret()),hasElevenKey:Boolean(this.getElevenSecret())};}
}
