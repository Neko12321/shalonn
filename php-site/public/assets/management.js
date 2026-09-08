import { root, api, escape as e, money, date, tag, status, normal, id, notify, busy, empty, input, select, check, textarea, submit, errorBox, values, dialog, table, iconButton, confirmAction, copy, download, image, affiliateLink, failurePage } from './common.js';

const partnerMode = document.body.dataset.screen === 'affiliate';
let state, data, section = partnerMode ? 'overview' : 'dashboard', pageNumber = 1, query = '', filter = '';
let passwordDraft = '', usernameDraft = '', refreshing = false;
const labels={dashboard:'Genel Bakış',players:'Oyuncular',finance:'Talepler ve Finans',bets:'Bahisler',games:'Oyunlar',banners:'Bannerlar',matches:'Maçlar',payments:'Ödeme Yöntemleri',employees:'Çalışanlar',affiliates:'Affiliate Ortakları',pages:'Kurumsal Sayfalar',support:'Destek',settings:'Ayarlar',backup:'Yedekleme',overview:'Genel Bakış',members:'Üyelerim',links:'Bağlantılarım',security:'Hesap Güvenliği'};
const groups = partnerMode ? [['ORTAKLIK',['overview','members','links']],['HESAP',['security']]] : [['OPERASYON',['dashboard','players','finance','bets']],['ORGANİZASYON',['employees','affiliates']],['İÇERİK',['games','banners','matches','payments','pages']],['SİSTEM',['support','settings','backup']]];
const icons={dashboard:'▦',players:'◉',finance:'₺',bets:'▤',games:'▧',banners:'◇',matches:'◎',payments:'▱',employees:'◉',affiliates:'↗',pages:'▤',support:'◌',settings:'⚙',backup:'↓',overview:'▦',members:'◉',links:'↗',security:'◇'};
const currentUser = () => partnerMode ? state.partner : state.staff;
const allowed = (s) => partnerMode || currentUser()?.role==='owner' || currentUser()?.permissions.includes(s);
const canUse = (s) => allowed(s) && (!['employees','backup'].includes(s) || currentUser()?.role==='owner');
const contentType = {games:'games',banners:'banners',matches:'matches',payments:'paymentMethods',pages:'pages'};
const permissionList = ['dashboard','players','finance','bets','games','banners','matches','payments','pages','support','employees','affiliates','settings','backup'];

async function load() {
  state=await api('bootstrap');
  if(currentUser()) data=partnerMode ? await api('affiliate.members') : await api('admin.state');
}

function login() {
  root.innerHTML=`<main class="install-wrap"><form class="login-card form" id="management-login"><div class="admin-monogram">S</div><h1>SHALOM BET</h1><p class="muted">${partnerMode?'Affiliate ortak paneli':'Yönetim paneli'}</p>${input('username','Kullanıcı adı',usernameDraft,'text','required autocomplete="username"')}${input('password','Şifre',passwordDraft,'password','required autocomplete="current-password"')}${submit('Giriş yap')}<a href="${partnerMode?'admin.php':'ortak.php'}" class="form-link">${partnerMode?'Yönetici girişi':'Affiliate girişi'} →</a><a href="index.php" class="form-link">Siteye dön</a></form></main>`;
  const form=document.getElementById('management-login');
  form.onsubmit=event=>{event.preventDefault();busy(form,async()=>{usernameDraft=form.elements.username.value;await api(partnerMode?'affiliate.login':'admin.login',values(form));passwordDraft='';await load();render();});};
}

function navigation() {
  return groups.map(([group,items])=>{const visible=items.filter(canUse);return visible.length?`<div class="nav-group"><h2>${group}</h2>${visible.map(s=>`<button data-section="${s}" class="${section===s?'active':''}"><span>${icons[s]}</span>${labels[s]}${s==='finance'&&data?.transactions?.some(t=>t.status==='pending')?`<b>${data.transactions.filter(t=>t.status==='pending').length}</b>`:''}</button>`).join('')}</div>`:'';}).join('');
}

