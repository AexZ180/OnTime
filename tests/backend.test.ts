import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {eq} from 'drizzle-orm';
import * as schema from '../db/schema';
import {migrateDatabase,type DatabaseConnection} from '../server/database';
import {handleRequest,type Context} from '../server/api';
import {rankSlots,availabilityAt} from '../server/scheduling';
import {digest,rateLimit} from '../server/auth';
import {nodeHeaders} from '../server/http';
import {geohash,normalizeTicketmasterEvent} from '../server/discovery';

const password='A long demo password 2026!';
const start='2030-10-01T15:00:00Z',end='2030-10-01T17:00:00Z';
test('full SQL account, profile, friendship, planning, RSVP and restart lifecycle',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'ontime-test-'));
  let client=new PGlite(directory);await client.waitReady;
  let db=drizzle(client,{schema});
  const connection=():DatabaseConnection=>({db,client,mode:'local',close:()=>client.close()});
  await migrateDatabase(connection());
  const context=():Context=>({db,mode:'local',origins:['http://localhost:5173'],appOrigin:'http://localhost:5173',google:null,secureCookies:false,clientAddress:'test'});
  async function call(path:string,method='GET',data?:unknown,cookie='',expected=200){
    const response=await handleRequest(new Request('http://localhost:5173/api'+path,{method,headers:{'content-type':'application/json',origin:'http://localhost:5173',cookie},...(data===undefined?{}:{body:JSON.stringify(data)})}),context());
    // Endpoint payloads vary; runtime assertions below verify their contracts.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value:any=await response.json();assert.equal(response.status,expected,JSON.stringify(value));return {value,cookie:response.headers.get('set-cookie')?.split(';')[0]??cookie,response};
  }
  try{
    await call('/state','GET',undefined,'',401);
    const a=await call('/auth/register','POST',{email:'ALICE@example.com',username:'Alice',password,name:'Alice',timeZone:'America/Chicago'},'',201);
    const b=await call('/auth/register','POST',{email:'bob@example.com',username:'bob',password,name:'Bob'},'',201);
    const c=await call('/auth/register','POST',{email:'carol@example.com',username:'carol',password,name:'Carol'},'',201);
    assert.match(a.response.headers.get('set-cookie')!,/HttpOnly; SameSite=Lax/);
    await call('/auth/register','POST',{email:'alice@example.com',username:'another',password,name:'Duplicate'},'',409);
    const [account]=await db.select().from(schema.accounts).where(eq(schema.accounts.id,a.value.user.id));
    assert.ok(account.passwordHash);assert.match(account.passwordHash,/^\$argon2id\$/);assert.notEqual(account.passwordHash,password);
    const [session]=await db.select().from(schema.sessions).where(eq(schema.sessions.userId,a.value.user.id));
    assert.equal(session.tokenHash,digest(a.cookie.split('=')[1]));
    await call('/auth/login','POST',{identifier:'alice',password:'wrong'},'',401);
    await call('/profile','PATCH',{timeZone:'Not/AZone'},a.cookie,400);
    await call('/profile','PATCH',{birthday:'2000-02-30'},a.cookie,400);
    await call('/profile','PATCH',{name:'Alice Example',bio:'Coffee and calendars',birthday:'2000-02-29'},a.cookie);
    await call('/users/'+a.value.user.id,'GET',undefined,b.cookie,404);
    assert.equal((await call('/users?q=al','GET',undefined,b.cookie)).value.users[0].email,undefined);
    await call('/friends/requests','POST',{userId:a.value.user.id},a.cookie,400);
    const request=await call('/friends/requests','POST',{userId:b.value.user.id},a.cookie,201);
    await call('/friends/'+request.value.id,'PATCH',{action:'accept'},a.cookie,409);
    await call('/friends/'+request.value.id,'PATCH',{action:'accept'},c.cookie,404);
    await call('/friends/'+request.value.id,'PATCH',{action:'accept'},b.cookie);
    assert.equal((await call('/users/'+a.value.user.id,'GET',undefined,b.cookie)).value.profile.name,'Alice Example');
    const pollBody={title:'Hackathon celebration',durationMinutes:60,minParticipants:2,timeZone:'America/Chicago',windows:[{start,end}],invitees:[{userId:b.value.user.id,required:true}]};
    const poll=await call('/polls','POST',pollBody,a.cookie,201),pollPath='/polls/'+poll.value.id;
    await call(pollPath,'GET',undefined,c.cookie,404);
    await call(pollPath+'/availability','PUT',{blocks:[{start,end,status:'available'}]},c.cookie,404);
    let slots=(await call(pollPath+'/slots','GET',undefined,a.cookie)).value.slots;
    assert.equal(slots[0].qualified,false);assert.equal(slots[0].participants[0].status,'unknown');
    await call(pollPath+'/availability','PUT',{blocks:[{start,end,status:'preferred'}]},a.cookie);
    await call(pollPath+'/availability','PUT',{blocks:[{start,end,status:'maybe'}]},b.cookie);
    await call(pollPath+'/confirm','POST',{start},a.cookie,409);
    await call(pollPath+'/availability','PUT',{blocks:[{start,end,status:'available'}]},b.cookie);
    const busy=await call('/action','POST',{action:'save',event:{title:'Private appointment',calendar:'personal-'+b.value.user.id,start,end:'2030-10-01T16:00:00Z'}},b.cookie);
    slots=(await call(pollPath+'/slots','GET',undefined,a.cookie)).value.slots;
    assert.equal(slots[0].start,'2030-10-01T16:00:00.000Z');assert.equal(slots[0].qualified,true);
    assert.equal(JSON.stringify(slots).includes('Private appointment'),false);
    await call(pollPath+'/confirm','POST',{start},a.cookie,409);
    await call('/action','POST',{action:'delete',id:busy.value.ids[0]},a.cookie,404);
    await call('/action','POST',{action:'delete',id:busy.value.ids[0]},b.cookie);
    await call(pollPath+'/confirm','POST',{start},b.cookie,403);
    const confirmed=await call(pollPath+'/confirm','POST',{start},a.cookie);
    const again=await call(pollPath+'/confirm','POST',{start},a.cookie);
    assert.equal(confirmed.value.eventId,again.value.eventId);
    await call(pollPath+'/confirm','POST',{start:'2030-10-01T16:00:00Z'},a.cookie,409);
    await call(pollPath+'/availability','PUT',{blocks:[]},b.cookie,409);
    const stateA=(await call('/state','GET',undefined,a.cookie)).value;
    const stateB=(await call('/state','GET',undefined,b.cookie)).value;
    assert.equal(stateA.events.length,1);assert.equal(stateB.events.length,1);
    assert.equal(stateA.events[0].id,stateB.events[0].id);assert.equal(stateB.events[0].canEdit,false);
    await call('/action','POST',{action:'save',event:{...stateB.events[0],calendar:'personal-'+b.value.user.id}},b.cookie,404);
    await call('/events/'+confirmed.value.eventId+'/rsvp','POST',{status:'Going'},c.cookie,404);
    await call('/events/'+confirmed.value.eventId+'/rsvp','POST',{status:'Going'},b.cookie);
    assert.equal((await call('/state','GET',undefined,b.cookie)).value.events[0].attendance,'Going');
    const second=await call('/polls','POST',pollBody,a.cookie,201);
    for(const person of [a,b])await call('/polls/'+second.value.id+'/availability','PUT',{blocks:[{start,end,status:'available'}]},person.cookie);
    await call('/polls/'+second.value.id+'/confirm','POST',{start},a.cookie,409);
    await call('/friends/'+request.value.id,'PATCH',{action:'block'},a.cookie);
    assert.equal((await call('/users?q=al','GET',undefined,b.cookie)).value.users.length,0);
    await call('/friends/'+request.value.id,'PATCH',{action:'unblock'},b.cookie,409);
    await call('/profile','PATCH',{visibility:'private'},c.cookie);
    assert.equal((await call('/users?q=ca','GET',undefined,b.cookie)).value.users.length,0);
    const csrf=await handleRequest(new Request('http://localhost:5173/api/auth/logout',{method:'POST',headers:{origin:'https://evil.example',cookie:a.cookie}}),context());assert.equal(csrf.status,403);
    await rateLimit(db,'isolated-limit',1);await assert.rejects(()=>rateLimit(db,'isolated-limit',1),/Too many/);
    await client.close();client=new PGlite(directory);await client.waitReady;db=drizzle(client,{schema});await migrateDatabase(connection());
    assert.equal((await call('/auth/me','GET',undefined,a.cookie)).value.user.id,a.value.user.id);
    assert.equal((await call('/state','GET',undefined,b.cookie)).value.events[0].id,confirmed.value.eventId);
    await call('/auth/logout','POST',{},a.cookie);
    assert.equal((await call('/auth/me','GET',undefined,a.cookie)).value.user,null);
    const login=await call('/auth/login','POST',{identifier:'ALICE@example.com',password});assert.equal(login.value.user.id,a.value.user.id);
  }finally{await client.close();await rm(directory,{recursive:true,force:true})}
});

