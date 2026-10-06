/* Biên tập Map Online · xulytiengviet/bientapmap · MIT */
'use strict';

  function renderGroups(){
    const box=el('groupList'); box.innerHTML='';
    for(const g of state.groups){
      const row=document.createElement('div'); row.className='group-row'+(g.id===state.activeGroupId?' active':''); row.dataset.id=g.id;
      row.innerHTML=`<span class="group-color" style="background:${g.color}"></span><span class="group-name" title="${escapeHtml(g.name)}">${escapeHtml(g.name)}</span><span class="group-count">${g.provinces.length}</span><button class="icon-btn" title="Xóa nhóm">×</button>`;
      row.addEventListener('click',e=>{ if(e.target.closest('.icon-btn')) return; state.activeGroupId=g.id; renderGroups(); el('colorHint').textContent=`Màu sẽ áp dụng cho nhóm “${g.name}”.`; });
      row.querySelector('.icon-btn').addEventListener('click',()=>{ state.groups=state.groups.filter(x=>x.id!==g.id); if(state.activeGroupId===g.id) state.activeGroupId=state.groups[0]?.id||null; renderGroups(); refreshStyles(); });
      box.appendChild(row);
    }
    updateLegend();
  }

  function applyPreset(type){
    state.provinceColors={}; state.labelOverrides={}; state.selected.clear();
    if(type==='national'){
      state.groups=[{id:uid(),name:'Việt Nam',color:'#4C9F70',provinces:state.data.features.map(provinceName)}];
      el('mapTitle').value='BẢN ĐỒ VIỆT NAM'; el('mapSubtitle').value='34 tỉnh/thành';
    } else {
      state.groups=REGION_DEFS.map(r=>({id:uid(),name:r.name,color:r.color,provinces:[...r.provinces]}));
      el('mapTitle').value='BẢN ĐỒ CÁC VÙNG KINH TẾ - XÃ HỘI VIỆT NAM'; el('mapSubtitle').value='6 vùng · 34 tỉnh/thành';
    }
    state.activeGroupId=state.groups[0]?.id||null;
    renderProvinceList(el('provinceSearch').value); renderGroups(); refreshStyles(); syncText(); fitNational();
    status(type==='national'?'Đã chuyển sang bản đồ toàn quốc.':'Đã nạp 6 vùng kinh tế - xã hội.');
  }

  function createGroup(){
    const names=[...state.selected]; const name=el('groupName').value.trim();
    if(!names.length){ status('Chọn tỉnh/thành trước khi tạo nhóm.'); return; }
    if(!name){ status('Nhập tên khu vực / địa bàn.'); return; }
    const color=el('customColor').value;
    for(const g of state.groups) g.provinces=g.provinces.filter(p=>!names.includes(p));
    state.groups=state.groups.filter(g=>g.provinces.length);
    const g={id:uid(),name,color,provinces:names}; state.groups.push(g); state.activeGroupId=g.id;
    state.selected.clear(); el('groupName').value=''; renderProvinceList(el('provinceSearch').value); renderGroups(); refreshStyles();
    status(`Đã tạo “${name}” gồm ${names.length} tỉnh/thành.`);
  }

  function buildPalette(){
    const box=el('palette256');
    for(let i=0;i<256;i++){
      const col=i%16,row=Math.floor(i/16); const h=(col*22.5 + row*4)%360; const s=42+(row%4)*12; const l=27+Math.floor(row/4)*13;
      const color=`hsl(${h} ${Math.min(s,88)}% ${Math.min(l,72)}%)`;
      const b=document.createElement('button'); b.className='swatch'; b.style.background=color; b.title=`Màu ${i+1}`; b.addEventListener('click',()=>applyColor(color)); box.appendChild(b);
    }
  }

  function cssToHex(color){
    const c=document.createElement('canvas').getContext('2d');
    c.fillStyle='#000000'; c.fillStyle=color;
    const v=String(c.fillStyle);
    if(v.startsWith('#')) return v.length===4 ? '#' + [...v.slice(1)].map(x=>x+x).join('') : v.slice(0,7);
    const rgb=(v.match(/\d+(?:\.\d+)?/g)||[]).slice(0,3).map(Number);
    return rgb.length===3 ? '#' + rgb.map(n=>Math.max(0,Math.min(255,Math.round(n))).toString(16).padStart(2,'0')).join('') : '#2f80ed';
  }
  function applyColor(color){
    const hex=cssToHex(color); el('customColor').value=hex;
    if(state.colorTarget==='province'){
      if(!state.activeProvince){ status('Nhấp một tỉnh trên bản đồ trước khi tô màu riêng.'); return; }
      state.provinceColors[state.activeProvince]=hex; status(`Đã đổi màu ${state.activeProvince}.`);
    } else {
      const g=state.groups.find(x=>x.id===state.activeGroupId); if(!g){ status('Chọn một nhóm trước khi tô màu.'); return; }
      g.color=hex; status(`Đã đổi màu nhóm “${g.name}”.`); renderGroups();
    }
    refreshStyles();
  }

  function syncText(){
    el('layoutTitle').textContent=el('mapTitle').value;
    el('layoutTitle').style.fontSize=`${Number(el('titleSize').value)||30}px`;
    el('layoutSubtitle').textContent=el('mapSubtitle').value;
    el('layoutAuthor').textContent=el('authorName').value;
    el('layoutSource').textContent=el('sourceText').value;
    updateSpecialLabels();
  }

  function updateLegend(){
    const box=el('legendList'); box.innerHTML='';
    const groups=state.groups.length?state.groups:REGION_DEFS.map(r=>({...r}));
    groups.forEach(g=>{
      const item=document.createElement('div'); item.className='legend-item';
      item.innerHTML=`<span class="legend-swatch" style="background:${g.color}"></span><div><div class="legend-label">${escapeHtml(g.name)}</div><div class="legend-sub">${g.provinces.length} tỉnh/thành</div></div>`;
      box.appendChild(item);
    });
    el('legendScope').textContent=groups.length===1?groups[0].name:`${groups.length} khu vực / nhóm`;
    el('legendUnits').textContent=`${state.data?.features.length||0} tỉnh/thành`;
    el('legendPanel').style.display=el('legendToggle').checked?'block':'none';
  }

  function crsLabel(){ return el('crsSelect').selectedOptions[0].textContent; }
  function updateCoordReadout(latlng){
    const crs=el('crsSelect').value;
    try{
      if(crs==='EPSG:4326') el('coordReadout').textContent=`Lon ${latlng.lng.toFixed(5)} · Lat ${latlng.lat.toFixed(5)}`;
      else if(crs==='EPSG:4756'){
        const p=proj4('EPSG:4326','EPSG:4756',[latlng.lng,latlng.lat]); el('coordReadout').textContent=`VN-2000 Lon ${p[0].toFixed(5)} · Lat ${p[1].toFixed(5)}`;
      } else {
        const p=proj4('EPSG:4326',crs,[latlng.lng,latlng.lat]); el('coordReadout').textContent=`E ${Math.round(p[0]).toLocaleString('vi-VN')} m · N ${Math.round(p[1]).toLocaleString('vi-VN')} m`;
      }
    }catch(err){ el('coordReadout').textContent='Không chuyển đổi được tọa độ tại vị trí này.'; }
  }

  function drawGrid(){
    if(state.gridLayer) state.map.removeLayer(state.gridLayer);
    state.gridLayer=L.layerGroup(); if(!el('gridToggle').checked){ return; }
    const crs=el('crsSelect').value;
    if(crs==='EPSG:4326' || crs==='EPSG:4756') drawDegreeGrid(state.gridLayer,Number(el('degreeStep').value)||2);
    else drawProjectedGrid(state.gridLayer,crs,Number(el('meterStep').value)||200000);
    state.gridLayer.addTo(state.map); state.gridLayer.bringToFront();
  }

  function drawDegreeGrid(group,step){
    const b=state.map.getBounds(); const minLon=Math.floor(b.getWest()/step)*step,maxLon=Math.ceil(b.getEast()/step)*step,minLat=Math.floor(b.getSouth()/step)*step,maxLat=Math.ceil(b.getNorth()/step)*step;
    for(let lon=minLon;lon<=maxLon;lon+=step){ const pts=[]; for(let lat=minLat;lat<=maxLat;lat+=.25) pts.push([lat,lon]); L.polyline(pts,{color:'#7a8da0',weight:.55,opacity:.55,dashArray:'2 4',interactive:false}).addTo(group); addGridLabel(group,[Math.max(minLat,b.getSouth()+.15),lon],`${lon.toFixed(0)}°E`); }
    for(let lat=minLat;lat<=maxLat;lat+=step){ const pts=[]; for(let lon=minLon;lon<=maxLon;lon+=.25) pts.push([lat,lon]); L.polyline(pts,{color:'#7a8da0',weight:.55,opacity:.55,dashArray:'2 4',interactive:false}).addTo(group); addGridLabel(group,[lat,Math.max(minLon,b.getWest()+.15)],`${lat.toFixed(0)}°N`); }
  }

  function drawProjectedGrid(group,crs,step){
    const b=state.map.getBounds(); const corners=[[b.getWest(),b.getSouth()],[b.getWest(),b.getNorth()],[b.getEast(),b.getSouth()],[b.getEast(),b.getNorth()]].map(p=>proj4('EPSG:4326',crs,p));
    const xs=corners.map(p=>p[0]), ys=corners.map(p=>p[1]); const minX=Math.floor(Math.min(...xs)/step)*step,maxX=Math.ceil(Math.max(...xs)/step)*step,minY=Math.floor(Math.min(...ys)/step)*step,maxY=Math.ceil(Math.max(...ys)/step)*step;
    const samples=40;
    for(let x=minX;x<=maxX;x+=step){ const pts=[]; for(let i=0;i<=samples;i++){ const y=minY+(maxY-minY)*i/samples; const p=proj4(crs,'EPSG:4326',[x,y]); if(Number.isFinite(p[0])&&Number.isFinite(p[1])) pts.push([p[1],p[0]]); } if(pts.length>1){ L.polyline(pts,{color:'#7a8da0',weight:.55,opacity:.55,dashArray:'2 4',interactive:false}).addTo(group); addGridLabel(group,pts[Math.floor(pts.length/2)],`${Math.round(x/1000)}kE`); } }
    for(let y=minY;y<=maxY;y+=step){ const pts=[]; for(let i=0;i<=samples;i++){ const x=minX+(maxX-minX)*i/samples; const p=proj4(crs,'EPSG:4326',[x,y]); if(Number.isFinite(p[0])&&Number.isFinite(p[1])) pts.push([p[1],p[0]]); } if(pts.length>1){ L.polyline(pts,{color:'#7a8da0',weight:.55,opacity:.55,dashArray:'2 4',interactive:false}).addTo(group); addGridLabel(group,pts[Math.floor(pts.length/2)],`${Math.round(y/1000)}kN`); } }
  }

  function addGridLabel(group,latlng,text){ L.marker(latlng,{interactive:false,icon:L.divIcon({className:'grid-label',html:escapeHtml(text),iconSize:null})}).addTo(group); }
