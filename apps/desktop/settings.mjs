import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createPrivateKey } from 'node:crypto';
import { validateFireTvHost } from './fire-tv.mjs';
export const defaults = { profileId:'default', textModel:'gpt-5.4-mini', realtimeModel:'gpt-realtime', voice:'marin', maxSessionMinutes:10, apps:[], startupGreeting:true, weatherLocation:null, elevenVoiceId:'', startAtLogin:false, standbyEnabled:false, wakeClapEnabled:true, wakeVoiceEnabled:true, greetingMusicEnabled:true, receptionOutfitEnabled:false, receptionVoiceEnabled:false, continuousVoiceEnabled:false, ultronEnabled:false, fireTvEnabled:false, fireTvHost:'' };
export function validateSettings(value) {
  if(!value || typeof value!=='object' || Array.isArray(value)) throw new Error('Configuração inválida.');
  const result = {};
  if(value.fireTvEnabled!==undefined){if(typeof value.fireTvEnabled!=='boolean')throw new Error('A conexão Fire TV deve ser verdadeira ou falsa.');result.fireTvEnabled=value.fireTvEnabled;}
  if(value.fireTvHost!==undefined){if(value.fireTvHost!==''&&!validateFireTvHost(value.fireTvHost))throw new Error('Informe o IP privado da Fire TV.');result.fireTvHost=value.fireTvHost;}
  for (const key of ['textModel','realtimeModel']) if (value[key] !== undefined) {
    if (typeof value[key] !== 'string' || !/^[a-zA-Z0-9._:-]{1,120}$/.test(value[key])) throw new Error('Identificador de modelo inválido.');
    result[key]=value[key];
  }
  if(value.profileId!==undefined){if(typeof value.profileId!=='string'||!/^[a-z0-9_-]{1,64}$/.test(value.profileId))throw new Error('Perfil inválido. Use letras minúsculas, números, _ ou -.');result.profileId=value.profileId;}
  if(value.voice!==undefined){if(!['alloy','ash','ballad','coral','echo','sage','shimmer','verse','marin','cedar'].includes(value.voice))throw new Error('Voz inválida.');result.voice=value.voice;}
  if(value.maxSessionMinutes!==undefined){const n=value.maxSessionMinutes;if(!Number.isInteger(n)||n<1||n>30)throw new Error('A sessão deve durar de 1 a 30 minutos.');result.maxSessionMinutes=n;}
  if(value.startupGreeting!==undefined){if(typeof value.startupGreeting!=='boolean')throw new Error('Escolha se deseja a saudação ao iniciar.');result.startupGreeting=value.startupGreeting;}
  for(const key of ['startAtLogin','standbyEnabled','wakeClapEnabled','wakeVoiceEnabled','greetingMusicEnabled','receptionVoiceEnabled','continuousVoiceEnabled','ultronEnabled'])if(value[key]!==undefined){if(typeof value[key]!=='boolean')throw new Error('A opção de início, espera ou áudio deve ser verdadeira ou falsa.');result[key]=value[key];}
  // Retired: migrate saved opt-ins and older clients to disabled without changing other settings.
  if(value.receptionOutfitEnabled!==undefined){if(typeof value.receptionOutfitEnabled!=='boolean')throw new Error('A opção de câmera deve ser verdadeira ou falsa.');result.receptionOutfitEnabled=false;}
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
function checkedFireTvRecord(value){
  if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).some(key=>!['host','profileId','privateKey','paired'].includes(key))||!validateFireTvHost(value.host)||typeof value.profileId!=='string'||!/^[a-z0-9_-]{1,64}$/.test(value.profileId)||typeof value.paired!=='boolean'||typeof value.privateKey!=='string'||value.privateKey.length>4096)throw new Error('Registro protegido da Fire TV inválido.');
  try{const key=createPrivateKey(value.privateKey);if(key.asymmetricKeyType!=='rsa'||key.asymmetricKeyDetails?.modulusLength!==2048||key.asymmetricKeyDetails?.publicExponent!==65537n)throw new Error();}catch{throw new Error('Chave protegida da Fire TV inválida.');}
  return {host:value.host,profileId:value.profileId,privateKey:value.privateKey,paired:value.paired};
}
export class SettingsStore {
  constructor(dir, crypto) {this.dir=dir;this.crypto=crypto;mkdirSync(dir,{recursive:true});this.path=join(dir,'settings.json');this.secretPath=join(dir,'credentials.bin');try{const stored=JSON.parse(readFileSync(this.path,'utf8'));this.value={...defaults,...validateSettings(stored),workspaceRoot:typeof stored.workspaceRoot==='string'?stored.workspaceRoot:undefined,apps:Array.isArray(stored.apps)?stored.apps.filter(a=>a&&typeof a.id==='string'&&typeof a.path==='string'&&typeof a.label==='string'):[]};}catch{this.value={...defaults,apps:[]};}}
  get(){return structuredClone(this.value);}
  write(extra){this.value={...this.value,...extra};const temp=this.path+'.tmp';writeFileSync(temp,JSON.stringify(this.value,null,2),{mode:0o600});renameSync(temp,this.path);return this.get();}
  save(value){const valid=validateSettings(value);if((valid.fireTvEnabled??this.value.fireTvEnabled)&&!validateFireTvHost(valid.fireTvHost??this.value.fireTvHost))throw new Error('Informe o IP privado antes de ativar a Fire TV.');if((valid.standbyEnabled??this.value.standbyEnabled)===true)valid.startupGreeting=true;const openai=value.apiKey!==undefined?checkedSecret(value.apiKey):'',eleven=value.elevenApiKey!==undefined?checkedSecret(value.elevenApiKey):'';if(openai)this.setSecret(openai);if(eleven)this.#saveSecret(join(this.dir,'credentials-eleven.bin'),eleven);return this.write(valid);}
  #saveSecret(file,key){if(!this.crypto.isEncryptionAvailable())throw new Error('O armazenamento protegido do sistema não está disponível.');const data=this.crypto.encryptString(key);writeFileSync(file+'.tmp',data,{mode:0o600});renameSync(file+'.tmp',file);}
  #readSecret(file,fallback){try{if(existsSync(file)&&this.crypto.isEncryptionAvailable())return this.crypto.decryptString(readFileSync(file));}catch{}return fallback||'';}
  setSecret(key){this.#saveSecret(this.secretPath,checkedSecret(key));}
  getSecret(){return this.#readSecret(this.secretPath,process.env.OPENAI_API_KEY);}
  getElevenSecret(){return this.#readSecret(join(this.dir,'credentials-eleven.bin'),process.env.ELEVENLABS_API_KEY);}
  getFireTvKeyRecord(){try{return checkedFireTvRecord(JSON.parse(this.#readSecret(join(this.dir,'credentials-fire-tv.bin'),'')));}catch{return null;}}
  setFireTvKeyRecord(value){this.#saveSecret(join(this.dir,'credentials-fire-tv.bin'),JSON.stringify(checkedFireTvRecord(value)));}
  public(){const s=this.get(),tv=this.getFireTvKeyRecord();return {...s,fireTvPaired:Boolean(s.fireTvEnabled&&tv?.paired&&tv.host===s.fireTvHost&&tv.profileId===s.profileId),apps:s.apps.map(({id,label})=>({id,label})),hasKey:Boolean(this.getSecret()),hasElevenKey:Boolean(this.getElevenSecret())};}
}
