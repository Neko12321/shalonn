import { useEffect, useMemo, useRef, useState } from "react";
import { parse } from "acorn";
import { Engine } from "php-parser";
import { strToU8, zipSync, type Zippable } from "fflate";
import { Icon } from "./ui";
import { href } from "./navigation";
import rootProtection from "../php-site/.htaccess?raw";
import publicProtection from "../php-site/public/.htaccess?raw";
import storageProtection from "../php-site/storage/.htaccess?raw";
import emblemUrl from "./assets/logo.png";
import cornerUrl from "./assets/corner.png";
import "./download.css";

// Explicit source allowlist: never bundle config.php, a live database or uploads.
const rawPackage = import.meta.glob<string>([
  "../php-site/app/*.{php,sql}", "../php-site/public/*.php", "../php-site/public/assets/*.{js,css,svg}",
  "../php-site/bin/install.php", "../php-site/tests/smoke.php", "../php-site/config.example.php",
  "../php-site/README.md", "../php-site/nginx.example.conf", "../php-site/storage/index.html",
], { query: "?raw", import: "default", eager: true });
const files: Record<string, string> = Object.fromEntries(Object.entries(rawPackage).map(([path, source]) => [path.replace("../php-site/", ""), source]));
files[".htaccess"] = rootProtection;
files["public/.htaccess"] = publicProtection;
files["storage/.htaccess"] = storageProtection;

const reactFiles = import.meta.glob<string>(["./**/*.{ts,tsx,css,json}", "../index.html", "../package.json", "../package-lock.json", "../tsconfig.json", "../vite.config.ts", "../INTEGRATION.md", "../TESLIM.md", "../scripts/package-php.mjs"], { query: "?raw", import: "default", eager: true });
const assets = { "./assets/logo.png": emblemUrl, "./assets/corner.png": cornerUrl };
const requiredFiles = ["public/index.php", "public/admin.php", "public/ortak.php", "public/install.php", "public/api.php", "public/assets/site.js", "public/assets/management.js", "public/assets/site.css", "app/schema.sql", "config.example.php", "README.md", "public/.htaccess", "storage/.htaccess"];
const groups = [
  { name: "public", description: "Site, admin, ortak paneli ve arayüz dosyaları", icon: "globe" as const },
  { name: "app", description: "PHP servisleri, yetki kontrolü ve SQL şeması", icon: "document" as const },
  { name: "storage", description: "Korunan veritabanı ve dosya alanı", icon: "lock" as const },
  { name: "bin", description: "Komut satırı kurulumu", icon: "settings" as const },
  { name: "tests", description: "Kurulum ve işlev kontrol betikleri", icon: "check" as const },
];

type Validation = { errors: string[]; phpCount: number; jsCount: number; checked: boolean };

function validateSources(): Validation {
  const errors: string[] = [];
  let phpCount = 0, jsCount = 0;
  const php = new Engine({ parser: { version: 802, suppressErrors: false }, ast: { withPositions: true } });
  for (const name of requiredFiles) if (!files[name]) errors.push(`Eksik dosya: ${name}`);
  for (const [name, source] of Object.entries(files)) {
    try {
      if (name.endsWith(".php")) { php.parseCode(source, name); phpCount++; }
      if (name.endsWith(".js")) { parse(source, { ecmaVersion: "latest", sourceType: "module" }); jsCount++; }
    } catch (failure) {
      errors.push(`${name}: ${(failure as Error).message}`);
    }
  }
  return { errors, phpCount, jsCount, checked: true };
}

