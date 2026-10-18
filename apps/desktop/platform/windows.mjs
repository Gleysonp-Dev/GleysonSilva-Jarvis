import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const helper=fileURLToPath(new URL('./windows.ps1',import.meta.url));
export function createWindowsAdapters({getApps,openExternal}) {
 async function run(action,payload,{signal}={}){
  if(process.platform!=='win32')throw new Error('Esta integração exige Windows.');
  const encoded=Buffer.from(JSON.stringify(payload),'utf8').toString('base64');
  return new Promise((resolve,reject)=>{
   const child=spawn(join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',helper,'-Action',action,'-Payload',encoded],{windowsHide:true,stdio:['ignore','pipe','pipe'],signal});
   let out='';const timer=setTimeout(()=>{child.kill();reject(new Error('O Windows não confirmou a ação no prazo.'));},18000);
   child.stdout.on('data',d=>{out+=d.toString('utf8');if(out.length>64000)child.kill();});
   child.stderr.resume();child.on('error',e=>{clearTimeout(timer);reject(e.name==='AbortError'?new Error('Ação cancelada.'):new Error('Não foi possível iniciar a integração Windows.'));});
   child.on('close',code=>{clearTimeout(timer);try{const result=JSON.parse(out.trim());if(code||!result.verified)reject(new Error(result.summary||'Não foi possível confirmar a ação.'));else resolve(result);}catch{reject(new Error('A integração Windows não retornou uma confirmação válida.'));}});
  });
 }
 return {
  async openApp(appId,options){const app=getApps().find(a=>a.id===appId);if(!app)throw new Error('Aplicativo não cadastrado.');await access(app.path);return run('OpenApp',{path:app.path},options);},
  async openBrowser(url,{signal}={}){if(signal?.aborted)throw new Error('Ação cancelada.');const parsed=new URL(url);if(!['https:','http:'].includes(parsed.protocol)||parsed.username||parsed.password)throw new Error('URL não permitida.');await openExternal(parsed.href);return {verified:false,summary:'A URL foi encaminhada ao navegador. O conteúdo da página ainda não foi verificado.',url:parsed.href};},
  async dictateNotes(text,options){return run('DictateNotes',{text},options);}
 };
}
