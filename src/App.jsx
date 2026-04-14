import { useState, useEffect, useRef } from "react";

const STATUS = {
  erhalten: { label: "Exposé erhalten", color: "#f87171", bg: "#2d0a0a", icon: "🔴" },
  termin_angefragt: { label: "Termin angefragt", color: "#fb923c", bg: "#431407", icon: "🟠" },
  bestaetigt: { label: "Termin bestätigt", color: "#4ade80", bg: "#052e16", icon: "🟢" },
};

const EMAIL_TEMPLATES = {
  expose_anfrage: (obj) => [
    `Betreff: Anfrage – ${obj.titel || obj.adresse || "Ihre Immobilie"}`,
    ``,
    `Guten Tag Frau/Herr [NAME],`,
    ``,
    `ich bin auf Ihr Inserat aufmerksam geworden und habe großes Interesse an der angebotenen Immobilie – ${obj.titel || "[Objektbezeichnung]"}${obj.adresse ? ` mit der Adresse ${obj.adresse}` : ""}.`,
    ``,
    `Könnten Sie mir kurz mitteilen, wie der aktuelle Stand ist? Mich würde interessieren, ob die Immobilie noch verfügbar ist und wie das weitere Vorgehen aussieht.`,
    ``,
    `Zu mir: Ich bin Studentin und suche aktuell gemeinsam mit meinen Eltern für mich nach einer passenden Eigentumswohnung zur Selbstnutzung. Ihr Angebot passt dabei sehr gut in das, was wir uns vorstellen.`,
    ``,
    `Könnten Sie mir für weitere Informationen ein Exposé zukommen lassen?`,
    ``,
    `Mit freundlichen Grüßen`,
    `Giuliano Veenstra`,
    `veenstra.g@outlook.de`,
  ].join("\n"),

  termin_anfrage: (obj) => [
    `Betreff: Terminanfrage Besichtigung – ${obj.titel || obj.adresse || "Ihre Immobilie"}`,
    ``,
    `Guten Tag Frau/Herr [NAME],`,
    ``,
    `ich bin interessiert an der Immobilie – ${obj.titel || "[Objektbezeichnung]"}${obj.adresse ? ` (${obj.adresse})` : ""} – und würde diese gerne persönlich besichtigen.`,
    ``,
    `Bitte teilen Sie mir mögliche Termine mit oder lassen Sie mich wissen, wann eine Besichtigung möglich wäre. Bevorzugt ist hierbei das Wochenende.`,
    ``,
    `Sie können mich per Mail unter veenstra.g@outlook.de erreichen.`,
    ``,
    `Ich freue mich auf Ihre Rückmeldung.`,
    ``,
    `Mit freundlichen Grüßen`,
    `Giuliano Veenstra`,
    `veenstra.g@outlook.de`,
  ].join("\n"),

  weiterleitung: (obj) => [
    `Betreff: Exposé zur Prüfung – ${obj.titel || obj.adresse || "Immobilie"}`,
    ``,
    `Hallo,`,
    ``,
    `anbei das Exposé für folgende Immobilie:`,
    obj.titel ? `Objekt: ${obj.titel}` : null,
    `Adresse: ${obj.adresse || "[Adresse]"}`,
    `Preis: ${obj.preis || "[Preis]"}`,
    obj.groesse ? `Größe: ${obj.groesse}` : null,
    obj.zimmer ? `Zimmer: ${obj.zimmer}` : null,
    ``,
    `Bitte gib mir Feedback, ob wir einen Termin anfragen sollen.`,
    ``,
    `Viele Grüße`,
    `Giuliano`,
  ].filter(l => l !== null).join("\n"),
};

const STORAGE_KEY = "immo_crm_v1";

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Speicherfehler:", e);
  }
}