function saveBlob(data: Uint8Array, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([new Uint8Array(data)], { type }));
  const link = document.createElement("a");
  link.href = url; link.download = name; link.rel = "noopener";
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export default function DownloadPackage() {
  const [includeReact, setIncludeReact] = useState(false);
  const [status, setStatus] = useState<"idle" | "building" | "ready" | "error">("idle");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState("README.md");
  const [validation, setValidation] = useState<Validation>({ errors: [], phpCount: 0, jsCount: 0, checked: false });
  const [previewOpen, setPreviewOpen] = useState(false);
  const preview = useRef<HTMLDialogElement>(null);
  const names = useMemo(() => Object.keys(files).sort(), []);
  const totalBytes = useMemo(() => Object.values(files).reduce((sum, source) => sum + strToU8(source).length, 0), []);

  useEffect(() => {
    document.title = "PHP Dosyalarını İndir | SHALOM BET";
    const timeout = setTimeout(() => {
      try { setValidation(validateSources()); }
      catch (failure) { setValidation({ checked: true, errors: [(failure as Error).message], phpCount: 0, jsCount: 0 }); }
    }, 100);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!previewOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    preview.current?.showModal();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, [previewOpen]);

  const download = async () => {
    setStatus("building"); setMessage("");
    await new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 30)));
    try {
      const check = validateSources();
      setValidation(check);
      if (check.errors.length) throw new Error("Kaynak kontrolünde hata bulundu. Dosya kontrolü bölümünü inceleyin.");
      const entries: Zippable = {};
      for (const [name, source] of Object.entries(files)) entries[`shalom-bet-php/${name}`] = strToU8(source);
      if (includeReact) {
        for (const [path, source] of Object.entries(reactFiles)) {
          const filename = path.startsWith("../") ? path.slice(3) : `src/${path.slice(2)}`;
          entries[`react-kaynak/${filename}`] = strToU8(source);
        }
        // The exporter imports the PHP templates too, so retain them in the source tree.
        for (const [name, source] of Object.entries(files)) entries[`react-kaynak/php-site/${name}`] = strToU8(source);
        for (const [path, url] of Object.entries(assets)) {
          const response = await fetch(url);
          if (!response.ok) throw new Error("Logo veya görsel dosyası okunamadı.");
          entries[`react-kaynak/src/${path.slice(2)}`] = [new Uint8Array(await response.arrayBuffer()), { level: 0 }];
        }
      }
      const manifest = {
        package: "shalom-bet-php", version: "1.0.0", createdAt: new Date().toISOString(),
        phpMinimum: "8.2", sourceFiles: names, containsPersonalData: false,
        syntaxValidation: { phpFiles: check.phpCount, javascriptFiles: check.jsCount },
        runtimeVerified: false,
      };
      entries["shalom-bet-php/manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));
      entries["BASLAMADAN-ONCE.txt"] = strToU8("PHP sunucusuna shalom-bet-php klasorunu yukleyin. Web kok dizini public/ olmalidir. Kurulum: shalom-bet-php/README.md. Gercek odeme ve oyun saglayicilari ayrica yapilandirilir. Bu arsiv kullanici kayitlari, sifreler veya calisan veritabani icermez. PHP calisma zamani testleri bu ortamda yapilmamistir.\n");
      const zipped = zipSync(entries, { level: 6 });
      saveBlob(zipped, includeReact ? "shalom-bet-php-ve-kaynak.zip" : "shalom-bet-php.zip", "application/zip");
      setStatus("ready"); setMessage("ZIP dosyanız hazır. İndirme başlamadıysa düğmeye tekrar basabilirsiniz.");
    } catch (failure) { setStatus("error"); setMessage((failure as Error).message); }
  };

  return <div className="package-app">
    <header className="package-header"><a className="package-brand" href={href("home")}><span>S</span><div>SHALOM BET<small>GELİŞTİRİCİ DOSYALARI</small></div></a><a className="package-back" href={href("admin")}><Icon name="back" size={16} /> Yönetim paneline dön</a></header>
    <main className="package-main">
      <div className="package-intro"><span className="package-eyebrow">SUNUCUYA TAŞIMAYA HAZIR KAYNAKLAR</span><h1>Site dosyalarınız,<br /><span>tek bir pakette.</span></h1><p>PHP sunucusu, siyah-altın site, yönetim paneli ve ayrı affiliate paneli. Dosyaları indirin, kendi sunucunuzda kurun.</p></div>
      <div className="package-layout">
        <section className="package-download" aria-labelledby="package-heading">
          <div className="package-file-icon"><Icon name="document" size={31} /><span>PHP</span></div>
          <h2 id="package-heading">SHALOM BET / PHP</h2><p className="package-format">PHP 8.2+ · SQLite · HTML · CSS · JavaScript</p>
          <div className="package-features"><span><Icon name="check" size={17} /> Site, yönetici ve çalışan hesapları</span><span><Icon name="check" size={17} /> Ayrı ortak paneli ve affiliate takibi</span><span><Icon name="check" size={17} /> Görseller, oyun linki ve API bağlantısı</span><span><Icon name="check" size={17} /> Kurulum ekranı ve Türkçe kılavuz</span></div>
          <label className="package-option"><input type="checkbox" checked={includeReact} onChange={(event) => setIncludeReact(event.target.checked)} disabled={status === "building"} /><div><b>React çalışma dosyalarını da ekle</b><small>Mevcut ön yüz kaynakları ve logolar ayrı klasörde eklenir.</small></div></label>
          <button type="button" className="package-download-button" onClick={download} disabled={status === "building" || !validation.checked || !!validation.errors.length}><Icon name={status === "building" ? "clock" : "deposit"} size={20} />{status === "building" ? "ZIP hazırlanıyor..." : "PHP paketini indir"}<span>.zip</span></button>
          <p className="package-caption">{names.length} kaynak dosyası · Yaklaşık {Math.ceil(totalBytes / 1024)} KB · PHP kurulumu için Node.js gerekmez</p>
          {message && <p className={`package-feedback ${status === "error" ? "is-error" : ""}`} role="status">{message}</p>}
          <button className="package-guide-link" onClick={() => { setSelected("README.md"); setPreviewOpen(true); }}>Kurulum kılavuzunu oku <Icon name="arrow" size={15} /></button>
        </section>
        <section className="package-tree" aria-label="Paket dosyaları">
          <header><div><Icon name="document" size={18} /><strong>shalom-bet-php/</strong></div><span>KAYNAK KLASÖRÜ</span></header>
          <div className="package-tree-list">{groups.map((group) => <details key={group.name} open={group.name === "public"}><summary><Icon name={group.icon} size={17} /><div><b>{group.name}/</b><small>{group.description}</small></div><Icon name="chevron" size={14} /></summary><div className="package-file-list">{names.filter((name) => name.startsWith(`${group.name}/`)).map((name) => <button key={name} onClick={() => { setSelected(name); setPreviewOpen(true); }}><Icon name="document" size={13} /><span>{name.slice(group.name.length + 1)}</span><Icon name="arrow" size={13} /></button>)}</div></details>)}<div className="package-root-files">{names.filter((name) => !name.includes("/")).map((name) => <button key={name} onClick={() => { setSelected(name); setPreviewOpen(true); }}><Icon name="document" size={15} />{name}<Icon name="arrow" size={13} /></button>)}</div></div>
        </section>
      </div>
      <section className="package-instructions"><div><span>01</span><h3>Paketi açın</h3><p>ZIP içindeki <code>shalom-bet-php/</code> klasörünü sunucunuza yükleyin.</p></div><div><span>02</span><h3>Sunucuyu ayarlayın</h3><p><code>config.example.php</code> dosyasını kopyalayın. Web kökünü <code>public/</code> olarak belirleyin.</p></div><div><span>03</span><h3>Kurulumu tamamlayın</h3><p><code>install.php</code> ekranında kendi yönetici hesabınızı oluşturun.</p></div></section>
      <div className="package-notice"><Icon name="info" size={20} /><p><b>Kurulumdan önce:</b> PHP sunucu testleri bu ortamda çalıştırılmadı. E-posta, gerçek ödeme ve oyun sağlayıcılarını ayrıca yapılandırın. Paket kişisel verilerinizi ve tarayıcınızdaki kullanıcı kayıtlarını içermez.</p></div>
      <details className="package-validation"><summary><Icon name={validation.errors.length ? "info" : "shield"} size={16} />Dosya kontrolü <span>{!validation.checked ? "Kontrol ediliyor" : validation.errors.length ? `${validation.errors.length} hata` : `${validation.phpCount} PHP / ${validation.jsCount} JavaScript kaynağı ayrıştırıldı`}</span></summary><p>İndirme öncesinde PHP ve JavaScript dosyaları sözdizimi ayrıştırıcısıyla kontrol edilir. Bu kontrol PHP sunucusunda çalışma veya entegrasyon testi yerine geçmez.</p>{validation.errors.map((error) => <pre key={error}>{error}</pre>)}</details>
    </main>
    <footer className="package-footer"><span>SHALOM BET</span><p>Kaynak kodu teslimi / v1.0</p><a href={href("home")}>Siteye dön <Icon name="arrow" size={13} /></a></footer>
    {previewOpen && <dialog ref={preview} className="package-preview-dialog" onClose={() => setPreviewOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) setPreviewOpen(false); }} aria-label={selected}><section className="package-preview"><header><strong>{selected}</strong><div><button onClick={() => saveBlob(strToU8(files[selected]), selected.split("/").pop()!, "text/plain;charset=utf-8")} aria-label="Dosyayı indir"><Icon name="deposit" size={18} /></button><button onClick={() => setPreviewOpen(false)} aria-label="Kapat"><Icon name="close" size={20} /></button></div></header><pre>{files[selected]}</pre></section></dialog>}
  </div>;
}