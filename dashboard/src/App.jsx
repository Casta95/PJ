import { useState, useEffect, useRef } from "react";
import {
  BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, ReferenceLine, RadarChart,
  Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import { Clock, Coins, User, Hospital } from "lucide-react";

// ── Constantes de diseño (Modo Claro Adaptado) ──────────────────────────────
const TIER_COLORS  = { BAJO: "#16a34a", MEDIO: "#d97706", ALTO: "#dc2626" };
const TIER_BG      = { BAJO: "rgba(22,163,74,0.06)", MEDIO: "rgba(217,119,6,0.06)", ALTO: "rgba(220,38,38,0.06)" };
const TIER_BORDER  = { BAJO: "#16a34a", MEDIO: "#d97706", ALTO: "#dc2626" };
const ESTADO_COLORS = {
  AP: "#6366f1", RD: "#0ea5e9", GN: "#f97316",
  DV: "#dc2626", EV: "#14b8a6", RV: "#a855f7",
  PV: "#84cc16", PD: "#64748b",
};
const API = "http://localhost:5000/api";

// ── Utilidades ─────────────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat("es-CO").format(Math.round(n));
const fmtCOP = (n) => `$${fmt(n)}`;
const fmtPct = (n) => `${n}%`;

const useFetch = (endpoint) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${API}${endpoint}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [endpoint]);
  return { data, loading };
};

// ── Componentes UI ─────────────────────────────────────────────────────────
const Spinner = () => (
  <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:120 }}>
    <div style={{
      width:32, height:32, borderRadius:"50%",
      border:"3px solid #e2e8f0", borderTopColor:"#0ea5e9",
      animation:"spin 0.8s linear infinite",
    }} />
  </div>
);

const SectionTitle = ({ children, subtitle }) => (
  <div style={{ marginBottom:24 }}>
    <h2 style={{
      margin:0, fontSize:13, fontFamily:"'DM Mono', monospace",
      letterSpacing:"0.15em", textTransform:"uppercase",
      color:"#475569", fontWeight:600,
    }}>{children}</h2>
    {subtitle && (
      <p style={{ margin:"4px 0 0", fontSize:11, color:"#64748b", fontFamily:"'DM Mono', monospace" }}>
        {subtitle}
      </p>
    )}
  </div>
);

const Card = ({ children, style = {} }) => (
  <div style={{
    background:"#ffffff",
    border:"1px solid #e2e8f0",
    borderRadius:8,
    padding:24,
    boxShadow:"0 1px 3px rgba(0,0,0,0.05)",
    ...style,
  }}>
    {children}
  </div>
);

const InsightBadge = ({ color, children }) => (
  <div style={{
    display:"inline-flex", alignItems:"flex-start", gap:8,
    marginTop:12, padding:"8px 12px",
    background: `${color}10`,
    border:`1px solid ${color}25`,
    borderRadius:6, fontSize:12, lineHeight:1.5,
    color:"#334155", fontFamily:"'DM Mono', monospace",
  }}>
    <span style={{ color, fontWeight:700, flexShrink:0 }}>▸</span>
    {children}
  </div>
);

