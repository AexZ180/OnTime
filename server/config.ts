import {existsSync} from 'node:fs';
import {loadEnvFile} from 'node:process';
import {resolve} from 'node:path';

// Existing process environment wins. Never print database URLs or credentials.
for(const file of ['.env.local','.env','.dev.vars']){
  if(existsSync(resolve(file)))loadEnvFile(resolve(file));
}

export function config(){
  const origins=(process.env.APP_ORIGIN||'http://localhost:5173,http://127.0.0.1:5173').split(',').map(x=>new URL(x.trim()).origin);
  if(process.env.NODE_ENV==='production'&&origins.some(x=>!x.startsWith('https://')))throw new Error('Production APP_ORIGIN must use HTTPS.');
  return {origins,secureCookies:origins.every(x=>x.startsWith('https://')),port:Number(process.env.API_PORT||3001)};
}
