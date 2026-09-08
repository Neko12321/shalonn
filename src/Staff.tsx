import { Fragment, useMemo, useState } from "react";
import "./admin.css";
import emblemUrl from "./assets/logo.png";
import { money } from "./platform";
import {
  STAFF_PERMISSIONS, affiliatePublicLink, deleteAffiliate, deleteEmployee, hashText, makePromoCode, membersOfAffiliate, newId,
  partnerLoginLink, setStaffSession, upsertAffiliate, upsertEmployee, useStore,
  type PermissionId,
} from "./store";

export function EmployeesPanel({ notify }: { notify: (m: string) => void }) {
  const { employees, settings } = useStore();
  const [form, setForm] = useState<null | { id: string; name: string; username: string; password: string; permissions: PermissionId[]; status: "active" | "blocked" }>(null);

  const save = async () => {
    if (!form) return;
    const username = form.username.trim();
    if (username.length < 3) { notify("Kullanıcı adı en az 3 karakter olmalı."); return; }
    const taken = employees.some((e) => e.id !== form.id && e.username.toLocaleLowerCase("tr-TR") === username.toLocaleLowerCase("tr-TR"))
      || settings.admin.username.toLocaleLowerCase("tr-TR") === username.toLocaleLowerCase("tr-TR");
    if (taken) { notify("Bu kullanıcı adı kullanılıyor."); return; }
    const existing = employees.find((e) => e.id === form.id);
    if (!existing && form.password.length < 6) { notify("Şifre en az 6 karakter olmalı."); return; }
    if (form.password && form.password.length < 6) { notify("Şifre en az 6 karakter olmalı."); return; }
    const passwordHash = form.password ? await hashText(form.password) : existing?.passwordHash || "";
    upsertEmployee({
      id: form.id, name: form.name.trim() || username, username, passwordHash,
      permissions: form.permissions, status: form.status, createdAt: existing?.createdAt || new Date().toISOString(),
    });
    setForm(null);
    notify("Çalışan kaydedildi.");
  };

  const toggle = (id: PermissionId) => {
    if (!form) return;
    setForm({
      ...form,
      permissions: form.permissions.includes(id) ? form.permissions.filter((p) => p !== id) : [...form.permissions, id],
    });
  };

  return (
    <>
      <div className="toolbar">
        <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>Çalışanlar yönetim paneline kendi kullanıcı adı ve şifreleriyle girer. Yetkili oldukları menüler görünür.</p>
        <button className="btn btn-blue" onClick={() => setForm({ id: newId(), name: "", username: "", password: "", permissions: ["dashboard", "players"], status: "active" })}>+ Çalışan ekle</button>
      </div>
      {form && (
        <div className="panel">
          <div className="panel-h"><h3>{employees.some((e) => e.id === form.id) ? "Çalışanı düzenle" : "Yeni çalışan"}</h3></div>
          <div className="panel-b"><div className="form">
            <div className="g2">
              <div className="field"><label>Ad soyad</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="field"><label>Kullanıcı adı</label><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} autoComplete="off" /></div>
            </div>
            <div className="field"><label>{employees.some((e) => e.id === form.id) ? "Yeni şifre (boş bırakılırsa değişmez)" : "Şifre"}</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" /></div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Yetkiler</label>
              <div className="g2" style={{ marginTop: 8 }}>
                {STAFF_PERMISSIONS.map((p) => (
                  <label className="check" key={p.id}>
                    <input type="checkbox" checked={form.permissions.includes(p.id)} onChange={() => toggle(p.id)} />
                    <span>{p.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="actions">
              <button className="btn btn-blue" onClick={save}>Kaydet</button>
              <button className="btn btn-white" onClick={() => setForm(null)}>Vazgeç</button>
            </div>
          </div></div>
        </div>
      )}
      <div className="panel">
        <div className="panel-h"><h3>Çalışanlar</h3><span className="tag tag-gray">{employees.length}</span></div>
        {employees.length === 0 ? <div className="empty"><b>Çalışan yok</b><p>Yeni çalışan ekleyin.</p></div> : (
          <table className="tbl">
            <thead><tr><th>Çalışan</th><th>Yetkiler</th><th>Durum</th><th></th></tr></thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id}>
                  <td><strong>{e.name}</strong><span className="sub">{e.username}</span></td>
                  <td>{e.permissions.map((p) => STAFF_PERMISSIONS.find((x) => x.id === p)?.label || p).join(", ") || "—"}</td>
                  <td><span className={`tag ${e.status === "active" ? "tag-green" : "tag-red"}`}>{e.status === "active" ? "Aktif" : "Askıda"}</span></td>
                  <td><div className="acts">
                    <button className="btn btn-white btn-sm" onClick={() => setForm({ id: e.id, name: e.name, username: e.username, password: "", permissions: e.permissions, status: e.status })}>Düzenle</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { upsertEmployee({ ...e, status: e.status === "active" ? "blocked" : "active" }); notify(e.status === "active" ? "Askıya alındı." : "Aktifleştirildi."); }}>{e.status === "active" ? "Askıya al" : "Aç"}</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { if (confirm("Silinsin mi?")) { deleteEmployee(e.id); notify("Silindi."); } }}>Sil</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

export function AffiliatesPanel({ notify }: { notify: (m: string) => void }) {
  const { affiliates } = useStore();
  const [form, setForm] = useState<null | { id: string; name: string; username: string; password: string; promoCode: string; status: "active" | "blocked" }>(null);
  const [open, setOpen] = useState<string | null>(null);

  const save = async () => {
    if (!form) return;
    const username = form.username.trim();
    if (username.length < 3) { notify("Kullanıcı adı en az 3 karakter olmalı."); return; }
    const existing = affiliates.find((a) => a.id === form.id);
    if (!existing && form.password.length < 6) { notify("Şifre en az 6 karakter olmalı."); return; }
    if (form.password && form.password.length < 6) { notify("Şifre en az 6 karakter olmalı."); return; }
    let promo = (form.promoCode || "").trim().toUpperCase().replace(/\s+/g, "");
    if (!promo) promo = makePromoCode(username);
    if (affiliates.some((a) => a.id !== form.id && a.promoCode.toUpperCase() === promo)) {
      notify("Bu promo kodu başka bir ortağa ait."); return;
    }
    if (affiliates.some((a) => a.id !== form.id && a.username.toLocaleLowerCase("tr-TR") === username.toLocaleLowerCase("tr-TR"))) {
      notify("Bu kullanıcı adı kullanılıyor."); return;
    }
    upsertAffiliate({
      id: form.id, name: form.name.trim() || username, username, promoCode: promo,
      passwordHash: form.password ? await hashText(form.password) : existing?.passwordHash || "",
      status: form.status, createdAt: existing?.createdAt || new Date().toISOString(),
    });
    setForm(null);
    notify("Affiliate ortağı kaydedildi.");
  };

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); notify("Kopyalandı."); }
    catch { notify("Kopyalanamadı."); }
  };

  return (
    <>
      <div className="toolbar">
        <p style={{ margin: 0, color: "#64748b", fontSize: 13, maxWidth: 640 }}>
          Her ortağa özel kod ve kayıt linki (`#/r/KOD`) oluşur. Ortaklar ayrı panele `#/ortak` adresinden girer.
        </p>
        <button className="btn btn-blue" onClick={() => setForm({ id: newId(), name: "", username: "", password: "", promoCode: "", status: "active" })}>+ Affiliate ortağı ekle</button>
      </div>
      {form && (
        <div className="panel">
          <div className="panel-h"><h3>{affiliates.some((a) => a.id === form.id) ? "Ortağı düzenle" : "Yeni affiliate ortağı"}</h3></div>
          <div className="panel-b"><div className="form">
            <div className="g2">
              <div className="field"><label>Ad soyad</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="field"><label>Kullanıcı adı</label><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} autoComplete="off" /></div>
            </div>
            <div className="g2">
              <div className="field"><label>{affiliates.some((a) => a.id === form.id) ? "Yeni şifre (boş bırakılırsa değişmez)" : "Şifre"}</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" /></div>
              <div className="field"><label>Affiliate promo kodu</label>
                <input value={form.promoCode} onChange={(e) => setForm({ ...form, promoCode: e.target.value.toUpperCase() })} placeholder="Boş bırakırsanız otomatik üretilir" /></div>
            </div>
            {form.promoCode && <div className="note">Kayıt linki: {affiliatePublicLink(form.promoCode)}</div>}
            <div className="note">Ortak paneli girişi: {partnerLoginLink()}</div>
            <div className="actions">
              <button className="btn btn-blue" onClick={save}>Kaydet</button>
              <button className="btn btn-white" onClick={() => setForm(null)}>Vazgeç</button>
            </div>
          </div></div>
        </div>
      )}
      <div className="panel">
        <div className="panel-h"><h3>Affiliate ortakları</h3><span className="tag tag-gray">{affiliates.length}</span></div>
        {affiliates.length === 0 ? <div className="empty"><b>Ortak yok</b></div> : (
          <table className="tbl">
            <thead><tr><th>Ortak</th><th>Promo / Link</th><th>Üye</th><th>Durum</th><th></th></tr></thead>
            <tbody>
              {affiliates.map((a) => {
                const referred = membersOfAffiliate(a);
                const link = affiliatePublicLink(a.promoCode);
                return (
                  <Fragment key={a.id}>
                    <tr>
                      <td><strong>{a.name}</strong><span className="sub">{a.username}</span></td>
                      <td>
                        <strong>{a.promoCode}</strong>
                        <span className="sub" style={{ wordBreak: "break-all" }}>{link}</span>
                      </td>
                      <td>{referred.length}</td>
                      <td><span className={`tag ${a.status === "active" ? "tag-green" : "tag-red"}`}>{a.status === "active" ? "Aktif" : "Askıda"}</span></td>
                      <td><div className="acts">
                        <button className="btn btn-white btn-sm" onClick={() => copy(link)}>Linki kopyala</button>
                        <button className="btn btn-white btn-sm" onClick={() => setOpen(open === a.id ? null : a.id)}>Üyeler</button>
                        <button className="btn btn-white btn-sm" onClick={() => setForm({ id: a.id, name: a.name, username: a.username, password: "", promoCode: a.promoCode, status: a.status })}>Düzenle</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => { if (confirm("Silinsin mi?")) { deleteAffiliate(a.id); notify("Silindi."); } }}>Sil</button>
                      </div></td>
                    </tr>
                    {open === a.id && (
                      <tr key={`${a.id}-m`}><td colSpan={5}>
                        {referred.length === 0 ? <div className="note">Bu kodla kayıt olan üye yok.</div> : (
                          <table className="tbl">
                            <thead><tr><th>Kullanıcı</th><th>Ad</th><th>Tarih</th><th>Bakiye</th></tr></thead>
                            <tbody>{referred.map((m) => (
                              <tr key={m.id}><td>{m.username}</td><td>{m.firstName} {m.lastName}</td><td>{new Date(m.createdAt).toLocaleString("tr-TR")}</td><td>{money(m.balance)}</td></tr>
                            ))}</tbody>
                          </table>
                        )}
                      </td></tr>
                     )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

export function AffiliatePortal() {
  const { affiliates, staffSession } = useStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const current = staffSession?.role === "affiliate" ? affiliates.find((a) => a.id === staffSession.affiliateId) : null;

  const login = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    const found = affiliates.find((a) => a.username.toLocaleLowerCase("tr-TR") === username.trim().toLocaleLowerCase("tr-TR"));
    if (!found || found.status !== "active" || (await hashText(password)) !== found.passwordHash) {
      setError("Kullanıcı adı veya şifre hatalı."); return;
    }
    setStaffSession({ role: "affiliate", affiliateId: found.id });
  };

  if (!current) {
    return (
      <div className="adm">
        <div className="adm-login">
          <form className="adm-login-card" onSubmit={login}>
            <div className="adm-login-brand"><img src={emblemUrl} alt="" /><b>SHALOM BET</b></div>
            <h1>Affiliate girişi</h1>
            <p>Ortak paneliniz</p>
            <div className="form">
              <div className="field"><label>Kullanıcı adı</label><input value={username} onChange={(e) => setUsername(e.target.value)} /></div>
              <div className="field"><label>Şifre</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              {error && <div className="note warn">{error}</div>}
              <button className="btn btn-blue" type="submit" style={{ width: "100%" }}>Giriş Yap</button>
            </div>
            <p style={{ marginTop: 14, textAlign: "center" }}><a href="#/" style={{ color: "#2563eb" }}>Siteye dön</a></p>
          </form>
        </div>
      </div>
    );
  }

  const referred = membersOfAffiliate(current);
  const link = affiliatePublicLink(current.promoCode);

  return (
    <div className="adm">
      <header className="adm-top">
        <h1>Affiliate paneli<small>{current.name} · {current.promoCode}</small></h1>
        <div className="adm-top-actions">
          <a className="btn btn-white btn-sm" href="#/">Site</a>
          <button className="btn btn-navy btn-sm" onClick={() => setStaffSession(null)}>Çıkış</button>
        </div>
      </header>
      <div className="adm-body">
        <div className="stats">
          <div className="stat on"><span>Çekilen üye</span><b>{referred.length}</b></div>
          <div className="stat"><span>Promo kodu</span><b style={{ fontSize: 16 }}>{current.promoCode}</b></div>
        </div>
        <div className="panel">
          <div className="panel-h"><h3>Sizin kayıt linkiniz</h3>
            <button className="btn btn-blue btn-sm" onClick={() => navigator.clipboard.writeText(link)}>Kopyala</button>
          </div>
          <div className="panel-b">
            <div className="note">{link}</div>
            <p style={{ color: "#64748b", fontSize: 13, marginTop: 10 }}>Bu linke tıklayan kişi kayıt olurken promo kodunuz otomatik uygulanır. Her ortağın kodu ve linki kendine özeldir.</p>
          </div>
        </div>
        <div className="panel">
          <div className="panel-h"><h3>Kayıt olan üyeler</h3></div>
          {referred.length === 0 ? <div className="empty"><b>Henüz üye yok</b></div> : (
            <table className="tbl">
              <thead><tr><th>Kullanıcı</th><th>Ad</th><th>Tarih</th></tr></thead>
              <tbody>{referred.map((m) => (
                <tr key={m.id}><td>{m.username}</td><td>{m.firstName} {m.lastName}</td><td>{new Date(m.createdAt).toLocaleString("tr-TR")}</td></tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export function usePermissions() {
  const { staffSession, employees } = useStore();
  return useMemo(() => {
    if (!staffSession || staffSession.role === "affiliate") return [] as PermissionId[];
    if (staffSession.role === "owner") return STAFF_PERMISSIONS.map((p) => p.id);
    const emp = employees.find((e) => e.id === staffSession.employeeId);
    return emp?.status === "active" ? emp.permissions : [];
  }, [staffSession, employees]);
}
