import {getChatGPTUser} from '@/app/chatgpt-auth';
import {getDb} from '@/db';
import {calendars,events,profiles,responses} from '@/db/schema';
import {and,eq} from 'drizzle-orm';
import {z} from 'zod';

const eventSchema=z.object({id:z.string().max(150).optional(),calendar:z.string().max(150),title:z.string().trim().min(1).max(160),start:z.string().max(50),end:z.string().max(50),location:z.string().max(300).default(''),invitees:z.string().max(1000).default(''),notes:z.string().max(2000).default(''),allDay:z.boolean().default(false)}).refine(e=>Number.isFinite(Date.parse(e.start))&&Number.isFinite(Date.parse(e.end))&&Date.parse(e.end)>Date.parse(e.start),'End time must be after start time.');

export async function POST(req:Request){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:'Sign in to save your changes.'},{status:401});
  if(req.headers.get('sec-fetch-site')==='cross-site')return Response.json({error:'Request not allowed.'},{status:403});
  try{
    const raw=await req.text();
    if(raw.length>2000000)return Response.json({error:'This import is too large.'},{status:413});
    const b=JSON.parse(raw),db=getDb(),owner=user.userId;

    if(b.action==='calendar'){
      const name=z.string().trim().min(1).max(60).parse(b.name);
      const id=crypto.randomUUID();
      await db.insert(calendars).values({id,owner,name,color:String(Number(b.color||1)%3)});
      return Response.json({id});
    }

    if(b.action==='profile'){
      const p=z.object({name:z.string().trim().min(1,'Add a display name.').max(100),birthday:z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/),homeCity:z.string().trim().max(100),timeZone:z.string().trim().max(100),locationSharing:z.enum(['never','while_using','always'])}).parse(b.profile);
      await db.insert(profiles).values({owner,name:p.name,birthday:p.birthday,homeCity:p.homeCity,timeZone:p.timeZone,locationSharing:p.locationSharing})
        .onConflictDoUpdate({target:profiles.owner,set:{name:p.name,birthday:p.birthday,homeCity:p.homeCity,timeZone:p.timeZone,locationSharing:p.locationSharing}});
      return Response.json({ok:true});
    }

    if(b.action==='delete'){
      const id=z.string().parse(b.id);
      await db.transaction(async tx=>{
        const owned=await tx.select({id:events.id}).from(events).where(and(eq(events.id,id),eq(events.owner,owner))).limit(1);
        if(owned.length){
          await tx.delete(responses).where(eq(responses.event,id));
          await tx.delete(events).where(and(eq(events.id,id),eq(events.owner,owner)));
        }
      });
      return Response.json({ok:true});
    }

    if(b.action==='save'||b.action==='import'){
      const input=b.action==='save'?[b.event]:b.events;
      const list=z.array(eventSchema).min(1).max(500).parse(input);
      const ownedRows=await db.select({id:calendars.id}).from(calendars).where(eq(calendars.owner,owner));
      const owned=ownedRows.map(r=>r.id);
      if(list.some(e=>!owned.includes(e.calendar)))return Response.json({error:'Calendar not found.'},{status:403});

      const updates:{id:string;calendar:string;data:string}[]=[];
      const inserts:{id:string;calendar:string;data:string;token:string}[]=[];
      for(const e of list){
        if(e.id&&b.action==='save'){
          const id=e.id;
          const existing=await db.select({id:events.id}).from(events).where(and(eq(events.id,id),eq(events.owner,owner))).limit(1);
          if(existing.length===0)return Response.json({error:'Event not found.'},{status:404});
          updates.push({id,calendar:e.calendar,data:JSON.stringify({...e,id})});
        }else{
          const id=crypto.randomUUID();
          inserts.push({id,calendar:e.calendar,data:JSON.stringify({...e,id}),token:crypto.randomUUID()});
        }
      }

      await db.transaction(async tx=>{
        for(const u of updates)await tx.update(events).set({calendar:u.calendar,data:u.data}).where(and(eq(events.id,u.id),eq(events.owner,owner)));
        if(inserts.length)await tx.insert(events).values(inserts.map(i=>({id:i.id,owner,calendar:i.calendar,data:i.data,token:i.token})));
      });

      return Response.json({ok:true,count:list.length});
    }

    return Response.json({error:'Unknown action.'},{status:400});
  }catch(e){
    if(e instanceof z.ZodError)return Response.json({error:e.issues[0]?.message??'Check your event details.'},{status:400});
    console.error(e);
    return Response.json({error:'Could not save. Your changes have been kept in the form; please retry.'},{status:503});
  }
}