export default function ImmoCRM() {
  const [objekte, setObjekte] = useState(() => loadData());
  const [view, setView] = useState("liste");
  const [selected, setSelected] = useState(null);
  const [emailText, setEmailText] = useState("");
  const [copied, setCopied] = useState(false);
  const [filterStatus, setFilterStatus] = useState("alle");
  const [toast, setToast] = useState(null);
  const fileRef = useRef();

  const [form, setForm] = useState({
    adresse: "", titel: "", preis: "", groesse: "", zimmer: "", anbieter: "", notizen: "",
  });

  useEffect(() => { saveData(objekte); }, [objekte]);

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const addObjekt = () => {
    if (!form.adresse.trim()) { showToast("Bitte Adresse eingeben", "err"); return; }
    const neu = {
      id: Date.now(), ...form, status: "erhalten",
      erstelltAm: new Date().toISOString(), pdf: null, pdfName: null,
      log: [{ ts: new Date().toISOString(), text: "Objekt angelegt" }],
    };
    setObjekte(prev => [neu, ...prev]);
    setForm({ adresse: "", titel: "", preis: "", groesse: "", zimmer: "", anbieter: "", notizen: "" });
    setView("liste");
    showToast("Objekt angelegt ✓");
  };

  const updateStatus = (id, status) => {
    setObjekte(prev => prev.map(o =>
      o.id === id ? { ...o, status, log: [...o.log, { ts: new Date().toISOString(), text: `Status → ${STATUS[status].label}` }] } : o
    ));
    showToast(`Status: ${STATUS[status].label}`);
  };

  const deleteObjekt = (id) => {
    setObjekte(prev => prev.filter(o => o.id !== id));
    setView("liste"); setSelected(null); showToast("Gelöscht");
  };

  const handlePDF = (id, file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setObjekte(prev => prev.map(o =>
        o.id === id ? { ...o, pdf: e.target.result, pdfName: file.name, log: [...o.log, { ts: new Date().toISOString(), text: `Exposé hochgeladen: ${file.name}` }] } : o
      ));
      showToast("PDF gespeichert ✓");
    };
    reader.readAsDataURL(file);
  };

  const openEmail = (obj, type) => { setEmailText(EMAIL_TEMPLATES[type](obj)); setView("email"); };
  const copyEmail = () => { navigator.clipboard.writeText(emailText); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const filtered = filterStatus === "alle" ? objekte : objekte.filter(o => o.status === filterStatus);
  const statusCounts = Object.keys(STATUS).reduce((acc, k) => { acc[k] = objekte.filter(o => o.status === k).length; return acc; }, {});
  const fmt = (iso) => new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
  const liveObj = selected ? objekte.find(o => o.id === selected.id) : null;

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", color: "#e2e8f0" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 1000, background: toast.type === "err" ? "#7f1d1d" : "#052e16", border: `1px solid ${toast.type === "err" ? "#ef4444" : "#4ade80"}`, color: toast.type === "err" ? "#fca5a5" : "#86efac", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontFamily: "'DM Mono', monospace", boxShadow: "0 4px 24px rgba(0,0,0,0.5)" }}>{toast.msg}</div>
      )}

      <div style={{ borderBottom: "1px solid #1e293b", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0d1526" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🏠</div>
          <div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 500, color: "#60a5fa", letterSpacing: 2 }}>IMMO</div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: -2 }}>Workflow Manager</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {view !== "liste" && <button onClick={() => setView("liste")} style={{ background: "transparent", border: "1px solid #334155", color: "#94a3b8", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>← Zurück</button>}
          {view === "liste" && <button onClick={() => setView("neu")} style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", border: "none", color: "#fff", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 }}>+ Objekt</button>}
        </div>
      </div>

      {view === "liste" && (
        <div style={{ padding: "12px 24px", display: "flex", gap: 8, borderBottom: "1px solid #1e293b", overflowX: "auto" }}>
          <StatPill label="Alle" count={objekte.length} active={filterStatus === "alle"} onClick={() => setFilterStatus("alle")} color="#60a5fa" />
          {Object.entries(STATUS).map(([k, v]) => <StatPill key={k} label={v.label} count={statusCounts[k]} active={filterStatus === k} onClick={() => setFilterStatus(k)} color={v.color} />)}
        </div>
      )}

      <div style={{ padding: "20px 24px", maxWidth: 800, margin: "0 auto" }}>

        {view === "liste" && (
          <div>
            {filtered.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🏘️</div>
                <div style={{ fontSize: 16, color: "#475569" }}>Noch keine Objekte</div>
                <div style={{ fontSize: 13, color: "#334155", marginTop: 8 }}>Klick auf "+ Objekt" um zu starten</div>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map((obj) => {
                const s = STATUS[obj.status];
                return (
                  <div key={obj.id} onClick={() => { setSelected(obj); setView("detail"); }}
                    style={{ background: "#0d1526", border: `1px solid ${s.color}33`, borderLeft: `3px solid ${s.color}`, borderRadius: 10, padding: "14px 16px", cursor: "pointer", transition: "background 0.15s", display: "flex", alignItems: "center", gap: 16 }}
                    onMouseEnter={e => e.currentTarget.style.background = "#131e35"}
                    onMouseLeave={e => e.currentTarget.style.background = "#0d1526"}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 14, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{obj.titel || obj.adresse}</div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 3, display: "flex", gap: 12, flexWrap: "wrap" }}>
                        {obj.titel && <span>📍 {obj.adresse}</span>}
                        {obj.preis && <span>💶 {obj.preis}</span>}
                        {obj.groesse && <span>📐 {obj.groesse}</span>}
                        {obj.zimmer && <span>🛏 {obj.zimmer} Zi.</span>}
                        <span>📅 {fmt(obj.erstelltAm)}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      {obj.pdf && <span style={{ fontSize: 11, background: "#1e3a5f", color: "#60a5fa", padding: "2px 7px", borderRadius: 4 }}>PDF</span>}
                      <div style={{ fontSize: 11, background: s.bg, color: s.color, padding: "3px 9px", borderRadius: 20, border: `1px solid ${s.color}44`, whiteSpace: "nowrap" }}>{s.icon} {s.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === "neu" && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, color: "#e2e8f0" }}>Neues Objekt anlegen</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Field label="Objektbezeichnung (Titel des Inserats)" value={form.titel} onChange={v => setForm({ ...form, titel: v })} placeholder='z.B. "Helle 3-Zimmer-Wohnung in Schwabing"' />
              <Field label="Adresse *" value={form.adresse} onChange={v => setForm({ ...form, adresse: v })} placeholder="Musterstraße 12, 80333 München" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <Field label="Preis" value={form.preis} onChange={v => setForm({ ...form, preis: v })} placeholder="450.000 €" />
                <Field label="Größe" value={form.groesse} onChange={v => setForm({ ...form, groesse: v })} placeholder="85 m²" />
                <Field label="Zimmer" value={form.zimmer} onChange={v => setForm({ ...form, zimmer: v })} placeholder="3" />
              </div>
              <Field label="Anbieter / Makler" value={form.anbieter} onChange={v => setForm({ ...form, anbieter: v })} placeholder="Name oder E-Mail" />
              <Field label="Notizen" value={form.notizen} onChange={v => setForm({ ...form, notizen: v })} placeholder="Wichtige Infos..." multiline />
              <button onClick={addObjekt} style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", border: "none", color: "#fff", padding: "12px", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600, marginTop: 8 }}>Objekt speichern</button>
            </div>
          </div>
        )}

        {view === "detail" && liveObj && (() => {
          const obj = liveObj;
          const s = STATUS[obj.status];
          return (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: "#e2e8f0" }}>{obj.titel || obj.adresse}</div>
                  {obj.titel && <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>📍 {obj.adresse}</div>}
                  <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>Angelegt am {fmt(obj.erstelltAm)}</div>
                </div>
                <div style={{ fontSize: 12, background: s.bg, color: s.color, padding: "5px 12px", borderRadius: 20, border: `1px solid ${s.color}44` }}>{s.icon} {s.label}</div>
              </div>

              <div style={{ background: "#0d1526", border: "1px solid #1e293b", borderRadius: 10, padding: 16, marginBottom: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {obj.preis && <InfoRow icon="💶" label="Preis" value={obj.preis} />}
                {obj.groesse && <InfoRow icon="📐" label="Größe" value={obj.groesse} />}
                {obj.zimmer && <InfoRow icon="🛏" label="Zimmer" value={obj.zimmer} />}
                {obj.anbieter && <InfoRow icon="👤" label="Anbieter" value={obj.anbieter} />}
              </div>

              {obj.notizen && (
                <div style={{ background: "#0d1526", border: "1px solid #1e293b", borderRadius: 10, padding: 14, marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: "#475569", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Notizen</div>
                  <div style={{ fontSize: 13, color: "#94a3b8", whiteSpace: "pre-wrap" }}>{obj.notizen}</div>
                </div>
              )}

              <div style={{ background: "#0d1526", border: "1px solid #1e293b", borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "#475569", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Exposé (PDF)</div>
                {obj.pdf ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 20 }}>📄</span>
                    <span style={{ fontSize: 13, color: "#60a5fa" }}>{obj.pdfName}</span>
                    <button onClick={() => { const a = document.createElement("a"); a.href = obj.pdf; a.download = obj.pdfName; a.click(); }} style={{ marginLeft: "auto", background: "#1e3a5f", border: "none", color: "#60a5fa", padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>Download</button>
                  </div>
                ) : (
                  <div>
                    <input type="file" accept=".pdf" ref={fileRef} style={{ display: "none" }} onChange={e => { if (e.target.files[0]) handlePDF(obj.id, e.target.files[0]); }} />
                    <button onClick={() => fileRef.current.click()} style={{ background: "#1e293b", border: "1px dashed #334155", color: "#64748b", padding: "10px 20px", borderRadius: 8, cursor: "pointer", fontSize: 13, width: "100%" }}>+ PDF hochladen</button>
                  </div>
                )}
              </div>

              <div style={{ background: "#0d1526", border: "1px solid #1e293b", borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "#475569", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Status setzen</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {Object.entries(STATUS).map(([k, v]) => (
                    <button key={k} onClick={() => updateStatus(obj.id, k)} style={{ background: obj.status === k ? v.bg : "transparent", border: `1px solid ${obj.status === k ? v.color : "#334155"}`, color: obj.status === k ? v.color : "#64748b", padding: "8px 16px", borderRadius: 20, cursor: "pointer", fontSize: 13, fontWeight: obj.status === k ? 600 : 400 }}>
                      {v.icon} {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ background: "#0d1526", border: "1px solid #1e293b", borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "#475569", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>E-Mails generieren</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <EmailBtn label="📨 Exposé anfragen" onClick={() => openEmail(obj, "expose_anfrage")} color="#60a5fa" />
                  <EmailBtn label="📤 An Kollegen weiterleiten" onClick={() => openEmail(obj, "weiterleitung")} color="#a78bfa" />
                  <EmailBtn label="📅 Termin anfragen" onClick={() => openEmail(obj, "termin_anfrage")} color="#fb923c" />
                </div>
              </div>

              <div style={{ background: "#0d1526", border: "1px solid #1e293b", borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "#475569", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Verlauf</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[...obj.log].reverse().map((l, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, fontSize: 12 }}>
                      <span style={{ color: "#334155", fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>{fmt(l.ts)}</span>
                      <span style={{ color: "#64748b" }}>{l.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={() => { if (window.confirm("Objekt wirklich löschen?")) deleteObjekt(obj.id); }} style={{ background: "transparent", border: "1px solid #7f1d1d", color: "#f87171", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, width: "100%" }}>Objekt löschen</button>
            </div>
          );
        })()}

        {view === "email" && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6, color: "#e2e8f0" }}>E-Mail generiert</div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>
              Ersetze <span style={{ color: "#fb923c", fontFamily: "monospace", background: "#431407", padding: "2px 6px", borderRadius: 4 }}>[NAME]</span> mit dem Namen des Anbieters, dann kopieren!
            </div>
            <textarea value={emailText} onChange={e => setEmailText(e.target.value)} style={{ width: "100%", minHeight: 360, background: "#0d1526", border: "1px solid #1e293b", borderRadius: 10, padding: 16, color: "#cbd5e1", fontSize: 13, fontFamily: "'DM Mono', monospace", lineHeight: 1.7, resize: "vertical", boxSizing: "border-box", outline: "none" }} />
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button onClick={copyEmail} style={{ flex: 1, background: copied ? "#052e16" : "linear-gradient(135deg, #3b82f6, #1d4ed8)", border: copied ? "1px solid #4ade80" : "none", color: copied ? "#4ade80" : "#fff", padding: 12, borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
                {copied ? "✓ Kopiert!" : "Kopieren"}
              </button>
              <button onClick={() => setView("detail")} style={{ background: "#1e293b", border: "none", color: "#94a3b8", padding: "12px 20px", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>Zurück</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatPill({ label, count, active, onClick, color }) {
  return (
    <button onClick={onClick} style={{ background: active ? `${color}22` : "transparent", border: `1px solid ${active ? color : "#1e293b"}`, color: active ? color : "#475569", padding: "4px 12px", borderRadius: 20, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
      {label} <span style={{ background: active ? `${color}33` : "#1e293b", padding: "1px 6px", borderRadius: 10, fontSize: 11 }}>{count}</span>
    </button>
  );
}

function Field({ label, value, onChange, placeholder, multiline }) {
  const style = { width: "100%", background: "#0d1526", border: "1px solid #1e293b", borderRadius: 8, padding: "10px 12px", color: "#e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
  return (
    <div>
      <label style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>{label}</label>
      {multiline ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ ...style, minHeight: 80, resize: "vertical" }} /> : <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={style} />}
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#475569", marginBottom: 2 }}>{icon} {label}</div>
      <div style={{ fontSize: 13, color: "#cbd5e1" }}>{value}</div>
    </div>
  );
}

function EmailBtn({ label, onClick, color }) {
  return (
    <button onClick={onClick} style={{ background: "transparent", border: `1px solid ${color}44`, color: color, padding: "10px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, textAlign: "left" }}
      onMouseEnter={e => e.currentTarget.style.background = `${color}11`}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
      {label}
    </button>
  );
}
