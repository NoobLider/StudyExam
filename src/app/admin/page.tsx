"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Upload, Trash2, FileSpreadsheet, FileText, CheckCircle2, AlertCircle, Download, RefreshCw, RotateCcw, ShieldAlert, Users, UserPlus, KeyRound } from "lucide-react";
import { db, type ContentItem } from "@/lib/db";
import { exportData, importData, resetUserProgress, resetAllData, reloadSeedData } from "@/lib/dataManager";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/features/AuthProvider";
import { getUsers, createUser, deleteUser, changePassword, type AppUser } from "@/lib/auth";

type UploadStatus = "idle" | "uploading" | "success" | "error";

export default function AdminPage() {
  const { user: currentUser } = useAuth();
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<ContentItem[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [actionMsg, setActionMsg] = useState("");

  const [users, setUsers] = useState<AppUser[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [newDisplay, setNewDisplay] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "student">("student");
  const [userMsg, setUserMsg] = useState("");
  const [pwTarget, setPwTarget] = useState("");
  const [newPw, setNewPw] = useState("");

  const refreshUsers = useCallback(() => {
    getUsers().then(setUsers);
  }, []);

  useEffect(() => {
    refreshUsers();
    window.addEventListener("studyexam:users-changed", refreshUsers);
    return () => {
      window.removeEventListener("studyexam:users-changed", refreshUsers);
    };
  }, [refreshUsers]);

  const contentCount = useLiveQuery(() => db.content.count(), []);
  const sessionCount = useLiveQuery(() => db.sessions.count(), []);
  const allContent = useLiveQuery(() => db.content.orderBy("topic").limit(100).toArray(), []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus("uploading");
    setMessage("Dosya işleniyor...");
    setPreview([]);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Sunucu hatası");

      const items: ContentItem[] = data.items;
      setPreview(items.slice(0, 10));
      setMessage(`${items.length} içerik okundu. Kaydetmek için onayla.`);
      setStatus("success");

      await db.content.bulkPut(items);
      setMessage(`✓ ${items.length} içerik veritabanına eklendi.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
      setStatus("error");
      setMessage(msg);
    }

    if (fileRef.current) fileRef.current.value = "";
  };

  const clearAll = async () => {
    if (!confirm("Tüm içerik silinecek. Emin misin?")) return;
    await db.content.clear();
    setMessage("Tüm içerik silindi.");
    setPreview([]);
  };

  const handleExport = async () => {
    await exportData();
    setActionMsg("✓ Yedek dosyası indirildi.");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setActionMsg("İçe aktarılıyor...");
    const result = await importData(file);
    setActionMsg(result.message);
    if (importRef.current) importRef.current.value = "";
  };

  const handleResetProgress = async () => {
    if (!confirm("Tüm ilerleme, rozet ve oturum geçmişi silinecek. İçerikler kalacak. Emin misin?")) return;
    await resetUserProgress();
    setActionMsg("✓ İlerleme sıfırlandı.");
  };

  const handleResetAll = async () => {
    if (!confirm("HER ŞEY silinecek (içerik + ilerleme + oturumlar). Geri alınamaz. Emin misin?")) return;
    await resetAllData();
    setActionMsg("✓ Tüm veriler silindi.");
  };

  const handleReloadSeed = async () => {
    await reloadSeedData();
    setActionMsg("✓ Varsayılan içerik yüklendi.");
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Yönetim Paneli</h2>
        <p className="text-muted-foreground text-sm mt-1">İçerik, yedek ve veri yönetimi</p>
      </div>

      {/* Özet istatistikler */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatBadge label="İçerik" value={contentCount ?? 0} />
        <StatBadge label="Oturum" value={sessionCount ?? 0} />
        <StatBadge label="Kullanıcı" value={users.length} />
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex gap-2 text-muted-foreground text-sm">
            <span className="flex items-center gap-1"><FileSpreadsheet size={14} /> .xlsx</span>
            <span className="flex items-center gap-1"><FileText size={14} /> .pdf</span>
          </div>
          <span className="text-muted-foreground text-sm">desteklenen formatlar</span>
        </div>

        <label className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/30 p-8 cursor-pointer hover:bg-muted/50 transition-colors">
          <Upload size={28} className="text-muted-foreground" />
          <span className="text-sm font-medium">Dosya seç veya sürükle bırak</span>
          <span className="text-xs text-muted-foreground">Excel: yazar-eser tablosu / PDF: konu anlatımı</span>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.pdf"
            className="hidden"
            onChange={handleUpload}
          />
        </label>

        {status !== "idle" && (
          <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${status === "error" ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400" : status === "uploading" ? "bg-muted text-muted-foreground" : "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"}`}>
            {status === "error" && <AlertCircle size={15} className="shrink-0 mt-0.5" />}
            {status === "success" && <CheckCircle2 size={15} className="shrink-0 mt-0.5" />}
            {status === "uploading" && <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent shrink-0 mt-0.5" />}
            <span>{message}</span>
          </div>
        )}
      </div>

      {/* Yedek & Geri Yükleme */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-semibold text-sm flex items-center gap-2"><Download size={14} /> Yedek & Geri Yükleme</h3>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={handleExport} className="gap-2">
            <Download size={13} /> Dışa Aktar (JSON)
          </Button>
          <label className="inline-flex items-center gap-2 cursor-pointer rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors">
            <Upload size={13} /> İçe Aktar (JSON)
            <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          </label>
          <Button size="sm" variant="outline" onClick={handleReloadSeed} className="gap-2">
            <RefreshCw size={13} /> Varsayılan İçeriği Yükle
          </Button>
        </div>
        {actionMsg && (
          <p className="text-xs text-muted-foreground mt-1">{actionMsg}</p>
        )}
      </div>

      {/* İçerik listesi */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Mevcut İçerik</h3>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{contentCount ?? 0} kayıt</span>
            {(contentCount ?? 0) > 0 && (
              <button
                onClick={clearAll}
                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 font-medium"
              >
                <Trash2 size={13} /> İçeriği Sil
              </button>
            )}
          </div>
        </div>

        {(allContent?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Henüz içerik yüklenmedi.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tür</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Konu</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">İçerik</th>
                </tr>
              </thead>
              <tbody>
                {allContent?.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${item.type === "quiz" ? "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300" : "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"}`}>
                        {item.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{item.topic}</td>
                    <td className="px-3 py-2 max-w-[240px] truncate">{item.question ?? item.front}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tehlikeli bölge */}
      <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 p-5 space-y-3">
        <h3 className="font-semibold text-sm flex items-center gap-2 text-red-700 dark:text-red-400">
          <ShieldAlert size={14} /> Tehlikeli Bölge
        </h3>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={handleResetProgress}
            className="gap-2 border-red-300 text-red-600 hover:bg-red-100 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40">
            <RotateCcw size={13} /> İlerlemeyi Sıfırla
          </Button>
          <Button size="sm" variant="outline" onClick={handleResetAll}
            className="gap-2 border-red-400 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-950/40 font-semibold">
            <Trash2 size={13} /> Tüm Verileri Sil
          </Button>
        </div>
        <p className="text-xs text-red-600/70 dark:text-red-400/70">"İlerlemeyi Sıfırla" XP/rozet/oturumları siler, içerik kalır. "Tüm Verileri Sil" her şeyi siler.</p>
      </div>

      {/* Kullanıcı Yönetimi — sadece admin */}
      {currentUser?.role === "admin" && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 className="font-semibold text-sm flex items-center gap-2"><Users size={14} /> Kullanıcı Yönetimi</h3>

          {/* Mevcut kullanıcılar */}
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Kullanıcı Adı</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Görünen Ad</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Rol</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Eklenme</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.username} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{u.username}</td>
                    <td className="px-3 py-2 text-muted-foreground">{u.displayName}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        u.role === "admin" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" : "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                      }`}>{u.role}</span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{u.createdAt ? new Date(u.createdAt).toLocaleDateString("tr") : "-"}</td>
                    <td className="px-3 py-2">
                      <button
                        disabled={u.username === currentUser?.username}
                        onClick={async () => {
                          if (!confirm(`"${u.username}" silinecek. Emin misin?`)) return;
                          await deleteUser(u.username);
                          refreshUsers();
                          setUserMsg(`✓ ${u.username} silindi.`);
                        }}
                        className="text-red-500 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Yeni kullanıcı ekle */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <p className="text-xs font-medium flex items-center gap-1.5"><UserPlus size={13} /> Yeni Kullanıcı Ekle</p>
            <div className="grid grid-cols-2 gap-2">
              <input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="kullanıcı_adı" className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary" />
              <input value={newDisplay} onChange={(e) => setNewDisplay(e.target.value)} placeholder="Görünen Ad" className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary" />
              <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Şifre" type="password" className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary" />
              <select value={newRole} onChange={(e) => setNewRole(e.target.value as "admin" | "student")} className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary">
                <option value="student">student</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <Button size="sm" onClick={async () => {
              if (!newUsername || !newPassword) { setUserMsg("Kullanıcı adı ve şifre zorunlu."); return; }
              const result = await createUser(newUsername.trim(), newDisplay || newUsername.trim(), newPassword, newRole);
              if (!result.ok) { setUserMsg(result.error ?? "Hata."); return; }
              setNewUsername(""); setNewDisplay(""); setNewPassword("");
              refreshUsers();
              setUserMsg(`✓ ${newUsername} eklendi.`);
            }} className="gap-2"><UserPlus size={13} /> Ekle</Button>
          </div>

          {/* Şifre değiştir */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <p className="text-xs font-medium flex items-center gap-1.5"><KeyRound size={13} /> Şifre Değiştir</p>
            <div className="flex gap-2">
              <select value={pwTarget} onChange={(e) => setPwTarget(e.target.value)} className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary">
                <option value="">Kullanıcı seç...</option>
                {users.map((u) => <option key={u.username} value={u.username}>{u.username}</option>)}
              </select>
              <input value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Yeni Şifre" type="password" className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary" />
              <Button size="sm" onClick={async () => {
                if (!pwTarget || !newPw) { setUserMsg("Kullanıcı ve şifre zorunlu."); return; }
                await changePassword(pwTarget, newPw);
                setPwTarget(""); setNewPw("");
                setUserMsg(`✓ ${pwTarget} şifresi güncellendi.`);
              }}>Kaydet</Button>
            </div>
          </div>

          {userMsg && <p className="text-xs text-muted-foreground">{userMsg}</p>}
        </div>
      )}

      {preview.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h3 className="font-semibold text-sm">Son Yükleme Önizleme</h3>
          <div className="space-y-2">
            {preview.map((item) => (
              <div key={item.id} className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                <span className="font-medium">{item.topic}</span>
                <span className="text-muted-foreground"> · </span>
                <span>{item.question ?? item.front}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatBadge({ label, value, isText }: { label: string; value: number | string; isText?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-center">
      <p className="text-2xl font-bold">{isText ? value : value.toLocaleString("tr")}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
