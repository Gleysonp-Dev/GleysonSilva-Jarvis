const { contextBridge, ipcRenderer } = require('electron');
const invoke = method => value => ipcRenderer.invoke('jarvis:' + method, value);
contextBridge.exposeInMainWorld('jarvis', Object.freeze({
 boot:invoke('boot'),saveSettings:invoke('saveSettings'),chooseWorkspace:invoke('chooseWorkspace'),chooseApp:invoke('chooseApp'),
 text:invoke('text'),cancel:invoke('cancel'),callTool:invoke('callTool'),approve:invoke('approve'),
 memorySave:invoke('memorySave'),memoryDelete:invoke('memoryDelete'),realtimeSession:invoke('realtimeSession'),
 vision:invoke('vision'),openExternal:invoke('openExternal'),listModels:invoke('listModels'),startupGreeting:invoke('startupGreeting'),
 speak:invoke('speak'),cancelSpeech:invoke('cancelSpeech'),wakeStart:invoke('wakeStart'),wakeStop:invoke('wakeStop'),chooseGreetingMusic:invoke('chooseGreetingMusic'),cancelGreeting:invoke('cancelGreeting'),
 onEvent(callback){if(typeof callback!=='function')throw new Error('Callback inválido.');const listener=(_event,data)=>callback(data);ipcRenderer.on('jarvis:event',listener);return()=>ipcRenderer.removeListener('jarvis:event',listener);}
}));
