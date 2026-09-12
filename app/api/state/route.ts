import {getChatGPTUser} from '@/app/chatgpt-auth';
import {getDb} from '@/db';
import {calendars,events,profiles} from '@/db/schema';
import {asc,eq} from 'drizzle-orm';

export async function GET(){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:'Sign in to use your calendar.'},{status:401});
  try{
    const db=getDb();
    const id='personal-'+user.userId;
    await db.insert(calendars).values({id,owner:user.userId,name:'My calendar',color:'0'}).onConflictDoNothing({target:calendars.id});
    const [c,e,p]=await Promise.all([
      db.select({id:calendars.id,name:calendars.name,color:calendars.color}).from(calendars).where(eq(calendars.owner,user.userId)).orderBy(asc(calendars.createdAt)),
      db.select({data:events.data,token:events.token}).from(events).where(eq(events.owner,user.userId)).orderBy(asc(events.createdAt)),
      db.select({name:profiles.name,birthday:profiles.birthday,homeCity:profiles.homeCity,timeZone:profiles.timeZone,locationSharing:profiles.locationSharing}).from(profiles).where(eq(profiles.owner,user.userId)).limit(1),
    ]);
    return Response.json({
      user:{name:user.displayName,email:user.email},
      profile:p[0]??{name:user.fullName??'',birthday:'',homeCity:'',timeZone:'',locationSharing:'never'},
      calendars:c,
      events:e.map(x=>({...JSON.parse(x.data),token:x.token})),
    },{headers:{'Cache-Control':'no-store'}});
  }catch(e){
    console.error(e);
    return Response.json({error:'Unable to load saved calendars. Please retry.'},{status:503});
  }
}
