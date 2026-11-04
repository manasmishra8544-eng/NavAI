const $=id=>document.getElementById(id);
const S={number:0,total:10,score:0,history:[],topic:"",subject:"",level:"",difficulty:"Medium",question:"",busy:false,muted:false};
function show(id,v){$(id).classList.toggle("hidden",!v)}
function status(t){$("status").textContent=t}
function speak(t){if(!S.muted&&"speechSynthesis"in window){speechSynthesis.cancel();let u=new SpeechSynthesisUtterance(t);u.rate=.94;speechSynthesis.speak(u)}}
async function ai(prompt){
 const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:prompt,history:[]})});
 if(!r.ok)throw Error("NavAI API error: "+r.status);
 const d=await r.json();const t=d.response??d.reply??d.answer??d.message??d.content??d.text??d.choices?.[0]?.message?.content;
 if(typeof t!=="string"||!t.trim())throw Error("API response format check karna hoga.");
 return t.trim();
}
function context(){return `You are NavAI Oral Quiz teacher. Subject: ${S.subject}; class/level: ${S.level}; topic: ${S.topic}; difficulty: ${S.difficulty}. Ask one question at a time. Keep content accurate and student-friendly.`}
async function nextQuestion(){
 if(S.number>=S.total){finish();return}
 S.number++;
 S.question=await ai(context()+` Generate question ${S.number} of ${S.total}. Ask one new question only. Do not reveal answer. Avoid previous questions: ${S.history.map(x=>x.q).join(" | ")}`);
 $("question").textContent=S.question;$("answer").value="";
 $("progress").textContent=`Question ${S.number} / ${S.total}`;
 $("score").textContent=`Score: ${S.score}`;$("fill").style.width=((S.number-1)/S.total*100)+"%";
 show("feedback",false);show("submit",true);show("unknown",true);show("next",false);speak(S.question);status("");
}
async function run(fn){if(S.busy)return;S.busy=true;try{await fn()}catch(e){status(e.message||"Error")}finally{S.busy=false}}
$("start").onclick=()=>run(async()=>{
 S.subject=$("subject").value.trim()||"General";S.level=$("level").value.trim()||"General";S.topic=$("topic").value.trim();S.difficulty=$("difficulty").value;S.total=+$("count").value;
 if(!S.topic)throw Error("Pehle topic likho.");S.number=0;S.score=0;S.history=[];
 show("setup",false);show("results",false);show("quiz",true);await nextQuestion();
});
$("submit").onclick=()=>run(async()=>{
 const a=$("answer").value.trim();if(!a)throw Error("Answer type karo ya microphone use karo.");
 const result=await ai(context()+` Evaluate fairly. Question: ${S.question}. Student answer: ${a}. Start with exactly one label: CORRECT, PARTLY CORRECT, or INCORRECT. Then explain the correct answer and any mistake.`);
 const correct=/^CORRECT\b/i.test(result)&&!/^CORRECTLY\b/i.test(result);
 if(correct)S.score++;
 S.history.push({q:S.question,a,result,correct});$("feedback").textContent=result;
 show("feedback",true);show("submit",false);show("unknown",false);show("next",true);$("score").textContent=`Score: ${S.score}`;speak(result);
});
$("unknown").onclick=()=>run(async()=>{
 const result=await ai(context()+` Student does not know the answer. Question: ${S.question}. Explain the correct answer step by step with a simple example. Do not ask the next question.`);
 S.history.push({q:S.question,a:"Didn't know",result,correct:false});$("feedback").textContent="ANSWER & EXPLANATION\n\n"+result;
 show("feedback",true);show("submit",false);show("unknown",false);show("next",true);speak(result);
});
$("next").onclick=()=>run(nextQuestion);
$("read").onclick=()=>speak(S.question);
$("mute").onclick=()=>{S.muted=!S.muted;$("mute").textContent=S.muted?"Enable voice":"Mute";if(S.muted&&"speechSynthesis"in window)speechSynthesis.cancel()};
$("mic").onclick=()=>{
 const R=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!R){status("Speech recognition supported nahi hai; answer type karo.");return}
 const r=new R();r.lang="en-IN";r.onstart=()=>status("Listening...");r.onresult=e=>{$("answer").value=e.results[0][0].transcript;status("Answer captured. Submit dabao.")};r.onerror=e=>status("Mic error: "+e.error);r.start();
};
function finish(){
 show("quiz",false);show("results",true);$("finalScore").textContent=`${S.score} / ${S.total}`;
 const root=$("review");root.replaceChildren();
 S.history.forEach((x,i)=>{const div=document.createElement("div");div.className="review-item";const q=document.createElement("strong");q.textContent=`${i+1}. ${x.q}`;const a=document.createElement("p");a.textContent="Your answer: "+x.a;const f=document.createElement("p");f.textContent=x.result;div.append(q,a,f);root.append(div)});
 try{const k="navai.oralQuiz.history.v1",old=JSON.parse(localStorage.getItem(k)||"[]");old.unshift({date:new Date().toISOString(),topic:S.topic,subject:S.subject,score:S.score,total:S.total,history:S.history});localStorage.setItem(k,JSON.stringify(old.slice(0,30)))}catch{}
 status("Quiz complete. Neeche answers revise karo.");
}
$("retry").onclick=()=>$("start").click();
$("new").onclick=()=>{show("results",false);show("setup",true);show("quiz",false);status("")};