test('full duration, adjacent blocks, gaps, endpoint boundaries, preferences and time offsets',()=>{
  const a=Date.parse(start),b=a+3600000;
  assert.equal(availabilityAt(a,b,[{userId:'a',start,end:'2030-10-01T15:30:00Z',status:'available'}],[]),'unknown');
  assert.equal(availabilityAt(a,b,[{userId:'a',start,end:'2030-10-01T15:30:00Z',status:'preferred'},{userId:'a',start:'2030-10-01T15:30:00Z',end,status:'available'}],[]),'available');
  assert.equal(availabilityAt(a,b,[{userId:'a',start,end,status:'preferred'}],[{userId:'a',start:'2030-10-01T16:00:00Z',end}]),'preferred');
  const slots=rankSlots({windows:[{start:'2030-10-01T10:00:00-05:00',end}],durationMinutes:60,minParticipants:1},[{userId:'a',required:true}],[{userId:'a',start,end,status:'available'}],[]);
  assert.equal(slots.length,5);assert.equal(slots[0].start,'2030-10-01T15:00:00.000Z');assert.equal(slots[0].qualified,true);
});

test('Ticketmaster locations are encoded and provider events are reduced to safe UI fields',()=>{
  assert.equal(geohash(41.8781,-87.6298),'dp3wjzt');
  const event=normalizeTicketmasterEvent({id:'abc',name:'Live show',url:'https://tickets.example/show',distance:4.2,units:'MILES',images:[{url:'http://unsafe.example/image',width:2000},{url:'https://images.example/wide',ratio:'16_9',width:1024}],dates:{timezone:'America/Chicago',status:{code:'onsale'},start:{dateTime:'2030-10-01T23:00:00Z',localDate:'2030-10-01',localTime:'18:00:00'}},classifications:[{primary:true,segment:{name:'Music'},genre:{name:'Rock'}}],priceRanges:[{currency:'USD',min:20,max:80}],_embedded:{venues:[{name:'The Venue',city:{name:'Chicago'},state:{stateCode:'IL'},country:{countryCode:'US'},address:{line1:'1 Main St'},location:{latitude:'41.88',longitude:'-87.63'}}]}});
  assert.deepEqual(event,{id:'abc',name:'Live show',url:'https://tickets.example/show',imageUrl:'https://images.example/wide',start:{dateTime:'2030-10-01T23:00:00Z',localDate:'2030-10-01',localTime:'18:00:00',dateTBD:false,dateTBA:false,timeTBA:false,timeZone:'America/Chicago'},status:'onsale',distance:4.2,distanceUnit:'MILES',category:'Music',genre:'Rock',subGenre:null,venue:{name:'The Venue',address:'1 Main St',city:'Chicago',state:'IL',country:'US',latitude:41.88,longitude:-87.63},price:{currency:'USD',min:20,max:80}});
});

