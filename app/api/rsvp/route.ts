import {getChatGPTUser} from '@/app/chatgpt-auth';
import {getDb} from '@/db';
import {events,responses} from '@/db/schema';
import {and,eq} from 'drizzle-orm';
import {z} from 'zod';

export async function GET(req:Request){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:'Sign in to view this invitation.'},{status:401});
  try{
    const token=new URL(req.url).searchParams.get('token');
    const db=getDb();
    const rows=await db.select({id:events.id,owner:events.owner,data:events.data}).from(events).where(eq(events.token,token??'')).limit(1);
    const e=rows[0];
    if(!e)return Response.json({error:'This invitation is no longer available.'},{status:404});
    const event=JSON.parse(e.data);
    const result=await db.select({name:responses.name,status:responses.status}).from(responses).where(eq(responses.event,e.id));
    const mineRows=await db.select({status:responses.status}).from(responses).where(and(eq(responses.event,e.id),eq(responses.user,user.userId))).limit(1);
    return Response.json({
      event:{id:event.id,title:event.title,start:event.start,end:event.end,location:event.location,notes:event.notes,allDay:event.allDay},
      responses:e.owner===user.userId?result:[],
      mine:mineRows[0]?.status??null,
    },{headers:{'Cache-Control':'no-store'}});
  }catch(e){
    console.error(e);
    return Response.json({error:'Unable to load this invitation.'},{status:503});
  }
}

export async function POST(req:Request){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:'Sign in to RSVP.'},{status:401});
  if(req.headers.get('sec-fetch-site')==='cross-site')return Response.json({error:'Request not allowed.'},{status:403});
  try{
    const b=z.object({token:z.string().uuid(),status:z.enum(['Going','Maybe','Not going'])}).parse(await req.json());
    const db=getDb();
    const rows=await db.select({id:events.id}).from(events).where(eq(events.token,b.token)).limit(1);
    if(rows.length===0)return Response.json({error:'Invitation not found.'},{status:404});
    await db.insert(responses).values({event:rows[0].id,user:user.userId,name:user.displayName,status:b.status})
      .onConflictDoUpdate({target:[responses.event,responses.user],set:{name:user.displayName,status:b.status}});
    return Response.json({ok:true});
  }catch(e){
    return Response.json({error:'Unable to save your RSVP. Please retry.'},{status:400});
  }
}
