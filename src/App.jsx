import { useState, useEffect, useRef } from "react";

const STATUS = {
  erhalten: { label: "Exposé erhalten", color: "#f87171", bg: "#2d0a0a", icon: "🔴" },
  termin_angefragt: { label: "Termin angefragt", color: "#fb923c", bg: "#431407", icon: "🟠" },
  bestaetigt: { label: "Termin bestätigt", color: "#4ade80", bg: "#052e16", icon: "🟢" },
};

const EMMANUEL_EMAIL = "emanuel.h1@outlook.de";

const buildWeiterleitungBody = (obj) => [
  `Hallo Emmanuel,`,
  ``,
  `schau dir mal dieses Objekt an:`,
  obj.titel ? `Objekt: ${obj.titel}` : null,
  `Adresse: ${obj.adresse || "[Adresse]"}`,
  `Preis: ${obj.preis || "[Preis]"}`,
  obj.groesse ? `Größe: ${obj.groesse}` : null,
  obj.zimmer ? `Zimmer: ${obj.zimmer}` : null,
  ``,
  `Ich habe das PDF separat heruntergeladen – schau es dir an und sag mir, ob wir einen Termin anfragen sollen.`,
  ``,
  `Viele Grüße`,
  `Giuliano`,
].filter(l => l !== null).join("\n");

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
};

const STORAGE_KEY = "immo_crm_v1";
function loadData() { try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : []; } catch { return []; } }
function saveData(d) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch (e) { console.error(e); } }

// ─── AI PDF Extraction ───────────────────────────────────────────────────────
async function extractFromPDF(base64Data) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64Data }
          },
          {
            type: "text",
            text: `Lies dieses Immobilien-Exposé und extrahiere folgende Informationen. Antworte NUR mit einem JSON-Objekt, ohne Erklärungen, ohne Backticks:
{
  "strasse": "Straßenname mit Hausnummer",
  "plz": "Postleitzahl",
  "ort": "Stadtname",
  "titel": "Exposé [Straße mit Hausnummer], [PLZ] [Ort]",
  "preis": "Kaufpreis als Text z.B. 450.000 €",
  "groesse": "Wohnfläche z.B. 85 m²",
  "zimmer": "Anzahl Zimmer als Zahl z.B. 3",
  "anbieter": "Name des Maklers oder Anbieters falls vorhanden"
}
Falls ein Wert nicht gefunden wird, setze null.`
          }
        ]
      }]
    })
  });
  const data = await response.json();
  const text = data.content?.map(i => i.text || "").join("") || "";
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}
// ─────────────────────────────────────────────────────────────────────────────

