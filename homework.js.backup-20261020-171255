const $=id=>document.getElementById(id);
const question=$("question"),photo=$("photo"),status=$("status"),solve=$("solve");
let imageData="";
$("uploadBtn").addEventListener("click",()=>photo.click());
photo.addEventListener("change",()=>{
  const file=photo.files&&photo.files[0];
  if(!file)return;
  if(!["image/jpeg","image/png","image/webp"].includes(file.type)){status.textContent="Choose a JPG, PNG or WebP image.";photo.value="";return}
  if(file.size>4*1024*1024){status.textContent="Image must be smaller than 4 MB.";photo.value="";return}
  const reader=new FileReader();
  reader.onload=()=>{imageData=String(reader.result||"");$("preview").src=imageData;$("preview").hidden=false;$("fileName").textContent=file.name;$("removePhoto").hidden=false;status.textContent=""};
  reader.onerror=()=>{status.textContent="Could not read that image. Try another one."};
  reader.readAsDataURL(file);
});
$("removePhoto").addEventListener("click",()=>{imageData="";photo.value="";$("preview").removeAttribute("src");$("preview").hidden=true;$("fileName").textContent="No photo selected";$("removePhoto").hidden=true});
solve.addEventListener("click",async()=>{
  const q=question.value.trim();
  if(!q&&!imageData){status.textContent="Type a question or upload a photo first.";return}
  solve.disabled=true;solve.textContent="Preparing your answer...";status.textContent="Solving your homework. This can take a few seconds.";
  try{
    const response=await fetch("/api/homework/solve",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:q,subject:$("subject").value,style:$("style").value,image:imageData})});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||"Could not generate the answer.");
    if(!data.answer||!data.answer.trim())throw new Error("The AI returned an empty answer. Please try again.");
    $("answer").textContent=data.answer.trim();$("answerTitle").textContent=$("subject").value+" ? Answer";$("result").hidden=false;status.textContent="Answer ready. Review it before copying."; $("result").scrollIntoView({behavior:"smooth",block:"start"});
  }catch(e){status.textContent=e.message||"Request failed. Please try again."}
  finally{solve.disabled=false;solve.innerHTML='Solve homework <span>?</span>'}
});
$("copy").addEventListener("click",async()=>{
  const text=$("answer").textContent;
  try{await navigator.clipboard.writeText(text);$("copy").textContent="Copied!"}
  catch{const area=document.createElement("textarea");area.value=text;document.body.appendChild(area);area.select();document.execCommand("copy");area.remove();$("copy").textContent="Copied!"}
  setTimeout(()=>$("copy").textContent="Copy answer",1600);
});
