(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = { drawing: false, hasSignature: false, sealed: false, motionPaused: false };
  const bengaliDigits = (value) => String(value).replace(/[0-9]/g, (digit) => '০১২৩৪৫৬৭৮৯'[Number(digit)]);

  function localDateISO() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  }
  function formatBengaliDate(value) {
    if (!value) return 'তারিখ অনুল্লিখিত';
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('bn-BD',{day:'numeric',month:'long',year:'numeric'}).format(date);
  }
  function go(id) { const target=$(id); if(target) target.scrollIntoView({behavior:state.motionPaused?'auto':'smooth',block:'start'}); }
  all('a[href^="#"]').forEach(link => link.addEventListener('click', event => {
    const targetId=link.getAttribute('href').slice(1); if (!$(targetId)) return;
    event.preventDefault(); go(targetId);
  }));

  function progress(){const max=document.documentElement.scrollHeight-innerHeight;$('readingProgress').style.width=`${max>0?Math.max(0,Math.min(100,scrollY/max*100)):0}%`;}
  addEventListener('scroll',progress,{passive:true});progress();
  if('IntersectionObserver' in window){
    const chapters=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting&&entry.target.dataset.chapter)$('chapterLabel').textContent=entry.target.dataset.chapter;}),{threshold:.3});
    all('.scene').forEach(scene=>chapters.observe(scene));
    const reveal=new IntersectionObserver((entries,observer)=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target);}}),{threshold:.08});
    all('.reveal').forEach(el=>reveal.observe(el));
  } else all('.reveal').forEach(el=>el.classList.add('visible'));

  // Soft decorative particles, not essential to the document itself.
  const particles=$('ambientParticles');
  for(let i=0;i<13;i++){
    const particle=document.createElement('span');particle.className='particle';particle.textContent=i%4===0?'♥':'·';
    particle.style.left=`${(i*37+11)%100}%`;particle.style.animationDuration=`${12+(i*7)%12}s`;particle.style.animationDelay=`-${(i*3)%19}s`;particle.style.fontSize=`${10+(i%4)*3}px`;particles.appendChild(particle);
  }
  $('motionToggle').addEventListener('click',()=>{
    state.motionPaused=!state.motionPaused;document.body.classList.toggle('motion-paused',state.motionPaused);
    $('motionToggle').textContent=state.motionPaused?'▶':'Ⅱ';
    $('motionToggle').setAttribute('aria-label',state.motionPaused?'অ্যানিমেশন চালু করুন':'অ্যানিমেশন থামান');
    $('motionToggle').title=state.motionPaused?'অ্যানিমেশন চালু করুন':'অ্যানিমেশন থামান';
  });

  const clauseInputs=all('#clauseOptions input[type="checkbox"]');
  const bengaliNumbers=['১','২','৩','৪','৫','৬','৭','৮','৯','১০','১১','১২'];
  function selectedClauses(){return clauseInputs.filter(input=>input.checked).map(input=>({title:input.dataset.title||'',text:input.dataset.text||''}));}
  function renderSelectedClauses(){
    const root=$('paperSelectedTerms');root.replaceChildren();
    const selected=selectedClauses();
    if(!selected.length){const p=document.createElement('p');p.textContent='এই স্মারকের জন্য কোনো ঐচ্ছিক ধারা নির্বাচন করা হয় নাই।';root.appendChild(p);}
    selected.forEach((clause,index)=>{
      const p=document.createElement('p');const b=document.createElement('b');b.textContent=`${bengaliNumbers[index+4]||bengaliDigits(index+5)}। ${clause.title}।`;
      p.append(b,document.createTextNode(` ${clause.text}`));root.appendChild(p);
    });
    $('selectedCount').textContent=`${bengaliDigits(selected.length)}টি ধারা নির্বাচিত`;
  }
  clauseInputs.forEach(input=>input.addEventListener('change',()=>{if(!state.sealed){clauseInputs.forEach(item=>{const card=item.closest('.clause-option');card.classList.toggle('is-selected',item.checked);});renderSelectedClauses();fitPaper();}}));

  function updatePaperFields(){
    const first=$('firstName').value.trim();const second=$('secondName').value.trim();const date=$('agreementDate').value;const note=$('privateNote').value.trim();
    $('paperFirstParty').textContent=first||'________________________';
    $('paperSecondParty').textContent=second||'________________________';
    $('paperDate').textContent=date?formatBengaliDate(date):'________________________';
    $('paperFooterDate').textContent=date?formatBengaliDate(date):'________________';
    $('paperFirstDef').textContent=first||'প্রথম পক্ষের নাম';
    $('paperSecondDef').textContent=second||'দ্বিতীয় পক্ষের নাম';
    $('paperDateDef').textContent=date?formatBengaliDate(date):'সম্পাদনের তারিখে';
    $('paperFirstPartySignature').textContent=first||'প্রথম পক্ষের নাম';
    $('paperSignatureLabel').textContent=second||'দ্বিতীয় পক্ষের স্বাক্ষর';
    let old=$('paperPrivateNote');
    if(note){if(!old){old=document.createElement('p');old.id='paperPrivateNote';old.className='private-note';$('paperDate').closest('.party-details').insertAdjacentElement('afterend',old);}old.textContent=`বিশেষ স্মারক: ${note}`;}
    else if(old)old.remove();
    fitPaper();
  }
  $('agreementDate').value=localDateISO();
  ['firstName','secondName','agreementDate','privateNote'].forEach(id=>{ $(id).addEventListener('input',updatePaperFields);$(id).addEventListener('change',updatePaperFields); });
  renderSelectedClauses();updatePaperFields();

  // Fit the live document and the export copy to one A4 page. The PDF is made from this sheet only.
  function syncPaperScale(){
    const frame=$('paperFrame');const paper=$('contractPaper');if(!frame||!paper)return;
    const scale=Math.min(frame.clientWidth/794,1);
    paper.style.setProperty('--paper-scale',String(scale));
    // The displayed sheet remains a true A4 layout; on narrow screens the whole page
    // is scaled down instead of reflowing and cutting off its lower half.
    frame.style.height=`${1123*scale}px`;
  }
  function fitPaper(){
    const paper=$('contractPaper');if(!paper)return;
    const adjustable=all('.legal-intro,.fixed-terms p,.selected-terms p,.closing-terms p,.execution-line',paper);
    adjustable.forEach(el=>el.style.removeProperty('font-size'));
    paper.classList.remove('auto-fit');
    let size=Number.parseFloat(getComputedStyle(adjustable[0]||paper).fontSize)||12;
    for(let tries=0;tries<10;tries++){
      if(paper.scrollHeight<=paper.clientHeight+2)break;
      size-=.25;paper.classList.add('auto-fit');
      adjustable.forEach(el=>{el.style.fontSize=`${size}px`;});
    }
  }
  syncPaperScale();fitPaper();
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{syncPaperScale();fitPaper();});
  addEventListener('resize',()=>{syncPaperScale();if(!state.sealed)fitPaper();});

  // Signature canvas scales with high-DPI screens and accepts touch, pen and mouse.
  const canvas=$('signaturePad');const context=canvas.getContext('2d');
  function setupCanvas(keep=true){
    let snapshot=null;if(keep&&state.hasSignature&&!state.sealed){try{snapshot=canvas.toDataURL('image/png');}catch(_){}}
    const rect=canvas.getBoundingClientRect();if(!rect.width)return;
    const ratio=Math.max(devicePixelRatio||1,1);canvas.width=Math.round(rect.width*ratio);canvas.height=Math.round(rect.height*ratio);
    context.setTransform(ratio,0,0,ratio,0,0);context.strokeStyle='#ed6978';context.lineWidth=2.2;context.lineCap='round';context.lineJoin='round';
    if(snapshot){const img=new Image();img.onload=()=>context.drawImage(img,0,0,rect.width,rect.height);img.src=snapshot;}
  }
  setupCanvas(false);
  let resizeJob=0;addEventListener('resize',()=>{cancelAnimationFrame(resizeJob);resizeJob=requestAnimationFrame(()=>setupCanvas(true));});
  function canvasPoint(event){const rect=canvas.getBoundingClientRect();return{x:event.clientX-rect.left,y:event.clientY-rect.top};}
  function updateSealButton(){ $('sealButton').disabled=state.sealed||!$('secondName').value.trim()||!state.hasSignature||!$('consentCheck').checked; }
  function updateSignatureStatus(){ $('signatureStatus').textContent=state.hasSignature?'স্বাক্ষর প্রস্তুত':'অপেক্ষমাণ';$('signatureStatus').style.color=state.hasSignature?'#e17884':'';updateSealButton(); }
  canvas.addEventListener('pointerdown',event=>{if(state.sealed)return;event.preventDefault();state.drawing=true;if(canvas.setPointerCapture)canvas.setPointerCapture(event.pointerId);const p=canvasPoint(event);context.beginPath();context.moveTo(p.x,p.y);context.lineTo(p.x+.1,p.y+.1);context.stroke();state.hasSignature=true;updateSignatureStatus();});
  canvas.addEventListener('pointermove',event=>{if(!state.drawing||state.sealed)return;event.preventDefault();const p=canvasPoint(event);context.lineTo(p.x,p.y);context.stroke();});
  const stopDrawing=()=>{state.drawing=false;};['pointerup','pointercancel','lostpointercapture'].forEach(name=>canvas.addEventListener(name,stopDrawing));
  $('clearSignature').addEventListener('click',()=>{if(state.sealed)return;context.clearRect(0,0,canvas.width,canvas.height);state.hasSignature=false;updateSignatureStatus();});
  $('secondName').addEventListener('input',updateSealButton);$('consentCheck').addEventListener('change',updateSealButton);

  function sealDocument(){
    if(state.sealed||!$('secondName').value.trim()||!state.hasSignature||!$('consentCheck').checked)return;
    state.sealed=true;updatePaperFields();
    const img=$('paperSignatureImage');img.src=canvas.toDataURL('image/png');img.hidden=false;
    $('paperWax').classList.add('is-sealed');
    ['firstName','secondName','agreementDate','privateNote'].forEach(id=>$(id).readOnly=true);
    clauseInputs.forEach(input=>input.disabled=true);$('clearSignature').disabled=true;$('consentCheck').disabled=true;
    $('sealButton').disabled=true;$('sealButton').textContent='✓ দলিল সম্পাদিত';$('downloadPdf').disabled=false;
    $('signatureStatus').textContent='স্বাক্ষর ও সিলমোহর সম্পন্ন';$('statusMessage').textContent='চুক্তিপত্রে স্বাক্ষর ও সিলমোহর যুক্ত হয়েছে। এখন এক পাতার PDF ডাউনলোড করুন।';
    fitPaper();
  }
  $('sealButton').addEventListener('click',sealDocument);

  function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
  function makeCaptureClone(){
    const clone=$('contractPaper').cloneNode(true);clone.id='pdfCapturePaper';
    clone.style.width='794px';clone.style.height='1123px';clone.style.minHeight='1123px';clone.style.maxWidth='none';clone.style.aspectRatio='auto';
    clone.style.padding='47px 56px 36px';clone.style.margin='0';clone.style.boxShadow='none';clone.style.overflow='hidden';clone.style.transform='none';clone.style.transition='none';clone.style.position='relative';
    clone.style.backgroundColor='#0f0c0c';clone.style.color='#e6d9c6';clone.style.setProperty('--paper-copy-size','12px');
    clone.classList.remove('auto-fit');
    all('.legal-intro,.fixed-terms p,.selected-terms p,.closing-terms p,.execution-line',clone).forEach(el=>el.style.removeProperty('font-size'));
    clone.classList.add('pdf-capture-paper');
    const mount=document.createElement('div');mount.className='pdf-capture-mount';mount.style.cssText='position:fixed;left:0;top:0;width:794px;height:1123px;overflow:hidden;pointer-events:none;z-index:2147483000;visibility:hidden;';mount.appendChild(clone);document.body.appendChild(mount);
    return {mount,clone};
  }
  function loadScript(url){
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src=url;script.async=true;script.crossOrigin='anonymous';
      let timer=setTimeout(()=>{script.remove();reject(new Error(`Timed out loading ${url}`));},18000);
      script.onload=()=>{clearTimeout(timer);resolve();};
      script.onerror=()=>{clearTimeout(timer);script.remove();reject(new Error(`Failed to load ${url}`));};
      document.head.appendChild(script);
    });
  }
  async function loadPdfLibraries(){
    if(typeof window.html2canvas!=='function'){
      let loaded=false;
      for(const url of ['https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js','https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js']){
        try{await loadScript(url);if(typeof window.html2canvas==='function'){loaded=true;break;}}catch(error){console.warn(error.message);}
      }
      if(!loaded)throw new Error('Could not load html2canvas');
    }
    if(!window.jspdf||typeof window.jspdf.jsPDF!=='function'){
      let loaded=false;
      for(const url of ['https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js','https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js']){
        try{await loadScript(url);if(window.jspdf&&typeof window.jspdf.jsPDF==='function'){loaded=true;break;}}catch(error){console.warn(error.message);}
      }
      if(!loaded)throw new Error('Could not load jsPDF');
    }
  }
  async function downloadPdf(){
    if(!state.sealed)return;
    const button=$('downloadPdf');button.disabled=true;button.textContent='PDF প্রস্তুত হইতেছে…';$('downloadStatus').textContent='PDF লাইব্রেরি লোড করা হইতেছে…';
    let mount;
    try{
      await loadPdfLibraries();
      updatePaperFields();
      if(document.fonts&&document.fonts.ready)await document.fonts.ready;
      const originalImage=$('paperSignatureImage');if(originalImage&&originalImage.src)await originalImage.decode().catch(()=>{});
      await wait(180);
      const capture=makeCaptureClone();mount=capture.mount;
      const cloneImage=capture.clone.querySelector('#paperSignatureImage');
      if(cloneImage&&originalImage&&originalImage.src){cloneImage.src=originalImage.src;cloneImage.hidden=false;await cloneImage.decode().catch(()=>{});}
      // Fit the full-size export page before capture; reduce body copy only if the page truly overflows.
      const exportText=all('.legal-intro,.fixed-terms p,.selected-terms p,.closing-terms p,.execution-line',capture.clone);
      let exportSize=12;
      for(let attempt=0;attempt<9 && capture.clone.scrollHeight>capture.clone.clientHeight+2;attempt++){
        exportSize-=.3;exportText.forEach(el=>{el.style.fontSize=`${exportSize}px`;});
      }
      // Wait for Bengali typefaces in the cloned page, then rasterize this element alone.
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const canvasPdf=await window.html2canvas(capture.clone,{
        scale:2,backgroundColor:'#0f0c0c',useCORS:true,allowTaint:false,logging:false,
        width:794,height:1123,windowWidth:1200,windowHeight:1300,scrollX:0,scrollY:0,
        onclone:(clonedDoc)=>{
          const captureMount=clonedDoc.querySelector('.pdf-capture-mount');
          if(captureMount){captureMount.style.left='0';captureMount.style.top='0';captureMount.style.visibility='visible';captureMount.style.zIndex='2147483000';}
          const paper=clonedDoc.getElementById('pdfCapturePaper');
          if(paper){paper.style.visibility='visible';paper.style.width='794px';paper.style.height='1123px';paper.style.minHeight='1123px';paper.style.overflow='hidden';paper.style.boxShadow='none';paper.style.transform='none';}
        }
      });
      const PDF=window.jspdf.jsPDF;const pdf=new PDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
      // Exactly one image, on exactly one A4 page: no auto-pagination, no blank trailing pages.
      pdf.addImage(canvasPdf.toDataURL('image/jpeg',.98),'JPEG',0,0,210,297,undefined,'FAST');
      const name=$('secondName').value.trim().replace(/[^\p{L}\p{N}\p{M}_-]/gu,'_').slice(0,30)||'প্রেমচুক্তি';
      pdf.save(`ব্যক্তিগত_প্রেমচুক্তি_${name}.pdf`);
      $('downloadStatus').textContent='এক পাতার PDF ডাউনলোড সম্পন্ন। কাগজের লেখা ও স্বাক্ষর একই পাতায় রাখা হয়েছে।';
    }catch(error){
      console.error('PDF generation error:',error);
      $('downloadStatus').textContent='PDF লাইব্রেরি পাওয়া যায় নাই। বিকল্প হিসেবে প্রিন্ট হইতে PDF সংরক্ষণ করুন।';
      $('printFallback').hidden=false;
    }finally{
      if(mount)mount.remove();button.disabled=false;button.innerHTML='স্বাক্ষরিত PDF ডাউনলোড <span>↓</span>';
    }
  }
  $('downloadPdf').addEventListener('click',downloadPdf);
  function openPrintableContract(){
    const printWindow=window.open('','_blank');
    if(!printWindow){$('downloadStatus').textContent='নতুন উইন্ডোটি ব্রাউজার আটকে দিয়েছে। পপ-আপ অনুমতি দিয়ে আবার চেষ্টা করুন।';return;}
    const paper=$('contractPaper').cloneNode(true);
    paper.id='contractPaper';paper.style.setProperty('--paper-scale','1');paper.style.transform='none';
    const baseUrl=new URL('.',window.location.href).href;
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html lang="bn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="${baseUrl}"><title>ব্যক্তিগত প্রেমচুক্তি — মুদ্রণ</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Noto+Serif+Bengali:wght@400;500;600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="css/style.css"><style>@page{size:A4;margin:0}html,body{width:210mm!important;height:297mm!important;margin:0!important;padding:0!important;background:#fff!important;overflow:hidden!important}#contractPaper{position:relative!important;top:auto!important;left:auto!important;width:210mm!important;height:297mm!important;min-height:297mm!important;aspect-ratio:auto!important;padding:47px 56px 36px!important;margin:0!important;overflow:hidden!important;box-shadow:none!important;transform:none!important;break-after:avoid!important;page-break-after:avoid!important}.paper-border{inset:14px!important}.wax-seal.is-sealed{opacity:1!important;transform:rotate(8deg) scale(1)!important;transition:none!important}</style></head><body>${paper.outerHTML}<script>window.addEventListener('load',async()=>{try{if(document.fonts)await document.fonts.ready;}catch(e){}window.focus();window.print();});window.addEventListener('afterprint',()=>window.close());<\/script></body></html>`);
    printWindow.document.close();
  }
  $('printFallback').addEventListener('click',openPrintableContract);
  updateSealButton();
})();