export default function ImmoCRM() {
  const [objekte, setObjekte] = useState(() => loadData());
  const [view, setView] = useState("liste");
  const [selected, setSelected] = useState(null);
  const [emailText, setEmailText] = useState("");
  const [emailMode, setEmailMode] = useState(null);
  const [copied, setCopied] = useState(false);
  const [filterStatus, setFilterStatus] = useState("alle");
  const [toast, setToast] = useState(null);
  const [pdfAnalyzing, setPdfAnalyzing] = useState(false);
  const [extractedForm, setExtractedForm] = useState(null); // preview before saving
  const fileRef = useRef();
  const newPdfRef = useRef();
  const screenshotRef = useRef();

  const [form, setForm] = useState({ adresse: "", titel: "", preis: "", groesse: "", zimmer: "", anbieter: "", notizen: "" });

  useEffect(() => { saveData(objekte); }, [objekte]);

  const showToast = (msg, type = "ok") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };

  // ── Handle new PDF upload on "Neu" form ──────────────────────────────────
  const handleNewPDF = async (file) => {
    setPdfAnalyzing(true);
    showToast("🤖 KI liest das Exposé...", "ok");
    try {
      const base64 = await fileToBase64(file);
      const extracted = await extractFromPDF(base64);
      setForm(prev => ({
        ...prev,
        adresse: [extracted.strasse, extracted.plz, extracted.ort].filter(Boolean).join(", ") || prev.adresse,
        titel: extracted.titel || prev.titel,
        preis: extracted.preis || prev.preis,
        groesse: extracted.groesse || prev.groesse,
        zimmer: extracted.zimmer || prev.zimmer,
        anbieter: extracted.anbieter || prev.anbieter,
      }));
      setExtractedForm({ base64: `data:application/pdf;base64,${base64}`, name: file.name });
      showToast("✓ Felder automatisch ausgefüllt – bitte prüfen!");
    } catch (e) {
      console.error(e);
      showToast("KI-Analyse fehlgeschlagen – bitte manuell ausfüllen", "err");
    }
    setPdfAnalyzing(false);
  };

  const fileToBase64 = (file) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = () => rej(new Error("Lesefehler"));
    r.readAsDataURL(file);
  });

  const addObjekt = () => {
    if (!form.adresse.trim()) { showToast("Bitte Adresse eingeben", "err"); return; }
    const neu = {
      id: Date.now(), ...form, status: "erhalten",
      erstelltAm: new Date().toISOString(),
      pdf: extractedForm?.base64 || null,
      pdfName: extractedForm?.name || null,
      terminScreenshots: [], emmanuelKommentar: "",
      log: [{ ts: new Date().toISOString(), text: "Objekt angelegt" + (extractedForm ? " (PDF automatisch erkannt)" : "") }],
    };
    setObjekte(prev => [neu, ...prev]);
    setForm({ adresse: "", titel: "", preis: "", groesse: "", zimmer: "", anbieter: "", notizen: "" });
    setExtractedForm(null);
    setView("liste");
    showToast("Objekt angelegt ✓");
  };

  const updateStatus = (id, status) => {
    setObjekte(prev => prev.map(o => o.id === id ? { ...o, status, log: [...o.log, { ts: new Date().toISOString(), text: `Status → ${STATUS[status].label}` }] } : o));
    showToast(`Status: ${STATUS[status].label}`);
  };

  const deleteObjekt = (id) => { setObjekte(prev => prev.filter(o => o.id !== id)); setView("liste"); setSelected(null); showToast("Gelöscht"); };

  const handlePDF = (id, file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setObjekte(prev => prev.map(o => o.id === id ? { ...o, pdf: e.target.result, pdfName: file.name, log: [...o.log, { ts: new Date().toISOString(), text: `Exposé hochgeladen: ${file.name}` }] } : o));
      showToast("PDF gespeichert ✓");
    };
    reader.readAsDataURL(file);
  };

  const handleScreenshot = (id, files) => {
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setObjekte(prev => prev.map(o => o.id === id ? { ...o, terminScreenshots: [...(o.terminScreenshots || []), { data: e.target.result, name: file.name, ts: new Date().toISOString() }], log: [...o.log, { ts: new Date().toISOString(), text: `Screenshot hinzugefügt` }] } : o));
        showToast("Screenshot gespeichert ✓");
      };
      reader.readAsDataURL(file);
    });
  };

  const removeScreenshot = (objId, idx) => { setObjekte(prev => prev.map(o => o.id === objId ? { ...o, terminScreenshots: o.terminScreenshots.filter((_, i) => i !== idx) } : o)); };
  const updateKommentar = (id, text) => { setObjekte(prev => prev.map(o => o.id === id ? { ...o, emmanuelKommentar: text } : o)); };

  const bestaetigeTermin = (id) => {
    setObjekte(prev => prev.map(o => o.id === id ? { ...o, status: "bestaetigt", log: [...o.log, { ts: new Date().toISOString(), text: "✅ Termin bestätigt" }] } : o));
    showToast("Termin bestätigt! ✓");
  };

  const weiterleitenAnEmmanuel = (obj) => {
    if (obj.pdf) { const a = document.createElement("a"); a.href = obj.pdf; a.download = obj.pdfName || "expose.pdf"; a.click(); }
    const subject = encodeURIComponent(`Exposé zur Prüfung – ${obj.titel || obj.adresse || "Immobilie"}`);
    const body = encodeURIComponent(buildWeiterleitungBody(obj));
    window.location.href = `mailto:${EMMANUEL_EMAIL}?subject=${subject}&body=${body}`;
    setObjekte(prev => prev.map(o => o.id === obj.id ? { ...o, log: [...o.log, { ts: new Date().toISOString(), text: "Weitergeleitet an Emmanuel" }] } : o));
    showToast(obj.pdf ? "PDF lädt + Outlook öffnet sich" : "Outlook öffnet sich...");
  };

  const openEmail = (obj, type) => { setEmailText(EMAIL_TEMPLATES[type](obj)); setEmailMode(type); setView("email"); };
  const copyEmail = () => { navigator.clipboard.writeText(emailText); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const filtered = filterStatus === "alle" ? objekte : objekte.filter(o => o.status === filterStatus);
  const statusCounts = Object.keys(STATUS).reduce((acc, k) => { acc[k] = objekte.filter(o => o.status === k).length; return acc; }, {});
  const fmt = (iso) => new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
  const liveObj = selected ? objekte.find(o => o.id === selected.id) : null;

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", color: "#e2e8f0" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {toast && <div style={{ position: "fixed", top: 20, right: 20, zIndex: 1000, background: toast.type === "err" ? "#7f1d1d" : "#052e16", border: `1px solid ${toast.type === "err" ? "#ef4444" : "#4ade80"}`, color: toast.type === "err" ? "#fca5a5" : "#86efac", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontFamily: "'DM Mono', monospace", boxShadow: "0 4px 24px rgba(0,0,0,0.5)", maxWidth: 320 }}>{toast.msg}</div>}

      {/* Header */}
      <div style={{ borderBottom: "1px solid #1e293b", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0d1526" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🏠</div>
          <div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 500, color: "#60a5fa", letterSpacing: 2 }}>IMMO</div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: -2 }}>Workflow Manager</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {view !== "liste" && <button onClick={() => { setView("liste"); setExtractedForm(null); }} style={{ background: "transparent", border: "1px solid #334155", color: "#94a3b8", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>← Zurück</button>}
          {view === "liste" && <button onClick={() => setView("neu")} style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", border: "none", color: "#fff", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 }}>+ Objekt</button>}
        </div>
      </div>

      {/* Filter Bar */}
      {view === "liste" && (
        <div style={{ padding: "12px 24px", display: "flex", gap: 8, borderBottom: "1px solid #1e293b", overflowX: "auto" }}>
          <StatPill label="Alle" count={objekte.length} active={filterStatus === "alle"} onClick={() => setFilterStatus("alle")} color="#60a5fa" />
          {Object.entries(STATUS).map(([k, v]) => <StatPill key={k} label={v.label} count={statusCounts[k]} active={filterStatus === k} onClick={() => setFilterStatus(k)} color={v.color} />)}
        </div>
      )}

      <div style={{ padding: "20px 24px", maxWidth: 800, margin: "0 auto" }}>

        {/* LISTE */}
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
                      {(obj.terminScreenshots || []).length > 0 && <span style={{ fontSize: 11, background: "#431407", color: "#fb923c", padding: "2px 7px", borderRadius: 4 }}>📸 {obj.terminScreenshots.length}</span>}
                      <div style={{ fontSize: 11, background: s.bg, color: s.color, padding: "3px 9px", borderRadius: 20, border: `1px solid ${s.color}44`, whiteSpace: "nowrap" }}>{s.icon} {s.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* NEU */}
        {view === "neu" && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6, color: "#e2e8f0" }}>Neues Objekt anlegen</div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>Lade zuerst das PDF hoch – die KI füllt die Felder automatisch aus</div>

            {/* PDF Upload – prominent at top */}
            <div style={{ background: pdfAnalyzing ? "#0d2240" : extractedForm ? "#052e16" : "#0d1526", border: `2px dashed ${pdfAnalyzing ? "#3b82f6" : extractedForm ? "#4ade80" : "#334155"}`, borderRadius: 12, padding: 20, marginBottom: 20, textAlign: "center", transition: "all 0.3s" }}>
              {pdfAnalyzing ? (
                <div>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🤖</div>
                  <div style={{ color: "#60a5fa", fontWeight: 600, marginBottom: 4 }}>KI analysiert das Exposé...</div>
                  <div style={{ color: "#475569", fontSize: 12 }}>Einen Moment bitte</div>
                </div>
              ) : extractedForm ? (
                <div>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>✅</div>
                  <div style={{ color: "#4ade80", fontWeight: 600, marginBottom: 2 }}>{extractedForm.name}</div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>Felder wurden automatisch ausgefüllt</div>
                  <input type="file" accept=".pdf" ref={newPdfRef} style={{ display: "none" }} onChange={e => { if (e.target.files[0]) handleNewPDF(e.target.files[0]); }} />
                  <button onClick={() => newPdfRef.current.click()} style={{ marginTop: 10, background: "transparent", border: "1px solid #334155", color: "#64748b", padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>Anderes PDF wählen</button>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📄</div>
                  <div style={{ color: "#e2e8f0", fontWeight: 600, marginBottom: 4 }}>Exposé PDF hochladen</div>
                  <div style={{ color: "#475569", fontSize: 12, marginBottom: 14 }}>KI erkennt Adresse, Preis, Größe und Zimmer automatisch</div>
                  <input type="file" accept=".pdf" ref={newPdfRef} style={{ display: "none" }} onChange={e => { if (e.target.files[0]) handleNewPDF(e.target.files[0]); }} />
                  <button onClick={() => newPdfRef.current.click()} style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", border: "none", color: "#fff", padding: "10px 24px", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>PDF auswählen</button>
                  <div style={{ color: "#334155", fontSize: 11, marginTop: 10 }}>Oder manuell ausfüllen ↓</div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Field label="Objektbezeichnung / Titel" value={form.titel} onChange={v => setForm({ ...form, titel: v })} placeholder='wird automatisch befüllt' />
              <Field label="Adresse *" value={form.adresse} onChange={v => setForm({ ...form, adresse: v })} placeholder="Straße, PLZ Ort" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <Field label="Preis" value={form.preis} onChange={v => setForm({ ...form, preis: v })} placeholder="450.000 €" />
                <Field label="Größe" value={form.groesse} onChange={v => setForm({ ...form, groesse: v })} placeholder="85 m²" />
                <Field label="Zimmer" value={form.zimmer} onChange={v => setForm({ ...form, zimmer: v })} placeholder="3" />
              </div>
              <Field label="Anbieter / Makler" value={form.anbieter} onChange={v => setForm({ ...form, anbieter: v })} placeholder="Name oder E-Mail" />
              <Field label="Notizen" value={form.notizen} onChange={v => setForm({ ...form, notizen: v })} placeholder="Wichtige Infos..." multiline />
              <button onClick={addObjekt} disabled={pdfAnalyzing} style={{ background: pdfAnalyzing ? "#1e293b" : "linear-gradient(135deg, #3b82f6, #1d4ed8)", border: "none", color: pdfAnalyzing ? "#475569" : "#fff", padding: "12px", borderRadius: 8, cursor: pdfAnalyzing ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600, marginTop: 8 }}>
                {pdfAnalyzing ? "KI analysiert..." : "Objekt speichern"}
              </button>
            </div>
          </div>
        )}

        {/* DETAIL */}
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

              {/* PDF */}
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

              {/* Status */}
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

              {/* E-Mails */}
              <div style={{ background: "#0d1526", border: "1px solid #1e293b", borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "#475569", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>E-Mails</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <EmailBtn label="📨 Exposé anfragen" onClick={() => openEmail(obj, "expose_anfrage")} color="#60a5fa" />
                  <EmailBtn label="📅 Termin anfragen" onClick={() => openEmail(obj, "termin_anfrage")} color="#fb923c" />
                  <div style={{ background: "#1a1040", border: "1px solid #7c3aed44", borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 12, color: "#a78bfa", fontWeight: 600, marginBottom: 4 }}>📤 Weiterleiten an Emmanuel</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10 }}>Öffnet Outlook an <span style={{ color: "#a78bfa" }}>{EMMANUEL_EMAIL}</span>{obj.pdf ? " + lädt PDF herunter" : ""}</div>
                    <button onClick={() => weiterleitenAnEmmanuel(obj)} style={{ background: "linear-gradient(135deg, #7c3aed, #5b21b6)", border: "none", color: "#fff", padding: "9px 16px", borderRadius: 7, cursor: "pointer", fontSize: 13, fontWeight: 600, width: "100%" }}>
                      {obj.pdf ? "📄 PDF laden + Outlook öffnen" : "Outlook öffnen"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Screenshots */}
              <div style={{ background: "#0d1526", border: "1px solid #1e293b", borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "#475569", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>📸 Terminvorschläge (Screenshots)</div>
                <div style={{ fontSize: 12, color: "#475569", marginBottom: 10 }}>Screenshots von Makler-Antworten mit Terminvorschlägen</div>
                {(obj.terminScreenshots || []).length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                    {obj.terminScreenshots.map((sc, idx) => (
                      <div key={idx} style={{ border: "1px solid #1e293b", borderRadius: 8, overflow: "hidden", position: "relative" }}>
                        <img src={sc.data} alt={sc.name} style={{ width: "100%", display: "block" }} />
                        <button onClick={() => removeScreenshot(obj.id, idx)} style={{ position: "absolute", top: 8, right: 8, background: "#7f1d1d", border: "none", color: "#fca5a5", width: 26, height: 26, borderRadius: "50%", cursor: "pointer", fontSize: 14 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <input type="file" accept="image/*" multiple ref={screenshotRef} style={{ display: "none" }} onChange={e => { if (e.target.files.length) handleScreenshot(obj.id, e.target.files); screenshotRef.current.value = ""; }} />
                <button onClick={() => screenshotRef.current.click()} style={{ background: "#1e293b", border: "1px dashed #334155", color: "#64748b", padding: "10px 20px", borderRadius: 8, cursor: "pointer", fontSize: 13, width: "100%" }}>+ Screenshot hinzufügen</button>
              </div>

              {/* Emmanuel Feedback */}
              {(obj.terminScreenshots || []).length > 0 && (
                <div style={{ background: "#0d1526", border: "1px solid #7c3aed44", borderRadius: 10, padding: 14, marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: "#a78bfa", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>💬 Emmanuel's Feedback</div>
                  <textarea value={obj.emmanuelKommentar || ""} onChange={e => updateKommentar(obj.id, e.target.value)} placeholder="Kommentar zu den Terminvorschlägen..." style={{ width: "100%", background: "#0a0f1a", border: "1px solid #1e293b", borderRadius: 8, padding: "10px 12px", color: "#e2e8f0", fontSize: 13, fontFamily: "inherit", minHeight: 80, resize: "vertical", outline: "none", boxSizing: "border-box" }} />
                  {obj.status !== "bestaetigt" ? (
                    <button onClick={() => bestaetigeTermin(obj.id)} style={{ marginTop: 10, background: "linear-gradient(135deg, #16a34a, #15803d)", border: "none", color: "#fff", padding: "10px 20px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, width: "100%" }}>✅ Termin bestätigen</button>
                  ) : (
                    <div style={{ marginTop: 10, background: "#052e16", border: "1px solid #4ade80", borderRadius: 8, padding: "10px 16px", color: "#4ade80", fontSize: 13, textAlign: "center", fontWeight: 600 }}>🟢 Termin bestätigt!</div>
                  )}
                </div>
              )}

              {/* Verlauf */}
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

        {/* EMAIL */}
        {view === "email" && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6, color: "#e2e8f0" }}>{emailMode === "expose_anfrage" ? "Exposé anfragen" : "Termin anfragen"}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>Ersetze <span style={{ color: "#fb923c", fontFamily: "monospace", background: "#431407", padding: "2px 6px", borderRadius: 4 }}>[NAME]</span> mit dem Namen des Anbieters, dann kopieren!</div>
            <textarea value={emailText} onChange={e => setEmailText(e.target.value)} style={{ width: "100%", minHeight: 360, background: "#0d1526", border: "1px solid #1e293b", borderRadius: 10, padding: 16, color: "#cbd5e1", fontSize: 13, fontFamily: "'DM Mono', monospace", lineHeight: 1.7, resize: "vertical", boxSizing: "border-box", outline: "none" }} />
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button onClick={copyEmail} style={{ flex: 1, background: copied ? "#052e16" : "linear-gradient(135deg, #3b82f6, #1d4ed8)", border: copied ? "1px solid #4ade80" : "none", color: copied ? "#4ade80" : "#fff", padding: 12, borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>{copied ? "✓ Kopiert!" : "Kopieren"}</button>
              <button onClick={() => setView("detail")} style={{ background: "#1e293b", border: "none", color: "#94a3b8", padding: "12px 20px", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>Zurück</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatPill({ label, count, active, onClick, color }) {
  return <button onClick={onClick} style={{ background: active ? `${color}22` : "transparent", border: `1px solid ${active ? color : "#1e293b"}`, color: active ? color : "#475569", padding: "4px 12px", borderRadius: 20, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>{label} <span style={{ background: active ? `${color}33` : "#1e293b", padding: "1px 6px", borderRadius: 10, fontSize: 11 }}>{count}</span></button>;
}
function Field({ label, value, onChange, placeholder, multiline }) {
  const style = { width: "100%", background: "#0d1526", border: "1px solid #1e293b", borderRadius: 8, padding: "10px 12px", color: "#e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
  return <div><label style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>{label}</label>{multiline ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ ...style, minHeight: 80, resize: "vertical" }} /> : <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={style} />}</div>;
}
function InfoRow({ icon, label, value }) {
  return <div><div style={{ fontSize: 11, color: "#475569", marginBottom: 2 }}>{icon} {label}</div><div style={{ fontSize: 13, color: "#cbd5e1" }}>{value}</div></div>;
}
function EmailBtn({ label, onClick, color }) {
  return <button onClick={onClick} style={{ background: "transparent", border: `1px solid ${color}44`, color, padding: "10px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, textAlign: "left" }} onMouseEnter={e => e.currentTarget.style.background = `${color}11`} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>{label}</button>;
}
