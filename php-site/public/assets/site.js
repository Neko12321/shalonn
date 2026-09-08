import { root, api, escape as e, money, date, status, tag, normal, id, notify, busy, empty, logo, input, select, check, textarea, submit, errorBox, values, dialog, table, image, failurePage } from './common.js';
import { countries, flag } from './countries.js';

let state, step = 1, register = {}, selections = [], search = '', provider = '', sport = 'football', matchDay = 'all';
let renderId = 0, lastReferral = null;
const titles = {'':'Ana Sayfa',menu:'Menü','giris':'Giriş','kayit':'Kayıt','sifremi-unuttum':'Şifre Yenileme','spor-bahisleri':'Spor Bahisleri','canli-bahis':'Canlı Bahis','sanal-spor':'Sanal Spor','slot-oyunlari':'Slot Oyunları','canli-casino':'Canlı Casino',oyunlar:'Oyunlar',aviator:'Aviator','high-flyer':'High Flyer',spaceman:'Spaceman','bahis-kuponu':'Bahis Kuponu',hesabim:'Hesabım','para-yatir':'Para Yatır','para-cek':'Para Çek','islem-gecmisi':'İşlem Geçmişi','bahis-gecmisi':'Bahis Geçmişi','hesap-ayarlari':'Hesap Ayarları',guvenlik:'Güvenlik','hesap-dogrulama':'Hesap Doğrulama',mesajlar:'Mesajlar','oyun-limitleri':'Oyun Limitleri',hakkimizda:'Hakkımızda','kullanim-sartlari':'Kullanım Şartları','gizlilik-politikasi':'Gizlilik Politikası','sorumlu-oyun':'Sorumlu Oyun',iletisim:'İletişim','canli-destek':'Canlı Destek','odeme-yontemleri':'Ödeme Yöntemleri'};
const accountPages = ['hesabim','para-yatir','para-cek','islem-gecmisi','bahis-gecmisi','hesap-ayarlari','guvenlik','hesap-dogrulama','mesajlar','oyun-limitleri'];
const categories = {'slot-oyunlari':'slots','canli-casino':'casino',oyunlar:'all',aviator:'aviator','high-flyer':'highflyer',spaceman:'spaceman'};
const link = (page, label, className = '') => `<a class="${className}" href="#/${page}">${e(label || titles[page])}</a>`;
const currentRoute = () => { const route = location.hash.replace(/^#\/?/, '').split('?')[0].replace(/\/$/, ''); return route.startsWith('r/') ? 'kayit' : route; };
const errorNote = (text) => `<div class="notice error">${e(text)}</div>`;

async function referral() {
  const hash = location.hash; const params = new URLSearchParams(location.search);
  const hashParams = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '');
  let code = params.get('ref') || hashParams.get('ref');
  if (/^#\/r\//.test(hash)) { try { code = decodeURIComponent(hash.split('/')[2].split('?')[0]); } catch { code = ''; } }
  if (code !== null && code !== lastReferral) {
    lastReferral = code;
    try { state.referral = await api('referral.resolve', {code}); register.promoCode = state.referral?.code || ''; }
    catch (error) { state.referral = null; register.promoCode = ''; notify(error.message, true); }
  }
}

async function refresh() { state = await api('bootstrap'); }
function shell(page, content) {
  const auth = ['giris','kayit','sifremi-unuttum'].includes(page) || page.startsWith('sifre-yenile/');
  document.title = `${titles[page] || 'SHALOM BET'} | ${state.settings.brandName}`;
  const authActions = page === 'kayit' ? link('giris','GİRİŞ','login-link') : link('kayit','KAYIT','btn primary');
  const header = `<header class="site-header"><div class="site-width header-row">${logo(state.settings)}<div class="header-actions">${auth ? authActions + link('','×','close-page') : state.me ? link('hesabim',money(state.me.balance),'balance-link') + link('para-yatir','PARA YATIR','btn primary') : link('giris','GİRİŞ','login-link') + link('kayit','KAYIT','btn primary')}${!auth ? link('menu','☰','menu-button') : ''}</div></div></header>`;
  const nav = auth ? '' : `<nav class="top-nav site-width">${['spor-bahisleri','canli-bahis','slot-oyunlari','canli-casino','oyunlar','sanal-spor'].map((p) => link(p,titles[p],p === page ? 'active' : '')).join('')}</nav>`;
  const bottom = auth ? '' : `<nav class="bottom-nav">${[['spor-bahisleri','◎','Bahis'],['bahis-kuponu','▤',`Kupon (${selections.length})`],['slot-oyunlari','7','Slot'],['canli-casino','♠','Casino'],['menu','☰','Menü']].map(([p,s,l]) => link(p, '', p === page ? 'active' : '').replace(`>${e(titles[p])}</a>`, `><b>${s}</b><span>${e(l)}</span></a>`)).join('')}</nav>`;
  root.innerHTML = `${!auth && state.settings.announcementActive ? `<div class="announcement">${e(state.settings.announcement)}</div>` : ''}${header}${nav}<main id="main" class="site-width ${auth ? 'auth-page' : 'site-main'}">${content}</main>${!auth ? footer() : `<div class="auth-help">${link('canli-destek','DESTEK İLE İLETİŞİME GEÇİN')}</div>`}${bottom}`;
}

function footer() { return `<footer class="site-footer site-width"><div>${logo(state.settings)}<p>${e(state.settings.tagline)}</p></div><div><h3>Kurumsal</h3>${['hakkimizda','kullanim-sartlari','gizlilik-politikasi','iletisim'].map((p) => link(p)).join('')}</div><div><h3>Hesap işlemleri</h3>${['para-yatir','para-cek','canli-destek','sorumlu-oyun'].map((p) => link(p)).join('')}</div><div><span class="age">18+</span><p>Kontrol sizde kalsın.</p><a href="ortak.php">Ortak paneli</a><a href="admin.php">Yönetim paneli</a></div><small>© ${new Date().getFullYear()} ${e(state.settings.brandName)} ${e(state.settings.brandSub)}</small></footer>`; }

function gameCard(game) { return `<button class="game-card" data-game="${e(game.id)}"><span class="game-art">${image(game.imageUrl) || '<b>♠</b>'}<span class="play-label">HEMEN OYNA</span></span><small>${e(game.provider)}</small><strong>${e(game.title)}</strong></button>`; }

function home() {
  const banners = state.content.banners;
  const banner = banners[0];
  const hero = banner ? `<h1>${e(banner.title)}</h1><p>${e(banner.description)}</p><a class="btn primary" href="${e(banner.destination || '#/oyunlar')}">${e(banner.buttonLabel || 'İNCELE')}</a>${image(banner.imageUrl,'hero-image')}` : `<span class="eyebrow">AYRICALIKLI BİR DÜNYAYA HOŞ GELDİNİZ</span><h1 class="hero-brand">SHALOM <small>BET</small></h1><p>${e(state.settings.tagline)}</p>${link('oyunlar','OYUNLARI KEŞFEDİN →','btn primary')}<span class="hero-spade" aria-hidden="true">♠</span>`;
  return `<section class="hero ornate">${hero}</section><div class="quick-links">${link('canli-destek')}${state.settings.telegram ? `<a href="${e(state.settings.telegram)}" target="_blank" rel="noopener">Telegram</a>` : link('hesabim')}${link('para-yatir')}${link('para-cek')}</div><section><div class="section-head"><h2>Popüler Oyunlar</h2>${link('oyunlar','TÜMÜNÜ GÖR →')}</div>${state.content.games.length ? `<div class="game-rail">${state.content.games.slice(0,8).map(gameCard).join('')}</div>` : empty('Henüz oyun eklenmedi.','Oyunlar yayınlandığında burada listelenecek.')}</section><section class="world-grid">${[['canli-casino','CANLI CASINO','♠'],['slot-oyunlari','SLOT CASINO','7'],['spor-bahisleri','SPOR BAHİSLERİ','◎'],['sanal-spor','SANAL SPOR','♞']].map(([p,l,s]) => `<a class="world-card ornate" href="#/${p}"><small>SHALOM DÜNYASI</small><h2>${l}</h2><span>Hemen keşfet →</span><b aria-hidden="true">${s}</b></a>`).join('')}</section>`;
}

function menu() { const pages = ['canli-bahis','spor-bahisleri','slot-oyunlari','canli-casino','oyunlar','aviator','high-flyer','spaceman','sanal-spor','canli-destek']; return `<div class="page-head"><h1>MENÜ</h1>${link('','×')}</div><div class="menu-grid">${pages.map((p) => link(p,titles[p])).join('')}</div><div class="account-links">${accountPages.map((p) => link(p)).join('')}</div>`; }

function authForm(page) {
  if (page === 'giris') return `<p class="muted">Hesabınız var mı?</p><h1>HEMEN GİRİŞ YAPIN!</h1><form class="form" id="login-form">${input('username','Kullanıcı Adı','','text','required autocomplete="username"')}${input('password','Şifre','','password','required autocomplete="current-password"')}${check('remember','Beni hatırla')}${submit('GİRİŞ')}${link('sifremi-unuttum','ŞİFRENİZİ Mİ UNUTTUNUZ?','form-link')}</form>`;
  if (page === 'sifremi-unuttum') return `<h1>ŞİFRENİZİ YENİLEYİN</h1><p class="muted">Hesabınızda kayıtlı e-posta adresini girin.</p><form id="reset-form" class="form">${input('email','E-posta','','email','required autocomplete="email"')}${submit('Bağlantı gönder')}</form>`;
  if (page.startsWith('sifre-yenile/')) return `<h1>YENİ ŞİFRE OLUŞTURUN</h1><form id="complete-reset" class="form">${input('password','Yeni Şifre','','password','required minlength="8" maxlength="72" autocomplete="new-password"')}${submit('Şifremi yenile')}</form>`;
  const dateToday = new Date(), year = dateToday.getFullYear() - 18;
  const years = Array.from({length:year - 1899},(_,index) => [year-index,year-index]);
  const months = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const selectedCountry = register.country || 'TR';
  const phoneCountry = countries.find(([code]) => code === selectedCountry) || countries[0];
  const fields = step === 1 ? input('firstName','Adı',register.firstName,'text','required autocomplete="given-name"') + input('middleName','İkinci İsim (Varsa)',register.middleName) + input('lastName','Soyadı',register.lastName,'text','required autocomplete="family-name"') + input('username','Kullanıcı Adı',register.username,'text','required minlength="3" maxlength="24" pattern="[a-zA-Z0-9_.]{3,24}"') + input('email','E-posta',register.email,'email','required autocomplete="email"') :
    select('country','Ülke',countries.map(([code,name,dial]) => [code,`${flag(code)} ${name} (+${dial})`]),selectedCountry) + `<label>Telefon Numarası<span class="phone-input"><span id="phone-prefix">${flag(phoneCountry[0])} +${phoneCountry[2]}</span><input type="tel" name="phone" value="${e(register.phone || '')}" required inputmode="tel" autocomplete="tel-national" placeholder="Telefon numaranız"></span></label><fieldset><legend>Doğum Tarihi</legend><div class="date-row">${select('day','Gün',[['','Gün'],...Array.from({length:31},(_,i)=>[i+1,i+1])],register.day)}${select('month','Ay',[['','Ay'],...months.map((m,i)=>[i+1,m])],register.month)}${select('year','Yıl',[['','Yıl'],...years],register.year)}</div><small class="hint">18 yaşını doldurmuş olmalısınız.</small></fieldset>` + input('password','Şifre',register.password,'password','required minlength="8" maxlength="72" autocomplete="new-password"') + input('confirmPassword','Şifre Tekrar',register.confirmPassword,'password','required minlength="8" maxlength="72" autocomplete="new-password"') + input('promoCode','Ortak Kodu (Varsa)',state.referral?.code || register.promoCode,'text',state.referral ? 'readonly' : '') + `<label class="check"><input type="checkbox" name="terms" required ${register.terms ? 'checked' : ''}>18 yaşını doldurdum; kullanım şartları ve gizlilik politikasını kabul ediyorum.</label>`;
  return `<p class="muted">Yeni üye misiniz?</p><h1>ŞİMDİ KAYDOLUN, HER ŞEY ÇOK KOLAY!</h1>${state.referral ? `<div class="notice">Ortak kaydı: ${e(state.referral.name)} / <b>${e(state.referral.code)}</b></div>` : ''}<h2 class="step-label">KAYIT ADIMI ${step}</h2><p class="identity-note">Bilgilerinizi kimlikte göründüğü gibi eksiksiz girin.</p><form id="register-form" class="form">${fields}${errorBox}<div class="form-actions">${step === 2 ? '<button type="button" class="btn" data-back-step>GERİ</button>' : ''}<button type="submit" class="btn primary">${step === 1 ? 'SONRAKİ' : 'KAYDI TAMAMLA'}</button></div><progress max="2" value="${step}" aria-label="Kayıt ilerlemesi"></progress></form>`;
}

function games(page) {
  const category = categories[page];
  const providers = [...new Set(state.content.games.filter((g) => category==='all'||g.category===category).map((g)=>g.provider))];
  return `<div class="page-head"><h1>${titles[page]}</h1><span>${state.content.games.filter((g) => category==='all'||g.category===category).length} OYUN</span></div><div class="toolbar"><input id="game-search" type="search" placeholder="Oyun ara" aria-label="Oyun ara" value="${e(search)}">${select('provider','Sağlayıcı',[['','Tüm sağlayıcılar'],...providers.map((p)=>[p,p])],provider)}</div><div id="games-result"></div>`;
}
function gamesResult(page) { const list=state.content.games.filter((g)=>(categories[page]==='all'||g.category===categories[page])&&(!provider||g.provider===provider)&&normal(g.title).includes(normal(search))); document.getElementById('games-result').innerHTML=list.length?`<div class="games-grid">${list.map(gameCard).join('')}</div>`:empty('Oyun bulunmuyor.'); }

function matches(page) {
  const selected = page === 'sanal-spor' ? 'virtual' : sport;
  const targetDate=new Date(); if(matchDay==='tomorrow') targetDate.setDate(targetDate.getDate()+1);
  const list=state.content.matches.filter((m)=>m.sport===selected&&(page!=='canli-bahis'||m.live)&&(matchDay==='all'||(matchDay==='live'?m.live:new Date(m.startsAt).toDateString()===targetDate.toDateString())));
  return `<div class="page-head"><h1>${titles[page]}</h1><span>${list.length} KARŞILAŞMA</span></div><div class="tabs">${[['football','Futbol'],['basketball','Basketbol'],['tennis','Tenis'],['esports','E-spor']].map(([key,l])=>`<button data-sport="${key}" class="${sport===key?'active':''}">${l}</button>`).join('')}</div><div class="tabs minor">${[['all','Tümü'],['today','Bugün'],['tomorrow','Yarın'],['live','Canlı']].map(([k,l])=>`<button data-day="${k}" class="${matchDay===k?'active':''}">${l}</button>`).join('')}</div>${list.length ? list.map((m)=>`<div class="match"><div class="match-info"><small>${e(m.league)} / ${m.live?'Canlı':date(m.startsAt)}</small><strong>${e(m.home)} / ${e(m.away)}</strong>${m.live?`<span class="score">${e(m.score?.join(' : ')||'0 : 0')}</span>`:''}</div><div class="odds">${m.odds.map((odd,i)=>`<button data-pick="${e(m.id)}" data-outcome="${i}" class="${selections.some(s=>s.id===m.id&&s.index===i)?'selected':''}"><small>${['1','X','2'][i]}</small><b>${Number(odd).toFixed(2)}</b></button>`).join('')}</div></div>`).join(''):empty('Henüz karşılaşma eklenmedi.')}`;
}

function coupon() {
  if(!selections.length) return `<h1>Bahis Kuponu</h1>${empty('Kuponunuz şu an boş.','Maç oranlarına dokunarak seçim ekleyin.')}`;
  const total=selections.reduce((s,m)=>s*m.odd,1);
  return `<div class="narrow"><div class="page-head"><h1>Bahis Kuponu</h1><button class="text-btn" data-clear-coupon>Temizle</button></div>${selections.map((s)=>`<div class="coupon-item"><div><strong>${e(s.home)} / ${e(s.away)}</strong><small>Maç Sonucu: ${['1','X','2'][s.index]} / ${s.odd.toFixed(2)}</small></div><button data-remove-pick="${e(s.id)}" aria-label="Seçimi kaldır">×</button></div>`).join('')}<form class="form" id="coupon-form"><p>Toplam oran <b>${total.toFixed(2)}</b></p>${input('stake','Bahis Tutarı (TRY)','','text','required inputmode="decimal"')}<p>Olası kazanç: <strong id="potential">${money(0)}</strong></p>${submit('KUPONU ONAYLA')}</form></div>`;
}

async function account(page) {
  const navigation=`<nav class="account-nav">${accountPages.map(p=>link(p,titles[p],p===page?'active':'')).join('')}</nav>`;
  let body=`<h1>${titles[page]}</h1>`;
  if(!state.me) return navigation+body+`<div class="notice">Hesap işlemleri için ${link('giris','giriş yapın')}.</div>`;
  if(page==='hesabim') return navigation+body+`<section class="balance-card"><small>KULLANILABİLİR BAKİYE</small><h2>${money(state.me.balance)}</h2><p>Hoş geldiniz, ${e(state.me.username)}</p><div class="actions">${link('para-yatir','PARA YATIR','btn primary')}${link('para-cek','PARA ÇEK','btn')}</div></section><div class="account-links">${accountPages.slice(3).map(p=>link(p)).join('')}</div><button class="btn" data-logout>Çıkış Yap</button>`;
  if(['para-yatir','para-cek'].includes(page)) {
    const withdrawal=page==='para-cek', methods=state.content.paymentMethods.filter(m=>withdrawal?m.withdraw:m.deposit);
    body += methods.length?`<form class="form narrow" id="payment-form"><div class="method-list">${methods.map((m,i)=>`<label class="method"><input type="radio" name="methodId" value="${e(m.id)}" ${i===0?'checked':''}><span><strong>${e(m.name)}</strong><small>${e(m.description)}</small><small>${money(m.minimum)} - ${money(m.maximum)}</small></span></label>`).join('')}</div>${input('amount','Tutar (TRY)','','text','required inputmode="decimal"')}${withdrawal?input('destination','Alıcı IBAN / Cüzdan / Hesap Numarası','','text','required minlength="6"'):''}${submit(withdrawal?'Çekim talebi oluştur':'Yatırım talebi oluştur')}<p class="hint">Bu işlem bir talep oluşturur. Gerçek transfer banka veya ödeme sağlayıcısı üzerinden ayrıca yapılır.</p></form>`:empty('Aktif ödeme yöntemi bulunmuyor.');
  } else if(['islem-gecmisi','bahis-gecmisi','mesajlar'].includes(page)) {
    const rows=await api(page==='islem-gecmisi'?'transactions':page==='bahis-gecmisi'?'bets':'messages');
    if(page==='mesajlar') body+=rows.length?rows.map(r=>`<details class="message"><summary>${e(r.title)} <small>${date(r.created_at)}</small></summary><p>${e(r.body)}</p></details>`).join(''):empty('Henüz mesaj bulunmuyor.');
    else body+=table(['İşlem','Tutar','Durum','Tarih'],rows.map(r=>[e(page==='islem-gecmisi'?({deposit:'Yatırım',withdraw:'Çekim',adjustment:'Düzenleme'}[r.direction]):`${r.selections.length} karşılaşma`),money(r.amount??r.stake),tag(r.status),date(r.created_at)]));
  } else if(page==='hesap-ayarlari') body+=`<form class="form narrow" id="profile-form">${input('email','E-posta',state.me.email,'email','required')}${input('phone','Telefon (ülke koduyla)',state.me.phone,'tel','required')}${submit('Bilgileri kaydet')}</form>`;
  else if(page==='guvenlik') body+=`<form class="form narrow" id="password-form">${input('currentPassword','Mevcut Şifre','','password','required autocomplete="current-password"')}${input('newPassword','Yeni Şifre','','password','required minlength="8" maxlength="72" autocomplete="new-password"')}${submit('Şifreyi güncelle')}</form>`;
  else if(page==='hesap-dogrulama') body+=`<form class="form narrow" id="identity-form"><p class="muted">En fazla 5 MB, JPG, PNG, WEBP veya PDF belge seçin.</p><label>Kimlik Belgesi<input name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required></label>${submit('Belgeyi gönder')}</form>`;
  else if(page==='oyun-limitleri') body+=`<form class="form narrow" id="limits-form">${input('depositLimit','Günlük Yatırım Limiti (TRY)','','text','required inputmode="decimal"')}${select('sessionMinutes','Oturum süresi',[[30,'30 dakika'],[60,'1 saat'],[120,'2 saat']],60)}${submit('Limitleri kaydet')}</form><div class="break-section"><h2>Oyuna ara verin</h2><p>Hesabınıza 30 gün boyunca erişimi kapatabilirsiniz.</p><button class="btn" data-exclude>30 gün ara ver</button></div>`;
  return navigation+body;
}

async function render() {
  const ticket=++renderId;
  await referral(); const page=currentRoute(); let content;
  try {
    if(page==='') content=home(); else if(page==='menu') content=menu();
    else if(['giris','kayit','sifremi-unuttum'].includes(page)||page.startsWith('sifre-yenile/')) content=authForm(page);
    else if(Object.hasOwn(categories,page)) content=games(page);
    else if(['spor-bahisleri','canli-bahis','sanal-spor'].includes(page)) content=matches(page);
    else if(page==='bahis-kuponu') content=coupon();
    else if(accountPages.includes(page)) content=await account(page);
    else if(page==='canli-destek') content=`<h1>Size nasıl yardımcı olabiliriz?</h1>${state.content.helpArticles.map(a=>`<details class="message"><summary>${e(a.title)}</summary><p>${e(a.body)}</p></details>`).join('')||empty('Henüz yardım içeriği eklenmedi.')}${state.settings.supportEmail?`<p>${e(state.settings.supportEmail)}</p>`:''}${link('iletisim','İletişim formu','btn primary')}`;
    else if(page==='iletisim') content=`<h1>İletişim</h1><form id="contact-form" class="form narrow">${input('name','Adınız ve Soyadınız','','text','required')}${input('email','E-posta','','email','required')}${select('subject','Konu',[['Hesap işlemleri','Hesap işlemleri'],['Ödeme işlemleri','Ödeme işlemleri'],['Teknik destek','Teknik destek']])}${textarea('message','Mesajınız')}${submit('Mesajı gönder')}</form>`;
    else if(page==='odeme-yontemleri') content=`<h1>Ödeme Yöntemleri</h1>${state.content.paymentMethods.map(m=>`<div class="method"><strong>${e(m.name)}</strong><p>${e(m.description)}</p></div>`).join('')||empty('Ödeme yöntemi bulunmuyor.')}`;
    else { const key={'hakkimizda':'about','kullanim-sartlari':'terms','gizlilik-politikasi':'privacy','sorumlu-oyun':'responsible'}[page]; const doc=state.content.pages[key]; content=key?`<h1>${e(titles[page])}</h1>${doc?`<article class="prose">${e(doc.body)}</article>`:empty('İçerik henüz yayınlanmadı.')}`:empty('Sayfa bulunamadı.'); }
  } catch(error) { if(error.status===401) state.me=null; content=errorNote(error.message); }
  if(ticket!==renderId) return;
  shell(page,content); bind(page);
}

function bind(page) {
  const formAction=(selector,action,transform,done)=>{ const form=root.querySelector(selector); if(!form)return; form.onsubmit=event=>{event.preventDefault();busy(form,async()=>{const data=transform?transform(form):values(form);const result=await api(action,data);await refresh();if(done)await done(result,form);else{notify('İşlem tamamlandı.');render();}});}; };
  formAction('#login-form','login',null,()=>{location.hash='/hesabim';});
  formAction('#reset-form','resetPassword',null,(_,form)=>{form.reset();notify('Kayıtlı bir hesap varsa yenileme bağlantısı gönderilecektir.');});
  formAction('#complete-reset','completeReset',f=>({...values(f),token:page.split('/')[1]}),()=>{notify('Şifreniz güncellendi.');location.hash='/giris';});
  const rf=root.querySelector('#register-form');
  if(rf){rf.onsubmit=event=>{event.preventDefault();register={...register,...values(rf),terms:rf.elements.terms?.checked||false};if(step===1){step=2;window.scrollTo(0,0);render();return;}busy(rf,async()=>{
    if(register.password!==register.confirmPassword)throw new Error('Şifreler eşleşmiyor.');
    const country=countries.find(c=>c[0]===register.country)||countries[0];const digits=String(register.phone).replace(/\D/g,'');
    const phone=String(register.phone).trim().startsWith('+')?`+${digits}`:`+${country[2]}${digits.replace(/^0/,'')}`;
    const birthDate=`${register.year}-${String(register.month).padStart(2,'0')}-${String(register.day).padStart(2,'0')}`;
    await api('register',{...register,phone,birthDate,acceptedTerms:register.terms,promoCode:state.referral?.code||register.promoCode||''});
    register={};step=1;lastReferral=null;history.replaceState(null,'',location.pathname+'#/hesabim');await refresh();notify('Hesabınız oluşturuldu.');render();
  });};const cf=rf.elements.country;if(cf)cf.onchange=()=>{register.country=cf.value;const c=countries.find(c=>c[0]===cf.value);document.getElementById('phone-prefix').textContent=`${flag(c[0])} +${c[2]}`;};const back=root.querySelector('[data-back-step]');if(back)back.onclick=()=>{register={...register,...values(rf)};step=1;render();};}
  formAction('#profile-form','updateProfile'); formAction('#password-form','updatePassword');formAction('#identity-form','verifyIdentity',f=>new FormData(f));formAction('#limits-form','updateLimits',f=>values(f));
  formAction('#contact-form','contact',null,(_,form)=>{form.reset();notify('Mesajınız alındı.');});
  const pf=root.querySelector('#payment-form');if(pf){let requestKey=id();pf.addEventListener('input',()=>{requestKey=id();});formAction('#payment-form',page==='para-cek'?'withdraw':'deposit',f=>({...values(f),requestKey}),()=>{notify('Talebiniz alındı.');location.hash='/islem-gecmisi';});}
  const couponForm=root.querySelector('#coupon-form');if(couponForm){let key=id();couponForm.elements.stake.oninput=()=>{key=id();const total=selections.reduce((a,s)=>a*s.odd,1);document.getElementById('potential').textContent=money(Number(couponForm.elements.stake.value.replace(',','.'))*total);};formAction('#coupon-form','placeBet',f=>({stake:f.elements.stake.value,requestKey:key,selections:selections.map(s=>({matchId:s.id,outcome:['1','X','2'][s.index],odd:s.odd}))}),()=>{selections=[];notify('Kuponunuz oluşturuldu.');location.hash='/bahis-gecmisi';});}
  if(Object.hasOwn(categories,page)){gamesResult(page);root.querySelector('#game-search').oninput=event=>{search=event.target.value;gamesResult(page);};root.querySelector('[name="provider"]').onchange=event=>{provider=event.target.value;gamesResult(page);};}
}

root.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button)return;
  const d=button.dataset;
  if(d.game){const game=state.content.games.find(g=>g.id===d.game);if(!state.me){location.hash='/giris';return;}dialog(game.title,`<p class="muted">${e(game.provider)}</p><form class="form">${submit('Oyunu aç')}</form>`,modal=>{const f=modal.querySelector('form');f.onsubmit=ev=>{ev.preventDefault();busy(f,async()=>{const result=await api('launchGame',{gameId:game.id});location.assign(result.url);});};});}
  if(d.sport){sport=d.sport;render();}if(d.day){matchDay=d.day;render();}
  if(d.pick){const match=state.content.matches.find(m=>m.id===d.pick);const index=Number(d.outcome);const was=selections.some(s=>s.id===match.id&&s.index===index);selections=selections.filter(s=>s.id!==match.id);if(!was)selections.push({...match,index,odd:match.odds[index]});notify(was?'Seçim çıkarıldı.':'Kupona eklendi.');render();}
  if(d.removePick){selections=selections.filter(s=>s.id!==d.removePick);render();}if('clearCoupon'in d){selections=[];render();}
  if('logout'in d){try{await api('logout');await refresh();location.hash='/';}catch(err){notify(err.message,true);}}
  if('exclude'in d)dialog('Oyuna ara verin',`<p>Hesabınız 30 gün boyunca erişime kapatılır. Bu süre erken kaldırılamaz.</p><form class="form">${check('confirm','30 gün ara vermek istiyorum.')}${submit('Onayla')}</form>`,modal=>{const form=modal.querySelector('form');form.onsubmit=ev=>{ev.preventDefault();busy(form,async()=>{if(!form.elements.confirm.checked)throw new Error('Onay kutusunu işaretleyin.');await api('selfExclude');modal.close();await refresh();location.hash='/';});};});
});

window.addEventListener('hashchange',()=>{search='';provider='';window.scrollTo({top:0});render();});
try{await refresh();await render();}catch(error){failurePage(error);}