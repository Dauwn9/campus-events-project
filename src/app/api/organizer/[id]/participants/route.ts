import { getCurrentUser } from "@/lib/auth";
import { readStore } from "@/lib/services/demo-store";
import { ownedEvent } from "@/lib/services/campus";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const actor=await getCurrentUser();const {id}=await params;const store=readStore();
  try{ownedEvent(store,actor,id);}catch{return Response.json({error:"Нет доступа к участникам этого события"},{status:403});}
  const cell=(value:string)=>`"${(/^[=+@\-\t\r]/.test(value)?`'${value}`:value).replaceAll('"','""')}"`;
  const rows=store.registrations.filter(r=>r.eventId===id).map(r=>{const user=store.users.find(u=>u.id===r.userId)!;return [user.name,user.email,user.group,r.status,r.checkedInAt??""].map(cell).join(";");});
  return new Response(`\uFEFFИмя;Email;Группа;Статус;Вход\r\n${rows.join("\r\n")}`,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="participants-${id}.csv"`,"Cache-Control":"no-store"}});
}