function shell() {
  const user=currentUser();
  root.innerHTML=`<div class="admin-layout"><aside class="sidebar"><a class="admin-brand" href="${partnerMode?'ortak.php':'admin.php'}"><span>S</span><div>SHALOM BET<small>${partnerMode?'ORTAK PANELİ':'YÖNETİM MERKEZİ'}</small></div></a><nav id="management-nav">${navigation()}</nav><div class="sidebar-bottom"><span class="avatar">${e(user.username[0].toUpperCase())}</span><div><strong>${e(user.username)}</strong><small>${partnerMode?'Affiliate ortağı':user.role==='owner'?'Sistem yöneticisi':'Çalışan'}</small></div><button data-action="logout" title="Çıkış yap" aria-label="Çıkış yap">↪</button></div></aside><div class="admin-workspace"><header class="admin-top"><div><button class="mobile-menu" data-action="menu" aria-label="Menüyü aç">☰</button><span>Yönetim / <b>${e(labels[section]||'Panel')}</b></span></div><div class="actions"><span class="connection"><i></i>Sunucuya bağlı</span><a class="btn small" href="index.php" target="_blank" rel="noopener">Siteyi görüntüle ↗</a><button class="btn small" data-action="refresh">Yenile</button></div></header><main id="main" class="admin-main"><div class="admin-page-head"><div><span class="eyebrow">${partnerMode?'ORTAKLIK YÖNETİMİ':'SHALOM BET OPERASYON'}</span><h1>${e(labels[section]||'Panel')}</h1><p class="muted">${partnerMode?'Size ait bağlantı ve kayıtları takip edin.':'Oyuncu, içerik ve hesap işlemlerini tek bir yerden yönetin.'}</p></div><div id="page-action"></div></div><div id="panel-body"></div></main><footer class="admin-footer">SHALOM BET <span>PHP / Sunucu üzerinde kalıcı kayıt</span></footer></div></div>`;
}

function stats(items){return `<div class="stats">${items.map(([label,value])=>`<div class="stat"><span>${e(label)}</span><strong>${e(value)}</strong></div>`).join('')}</div>`;}
function panel(title,body){return `<section class="panel"><header><h2>${e(title)}</h2></header>${body}</section>`;}
function toolbar(options=[]){return `<form id="filter-form" class="table-toolbar"><label class="search-box"><span>⌕</span><input name="query" type="search" value="${e(query)}" placeholder="Kayıtlarda ara" aria-label="Kayıtlarda ara"></label><div class="actions">${options.length?select('status','Durum',[['','Tüm durumlar'],...options],filter):''}<button class="btn small" type="submit">Filtrele</button></div></form>`;}
function recordsTable(items,headers,row,options=[]){const list=items.filter(item=>normal(JSON.stringify(item)).includes(normal(query))&&(!filter||item.status===filter||String(item.active)===filter));const count=Math.max(1,Math.ceil(list.length/15));pageNumber=Math.min(count,pageNumber);return `<section class="panel">${toolbar(options)}${table(headers,list.slice((pageNumber-1)*15,pageNumber*15).map(row))}<footer class="pagination"><span>${list.length} kayıt / ${pageNumber}. sayfa</span><div class="actions"><button class="btn small" data-action="previous" ${pageNumber<=1?'disabled':''}>Önceki</button><button class="btn small" data-action="next" ${pageNumber>=count?'disabled':''}>Sonraki</button></div></footer></section>`;}
const memberCell=u=>`<div class="person"><span class="avatar">${e((u.username||u.name||'?')[0].toUpperCase())}</span><span><strong>${e(u.username||u.name)}</strong><small>${e(u.name||'')}</small></span></div>`;
const actions=(...buttons)=>`<div class="row-actions">${buttons.join('')}</div>`;

