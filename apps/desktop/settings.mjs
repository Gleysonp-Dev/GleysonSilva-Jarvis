import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';
export const defaults = { profileId:'default', textModel:'gpt-5.4-mini', realtimeModel:'gpt-realtime', voice:'marin', maxSessionMinutes:10, apps:[] };
export function validateSettings(value) {
  const result = {};
  for (const key of ['textModel','realtimeModel']) if (value[key] !== undefined) {
    if (typeof value[key] !== 'string' || !/^[a-zA-Z0-9._:-]{1,120}$/.test(value[key])) throw new Error('Identificador de modelo inválido.');
    result[key]=value[key];
  }
  if(value.profileId!==undefined){if(typeof value.profileId!=='string'||!/^[a-z0-9_-]{1,64}$/.test(value.profileId))throw new Error('Perfil inválido. Use letras minúsculas, números, _ ou -.');result.profileId=value.profileId;}
  if(value.voice!==undefined){if(!['alloy','ash','ballad','coral','echo','sage','shimmer','verse','marin','cedar'].includes(value.voice))throw new Error('Voz inválida.');result.voice=value.voice;}
  if(value.maxSessionMinutes!==undefined){const n=value.maxSessionMinutes;if(!Number.isInteger(n)||n<1||n>30)throw new Error('A sessão deve durar de 1 a 30 minutos.');result.maxSessionMinutes=n;}
  return result;
}
export class SettingsStore {
  constructor(dir, crypto) {this.dir=dir;this.crypto=crypto;mkdirSync(dir,{recursive:true});this.path=join(dir,'settings.json');this.secretPath=join(dir,'credentials.bin');try{const stored=JSON.parse(readFileSync(this.path,'utf8'));this.value={...defaults,...validateSettings(stored),workspaceRoot:typeof stored.workspaceRoot==='string'?stored.workspaceRoot:undefined,apps:Array.isArray(stored.apps)?stored.apps.filter(a=>a&&typeof a.id==='string'&&typeof a.path==='string'&&typeof a.label==='string'):[]};}catch{this.value={...defaults,apps:[]};}}
  get(){return structuredClone(this.value);}
  write(extra){this.value={...this.value,...extra};const temp=this.path+'.tmp';writeFileSync(temp,JSON.stringify(this.value,null,2),{mode:0o600});renameSync(temp,this.path);return this.get();}
  save(value){const valid=validateSettings(value);if(value.apiKey!==undefined){if(typeof value.apiKey!=='string'||value.apiKey.length>512||/[\r\n]/.test(value.apiKey))throw new Error('Chave inválida.');if(value.apiKey.trim())this.setSecret(value.apiKey.trim());}return this.write(valid);}
  setSecret(key){if(!this.crypto.isEncryptionAvailable())throw new Error('O armazenamento protegido do sistema não está disponível.');const data=this.crypto.encryptString(key);writeFileSync(this.secretPath+'.tmp',data,{mode:0o600});renameSync(this.secretPath+'.tmp',this.secretPath);}
  getSecret(){try{if(existsSync(this.secretPath)&&this.crypto.isEncryptionAvailable())return this.crypto.decryptString(readFileSync(this.secretPath));}catch{}return process.env.OPENAI_API_KEY||'';}
  public(){const s=this.get();return {...s,apps:s.apps.map(({id,label})=>({id,label})),hasKey:Boolean(this.getSecret())};}
}
