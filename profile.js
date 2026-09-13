// Explicitly local demo identity. Never store passwords or claim authentication.
window.OnTimeProfile={
 read(){try{const value=JSON.parse(sessionStorage.getItem('ontime-demo-profile')||'null');return value&&typeof value.username==='string'&&typeof value.email==='string'?value:null;}catch{return null;}},
 save(value){const profile={username:String(value.username||''),email:String(value.email||''),phone:String(value.phone||''),recommendations:!!value.recommendations};try{sessionStorage.setItem('ontime-demo-profile',JSON.stringify(profile));return true;}catch{return false;}},
 clear(){try{sessionStorage.removeItem('ontime-demo-profile');}catch{}}
};