function render(){
  if(!currentUser()){login();return;}
  const permitted=groups.flatMap(([,items])=>items).filter(canUse);
  if(!permitted.includes(section))section=permitted[0]||'none';
  shell();const target=document.getElementById('panel-body'),action=document.getElementById('page-action');
  if(partnerMode){renderPartner(target);return;}
  if(section==='none'){target.innerHTML=empty('Bu hesap için henüz yetki tanımlanmamış.');return;}
  if(section==='dashboard'){
    target.innerHTML=stats([['Oyuncular',data.players.length],['Bekleyen talepler',data.transactions.filter(t=>t.status==='pending').length],['Oyunlar',data.content.games?.length||0],['Bahisler',data.bets.length]])+panel('Bekleyen talepler',table(['Oyuncu','Tür','Tutar','İşlem'],data.transactions.filter(t=>t.status==='pending').slice(0,8).map(t=>[e(t.username),t.direction==='deposit'?'Yatırım':'Çekim',money(t.amount),canUse('finance')?actions(iconButton('İncele','transaction',t.id)):'-'])))+panel('Son işlemler',table(['Kullanıcı','İşlem','Tarih'],data.audit.slice(0,10).map(a=>[e(a.username||'-'),e(a.action),date(a.created_at)])));
  }else if(section==='players'){
    target.innerHTML=stats([['Tüm oyuncular',data.players.length],['Aktif',data.players.filter(u=>u.status==='active').length],['Askıda',data.players.filter(u=>u.status==='blocked').length],['Toplam bakiye',money(data.players.reduce((s,u)=>s+u.totalBalance,0))]])+recordsTable(data.players,['Oyuncu','İletişim','Bakiye','Durum','İşlem'],u=>[memberCell(u),`${e(u.phone)}<small>${e(u.email)}</small>`,money(u.balance),tag(u.status),actions(iconButton('Yönet','player',u.id))],[['active','Aktif'],['blocked','Askıda']]);
    if(data.files.length)target.innerHTML+=panel('Kimlik doğrulama',table(['Oyuncu','Belge','Durum','İşlem'],data.files.map(f=>[e(f.username),e(f.original_name),tag(f.status),actions(`<a class="btn small" href="media.php?id=${e(f.id)}" target="_blank" rel="noopener">Belge</a>`,iconButton('İncele','document',f.id))])));
  }else if(section==='employees'||section==='affiliates'){
    action.innerHTML=iconButton(section==='employees'?'+ Çalışan ekle':'+ Affiliate ortağı ekle','add-staff');
    const list=section==='employees'?data.employees:data.affiliates;
    target.innerHTML=stats([['Toplam hesap',list.length],['Aktif',list.filter(u=>u.status==='active').length],['Askıda',list.filter(u=>u.status==='blocked').length]])+recordsTable(list,['Hesap',section==='employees'?'Yetkiler':'Kod / Üyeler','Durum','İşlem'],u=>[memberCell(u),section==='employees'?u.permissions.map(p=>e(labels[p])).join(', '):`<strong>${e(u.promoCode)}</strong><small>${u.referredCount} üye</small>`,tag(u.status),actions(iconButton('Düzenle','edit-staff',u.id),section==='affiliates'?iconButton('Link / Üyeler','affiliate',u.id):'',iconButton(u.status==='active'?'Askıya al':'Aktifleştir','status',u.id))],[['active','Aktif'],['blocked','Askıda']]);
  }else if(section==='finance'){
    target.innerHTML=stats([['Bekleyen',data.transactions.filter(t=>t.status==='pending').length],['Tamamlanan',data.transactions.filter(t=>t.status==='completed').length],['İptal',data.transactions.filter(t=>t.status==='cancelled').length]])+recordsTable(data.transactions,['Oyuncu','İşlem','Tutar','Durum','Tarih','İşlem'],t=>[e(t.username),({deposit:'Yatırım',withdraw:'Çekim',adjustment:'Bakiye düzenleme'}[t.direction]),money(t.amount),tag(t.status),date(t.created_at),iconButton('İncele','transaction',t.id)],[['pending','Bekliyor'],['completed','Tamamlandı'],['cancelled','İptal']]);
  }else if(section==='bets'){
    target.innerHTML=recordsTable(data.bets,['Oyuncu','Kupon','Tutar','Durum','İşlem'],b=>[e(b.username),`${b.selections.length} karşılaşma <small>${Number(b.odds).toFixed(2)} oran</small>`,money(b.stake),tag(b.status),iconButton('Detay','bet',b.id)],[['pending','Bekliyor'],['won','Kazandı'],['lost','Kaybetti'],['cancelled','İptal']]);
  }else if(contentType[section]){
    action.innerHTML=iconButton('+ Yeni ekle','add-content');const items=data.content[contentType[section]]||[];
    target.innerHTML=recordsTable(items,['Kayıt','Detay','Durum','İşlem'],i=>[`${image(i.imageUrl,'thumb')}<strong>${e(i.title||i.name||`${i.home} / ${i.away}`)}</strong>`,e(i.provider||i.league||i.description?.slice(0,70)||i.id),tag(i.active?'active':'blocked'),actions(iconButton('Düzenle','edit-content',i.id),iconButton('Sil','delete-content',i.id))],[['true','Yayında'],['false','Gizli']]);
  }else if(section==='support'){
    action.innerHTML=iconButton('+ Yardım başlığı','add-help');
    target.innerHTML=recordsTable(data.messages,['Gönderen','Konu','Durum','Tarih','İşlem'],m=>[e(m.sender||'Sistem'),e(m.title),tag(m.status),date(m.created_at),iconButton('Oku / Yanıtla','message',m.id)])+panel('Sık sorulan sorular',table(['Başlık','İşlem'],(data.content.helpArticles||[]).map(a=>[e(a.title),actions(iconButton('Düzenle','edit-help',a.id),iconButton('Sil','delete-help',a.id))])));
  }else if(section==='settings'){
    const s=data.settings;
    target.innerHTML=panel('Site ayarları',`<form class="form panel-form" id="settings-form"><div class="form-grid">${input('brandName','Marka adı',s.brandName,'text','required')}${input('brandSub','Alt yazı',s.brandSub)}${input('tagline','Slogan',s.tagline)}${input('telegram','Telegram adresi',s.telegram,'url')}${input('supportEmail','Destek e-postası',s.supportEmail,'email')}${input('supportPhone','Destek telefonu',s.supportPhone)}</div>${input('supportUrl','Destek bağlantısı',s.supportUrl,'url')}${input('announcement','Duyuru',s.announcement)}${check('announcementActive','Duyuru görünsün',s.announcementActive)}${submit('Ayarları kaydet')}</form>`)+panel('Yönetici şifresi',passwordForm());
  }else if(section==='backup'){
    target.innerHTML=panel('İçerik yedeği',`<div class="panel-form"><p class="muted">Oyun, maç, banner ve sayfa içeriklerini dışa aktarabilirsiniz. Üye şifreleri ve finansal kayıtlar bu dosyada yer almaz. Tam yedek için sunucudaki storage klasörünü güvenli biçimde yedekleyin.</p><div class="actions"><button class="btn primary" data-action="export">İçerik yedeğini indir</button><label class="btn">İçerik yedeği yükle<input type="file" id="import-file" accept="application/json" class="visually-hidden"></label></div><div class="notice">Sunucudaki SQLite veritabanı gerçek kayıt kaynağıdır. Tarayıcı önbelleğini silmek üyeleri silmez.</div></div>`);
  }
  bindForms();
}

