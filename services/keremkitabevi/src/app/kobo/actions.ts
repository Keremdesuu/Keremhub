"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {db} from "@/lib/db";
export async function setBookKoboSync(form:FormData){
 const id=Number(form.get("id")),on=form.get("on")==="true";
 if(!Number.isSafeInteger(id)||id<1)return;
 if(on)await db.koboBookState.deleteMany({where:{bookId:id}});
 await db.book.update({where:{id},data:{koboSync:on}});
 revalidatePath("/kobo");revalidatePath("/kitap/"+id);revalidatePath("/kutuphane");
 redirect(form.get("returnTo")==="kobo"?"/kobo":"/kitap/"+id);
}