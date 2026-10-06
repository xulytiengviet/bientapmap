/* Biên tập Map Online · xulytiengviet/bientapmap · MIT */
'use strict';

  const DATA_URL = 'data/provinces.json';
  const NATIONAL_BOUNDS = [[5.8, 101.7], [24.55, 119.15]];
  const SEA_POS = [15.15, 114.3];
  const HS_POS = [16.5, 112.0];
  const TS_POS = [9.7, 114.3];
  const COLORS = { border:'#18324d', neutral:'#d7dee7', water:'#edf8ff' };
  const REGION_DEFS = [
    {id:'R1',name:'Trung du và miền núi phía Bắc',color:'#2F9E44',provinces:['Tuyên Quang','Cao Bằng','Lai Châu','Điện Biên','Sơn La','Lào Cai','Thái Nguyên','Lạng Sơn','Phú Thọ']},
    {id:'R2',name:'Đồng bằng sông Hồng',color:'#F08C00',provinces:['Hà Nội','Hải Phòng','Quảng Ninh','Bắc Ninh','Hưng Yên','Ninh Bình']},
    {id:'R3',name:'Bắc Trung Bộ',color:'#D9AE32',provinces:['Thanh Hóa','Nghệ An','Hà Tĩnh','Quảng Trị','Huế']},
    {id:'R4',name:'Duyên hải Nam Trung Bộ và Tây Nguyên',color:'#2878B5',provinces:['Đà Nẵng','Quảng Ngãi','Gia Lai','Đắk Lắk','Khánh Hòa','Lâm Đồng']},
    {id:'R5',name:'Đông Nam Bộ',color:'#8D5AA7',provinces:['TP. Hồ Chí Minh','Đồng Nai','Tây Ninh']},
    {id:'R6',name:'Đồng bằng sông Cửu Long',color:'#A9C542',provinces:['Cần Thơ','Vĩnh Long','Đồng Tháp','An Giang','Cà Mau']}
  ];

  const el = id => document.getElementById(id);
  const state = {
    data:null,
    map:null,
    geoLayer:null,
    baseLayer:null,
    gridLayer:null,
    labelsLayer:null,
    specialLabelsLayer:null,
    selected:new Set(),
    groups:[],
    activeGroupId:null,
    activeProvince:null,
    provinceColors:{},
    labelOverrides:{},
    colorTarget:'group',
    currentBasemap:'white'
  };

  proj4.defs('EPSG:4756','+proj=longlat +ellps=WGS84 +towgs84=-191.90441429,-39.30318279,-111.45032835,-0.00928836,0.01975479,-0.00427372,0.252906278 +no_defs +type=crs');
  proj4.defs('EPSG:3405','+proj=utm +zone=48 +ellps=WGS84 +towgs84=-191.90441429,-39.30318279,-111.45032835,-0.00928836,0.01975479,-0.00427372,0.252906278 +units=m +no_defs +type=crs');
  proj4.defs('EPSG:3406','+proj=utm +zone=49 +ellps=WGS84 +towgs84=-191.90441429,-39.30318279,-111.45032835,-0.00928836,0.01975479,-0.00427372,0.252906278 +units=m +no_defs +type=crs');

  function uid(){ return 'g_' + Math.random().toString(36).slice(2,9); }
  function escapeHtml(s=''){ return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function status(msg){ el('statusBox').textContent = msg; }
  function provinceName(ft){ const p=ft.properties||{}; return p.ten_tinh || p.name || p.NAME_1 || p.NAME || `Đơn vị ${p.stt||''}`; }
  function normalizeData(raw){
    if(raw?.type==='FeatureCollection' && Array.isArray(raw.features)) return raw;
    if(Array.isArray(raw?.provinces)){
      return {type:'FeatureCollection',name:'Viet Nam 34 provinces - web optimized',features:raw.provinces.map((p,i)=>({
        type:'Feature',
        properties:{ma_tinh:p.id,ten_tinh:p.name,loai:p.type,stt:i+1,dtich_km2:p.area,dan_so:p.population,matdo_km2:p.density},
        geometry:{type:'MultiPolygon',coordinates:(p.polygons||[]).map(ring=>[ring])}
      }))};
    }
    throw new Error('Dữ liệu nền không đúng định dạng.');
  }
  function provinceByName(name){ return state.data?.features.find(f=>provinceName(f)===name); }
  function groupForProvince(name){ for(let i=state.groups.length-1;i>=0;i--){ if(state.groups[i].provinces.includes(name)) return state.groups[i]; } return null; }
  function regionForProvince(name){ return REGION_DEFS.find(r=>r.provinces.includes(name)); }
  function featureColor(name){ return state.provinceColors[name] || groupForProvince(name)?.color || regionForProvince(name)?.color || COLORS.neutral; }

  function initMap(){
    state.map = L.map('map',{zoomControl:true,attributionControl:true,minZoom:4,maxZoom:13,preferCanvas:false});
    state.map.attributionControl.setPrefix(false);
    L.control.scale({position:'bottomright',imperial:false,maxWidth:130}).addTo(state.map);
    setBasemap('white');
    fitNational();
    state.map.on('mousemove', e => updateCoordReadout(e.latlng));
    state.map.on('zoomend moveend', () => { if(el('gridToggle').checked) drawGrid(); });
  }

  function setBasemap(kind){
    if(state.baseLayer) state.map.removeLayer(state.baseLayer);
    state.currentBasemap = kind;
    if(kind==='light'){
      state.baseLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{subdomains:'abcd',maxZoom:20,crossOrigin:true,attribution:'© OpenStreetMap © CARTO'}).addTo(state.map);
    } else if(kind==='osm'){
      state.baseLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,crossOrigin:true,attribution:'© OpenStreetMap contributors'}).addTo(state.map);
    } else {
      state.baseLayer = L.layerGroup().addTo(state.map);
      state.map.getContainer().style.background = '#ffffff';
    }
    if(state.geoLayer) state.geoLayer.bringToFront();
    if(state.gridLayer) state.gridLayer.bringToFront();
    if(state.labelsLayer) state.labelsLayer.bringToFront();
    if(state.specialLabelsLayer) state.specialLabelsLayer.bringToFront();
  }

  function fitNational(){ state.map.fitBounds(NATIONAL_BOUNDS,{padding:[8,8],animate:false}); }
  function fitSelected(){
    const names=[...state.selected];
    if(!names.length){ status('Hãy chọn ít nhất một tỉnh/thành.'); return; }
    const temp=L.geoJSON({type:'FeatureCollection',features:state.data.features.filter(f=>names.includes(provinceName(f)))});
    const b=temp.getBounds();
    if(b.isValid()) state.map.fitBounds(b.pad(.12),{animate:true});
  }

  function renderGeo(){
    if(state.geoLayer) state.map.removeLayer(state.geoLayer);
    state.geoLayer = L.geoJSON(state.data,{
      style: f => ({color:COLORS.border,weight:0.8,fillColor:featureColor(provinceName(f)),fillOpacity:Number(el('fillOpacity').value)}),
      onEachFeature:(f,layer)=>{
        const name=provinceName(f);
        layer.on('click', () => activateProvince(name));
        layer.bindTooltip(name,{sticky:true,direction:'top',opacity:.96});
      }
    }).addTo(state.map);
    updateProvinceLabels();
    updateSpecialLabels();
  }

  function refreshStyles(){
    state.geoLayer?.eachLayer(layer=>{
      const name=provinceName(layer.feature);
      layer.setStyle({fillColor:featureColor(name),fillOpacity:Number(el('fillOpacity').value)});
    });
    updateLegend();
  }

  function centroidLatLng(ft){
    const layer=L.geoJSON(ft);
    const b=layer.getBounds();
    return b.isValid()?b.getCenter():L.latLng(0,0);
  }

  function updateProvinceLabels(){
    if(state.labelsLayer) state.map.removeLayer(state.labelsLayer);
    state.labelsLayer=L.layerGroup();
    if(el('provinceLabelsToggle').checked){
      for(const ft of state.data.features){
        const name=provinceName(ft);
        const c=centroidLatLng(ft);
        const text=state.labelOverrides[name] || name;
        const icon=L.divIcon({className:'map-label',html:`<span>${escapeHtml(text)}</span>`,iconSize:[1,1],iconAnchor:[0,0]});
        L.marker(c,{icon,interactive:false}).addTo(state.labelsLayer);
      }
    }
    state.labelsLayer.addTo(state.map);
  }

  function specialIcon(text, cls){ return L.divIcon({className:`map-label ${cls}`,html:`<span>${escapeHtml(text)}</span>`,iconSize:[1,1],iconAnchor:[0,0]}); }
  function updateSpecialLabels(){
    if(state.specialLabelsLayer) state.map.removeLayer(state.specialLabelsLayer);
    state.specialLabelsLayer=L.layerGroup([
      L.marker(SEA_POS,{icon:specialIcon(el('seaLabelInput').value,'sea-label'),interactive:false}),
      L.marker(HS_POS,{icon:specialIcon(el('hsLabelInput').value,'island-label'),interactive:false}),
      L.marker(TS_POS,{icon:specialIcon(el('tsLabelInput').value,'island-label'),interactive:false})
    ]).addTo(state.map);
  }

  function activateProvince(name){
    state.activeProvince=name;
    el('activeProvinceName').textContent=name;
    el('provinceLabelInput').disabled=false;
    el('applyProvinceLabelBtn').disabled=false;
    el('provinceLabelInput').value=state.labelOverrides[name] || name;
    if(state.colorTarget==='province') el('colorHint').textContent=`Màu sẽ áp dụng cho tỉnh ${name}.`;
  }

  function renderProvinceList(filter=''){
    const q=filter.trim().toLocaleLowerCase('vi');
    const sorted=[...state.data.features].sort((a,b)=>provinceName(a).localeCompare(provinceName(b),'vi'));
    el('provinceList').innerHTML='';
    for(const ft of sorted){
      const name=provinceName(ft); if(q && !name.toLocaleLowerCase('vi').includes(q)) continue;
      const region=regionForProvince(name);
      const row=document.createElement('label'); row.className='province-item';
      row.innerHTML=`<input type="checkbox" ${state.selected.has(name)?'checked':''} data-province="${escapeHtml(name)}"><span>${escapeHtml(name)}</span><i class="region-dot" style="background:${region?.color||'#aaa'}"></i>`;
      row.querySelector('input').addEventListener('change',e=>{ e.target.checked?state.selected.add(name):state.selected.delete(name); updateSelectedCount(); });
      el('provinceList').appendChild(row);
    }
    updateSelectedCount();
  }

  function updateSelectedCount(){ el('selectedCount').textContent=`${state.selected.size} đã chọn`; }