function renderPartner(target){
  const user=state.partner;
  if(section==='overview')target.innerHTML=stats([['Toplam üye',data.length],['Aktif üyeler',data.filter(m=>m.status==='active').length],['Ortak kodu',user.promoCode]])+panel('Size özel kayıt bağlantısı',`<div class="panel-form"><p class="muted">Bu linkten kayıt olan üyeler kalıcı olarak sizin hesabınıza bağlanır.</p><label>Kayıt bağlantınız<input readonly value="${e(affiliateLink(user.promoCode))}"></label><button class="btn primary" data-action="copy-link">Linki kopyala</button></div>`);
  else if(section==='members')target.innerHTML=recordsTable(data,['Kullanıcı adı','Kayıt tarihi','Durum'],m=>[e(m.username),date(m.createdAt),tag(m.status)],[['active','Aktif'],['blocked','Askıda']]);
  else if(section==='links')target.innerHTML=panel('Ortaklık bağlantıları',`<div class="panel-form">${input('code','Promo kodunuz',user.promoCode,'text','readonly')}${input('link','Size özel link',affiliateLink(user.promoCode),'text','readonly')}<button class="btn primary" data-action="copy-link">Linki kopyala</button><div class="notice">Her ortak için farklı kod oluşturulur. Yeni bir ortağın linki açıldığında kayıt formundaki kod da o ortağa göre güncellenir.</div></div>`);
  else target.innerHTML=panel('Şifrenizi değiştirin',passwordForm());
  bindForms();
}
function passwordForm(){return `<form id="password-form" class="form panel-form">${input('currentPassword','Mevcut şifre','','password','required autocomplete="current-password"')}${input('newPassword','Yeni şifre','','password',`required minlength="${partnerMode?8:12}" maxlength="72" autocomplete="new-password"`)}${submit('Şifreyi güncelle')}</form>`;}

