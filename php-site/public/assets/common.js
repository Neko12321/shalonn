export const root = document.getElementById('app');
let csrf = '';

export const escape = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const money = (value = 0) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Number(value) || 0);
export const date = (value) => value ? new Date(value).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '-';
export const normal = (value) => String(value).toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');
export const id = () => crypto.randomUUID ? crypto.randomUUID() : [...crypto.getRandomValues(new Uint8Array(16))].map((n) => n.toString(16).padStart(2, '0')).join('');
export const status = (value) => ({active:'Aktif',blocked:'Askıda',pending:'Bekliyor',completed:'Tamamlandı',cancelled:'İptal',won:'Kazandı',lost:'Kaybetti',unread:'Okunmamış'}[value] || value);
export const tag = (value) => `<span class="tag ${['active','completed','won'].includes(value) ? 'positive' : ['blocked','cancelled','lost'].includes(value) ? 'negative' : 'pending'}">${escape(status(value))}</span>`;

export async function api(action, body) {
  const isBootstrap = action === 'bootstrap';
  const options = { method: isBootstrap ? 'GET' : 'POST', credentials: 'same-origin', headers: { Accept: 'application/json' } };
  if (!isBootstrap) {
    options.headers['X-CSRF-Token'] = csrf;
    if (body instanceof FormData) options.body = body;
    else { options.headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(body || {}); }
  }
  const response = await fetch(`api.php?action=${encodeURIComponent(action)}`, options);
  const result = await response.json().catch(() => ({ok:false,error:'Sunucu yanıtı okunamadı.'}));
  if (!response.ok || !result.ok) { const error = new Error(result.error || 'İşlem tamamlanamadı.'); error.status = response.status; throw error; }
  if (isBootstrap) csrf = result.data.csrf;
  return result.data;
}

export function notify(message, error = false) {
  const node = document.createElement('div'); node.className = `toast ${error ? 'error' : ''}`; node.textContent = message;
  document.getElementById('notices').append(node); setTimeout(() => node.remove(), 5000);
}

export async function busy(form, action) {
  const buttons = [...form.querySelectorAll('button[type="submit"]')];
  buttons.forEach((button) => { button.disabled = true; button.dataset.label = button.innerHTML; button.textContent = 'Bekleyiniz...'; });
  const output = form.querySelector('[data-error]'); if (output) { output.textContent = ''; output.hidden = true; }
  try { await action(); }
  catch (error) { if (output) { output.hidden = false; output.textContent = error.message; } else notify(error.message, true); }
  finally { buttons.forEach((button) => { button.disabled = false; button.innerHTML = button.dataset.label; }); }
}

export const notice = (text) => `<div class="notice">${escape(text)}</div>`;
export const errorBox = '<div class="notice error" data-error role="alert" hidden></div>';
export const empty = (title, text = '') => `<div class="empty"><span class="empty-symbol" aria-hidden="true">◇</span><h3>${escape(title)}</h3>${text ? `<p>${escape(text)}</p>` : ''}</div>`;
export const logo = (settings = {}) => `<a class="brand" href="index.php"><img src="assets/logo.svg" width="38" height="38" alt=""><span>${escape(settings.brandName || 'SHALOM')}<small>${escape(settings.brandSub || 'BET')}</small></span></a>`;
export function input(name, label, value = '', type = 'text', attrs = '') { return `<label>${escape(label)}<input name="${escape(name)}" type="${type}" value="${escape(value)}" ${attrs}></label>`; }
export function select(name, label, values, value = '') { return `<label>${escape(label)}<select name="${escape(name)}">${values.map(([id,label]) => `<option value="${escape(id)}" ${String(value) === String(id) ? 'selected' : ''}>${escape(label)}</option>`).join('')}</select></label>`; }
export function check(name, label, value = false) { return `<label class="check"><input name="${escape(name)}" type="checkbox" ${value ? 'checked' : ''}>${escape(label)}</label>`; }
export function textarea(name, label, value = '') { return `<label>${escape(label)}<textarea name="${escape(name)}" rows="5" maxlength="30000">${escape(value)}</textarea></label>`; }
export const values = (form) => Object.fromEntries(new FormData(form));
export const submit = (label = 'Kaydet') => `${errorBox}<button class="btn primary full" type="submit">${escape(label)}</button>`;
export const iconButton = (label, action, recordId = '') => `<button class="btn small" data-action="${action}" data-id="${escape(recordId)}">${escape(label)}</button>`;

export function table(headers, rows) {
  if (!rows.length) return empty('Henüz kayıt bulunmuyor.');
  return `<div class="table-scroll" tabindex="0" aria-label="Kayıt tablosu"><table><thead><tr>${headers.map((h) => `<th>${escape(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell, index) => `<td data-label="${escape(headers[index] || 'İşlem')}">${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

export function dialog(title, content, onReady) {
  const previous = document.activeElement;
  const node = document.createElement('dialog'); node.className = 'dialog';
  node.innerHTML = `<header><h2>${escape(title)}</h2><button type="button" class="dialog-close" aria-label="Kapat">×</button></header><div class="dialog-body">${content}</div>`;
  document.body.append(node); node.showModal();
  const old = document.body.style.overflow; document.body.style.overflow = 'hidden';
  node.querySelector('.dialog-close').onclick = () => node.close();
  node.addEventListener('click', (event) => { if (event.target === node) { const r = node.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) node.close(); } });
  node.addEventListener('close', () => { node.remove(); document.body.style.overflow = old; previous?.focus(); });
  onReady?.(node); return node;
}

export function confirmAction(title, text, action) {
  dialog(title, `<p class="muted">${escape(text)}</p><form class="form">${submit('Onayla')}</form>`, (modal) => {
    const form = modal.querySelector('form'); form.onsubmit = (event) => { event.preventDefault(); busy(form, async () => { await action(); modal.close(); }); };
  });
}

export async function copy(text) {
  try { await navigator.clipboard.writeText(text); notify('Bağlantı kopyalandı.'); }
  catch { dialog('Bağlantıyı kopyalayın', `<label>Bağlantı<input readonly value="${escape(text)}" autofocus></label>`, (node) => node.querySelector('input').select()); }
}

export function download(name, data, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([data], {type})); const link = document.createElement('a');
  link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export const image = (url, className = '') => url && (/^https:\/\//.test(url) || /^media\.php\?id=[a-f0-9]{32}$/.test(url)) ? `<img class="${className}" src="${escape(url)}" alt="" loading="lazy" decoding="async">` : '';
export function affiliateLink(code) { const url = new URL('index.php', location.href); url.search = new URLSearchParams({ref:code}); url.hash = '/kayit'; return url.href; }
export function failurePage(error) { root.innerHTML = `<main class="loading"><h1>Bağlantı kurulamadı.</h1><p>${escape(error.message)}</p><button class="btn primary">Yeniden dene</button></main>`; root.querySelector('button').onclick = () => location.reload(); }