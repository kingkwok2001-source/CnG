let installPrompt=null
const signal=()=>window.dispatchEvent(new Event('finance-install-state'))
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;signal()})
window.addEventListener('appinstalled',()=>{installPrompt=null;signal()})
export const getInstallPrompt=()=>installPrompt
export function clearInstallPrompt(){installPrompt=null;signal()}
export function installedMode(){return window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true}
export function registerPwa(){
 if(!('serviceWorker' in navigator)||!window.isSecureContext||!import.meta.env.PROD)return
 navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(()=>navigator.serviceWorker.ready).then(()=>{window.dispatchEvent(new Event('finance-offline-ready'))}).catch(()=>{})
}