function bindForms(){
  const ff=root.querySelector('#filter-form');if(ff)ff.onsubmit=event=>{event.preventDefault();query=ff.elements.query.value;filter=ff.elements.status?.value||'';pageNumber=1;render();};
  const settings=root.querySelector('#settings-form');if(settings)settings.onsubmit=event=>{event.preventDefault();busy(settings,async()=>{await api('admin.settings',{...values(settings),announcementActive:settings.elements.announcementActive.checked});notify('Ayarlar kaydedildi.');await reload();});};
  const password=root.querySelector('#password-form');if(password)password.onsubmit=event=>{event.preventDefault();busy(password,async()=>{await api(partnerMode?'affiliate.password':'admin.password',values(password));password.reset();notify('Şifreniz güncellendi.');});};
  const file=root.querySelector('#import-file');if(file)file.onchange=async()=>{try{const selected=file.files[0];if(!selected)return;if(selected.size>1000000)throw new Error('Yedek en fazla 1 MB olabilir.');const payload=JSON.parse(await selected.text());confirmAction('İçeriği geri yükle','Aynı kimlikteki içerikler bu dosyadaki kayıtlarla güncellenecek.',async()=>{await api('admin.import',payload);await reload();notify('İçerikler yüklendi.');});}catch(error){notify(error.message,true);}finally{file.value='';}};
}

async function reload(){if(refreshing)return;refreshing=true;try{await load();render();}catch(error){notify(error.message,true);if(error.status===401){state.staff=null;state.partner=null;login();}}finally{refreshing=false;}}

function staffEditor(user){
  const role=section==='employees'?'employee':'affiliate',existing=!!user;
  const fields=`<div class="form-grid">${input('name','Adı',user?.name||'','text','required')}${input('username','Kullanıcı Adı',user?.username||'','text','required minlength="3" maxlength="24" autocomplete="off"')}</div>${input('password',existing?'Yeni Şifre (değiştirmek için)':'Şifre','','password',`${existing?'':'required'} minlength="12" maxlength="72" autocomplete="new-password"`)}${role==='affiliate'?input('promoCode','Affiliate Promo Kodu',user?.promoCode||'','text','maxlength="40" placeholder="Boş bırakılırsa otomatik üretilir"'):`<fieldset><legend>Yetkiler</legend><div class="permission-grid">${permissionList.map(p=>check(`permission-${p}`,labels[p],user?.permissions.includes(p))).join('')}</div></fieldset>`}${select('status','Durum',[['active','Aktif'],['blocked','Askıda']],user?.status||'active')}`;
  dialog(existing?'Hesabı düzenle':role==='affiliate'?'Affiliate ortağı ekle':'Çalışan ekle',`<form class="form">${fields}${submit()}</form>`,modal=>{
    const form=modal.querySelector('form');form.onsubmit=event=>{event.preventDefault();busy(form,async()=>{await api('admin.saveStaff',{...values(form),id:user?.id||'',role,permissions:permissionList.filter(p=>form.elements[`permission-${p}`]?.checked)});modal.close();await reload();notify('Hesap kaydedildi.');});};
  });
}