// ── Sección 1: KPIs principales ────────────────────────────────────────────
const KPISection = () => {
  const { data, loading } = useFetch("/kpis");

  if (loading) return <Spinner />;
  if (!data) return null;

  const mainKPIs = [
    {
      label: "Facturas en Cartera",
      value: fmt(data.total_facturas),
      sub: "corte 16-04-2026",
      color: "#0284c7",
    },
    {
      label: "Valor Total Cartera",
      value: fmtCOP(data.valor_total_cop),
      sub: "suma de todas las facturas",
      color: "#6d28d9",
    },
    {
      label: "Silhouette Score",
      value: data.silhouette_score.toFixed(4),
      sub: "calidad del clustering k=3",
      color: "#16a34a",
    },
    {
      label: "Facturas Tier ALTO",
      value: fmt(data.tiers.ALTO.count),
      sub: `${data.tiers.ALTO.pct}% — atención prioritaria`,
      color: "#dc2626",
    },
  ];

  return (
    <div>
      {/* Headline KPIs Responsivo */}
      <div style={{
        display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(240px, 1fr))", gap:16, marginBottom:24,
      }}>
        {mainKPIs.map((kpi) => (
          <Card key={kpi.label} style={{ position:"relative", overflow:"hidden" }}>
            <div style={{
              position:"absolute", top:0, left:0, right:0, height:3,
              background: kpi.color,
            }} />
            <div style={{
              fontSize:11, fontFamily:"'DM Mono', monospace",
              letterSpacing:"0.1em", color:"#475569",
              textTransform:"uppercase", marginBottom:8,
              fontWeight: 500
            }}>
              {kpi.label}
            </div>
            <div style={{
              fontSize: kpi.label === "Valor Total Cartera" ? "22px" : "28px", 
              fontWeight:700, color: kpi.color,
              fontFamily:"'Space Grotesk', sans-serif", lineHeight:1.2,
              marginBottom:4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}>
              {kpi.value}
            </div>
            <div style={{ fontSize:11, color:"#64748b", fontFamily:"'DM Mono', monospace" }}>
              {kpi.sub}
            </div>
          </Card>
        ))}
      </div>

      {/* Breakdown de Tiers Responsivo */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))", gap:16 }}>
        {["BAJO","MEDIO","ALTO"].map((tier) => {
          const t = data.tiers[tier];
          const color = TIER_COLORS[tier];
          return (
            <Card key={tier} style={{ borderColor: `${color}30`, boxShadow:`0 1px 3px ${color}05` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                <div>
                  <div style={{
                    fontSize:11, fontFamily:"'DM Mono', monospace",
                    color:"#475569", textTransform:"uppercase", letterSpacing:"0.1em",
                    marginBottom:4, fontWeight: 500
                  }}>
                    Tier {tier}
                  </div>
                  <div style={{ fontSize:32, fontWeight:700, color, fontFamily:"'Space Grotesk', sans-serif" }}>
                    {fmt(t.count)}
                  </div>
                  <div style={{ fontSize:13, color:"#334155", marginTop:2 }}>
                    {t.pct}% de la cartera
                  </div>
                </div>
                <div style={{ textAlign:"right", flexShrink: 0 }}>
                  <div style={{
                    background: `${color}10`, border:`1px solid ${color}25`,
                    borderRadius:6, padding:"4px 10px",
                    fontSize:11, color, fontFamily:"'DM Mono', monospace",
                    marginBottom:6, fontWeight: 600
                  }}>
                    {t.dias_med} días (med.)
                  </div>
                  <div style={{ fontSize:11, color:"#64748b", fontFamily:"'DM Mono', monospace" }}>
                    mediana: {fmtCOP(t.valor.mediana_cop)}
                  </div>
                </div>
              </div>

              {/* Barra de progreso */}
              <div style={{ marginTop:16, height:4, background:"#e2e8f0", borderRadius:2 }}>
                <div style={{
                  width:`${t.pct}%`, height:"100%",
                  background: color, borderRadius:2,
                  transition:"width 0.6s ease",
                }} />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

// ── Sección 2: Distribución de estados ────────────────────────────────────
const EstadosSection = () => {
  const { data, loading } = useFetch("/estados");

  if (loading) return <Spinner />;
  if (!data) return null;

  const globalData = Object.entries(data.global)
    .map(([k, v]) => ({ estado: k, label: data.labels[k] || k, count: v }))
    .sort((a, b) => b.count - a.count);

  const tierData = ["BAJO","MEDIO","ALTO"].map((tier) => ({
    tier,
    ...data.por_tier[tier],
  }));

  const estados = Object.keys(data.labels);

  const tooltipStyles = {
    contentStyle: { background:"#ffffff", border:"1px solid #cbd5e1", borderRadius:6, boxShadow:"0 2px 4px rgba(0,0,0,0.05)" },
    labelStyle: { color:"#0f172a", fontFamily:"'DM Mono', monospace", fontWeight:600 }
  };

  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(340px, 1fr))", gap:16 }}>
      {/* Barras globales */}
      <Card>
        <SectionTitle subtitle="Total de facturas por estado del proceso">
          Distribución de Estados
        </SectionTitle>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={globalData} layout="vertical" margin={{ left:10, right:30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
            <XAxis type="number" tick={{ fill:"#64748b", fontSize:11 }} />
            <YAxis
              type="category" dataKey="estado" width={28}
              tick={{ fill:"#475569", fontSize:11, fontFamily:"'DM Mono', monospace" }}
            />
            <Tooltip
              contentStyle={tooltipStyles.contentStyle}
              labelStyle={tooltipStyles.labelStyle}
              formatter={(v, n, p) => [fmt(v), p.payload.label]}
            />
            <Bar dataKey="count" radius={[0, 3, 3, 0]}>
              {globalData.map((e) => (
                <Cell key={e.estado} fill={ESTADO_COLORS[e.estado] || "#64748b"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <InsightBadge color="#0ea5e9">
          RD (49.1%) y AP (25.3%) concentran el 74.4% del total. GN representa 1 de cada 5 facturas sin enviar.
        </InsightBadge>
      </Card>

      {/* Cross por tier */}
      <Card>
        <SectionTitle subtitle="% de cada estado dentro de su tier (validación del modelo)">
          Composición por Tier
        </SectionTitle>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={tierData} margin={{ right:16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="tier" tick={{ fill:"#475569", fontSize:12, fontFamily:"'DM Mono', monospace" }} />
            <YAxis tick={{ fill:"#64748b", fontSize:11 }} unit="%" domain={[0,100]} />
            <Tooltip
              contentStyle={tooltipStyles.contentStyle}
              formatter={(v) => [`${v.toFixed(1)}%`]}
            />
            <Legend wrapperStyle={{ fontSize:11, fontFamily:"'DM Mono', monospace", paddingTop: 10 }} />
            {estados.map((est) => (
              <Bar key={est} dataKey={est} stackId="a"
                fill={ESTADO_COLORS[est] || "#64748b"} name={est} />
            ))}
          </BarChart>
        </ResponsiveContainer>
        <InsightBadge color="#6366f1">
          Tier BAJO: 75.9% AP · Tier MEDIO: 86.5% RD + glosas (DV/RV) · Tier ALTO: 72.4% GN sin enviar. Separación casi perfecta sin supervisión.
        </InsightBadge>
      </Card>
    </div>
  );
};

// ── Sección 3: Elbow + Silhouette ─────────────────────────────────────────
const ElbowSection = () => {
  const { data, loading } = useFetch("/elbow");

  if (loading) return <Spinner />;
  if (!data) return null;

  const tooltipStyles = {
    contentStyle: { background:"#ffffff", border:"1px solid #cbd5e1", borderRadius:6, boxShadow:"0 2px 4px rgba(0,0,0,0.05)" },
    labelStyle: { color:"#0f172a", fontFamily:"'DM Mono', monospace" }
  };

  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(300px, 1fr))", gap:16 }}>
      <Card>
        <SectionTitle subtitle="Suma de cuadrados intra-cluster (WCSS)">
          Método del Codo
        </SectionTitle>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ right:16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="k" tick={{ fill:"#475569", fontSize:11 }} label={{ value:"k", position:"insideRight", fill:"#64748b", fontSize:11 }} />
            <YAxis tick={{ fill:"#64748b", fontSize:10 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
            <Tooltip
              contentStyle={tooltipStyles.contentStyle}
              labelStyle={tooltipStyles.labelStyle}
              formatter={(v) => [fmt(v), "Inercia"]}
            />
            <ReferenceLine x={3} stroke="#16a34a" strokeDasharray="4 4" label={{ value:"k=3", fill:"#16a34a", fontSize:11, position:"top", fontWeight:600 }} />
            <Line type="monotone" dataKey="inercia" stroke="#0284c7" strokeWidth={2.5} dot={{ fill:"#0284c7", r:4 }} />
          </LineChart>
        </ResponsiveContainer>
        <InsightBadge color="#0284c7">
          Inflexión notable en k=3. Más clusters no justifican la complejidad operativa adicional.
        </InsightBadge>
      </Card>

      <Card>
        <SectionTitle subtitle="Mejor separación matemática vs valor operativo">
          Silhouette Score por k
        </SectionTitle>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ right:16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="k" tick={{ fill:"#475569", fontSize:11 }} />
            <YAxis tick={{ fill:"#64748b", fontSize:11 }} domain={[0.2, 0.35]} />
            <Tooltip
              contentStyle={tooltipStyles.contentStyle}
              labelStyle={tooltipStyles.labelStyle}
              formatter={(v) => [v.toFixed(4), "Silhouette"]}
            />
            <ReferenceLine x={3} stroke="#16a34a" strokeDasharray="4 4" label={{ value:"k=3", fill:"#16a34a", fontSize:11, position:"top", fontWeight:600 }} />
            <Line type="monotone" dataKey="silhouette" stroke="#7c3aed" strokeWidth={2.5} dot={{ fill:"#7c3aed", r:4 }} />
          </LineChart>
        </ResponsiveContainer>
        <InsightBadge color="#7c3aed">
          k=2 maximiza Silhouette (0.3245) pero es insuficiente operativamente. k=3 sacrifica 0.076 a cambio de 3 niveles de gestión accionables.
        </InsightBadge>
      </Card>
    </div>
  );
};

// ── Sección 4: Correlaciones Spearman ────────────────────────────────────
const CorrelacionesSection = () => {
  const { data, loading } = useFetch("/correlaciones_spearman");

  if (loading) return <Spinner />;
  if (!data) return null;

  const top12 = data.slice(0, 12).map((d) => ({
    ...d,
    abs_rho: Math.abs(d.rho),
  }));

  return (
    <Card>
      <SectionTitle subtitle="Correlación de Spearman con dias_transcurridos (proxy del tier)">
        Importancia de Variables
      </SectionTitle>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={top12} layout="vertical" margin={{ left:40, right:60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
          <XAxis type="number" domain={[0, 1]} tick={{ fill:"#64748b", fontSize:11 }} />
          <YAxis
            type="category" dataKey="feature" width={160}
            tick={{ fill:"#475569", fontSize:10, fontFamily:"'DM Mono', monospace" }}
          />
          <Tooltip
            contentStyle={{ background:"#ffffff", border:"1px solid #cbd5e1", borderRadius:6 }}
            formatter={(v, n, p) => [`ρ = ${p.payload.rho > 0 ? "+" : ""}${p.payload.rho}`, "Spearman"]}
          />
          <Bar dataKey="abs_rho" radius={[0, 3, 3, 0]}>
            {top12.map((d) => (
              <Cell key={d.feature} fill={d.rho < 0 ? "#dc2626" : "#16a34a"} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div style={{ display:"flex", flexWrap: "wrap", gap:8, marginTop:8 }}>
        <InsightBadge color="#dc2626">
          mes_doc (ρ=-0.96): correlación espuria del corte estático — facturas antiguas tienen más días por definición.
        </InsightBadge>
        <InsightBadge color="#16a34a">
          tiene_envio (ρ=+0.53) y estado_ord (ρ=-0.53) son los factores procesales más controlables.
        </InsightBadge>
      </div>
    </Card>
  );
};

// ── Sección 5: Centroides ─────────────────────────────────────────────────
const CentroidesSection = () => {
  const { data, loading } = useFetch("/centroides");

  if (loading) return <Spinner />;
  if (!data) return null;

  const radarData = [
    { feature: "Días", BAJO: data.BAJO.dias_transcurridos, MEDIO: data.MEDIO.dias_transcurridos, ALTO: data.ALTO.dias_transcurridos },
    { feature: "Estado", BAJO: data.BAJO.estado_ord * 10, MEDIO: data.MEDIO.estado_ord * 10, ALTO: data.ALTO.estado_ord * 10 },
    { feature: "Hospitaliz.", BAJO: data.BAJO.dias_hospitalizacion, MEDIO: data.MEDIO.dias_hospitalizacion, ALTO: data.ALTO.dias_hospitalizacion },
    { feature: "CUV", BAJO: data.BAJO.tiene_cuv * 100, MEDIO: data.MEDIO.tiene_cuv * 100, ALTO: data.ALTO.tiene_cuv * 100 },
    { feature: "Envío", BAJO: data.BAJO.tiene_envio * 100, MEDIO: data.MEDIO.tiene_envio * 100, ALTO: data.ALTO.tiene_envio * 100 },
  ];

  const tableRows = [
    { label: "Días transcurridos", key: "dias_transcurridos", fmt: (v) => `${v.toFixed(1)} días` },
    { label: "Valor factura (mediana)", key: "valor_doc_cop", fmt: (v) => fmtCOP(v) },
    { label: "Estado ordinal (1-8)", key: "estado_ord", fmt: (v) => v.toFixed(2) },
    { label: "Días hospitalización", key: "dias_hospitalizacion", fmt: (v) => `${v.toFixed(1)} días` },
    { label: "Días doc→envío", key: "dias_doc_a_envio", fmt: (v) => v < 0 ? "Sin envío" : `${v.toFixed(1)} días` },
    { label: "% con envío", key: "tiene_envio", fmt: (v) => `${(v * 100).toFixed(0)}%` },
    { label: "% con CUV", key: "tiene_cuv", fmt: (v) => `${(v * 100).toFixed(0)}%` },
  ];

  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(320px, 1fr))", gap:16 }}>
      {/* Tabla de centroides */}
      <Card style={{ overflowX: "auto" }}>
        <SectionTitle subtitle="Valores desescalados — perfil operativo de cada tier">
          Perfil de Centroides
        </SectionTitle>
        <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:"'DM Mono', monospace", fontSize:12, minWidth: 300 }}>
          <thead>
            <tr>
              <th style={{ textAlign:"left", color:"#64748b", fontWeight:600, paddingBottom:8, paddingRight:12 }}>Métrica</th>
              {["BAJO","MEDIO","ALTO"].map((t) => (
                <th key={t} style={{ textAlign:"right", color: TIER_COLORS[t], fontWeight:700, paddingBottom:8 }}>
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, i) => (
              <tr key={row.key} style={{ borderTop:"1px solid #e2e8f0" }}>
                <td style={{ padding:"8px 12px 8px 0", color:"#475569" }}>{row.label}</td>
                {["BAJO","MEDIO","ALTO"].map((t) => (
                  <td key={t} style={{
                    textAlign:"right", padding:"8px 0",
                    color: TIER_COLORS[t], fontWeight:600,
                  }}>
                    {data[t][row.key] != null ? row.fmt(data[t][row.key]) : "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <InsightBadge color="#d97706">
          Separación de ~21 días entre BAJO↔MEDIO y ~26 días entre MEDIO↔ALTO. Gradiente consistente y operativamente significativo.
        </InsightBadge>
      </Card>

      {/* Radar */}
      <Card>
        <SectionTitle subtitle="Comparación multidimensional de tiers">
          Radar de Perfiles
        </SectionTitle>
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis dataKey="feature" tick={{ fill:"#475569", fontSize:11, fontFamily:"'DM Mono', monospace" }} />
            <PolarRadiusAxis tick={{ fill:"#64748b", fontSize:9 }} />
            {["BAJO","MEDIO","ALTO"].map((t) => (
              <Radar key={t} name={`Tier ${t}`} dataKey={t}
                stroke={TIER_COLORS[t]} fill={TIER_COLORS[t]} fillOpacity={0.06} strokeWidth={2} />
            ))}
            <Legend wrapperStyle={{ fontSize:11, fontFamily:"'DM Mono', monospace", paddingTop: 5 }} />
          </RadarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
};

// ── Sección 6: Predictor de Tier ──────────────────────────────────────────
const PredictorSection = () => {
  const [form, setForm] = useState({
    tipo_responsable: "E",
    cod_responsable:  "101005",
    valor_doc:        500000,
    estado_actual:    "RD",
    dias_transcurridos: 45,
    cod_centro_costos: 3201,
    fuente_doc:        15,
    num_contrato:      "",
    fecha_doc:         "2026-03-01",
    fecha_ingreso:     "2026-02-28",
    fecha_egreso:      "2026-03-01",
    fecha_envio:       "",
    fecha_cuv:         "",
    fuente_envio:      "",
    numero_envio:      "",
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const predict = async () => {
    setLoading(true);
    try {
      const payload = { ...form };
      if (!payload.fecha_envio) payload.fecha_envio = null;
      if (!payload.fecha_cuv)   payload.fecha_cuv   = null;
      if (!payload.num_contrato) payload.num_contrato = null;
      const r = await fetch(`${API}/predecir`, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      setResult(d);
    } finally {
      setLoading(false);
    }
  };

  const fieldStyle = {
    background:"#ffffff", border:"1px solid #cbd5e1",
    borderRadius:4, color:"#0f172a", padding:"6px 10px",
    fontSize:12, fontFamily:"'DM Mono', monospace", width:"100%",
    boxSizing:"border-box",
    outline: "none"
  };
  const labelStyle = {
    fontSize:10, color:"#475569", fontFamily:"'DM Mono', monospace",
    textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:4,
    display:"block", fontWeight: 500
  };

  const fields = [
    { key:"estado_actual",       label:"Estado actual",     type:"select", options:["GN","EV","RD","AP","PV","PD","DV","RV"] },
    { key:"tipo_responsable",    label:"Tipo responsable",  type:"select", options:["E","P"] },
    { key:"dias_transcurridos",  label:"Días transcurridos",type:"number" },
    { key:"valor_doc",           label:"Valor doc (COP)",   type:"number" },
    { key:"cod_responsable",     label:"Cód. EPS",          type:"text" },
    { key:"cod_centro_costos",   label:"Centro de costos",  type:"select", options:[1303, 3201] },
    { key:"fecha_doc",           label:"Fecha documento",   type:"date" },
    { key:"fecha_envio",         label:"Fecha envío",       type:"text", placeholder:"YYYY/MM/DD o vacío" },
  ];

  return (
    <Card>
      <SectionTitle subtitle="Clasifica una nueva factura en un Tier de atención">
        Predictor de Tier
      </SectionTitle>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))", gap:12, marginBottom:20 }}>
        {fields.map((f) => (
          <div key={f.key}>
            <label style={labelStyle}>{f.label}</label>
            {f.type === "select" ? (
              <select
                style={fieldStyle}
                value={form[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: f.options[0] === 1303 ? Number(e.target.value) : e.target.value })}
              >
                {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input
                style={fieldStyle}
                type={f.type}
                value={form[f.key]}
                placeholder={f.placeholder || ""}
                onChange={(e) => setForm({ ...form, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value })}
              />
            )}
          </div>
        ))}
      </div>

      <button
        onClick={predict}
        disabled={loading}
        style={{
          background: loading ? "#e2e8f0" : "#0ea5e9",
          border:"none", borderRadius:6, color: loading ? "#94a3b8" : "#fff",
          padding:"10px 28px", fontSize:13, cursor: loading ? "not-allowed" : "pointer",
          fontFamily:"'DM Mono', monospace", letterSpacing:"0.05em",
          transition:"background 0.2s",
          boxShadow:"0 1px 2px rgba(0,0,0,0.05)"
        }}
      >
        {loading ? "Clasificando…" : "Predecir Tier →"}
      </button>

      {result && (
        <div style={{
          marginTop:20, padding:20,
          background: TIER_BG[result.tier],
          border:`1px solid ${TIER_COLORS[result.tier]}30`,
          borderRadius:8,
        }}>
          <div style={{ display:"flex", flexWrap: "wrap", alignItems:"center", gap:16, marginBottom:12 }}>
            <div style={{
              fontSize:40, fontWeight:800, color: TIER_COLORS[result.tier],
              fontFamily:"'Space Grotesk', sans-serif",
            }}>
              Tier {result.tier}
            </div>
            <div>
              <div style={{ fontSize:12, color:"#475569", fontFamily:"'DM Mono', monospace" }}>
                Distancias a centroides
              </div>
              <div style={{ display:"flex", gap:12, marginTop:4 }}>
                {["BAJO","MEDIO","ALTO"].map((t) => (
                  <div key={t} style={{
                    fontSize:11, fontFamily:"'DM Mono', monospace",
                    color: t === result.tier ? TIER_COLORS[t] : "#64748b",
                    fontWeight: t === result.tier ? 700 : 400,
                  }}>
                    {t}: {result.distancias_centroides[t].toFixed(2)}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{
            fontSize:12, color:"#334155", fontFamily:"'DM Mono', monospace",
            lineHeight:1.6,
          }}>
            {result.tier === "BAJO" && "✓ Gestión rutinaria. Monitoreo quincenal. Factura en estado avanzado o sin señales de riesgo."}
            {result.tier === "MEDIO" && "⚡ Seguimiento semanal. Verificar avance de radicación y gestión activa de posibles glosas."}
            {result.tier === "ALTO" && "🔴 Intervención inmediata. Factura represada o devuelta. Gestionar envío o respuesta a glosa hoy."}
          </div>
        </div>
      )}
    </Card>
  );
};

// ── Sección 7: Resumen de Limitaciones ────────────────────────────────────
const LimitacionesSection = () => {
  const items = [
    {
      icon: <Clock size={22} />,
      title: "Corte Estático",
      color: "#d97706",
      text: "Modelo entrenado en un único corte (16-04-2026). Reentrenar trimestralmente para mantener vigencia.",
    },
    {
      icon: <Coins size={22} />,
      title: "Sin Recaudo Real",
      color: "#4f46e5",
      text: "No incluye facturas pagadas. Los tiers miden dificultad de trámite, no probabilidad de cobro.",
    },
    {
      icon: <User size={22} />,
      title: "Sin Ground Truth",
      color: "#0284c7",
      text: "Clustering no supervisado. Los tiers deben validarse con el experto del área de cartera.",
    },
    {
      icon: <Hospital size={22} />,
      title: "EPS Nuevas",
      color: "#16a34a",
      text: "EPS no vistas en entrenamiento recibirán freq=0. Manejar con valor de fallback calibrado.",
    },
  ];

  return (
    <Card>
      <SectionTitle subtitle="Consideraciones técnicas y de negocio">
        Limitaciones del Modelo
      </SectionTitle>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:16 }}>
        {items.map((item) => (
          <div key={item.title} style={{
            padding:16, background:"#ffffff",
            border:`1px solid #e2e8f0`,
            borderTop: `3px solid ${item.color}`,
            borderRadius:6,
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
          }}>
            <div style={{ color: item.color, marginBottom:8 }}>{item.icon}</div>
            <div style={{
              fontSize:12, fontWeight:700, color:"#0f172a",
              fontFamily:"'DM Mono', monospace", marginBottom:6,
              textTransform:"uppercase", letterSpacing:"0.05em",
            }}>
              {item.title}
            </div>
            <div style={{ fontSize:12, color:"#475569", lineHeight:1.6 }}>
              {item.text}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

// ── App principal ──────────────────────────────────────────────────────────
export default function App() {
  return (
    <div style={{
      minHeight:"100vh",
      background:"#f8fafc",
      color:"#0f172a",
      fontFamily:"'DM Mono', monospace",
      padding:"24px 20px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=Space+Grotesk:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        select option { background: #ffffff; color: #0f172a; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom:40 }}>
        <div style={{
          display:"flex", flexWrap: "wrap", alignItems:"flex-start",
          justifyContent:"space-between", gap: 16, marginBottom:8,
        }}>
          <div>
            <div style={{
              fontSize:10, fontFamily:"'DM Mono', monospace",
              letterSpacing:"0.2em", color:"#64748b",
              textTransform:"uppercase", marginBottom:8,
              fontWeight: 500
            }}>
              Hospital · Área de Cartera y Cobros a EPS · Corte 16-04-2026
            </div>
            <h1 style={{
              margin:0, fontSize:32, fontWeight:800,
              fontFamily:"'Space Grotesk', sans-serif",
              background:"linear-gradient(135deg, #0284c7 0%, #4f46e5 50%, #7c3aed 100%)",
              WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
              lineHeight:1.1,
            }}>
              Clustering de Facturas Médicas
            </h1>
            <p style={{
              margin:"8px 0 0", fontSize:13, color:"#334155",
              lineHeight:1.6, maxWidth:640,
            }}>
              Clasificación automática de 69,570 facturas en Tiers de atención (Bajo / Medio / Alto)
              mediante KMeans para priorizar la gestión de cobro a EPS.
            </p>
          </div>
          <div style={{
            background:"#ffffff", border:"1px solid #e2e8f0",
            borderRadius:8, padding:"12px 20px", textAlign:"right",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            flexShrink:0,
          }}>
            <div style={{ fontSize:10, color:"#64748b", marginBottom:2 }}>Modelo</div>
            <div style={{ fontSize:14, fontWeight:700, color:"#0284c7" }}>KMeans k=3</div>
            <div style={{ fontSize:10, color:"#64748b", marginTop:4 }}>k-means++ · n_init=20</div>
          </div>
        </div>

        {/* Separador decorativo */}
        <div style={{
          height:2,
          background:"linear-gradient(90deg, #0284c7 0%, #4f46e5 50%, #e2e8f0 100%)",
          marginTop:20,
        }} />
      </div>

      {/* Secciones del Dashboard */}
      <div style={{ display:"flex", flexDirection:"column", gap:32 }}>

        <section>
          <div style={{
            fontSize:10, color:"#64748b", fontFamily:"'DM Mono', monospace",
            letterSpacing:"0.2em", textTransform:"uppercase", marginBottom:16, fontWeight: 600
          }}>
            01 — KPIs Principales
          </div>
          <KPISection />
        </section>

        <section>
          <div style={{
            fontSize:10, color:"#64748b", fontFamily:"'DM Mono', monospace",
            letterSpacing:"0.2em", textTransform:"uppercase", marginBottom:16, fontWeight: 600
          }}>
            02 — Composición de la Cartera
          </div>
          <EstadosSection />
        </section>

        <section>
          <div style={{
            fontSize:10, color:"#64748b", fontFamily:"'DM Mono', monospace",
            letterSpacing:"0.2em", textTransform:"uppercase", marginBottom:16, fontWeight: 600
          }}>
            03 — Selección de k Óptimo
          </div>
          <ElbowSection />
        </section>

        <section>
          <div style={{
            fontSize:10, color:"#64748b", fontFamily:"'DM Mono', monospace",
            letterSpacing:"0.2em", textTransform:"uppercase", marginBottom:16, fontWeight: 600
          }}>
            04 — Importancia de Variables
          </div>
          <CorrelacionesSection />
        </section>

        <section>
          <div style={{
            fontSize:10, color:"#64748b", fontFamily:"'DM Mono', monospace",
            letterSpacing:"0.2em", textTransform:"uppercase", marginBottom:16, fontWeight: 600
          }}>
            05 — Perfil de Tiers (Centroides)
          </div>
          <CentroidesSection />
        </section>

        <section>
          <div style={{
            fontSize:10, color:"#64748b", fontFamily:"'DM Mono', monospace",
            letterSpacing:"0.2em", textTransform:"uppercase", marginBottom:16, fontWeight: 600
          }}>
            06 — Clasificador en Tiempo Real
          </div>
          <PredictorSection />
        </section>

        <section>
          <div style={{
            fontSize:10, color:"#64748b", fontFamily:"'DM Mono', monospace",
            letterSpacing:"0.2em", textTransform:"uppercase", marginBottom:16, fontWeight: 600
          }}>
            07 — Limitaciones
          </div>
          <LimitacionesSection />
        </section>

        {/* Footer */}
        <div style={{
          borderTop:"1px solid #e2e8f0", paddingTop:20,
          display:"flex", justifyContent:"space-between",
          fontSize:10, color:"#64748b", fontFamily:"'DM Mono', monospace",
          fontWeight: 500
        }}>
          <span>Hospital · Dashboard Clustering de Cartera</span>
          <span>KMeans k=3 · 69,570 facturas · Corte 16-04-2026</span>
        </div>
      </div>
    </div>
  );
}