test('Google sign-in creates, reuses, and refuses to capture accounts',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'ontime-google-'));
  const client=new PGlite(directory);await client.waitReady;
  const db=drizzle(client,{schema});
  await migrateDatabase({db,client,mode:'local',close:()=>client.close()} as DatabaseConnection);
  const google={clientId:'test-client.apps.googleusercontent.com',clientSecret:'test-secret',redirectUri:'http://localhost:5173/api/auth/google/callback'};
  const context=():Context=>({db,mode:'local',origins:['http://localhost:5173'],appOrigin:'http://localhost:5173',google,secureCookies:false,clientAddress:'test'});
  const realFetch=globalThis.fetch;
  // Stands in for Google's token endpoint. The handler reads the ID token it returns
  // without checking the signature, exactly as it does against the real endpoint.
  let claims:Record<string,unknown>={};
  globalThis.fetch=(async(input:RequestInfo|URL)=>{
    assert.equal(String(input),'https://oauth2.googleapis.com/token');
    const payload=Buffer.from(JSON.stringify({iss:'https://accounts.google.com',aud:google.clientId,exp:Math.floor(Date.now()/1000)+300,...claims})).toString('base64url');
    return Response.json({id_token:`eyJhbGciOiJSUzI1NiJ9.${payload}.signature`});
  }) as typeof globalThis.fetch;
  const get=(path:string,cookie='')=>handleRequest(new Request('http://localhost:5173'+path,{headers:cookie?{cookie}:{}}),context());
  async function handshake(){
    const started=await get('/api/auth/google/start?next=%2F');
    assert.equal(started.status,302);
    const target=new URL(started.headers.get('location')!);
    assert.equal(target.origin+target.pathname,'https://accounts.google.com/o/oauth2/v2/auth');
    assert.equal(target.searchParams.get('code_challenge_method'),'S256');
    const binding=started.headers.get('set-cookie')!.split(';')[0];
    return {state:target.searchParams.get('state')!,binding};
  }
  const finish=async(cookie='')=>{
    const {state,binding}=await handshake();
    return get(`/api/auth/google/callback?code=demo&state=${state}`,[binding,cookie].filter(Boolean).join('; '));
  };
  const session=(response:Response)=>response.headers.getSetCookie().find(c=>c.startsWith('ontime_session='))?.split(';')[0]??'';
  try{
    claims={sub:'google-ollie',email:'Ollie@example.com',email_verified:true,name:'Ollie Otter'};
    const first=await finish();
    assert.equal(first.status,302);
    // A brand new account lands on the profile steps; the account already exists.
    assert.equal(first.headers.get('location'),'http://localhost:5173/login.html?google=new&next=%2F');
    const cookie=session(first);assert.ok(cookie);
    const me=await (await get('/api/auth/me',cookie)).json() as {user:{username:string;email:string}};
    assert.equal(me.user.email,'ollie@example.com');assert.equal(me.user.username,'ollie');

    // Returning with the same Google account reuses it and goes straight to the app.
    const again=await finish();
    assert.equal(again.headers.get('location'),'http://localhost:5173/');
    const returning=await (await get('/api/auth/me',session(again))).json() as {user:{id:string}};
    const originally=await (await get('/api/auth/me',cookie)).json() as {user:{id:string}};
    assert.equal(returning.user.id,originally.user.id);
    assert.equal((await db.select().from(schema.accounts)).length,1);

    // A second Google identity whose email local part is taken still gets a username.
    claims={sub:'google-other',email:'ollie@other.example',email_verified:true,name:'Ollie Two'};
    const second=await finish();
    assert.equal(second.headers.get('location'),'http://localhost:5173/login.html?google=new&next=%2F');
    const other=await (await get('/api/auth/me',session(second))).json() as {user:{username:string}};
    assert.notEqual(other.user.username,'ollie');assert.match(other.user.username,/^ollie[0-9a-f]{4}$/);

    // An unverified Google email is refused rather than trusted.
    claims={sub:'google-unverified',email:'nobody@example.com',email_verified:false,name:'Nobody'};
    assert.equal((await finish()).headers.get('location'),'http://localhost:5173/login.html?error=google_email');

    // Password accounts are never adopted: registration does not verify email, so
    // whoever registered the address first must not capture the Google sign-in.
    const password='A long demo password 2026!';
    const registered=await handleRequest(new Request('http://localhost:5173/api/auth/register',{method:'POST',headers:{'content-type':'application/json',origin:'http://localhost:5173'},body:JSON.stringify({email:'maya@example.com',username:'maya',password,name:'Maya'})}),context());
    assert.equal(registered.status,201);
    claims={sub:'google-maya',email:'maya@example.com',email_verified:true,name:'Maya'};
    const blocked=await finish();
    assert.equal(blocked.headers.get('location'),'http://localhost:5173/login.html?error=google_exists');
    assert.equal(session(blocked),'');

    // The response object is not what the browser sees. server/main.ts hands these
    // headers to Node, and collapsing the pair there dropped the session cookie and
    // left the handshake cleanup, so a finished Google sign-in arrived signed out.
    claims={sub:'google-wire',email:'wire@example.com',email_verified:true,name:'Wire'};
    const wire=await finish();
    const served=nodeHeaders(wire)['set-cookie'];
    assert.ok(Array.isArray(served)&&served.length===2,'both cookies must reach the browser');
    const servedSession=served.find(c=>c.startsWith('ontime_session='))!;
    assert.ok(servedSession,'the session cookie must survive serialization');
    assert.ok(served.some(c=>c.startsWith('ontime_oauth=')),'the handshake cookie is still cleared');
    const signedIn=await (await get('/api/auth/me',servedSession.split(';')[0])).json() as {user:{email:string}|null};
    assert.equal(signedIn.user?.email,'wire@example.com');

    // The handshake is single use and requires the browser's binding cookie.
    const {state,binding}=await handshake();
    assert.equal((await get(`/api/auth/google/callback?code=demo&state=${state}`)).headers.get('location'),'http://localhost:5173/login.html?error=google_expired');
    assert.equal((await get(`/api/auth/google/callback?code=demo&state=${state}`,binding)).headers.get('location'),'http://localhost:5173/login.html?error=google_expired');

    // Google-only accounts have no password to guess.
    const attempt=await handleRequest(new Request('http://localhost:5173/api/auth/login',{method:'POST',headers:{'content-type':'application/json',origin:'http://localhost:5173'},body:JSON.stringify({identifier:'ollie',password:'anything at all!!'})}),context());
    assert.equal(attempt.status,401);
  }finally{globalThis.fetch=realFetch;await client.close();await rm(directory,{recursive:true,force:true})}
});