function contentEditor(type,item={}){
  let fields='';
  if(type==='games')fields=`<div class="form-grid">${input('title','Oyun adı',item.title,'text','required')}${input('provider','Sağlayıcı',item.provider,'text','required')}${select('category','Kategori',[['slots','Slot'],['casino','Canlı Casino'],['games','Masa oyunları'],['aviator','Aviator'],['highflyer','High Flyer'],['spaceman','Spaceman']],item.category||'slots')}${input('providerGameId','Sağlayıcı oyun kimliği',item.providerGameId)}</div>${input('imageUrl','Görsel adresi',item.imageUrl)}<label class="upload-control">Görsel yükle<input type="file" data-upload accept="image/jpeg,image/png,image/webp"></label>${input('url','Oyun bağlantısı',item.url,'url')}${input('apiEndpoint','Oyun API adresi',item.apiEndpoint,'url')}<div class="notice">API adresi varsa önceliklidir. İzin verilen sunucular ve gizli anahtar config.php dosyasında yapılandırılır. Anahtarları buraya yazmayın.</div>`;
  else if(type==='banners')fields=input('title','Başlık',item.title,'text','required')+textarea('description','Açıklama',item.description)+input('imageUrl','Görsel adresi',item.imageUrl)+`<label class="upload-control">Görsel yükle<input type="file" data-upload accept="image/jpeg,image/png,image/webp"></label>`+input('buttonLabel','Buton yazısı',item.buttonLabel||'İNCELE')+input('destination','Hedef sayfa',item.destination||'#/oyunlar','text','required');
  else if(type==='matches')fields=`<div class="form-grid">${input('home','Ev sahibi',item.home,'text','required')}${input('away','Deplasman',item.away,'text','required')}${input('league','Lig',item.league,'text','required')}${select('sport','Spor dalı',[['football','Futbol'],['basketball','Basketbol'],['tennis','Tenis'],['esports','E-spor'],['virtual','Sanal Spor']],item.sport||'football')}${input('startsAt','Başlangıç',item.startsAt?new Date(new Date(item.startsAt).getTime()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16):'','datetime-local','required')}${input('minute','Dakika',item.minute||0,'number','min="0" max="200"')}${input('scoreHome','Ev skoru',item.score?.[0]||0,'number','min="0"')}${input('scoreAway','Deplasman skoru',item.score?.[1]||0,'number','min="0"')}</div><div class="form-grid three">${[0,1,2].map((i)=>input(`odd${i}`,`Oran ${['1','X','2'][i]}`,item.odds?.[i]||1,'number','required min="1" max="10000" step="0.01"')).join('')}</div>${check('live','Canlı karşılaşma',item.live)}`;
  else if(type==='paymentMethods')fields=`<div class="form-grid">${input('name','Yöntem adı',item.name,'text','required')}${select('kind','Tür',[['bank','Havale / EFT'],['wallet','Cüzdan'],['crypto','Kripto'],['card','Kart']],item.kind||'bank')}${input('minimum','Alt limit (TRY)',item.minimum||100,'number','required min="1" step="0.01"')}${input('maximum','Üst limit (TRY)',item.maximum||10000,'number','required min="1" step="0.01"')}</div>${textarea('description','Açıklama',item.description)}${check('deposit','Yatırıma açık',item.deposit??true)}${check('withdraw','Çekime açık',item.withdraw??true)}`;
  else fields=(type==='pages'?select('id','Sayfa',[['about','Hakkımızda'],['terms','Kullanım Şartları'],['privacy','Gizlilik Politikası'],['responsible','Sorumlu Oyun']],item.id||'about'):'')+input('title','Başlık',item.title,'text','required')+textarea('body','İçerik',item.body);
  dialog(item.id?'Kaydı düzenle':'Yeni kayıt',`<form class="form">${fields}${check('active','Yayında',item.active??true)}${submit()}</form>`,modal=>{
    const form=modal.querySelector('form'),upload=form.querySelector('[data-upload]');
    if(upload)upload.onchange=()=>busy(form,async()=>{if(!upload.files[0])return;const payload=new FormData();payload.append('file',upload.files[0]);const result=await api('admin.upload',payload);form.elements.imageUrl.value=result.url;notify('Görsel yüklendi.');});
    form.onsubmit=event=>{event.preventDefault();busy(form,async()=>{const v=values(form);const record={...v,id:item.id||v.id||'',active:form.elements.active.checked};if(type==='matches'){record.odds=[Number(v.odd0),Number(v.odd1),Number(v.odd2)];record.score=[Number(v.scoreHome),Number(v.scoreAway)];record.live=form.elements.live.checked;record.startsAt=new Date(v.startsAt).toISOString();}if(type==='paymentMethods'){record.deposit=form.elements.deposit.checked;record.withdraw=form.elements.withdraw.checked;}await api('admin.saveContent',{type,item:record});modal.close();await reload();notify('İçerik kaydedildi.');});};
  });
}

