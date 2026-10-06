/* Biên tập Map Online · xulytiengviet/bientapmap · MIT */
'use strict';

  async function captureSheet(){
    status('Đang dựng layout xuất bản…');
    if(el('nationalFrame').checked) fitNational();
    await new Promise(r=>setTimeout(r,650));
    state.map.invalidateSize(false);
    return html2canvas(el('printSheet'),{scale:2,useCORS:true,allowTaint:false,backgroundColor:'#ffffff',logging:false});
  }

  async function exportPNG(){ try{ const canvas=await captureSheet(); canvas.toBlob(blob=>{ downloadBlob(blob,slugFile(el('mapTitle').value)+'.png'); status('Đã tạo PNG.'); },'image/png',1); }catch(e){ status('Không thể xuất PNG: '+e.message); } }
  async function exportPDF(){ try{ const canvas=await captureSheet(); const img=canvas.toDataURL('image/jpeg',.94); const {jsPDF}=window.jspdf; const pdf=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'}); pdf.addImage(img,'JPEG',0,0,297,210,undefined,'FAST'); pdf.save(slugFile(el('mapTitle').value)+'.pdf'); status('Đã tạo PDF A4 ngang.'); }catch(e){ status('Không thể xuất PDF: '+e.message); } }

  function slugFile(s){ return (s||'ban-do').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_|_$/g,'').toLowerCase(); }
  function downloadBlob(blob,name){ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000); }

  function exportGeoJSON(){
    const out=structuredClone(state.data);
    out.features.forEach(ft=>{ const n=provinceName(ft),g=groupForProvince(n); ft.properties={...ft.properties,editor_group:g?.name||'',editor_color:featureColor(n),editor_label:state.labelOverrides[n]||n}; });
    downloadBlob(new Blob([JSON.stringify(out,null,2)],{type:'application/geo+json'}),slugFile(el('mapTitle').value)+'.geojson'); status('Đã xuất GeoJSON kèm tên nhóm, màu và nhãn biên tập.');
  }

  function projectPayload(){ return {version:1,title:el('mapTitle').value,subtitle:el('mapSubtitle').value,author:el('authorName').value,source:el('sourceText').value,sea:el('seaLabelInput').value,hs:el('hsLabelInput').value,ts:el('tsLabelInput').value,crs:el('crsSelect').value,groups:state.groups,provinceColors:state.provinceColors,labelOverrides:state.labelOverrides,labels:el('provinceLabelsToggle').checked,grid:el('gridToggle').checked,north:el('northToggle').checked,scale:el('scaleToggle').checked,legend:el('legendToggle').checked,nationalFrame:el('nationalFrame').checked,basemap:el('basemapSelect').value,opacity:el('fillOpacity').value}; }
  function saveProject(){ downloadBlob(new Blob([JSON.stringify(projectPayload(),null,2)],{type:'application/json'}),slugFile(el('mapTitle').value)+'_project.json'); status('Đã lưu dự án biên tập.'); }
  function loadProject(p){
    if(!p||!Array.isArray(p.groups)) throw new Error('Không đúng định dạng dự án.');
    state.groups=p.groups; state.activeGroupId=state.groups[0]?.id||null; state.provinceColors=p.provinceColors||{}; state.labelOverrides=p.labelOverrides||{};
    const set=(id,v)=>{ if(v!==undefined&&el(id)) el(id).value=v; }; set('mapTitle',p.title);set('mapSubtitle',p.subtitle);set('authorName',p.author);set('sourceText',p.source);set('seaLabelInput',p.sea);set('hsLabelInput',p.hs);set('tsLabelInput',p.ts);set('crsSelect',p.crs);set('basemapSelect',p.basemap);set('fillOpacity',p.opacity);
    ['provinceLabelsToggle','gridToggle','northToggle','scaleToggle','legendToggle','nationalFrame'].forEach(id=>{ const key={provinceLabelsToggle:'labels',gridToggle:'grid',northToggle:'north',scaleToggle:'scale',legendToggle:'legend',nationalFrame:'nationalFrame'}[id]; if(p[key]!==undefined) el(id).checked=!!p[key]; });
    setBasemap(el('basemapSelect').value); renderGroups(); refreshStyles(); updateProvinceLabels(); syncText(); syncMapDecorations(); drawGrid(); fitNational(); status('Đã mở dự án.');
  }

  function syncMapDecorations(){
    el('northArrow').style.display=el('northToggle').checked?'block':'none';
    const scale=state.map.getContainer().querySelector('.leaflet-control-scale'); if(scale) scale.style.display=el('scaleToggle').checked?'block':'none';
    el('legendPanel').style.display=el('legendToggle').checked?'block':'none';
    el('crsBadge').textContent=crsLabel();
  }

  async function importGeoJSON(file){
    const txt=await file.text(); const data=JSON.parse(txt); if(data.type!=='FeatureCollection'||!Array.isArray(data.features)) throw new Error('Cần FeatureCollection GeoJSON.');
    data.features.forEach((f,i)=>{ f.properties=f.properties||{}; if(!f.properties.ten_tinh) f.properties.ten_tinh=f.properties.name||f.properties.NAME_1||f.properties.NAME||`Đơn vị ${i+1}`; });
    state.data=data; state.selected.clear(); state.groups=[]; state.provinceColors={}; state.labelOverrides={}; renderProvinceList(); applyPreset('national'); renderGeo(); fitNational(); status(`Đã nạp GeoJSON: ${data.features.length} đối tượng.`);
  }

  function bindUI(){
    document.querySelectorAll('.preset-btn').forEach(b=>b.addEventListener('click',()=>applyPreset(b.dataset.preset)));
    el('provinceSearch').addEventListener('input',e=>renderProvinceList(e.target.value));
    el('selectAllBtn').addEventListener('click',()=>{ state.data.features.forEach(f=>state.selected.add(provinceName(f))); renderProvinceList(el('provinceSearch').value); });
    el('clearSelectionBtn').addEventListener('click',()=>{ state.selected.clear(); renderProvinceList(el('provinceSearch').value); });
    el('createGroupBtn').addEventListener('click',createGroup); el('focusSelectionBtn').addEventListener('click',fitSelected); el('fitNationalBtn').addEventListener('click',fitNational);
    document.querySelectorAll('[data-color-target]').forEach(b=>b.addEventListener('click',()=>{ document.querySelectorAll('[data-color-target]').forEach(x=>x.classList.remove('active')); b.classList.add('active'); state.colorTarget=b.dataset.colorTarget; el('colorHint').textContent=state.colorTarget==='province'?(state.activeProvince?`Màu sẽ áp dụng cho tỉnh ${state.activeProvince}.`:'Nhấp một tỉnh trên bản đồ, sau đó chọn màu.'):'Chọn một nhóm ở danh sách trên, sau đó bấm màu.'; }));
    el('customColor').addEventListener('input',e=>applyColor(e.target.value));
    ['mapTitle','mapSubtitle','authorName','sourceText','seaLabelInput','hsLabelInput','tsLabelInput','titleSize'].forEach(id=>el(id).addEventListener('input',syncText));
    el('provinceLabelsToggle').addEventListener('change',updateProvinceLabels);
    el('applyProvinceLabelBtn').addEventListener('click',()=>{ if(!state.activeProvince)return; state.labelOverrides[state.activeProvince]=el('provinceLabelInput').value.trim()||state.activeProvince; updateProvinceLabels(); status(`Đã cập nhật nhãn ${state.activeProvince}.`); });
    el('crsSelect').addEventListener('change',()=>{ syncMapDecorations(); drawGrid(); }); el('gridToggle').addEventListener('change',drawGrid); el('degreeStep').addEventListener('change',drawGrid); el('meterStep').addEventListener('change',drawGrid);
    ['northToggle','scaleToggle','legendToggle'].forEach(id=>el(id).addEventListener('change',syncMapDecorations));
    el('basemapSelect').addEventListener('change',e=>setBasemap(e.target.value)); el('fillOpacity').addEventListener('input',refreshStyles);
    el('exportPngBtn').addEventListener('click',exportPNG); el('exportPdfBtn').addEventListener('click',exportPDF); el('exportGeojsonBtn').addEventListener('click',exportGeoJSON); el('saveProjectBtn').addEventListener('click',saveProject);
    el('geojsonImport').addEventListener('change',async e=>{ try{ if(e.target.files[0]) await importGeoJSON(e.target.files[0]); }catch(err){status('Lỗi GeoJSON: '+err.message);} finally{e.target.value='';} });
    el('loadProjectInput').addEventListener('change',async e=>{ try{ if(e.target.files[0]) loadProject(JSON.parse(await e.target.files[0].text())); }catch(err){status('Lỗi dự án: '+err.message);} finally{e.target.value='';} });
    el('toggleEditorBtn').addEventListener('click',()=>{ document.querySelector('.app-shell').classList.toggle('editor-hidden'); setTimeout(()=>state.map.invalidateSize(),220); });
  }

  async function boot(){
    try{
      initMap(); buildPalette(); bindUI(); status('Đang tải dữ liệu 34 tỉnh/thành…');
      const res=await fetch(DATA_URL); if(!res.ok) throw new Error(`HTTP ${res.status}`); state.data=normalizeData(await res.json());
      renderProvinceList(); applyPreset('regions'); renderGeo(); drawGrid(); syncText(); syncMapDecorations(); fitNational();
      status('Sẵn sàng. Chọn tỉnh/thành để tạo khu vực hoặc nhấp trực tiếp lên bản đồ để sửa nhãn.');
    }catch(err){ console.error(err); status('Không thể khởi tạo: '+err.message); }
  }
  window.addEventListener('DOMContentLoaded',boot);