function playerDialog(user){
  dialog(user.username,`<div class="detail-grid"><span>Adı <b>${e(user.name)}</b></span><span>E-posta <b>${e(user.email)}</b></span><span>Telefon <b>${e(user.phone)}</b></span><span>Kayıt <b>${date(user.createdAt)}</b></span><span>Kullanılabilir bakiye <b>${money(user.balance)}</b></span><span>Bloke tutar <b>${money(user.reserved)}</b></span><span>Ortak kodu <b>${e(user.promoCode||'-')}</b></span></div>${allowed('finance')?`<h3>Bakiye düzenleme</h3><form class="form"><div class="notice">Yalnızca doğrulanmış işlemleri kaydedin. Bu işlem gerçek para transferi yapmaz.</div>${input('amount','Tutar (eksi değer bakiye düşürür)','','text','required inputmode="decimal"')}${input('note','İşlem açıklaması','','text','required')}${submit('Bakiye işlemini kaydet')}</form>`:''}<button class="btn full" data-status>${user.status==='active'?'Hesabı askıya al':'Hesabı aktifleştir'}</button>`,modal=>{
    modal.querySelector('[data-status]').onclick=()=>confirmAction('Hesap durumu','Hesabın durumunu değiştirmek istiyor musunuz?',async()=>{await api('admin.userStatus',{id:user.id,status:user.status==='active'?'blocked':'active'});modal.close();await reload();});
    const form=modal.querySelector('form');if(form){let key=id();form.oninput=()=>{key=id();};form.onsubmit=event=>{event.preventDefault();busy(form,async()=>{await api('admin.adjustBalance',{...values(form),id:user.id,requestKey:key});modal.close();await reload();notify('Bakiye kaydı oluşturuldu.');});};
  });
}

async function handleAction(action,recordId){
  if(action==='refresh'){await reload();return;}
  if(action==='logout'){await api(partnerMode?'affiliate.logout':'admin.logout');await load();login();return;}
  if(action==='menu'){dialog('Menü',`<nav class="mobile-admin-nav">${navigation()}</nav><button class="btn full" data-mobile-logout>Oturumu kapat</button>`,modal=>{modal.querySelectorAll('[data-section]').forEach(b=>{b.onclick=()=>{section=b.dataset.section;pageNumber=1;query='';filter='';modal.close();render();};});modal.querySelector('[data-mobile-logout]').onclick=()=>{modal.close();handleAction('logout').catch(error=>notify(error.message,true));};});return;}
  if(action==='previous'){pageNumber--;render();return;}if(action==='next'){pageNumber++;render();return;}
  if(action==='copy-link'){await copy(affiliateLink(state.partner.promoCode));return;}
  if(partnerMode)return;
  if(action==='add-staff')staffEditor();
  if(action==='edit-staff')staffEditor([...data.employees,...data.affiliates].find(u=>u.id===recordId));
  if(action==='status'){const user=[...data.employees,...data.affiliates].find(u=>u.id===recordId);confirmAction('Hesap durumu',`${user.username} hesabının durumu değiştirilecek.`,async()=>{await api('admin.userStatus',{id:user.id,status:user.status==='active'?'blocked':'active'});await reload();});}
  if(action==='affiliate'){
    const user=data.affiliates.find(u=>u.id===recordId),members=await api('admin.affiliateMembers',{id:recordId});
    dialog(user.username,`<div class="form">${input('link','Kayıt bağlantısı',affiliateLink(user.promoCode),'text','readonly')}<button class="btn primary" data-copy>Linki kopyala</button><a class="btn" href="ortak.php" target="_blank" rel="noopener">Ayrı ortak panelini aç ↗</a><h3>${members.length} kayıtlı üye</h3>${table(['Kullanıcı adı','Tarih','Durum'],members.map(m=>[e(m.username),date(m.createdAt),tag(m.status)]))}</div>`,modal=>{modal.querySelector('[data-copy]').onclick=()=>copy(affiliateLink(user.promoCode));});
  }
  if(action==='player')playerDialog(data.players.find(u=>u.id===recordId));
  if(action==='add-content')contentEditor(contentType[section]);
  if(action==='edit-content')contentEditor(contentType[section],data.content[contentType[section]].find(i=>i.id===recordId));
  if(action==='delete-content'||action==='delete-help')confirmAction('Kaydı sil','Bu içerik yayından kaldırılıp silinecek.',async()=>{await api('admin.deleteContent',{type:action==='delete-help'?'helpArticles':contentType[section],id:recordId});await reload();notify('Kayıt silindi.');});
  if(action==='add-help')contentEditor('helpArticles');if(action==='edit-help')contentEditor('helpArticles',data.content.helpArticles.find(a=>a.id===recordId));
  if(action==='transaction'){
    const t=data.transactions.find(t=>t.id===recordId);
    dialog('İşlem detayı',`<div class="detail-grid"><span>Oyuncu <b>${e(t.username)}</b></span><span>Tutar <b>${money(t.amount)}</b></span><span>Yöntem <b>${e(t.method||'Manuel')}</b></span><span>Alıcı <b>${e(t.destination||'-')}</b></span><span>Tarih <b>${date(t.created_at)}</b></span><span>Durum ${tag(t.status)}</span></div><p class="muted">${e(t.note)}</p>${t.status==='pending'?`<form class="form"><div class="notice">Onaydan önce ödemenin gerçekten yapıldığını kontrol edin. Onay yalnızca sistemdeki bakiye kaydını günceller.</div>${select('approve','Karar',[['true','Onayla'],['false','Reddet']])}${submit('Kararı kaydet')}</form>`:''}`,modal=>{const form=modal.querySelector('form');if(form)form.onsubmit=event=>{event.preventDefault();busy(form,async()=>{await api('admin.paymentDecision',{id:t.id,approve:form.elements.approve.value==='true'});modal.close();await reload();notify('Talep sonuçlandırıldı.');});};});
  }
  if(action==='bet'){
    const bet=data.bets.find(b=>b.id===recordId);
    dialog('Kupon detayı',`${table(['Karşılaşma','Seçim','Oran'],bet.selections.map(s=>[`${e(s.home)} / ${e(s.away)}`,e(s.outcome),Number(s.odd).toFixed(2)]))}<p>Tutar: ${money(bet.stake)} / Toplam oran: ${Number(bet.odds).toFixed(2)}</p>${bet.status==='pending'&&currentUser().role==='owner'?`<form class="form">${select('status','Sonuç',[['won','Kazandı'],['lost','Kaybetti'],['cancelled','İptal / İade']])}${submit('Kuponu sonuçlandır')}</form>`:tag(bet.status)}`,modal=>{const f=modal.querySelector('form');if(f)f.onsubmit=event=>{event.preventDefault();busy(f,async()=>{await api('admin.settleBet',{id:bet.id,status:f.elements.status.value});modal.close();await reload();});};});
  }
  if(action==='document'){
    dialog('Belge kararı',`<form class="form">${select('approve','Karar',[['true','Onayla'],['false','Reddet']])}${submit('Kaydet')}</form>`,modal=>{const f=modal.querySelector('form');f.onsubmit=event=>{event.preventDefault();busy(f,async()=>{await api('admin.documentDecision',{id:recordId,approve:f.elements.approve.value==='true'});modal.close();await reload();});};});
  }
  if(action==='message'){
    const m=data.messages.find(m=>m.id===recordId);
    dialog(m.title,`<p class="muted">${e(m.sender)} / ${e(m.email)}</p><p class="message-text">${e(m.body)}</p>${m.incoming&&m.user_id?`<form class="form">${textarea('body','Yanıtınız')}${submit('Oyuncuya gönder')}</form>`:''}`,modal=>{const f=modal.querySelector('form');if(f)f.onsubmit=event=>{event.preventDefault();busy(f,async()=>{await api('admin.reply',{id:m.id,body:f.elements.body.value});modal.close();await reload();notify('Yanıt gönderildi.');});};});
  }
  if(action==='export'){const result=await api('admin.export');download(`shalom-icerik-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(result,null,2));}
}

root.addEventListener('click',event=>{
  const sectionButton=event.target.closest('[data-section]');if(sectionButton){section=sectionButton.dataset.section;pageNumber=1;query='';filter='';render();return;}
  const button=event.target.closest('[data-action]');if(button)handleAction(button.dataset.action,button.dataset.id).catch(error=>notify(error.message,true));
});
window.addEventListener('focus',()=>{if(currentUser())reload();});
try{await load();render();}catch(error){failurePage(error);}