"""
app.py — Backend Flask para el Dashboard de Clustering de Facturas Médicas
Hospital | Área de Cartera y Cobros a EPS
Corte: 16-04-2026 | Dataset: 69,570 registros
"""

# ── Importaciones ─────────────────────────────────────────────────────────────
import os
import warnings
import numpy as np
import pandas as pd
import pickle

from flask import Flask, jsonify, request
from flask_cors import CORS

from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score, silhouette_samples

warnings.filterwarnings("ignore")

# ── Configuración de la aplicación ────────────────────────────────────────────
app = Flask(__name__)
CORS(app)  # Habilitar CORS para el frontend React

RANDOM_SEED = 42
FILE_PATH   = "facturas_con_tier.csv"
OUTPUT_DIR  = "datos_procesados"
os.makedirs(OUTPUT_DIR, exist_ok=True)


# ═══════════════════════════════════════════════════════════════════════════════
#  MÓDULO DE PROCESAMIENTO Y ENTRENAMIENTO
#  (Se ejecuta una sola vez al arrancar el servidor)
# ═══════════════════════════════════════════════════════════════════════════════

class ClusteringPipeline:
    """
    Encapsula todo el pipeline de preprocesamiento, clustering y predicción.
    Se instancia una sola vez y se reutiliza para todas las peticiones.
    """

    def __init__(self):
        self.df_raw          = None
        self.df              = None
        self.X_scaled        = None
        self.kmeans_model    = None
        self.scaler          = None
        self.le_tipo         = None
        self.le_contrato     = None
        self.le_fuente       = None
        self.freq_resp       = None
        self.tier_map_raw    = None
        self.feature_cols    = None
        self.scale_cols      = None
        self.no_scale_cols   = None
        self.estado_ord_map  = None
        self.p01 = self.p99  = None
        self.med_hosp        = None
        self.pca             = None
        self.sil_score_k3    = None
        self.inertia_k3      = None
        self.is_ready        = False

    # ── 1. Carga ──────────────────────────────────────────────────────────────
    def cargar_datos(self):
        self.df_raw = pd.read_csv(
            FILE_PATH,
            # sep=";", # <-- Descomenta esta línea si tu CSV usa punto y coma en lugar de coma
            dtype={
                "Identificacion del paciente": str,
                "Codigo del responsable":      str,
            },
        )
        print(f"✓ Dataset cargado: {self.df_raw.shape[0]:,} filas × {self.df_raw.shape[1]} columnas")

    # ── 2. Preprocesamiento ───────────────────────────────────────────────────
    def preprocesar(self):
        df = self.df_raw.copy()

        # ⬇️ AGREGA ESTA LÍNEA AQUÍ PARA LIMPIAR EL CSV ⬇️
        df.drop(columns=["tier", "cluster_raw"], errors="ignore", inplace=True)

        # Renombrar columnas (Aquí ya habrán exactamente 32 columnas)
        df.columns = [
            "fuente_doc", "fecha_doc", "id_unico", "num_ingreso", "id_paciente",
            "nombre_paciente", "tipo_responsable", "cod_responsable", "nombre_responsable",
            "num_documento", "valor_doc", "anulado", "cod_centro_costos", "usuario_genera",
            "estado_actual",
            "fecha_ingreso", "fecha_egreso", "cargo_cext", "num_contrato",
            "fecha_envio", "fuente_envio", "numero_envio", "usuario_envio", "fecha_radicado",
            "fuente_notas", "notas", "cufe", "cuv", "fecha_cuv", "dias_transcurridos",
            "estado_factura", "dias_cuv",
        ]

        # Eliminar columnas por leakage, PII, alta nulidad y proxies
        cols_drop = [
            "fecha_radicado", "estado_factura", "dias_cuv",       # leakage/derivadas
            "id_paciente", "nombre_paciente", "id_unico",
            "num_documento", "cufe", "cuv",                         # PII
            "fuente_notas", "notas",                                # alta nulidad
            "nombre_responsable", "cargo_cext",
            "usuario_genera", "usuario_envio",
            "anulado", "num_ingreso",                               # proxies redundantes
        ]
        df.drop(columns=cols_drop, inplace=True)

        # Conversión de fechas y features temporales
        for col in ["fecha_doc", "fecha_ingreso", "fecha_egreso"]:
            df[col] = pd.to_datetime(df[col], errors="coerce")
        df["fecha_envio"] = pd.to_datetime(df["fecha_envio"], format="%Y/%m/%d", errors="coerce")
        df["fecha_cuv"]   = pd.to_datetime(df["fecha_cuv"],   format="%Y/%m/%d", errors="coerce")

        df["mes_doc"]              = df["fecha_doc"].dt.month.astype("Int64")
        df["trimestre_doc"]        = df["fecha_doc"].dt.quarter.astype("Int64")
        df["dias_hospitalizacion"] = (df["fecha_egreso"] - df["fecha_ingreso"]).dt.days
        df["dias_doc_a_envio"]     = (df["fecha_envio"]  - df["fecha_doc"]).dt.days
        df["tiene_envio"]          = (~df["fecha_envio"].isna()).astype(int)
        df["tiene_cuv"]            = (~df["fecha_cuv"].isna()).astype(int)
        df.drop(columns=["fecha_doc", "fecha_ingreso", "fecha_egreso", "fecha_envio", "fecha_cuv"], inplace=True)

        # Tratamiento de nulos
        df["num_contrato"]         = df["num_contrato"].fillna("SIN_CONTRATO")
        df["fuente_envio"]         = df["fuente_envio"].fillna(0)
        df["numero_envio"]         = df["numero_envio"].fillna(0)
        self.med_hosp              = df["dias_hospitalizacion"].median()
        df["dias_hospitalizacion"] = df["dias_hospitalizacion"].fillna(self.med_hosp)
        df["dias_doc_a_envio"]     = df["dias_doc_a_envio"].fillna(-1)
        for col in ["mes_doc", "trimestre_doc"]:
            df[col] = df[col].fillna(df[col].mode()[0])

        # Winsorización de valor_doc
        self.p01 = df["valor_doc"].quantile(0.01)
        self.p99 = df["valor_doc"].quantile(0.99)
        df["valor_doc"] = df["valor_doc"].clip(lower=self.p01, upper=self.p99)

        # Codificación ordinal de estado_actual (conservar para análisis)
        self.estado_ord_map = {
            "GN": 1, "EV": 2, "RD": 3, "AP": 4,
            "PV": 5, "PD": 6, "DV": 7, "RV": 8,
        }
        df["estado_ord"] = df["estado_actual"].map(self.estado_ord_map)

        # Log1p de valor_doc
        df["valor_doc_log"] = np.log1p(df["valor_doc"])
        df.drop(columns=["valor_doc"], inplace=True)

        # Codificación de categóricas
        self.le_tipo = LabelEncoder()
        df["tipo_responsable_enc"] = self.le_tipo.fit_transform(df["tipo_responsable"])

        self.le_contrato = LabelEncoder()
        df["num_contrato_enc"] = self.le_contrato.fit_transform(df["num_contrato"])

        self.le_fuente = LabelEncoder()
        df["fuente_doc_enc"] = self.le_fuente.fit_transform(df["fuente_doc"].astype(str))

        self.freq_resp = df["cod_responsable"].value_counts(normalize=True).to_dict()
        df["cod_responsable_freq"] = df["cod_responsable"].map(self.freq_resp)

        df.drop(columns=["tipo_responsable", "num_contrato", "fuente_doc", "cod_responsable"], inplace=True)

        # Referencia de estado para análisis posterior
        estado_actual_ref = df["estado_actual"].copy()

        # Definir features
        self.feature_cols = [c for c in df.columns if c != "estado_actual"]

        # Escalado
        self.no_scale_cols = [
            "tiene_envio", "tiene_cuv", "mes_doc", "trimestre_doc",
            "tipo_responsable_enc", "fuente_doc_enc", "estado_ord",
        ]
        self.scale_cols = [c for c in self.feature_cols if c not in self.no_scale_cols]

        X_raw = df[self.feature_cols].astype(np.float64)
        self.scaler = StandardScaler()
        X_scaled = X_raw.copy()
        X_scaled[self.scale_cols] = self.scaler.fit_transform(X_raw[self.scale_cols])

        self.X_scaled = X_scaled
        self.df = df
        self.df["estado_actual"] = estado_actual_ref.values

        print(f"✓ Preprocesamiento completado. Features: {len(self.feature_cols)}")

    # ── 3. Clustering ─────────────────────────────────────────────────────────
    def entrenar_clustering(self):
        K_FINAL = 3
        self.kmeans_model = KMeans(
            n_clusters=K_FINAL, init="k-means++",
            n_init=20, max_iter=500, tol=1e-4,
            random_state=RANDOM_SEED,
        )
        self.kmeans_model.fit(self.X_scaled)
        self.df["cluster_raw"] = self.kmeans_model.labels_

        # Asignar tiers por días transcurridos del centroide
        centroids_raw = pd.DataFrame(
            self.kmeans_model.cluster_centers_, columns=self.X_scaled.columns
        )
        dias_idx = list(self.X_scaled.columns).index("dias_transcurridos")
        dias_centroids = (
            centroids_raw["dias_transcurridos"]
            * self.scaler.scale_[self.scale_cols.index("dias_transcurridos")]
            + self.scaler.mean_[self.scale_cols.index("dias_transcurridos")]
        )
        cluster_order    = dias_centroids.sort_values().index.tolist()
        self.tier_map_raw = {
            cluster_order[0]: "BAJO",
            cluster_order[1]: "MEDIO",
            cluster_order[2]: "ALTO",
        }
        self.df["tier"] = self.df["cluster_raw"].map(self.tier_map_raw)

        # Silhouette
        idx_s = np.random.RandomState(RANDOM_SEED).choice(len(self.X_scaled), 10_000, replace=False)
        self.sil_score_k3 = silhouette_score(
            self.X_scaled.iloc[idx_s].values,
            self.kmeans_model.labels_[idx_s],
            random_state=RANDOM_SEED,
        )
        self.inertia_k3 = self.kmeans_model.inertia_

        # PCA 2D para visualización
        self.pca = PCA(n_components=2, random_state=RANDOM_SEED)
        self.pca.fit(self.X_scaled)

        self.is_ready = True
        print(f"✓ Clustering completado. Silhouette k=3: {self.sil_score_k3:.4f}")
        print(f"  Distribución de Tiers:")
        for tier in ["BAJO", "MEDIO", "ALTO"]:
            n = (self.df["tier"] == tier).sum()
            print(f"    Tier {tier}: {n:,} ({n/len(self.df)*100:.1f}%)")

    # ── Inicialización completa ───────────────────────────────────────────────
    def inicializar(self):
        self.cargar_datos()
        self.preprocesar()
        self.entrenar_clustering()


# ─────────────────────────────────────────────────────────────────────────────
# Instanciar el pipeline
# ─────────────────────────────────────────────────────────────────────────────
pipeline = ClusteringPipeline()
pipeline.inicializar()


# ═══════════════════════════════════════════════════════════════════════════════
#  ENDPOINTS DE LA API
# ═══════════════════════════════════════════════════════════════════════════════

@app.route("/api/kpis", methods=["GET"])
def get_kpis():
    """
    KPIs principales del dashboard:
    - Total de facturas en cartera
    - Distribución de tiers
    - Silhouette score
    - Valor total de cartera
    - Días promedio por tier
    """
    df = pipeline.df
    df_raw = pipeline.df_raw

    total = len(df)
    tier_counts = df["tier"].value_counts()

    valor_total = np.expm1(df["valor_doc_log"]).sum()

    dias_por_tier = (
        df.groupby("tier")["dias_transcurridos"]
        .agg(["mean", "median"])
        .round(1)
        .to_dict()
    )

    valor_por_tier = {}
    for tier in ["BAJO", "MEDIO", "ALTO"]:
        sub = df[df["tier"] == tier]
        valor_por_tier[tier] = {
            "mediana_cop": round(float(np.expm1(sub["valor_doc_log"].median())), 0),
            "total_cop":   round(float(np.expm1(sub["valor_doc_log"]).sum()), 0),
        }

    return jsonify({
        "total_facturas":    total,
        "silhouette_score":  round(pipeline.sil_score_k3, 4),
        "inercia_k3":        round(pipeline.inertia_k3, 0),
        "valor_total_cop":   round(float(valor_total), 0),
        "tiers": {
            tier: {
                "count":      int(tier_counts.get(tier, 0)),
                "pct":        round(int(tier_counts.get(tier, 0)) / total * 100, 1),
                "dias_media": dias_por_tier["mean"].get(tier, 0),
                "dias_med":   dias_por_tier["median"].get(tier, 0),
                "valor":      valor_por_tier[tier],
            }
            for tier in ["BAJO", "MEDIO", "ALTO"]
        },
    })


@app.route("/api/estados", methods=["GET"])
def get_estados():
    """
    Distribución de estados de factura (global y por tier).
    """
    df = pipeline.df

    # Global
    estado_global = df["estado_actual"].value_counts().to_dict()

    # Por tier (normalizado en %)
    cross = pd.crosstab(df["tier"], df["estado_actual"], normalize="index") * 100
    cross = cross.loc[["BAJO", "MEDIO", "ALTO"]]

    estado_map = {
        "AP": "AP — Aprobada",    "DV": "DV — Dev. Glosa",
        "EV": "EV — Enviada",     "GN": "GN — Generada",
        "PD": "PD — Dev. Parcial","PV": "PV — Aprobada/Envío",
        "RD": "RD — Radicada",    "RV": "RV — Rad. Devolución",
    }

    return jsonify({
        "global": {k: int(v) for k, v in estado_global.items()},
        "por_tier": cross.round(1).to_dict(orient="index"),
        "labels": estado_map,
    })


@app.route("/api/correlaciones_spearman", methods=["GET"])
def get_correlaciones():
    """
    Correlaciones de Spearman de cada feature con dias_transcurridos.
    """
    from scipy.stats import spearmanr

    X = pipeline.X_scaled
    target = X["dias_transcurridos"]
    results = []

    for col in X.columns:
        if col == "dias_transcurridos":
            continue
        r, p = spearmanr(target, X[col])
        results.append({"feature": col, "rho": round(float(r), 4), "p_value": round(float(p), 6)})

    results.sort(key=lambda x: abs(x["rho"]), reverse=True)
    return jsonify(results)


@app.route("/api/centroides", methods=["GET"])
def get_centroides():
    """
    Perfil de centroides desescalado por tier.
    """
    df      = pipeline.df
    scaler  = pipeline.scaler
    km      = pipeline.kmeans_model
    tm      = pipeline.tier_map_raw
    sc      = pipeline.scale_cols
    fc      = pipeline.feature_cols

    centroids_raw = pd.DataFrame(km.cluster_centers_, columns=pipeline.X_scaled.columns)

    centroids_desc = centroids_raw.copy()
    for i, col in enumerate(sc):
        centroids_desc[col] = (
            centroids_raw[col] * scaler.scale_[i] + scaler.mean_[i]
        )

    centroids_desc.index = [tm[i] for i in range(3)]
    centroids_desc       = centroids_desc.loc[["BAJO", "MEDIO", "ALTO"]]
    centroids_desc["valor_doc_cop"] = np.expm1(centroids_desc["valor_doc_log"])

    key_features = [
        "dias_transcurridos", "valor_doc_cop", "estado_ord",
        "dias_hospitalizacion", "dias_doc_a_envio",
        "cod_responsable_freq", "tiene_envio", "tiene_cuv",
    ]

    result = {}
    for tier in ["BAJO", "MEDIO", "ALTO"]:
        result[tier] = {
            f: round(float(centroids_desc.loc[tier, f]), 3)
            for f in key_features if f in centroids_desc.columns
        }
    return jsonify(result)


@app.route("/api/pca", methods=["GET"])
def get_pca():
    """
    Proyección PCA 2D para visualización de clusters.
    Retorna una muestra de 3,000 puntos con sus coordenadas y tier.
    """
    df  = pipeline.df
    pca = pipeline.pca

    SAMPLE = 3_000
    idx    = np.random.RandomState(RANDOM_SEED).choice(len(pipeline.X_scaled), SAMPLE, replace=False)
    X_pca  = pca.transform(pipeline.X_scaled)

    points = [
        {
            "x":      round(float(X_pca[i, 0]), 4),
            "y":      round(float(X_pca[i, 1]), 4),
            "tier":   str(df["tier"].iloc[i]),
            "estado": str(df["estado_actual"].iloc[i]),
        }
        for i in idx
    ]

    return jsonify({
        "points":             points,
        "varianza_pc1":       round(float(pca.explained_variance_ratio_[0] * 100), 1),
        "varianza_pc2":       round(float(pca.explained_variance_ratio_[1] * 100), 1),
        "varianza_total":     round(float(pca.explained_variance_ratio_[:2].sum() * 100), 1),
    })


@app.route("/api/elbow", methods=["GET"])
def get_elbow():
    """
    Datos del método del codo (Elbow) e inercia por k.
    Valores pre-calculados del notebook.
    """
    # Valores documentados en el notebook para k=2..8
    elbow_data = [
        {"k": 2, "inercia": 619634, "silhouette": 0.3245},
        {"k": 3, "inercia": 538203, "silhouette": 0.2486},
        {"k": 4, "inercia": 482070, "silhouette": 0.2705},
        {"k": 5, "inercia": 430546, "silhouette": 0.2751},
        {"k": 6, "inercia": 386054, "silhouette": 0.2795},
        {"k": 7, "inercia": 352534, "silhouette": 0.2885},
        {"k": 8, "inercia": 324937, "silhouette": 0.2913},
    ]
    return jsonify(elbow_data)


@app.route("/api/tipo_responsable", methods=["GET"])
def get_tipo_responsable():
    """
    Distribución de tipo de responsable (E/P) por tier.
    """
    df = pipeline.df
    cross = (
        pd.crosstab(df["tier"], df["tipo_responsable_enc"], normalize="index") * 100
    )
    cross = cross.loc[["BAJO", "MEDIO", "ALTO"]]
    return jsonify({
        "data":   cross.round(1).to_dict(orient="index"),
        "labels": {"0": "Subsidiado (E)", "1": "Contributivo / Particular (P)"},
    })


@app.route("/api/top_eps", methods=["GET"])
def get_top_eps():
    """
    Top 10 EPS por número de facturas en toda la cartera.
    """
    df_raw = pipeline.df_raw
    df     = pipeline.df.copy()
    df["cod_responsable"] = df_raw["Codigo del responsable"].values

    top = df["cod_responsable"].value_counts().head(10)
    result = [
        {
            "eps":       str(cod),
            "count":     int(n),
            "pct_total": round(int(n) / len(df) * 100, 2),
        }
        for cod, n in top.items()
    ]
    return jsonify(result)


@app.route("/api/dias_boxplot", methods=["GET"])
def get_dias_boxplot():
    """
    Estadísticas para boxplot de dias_transcurridos por tier.
    """
    df = pipeline.df
    result = {}
    for tier in ["BAJO", "MEDIO", "ALTO"]:
        sub = df[df["tier"] == tier]["dias_transcurridos"]
        q1, q3 = float(sub.quantile(0.25)), float(sub.quantile(0.75))
        result[tier] = {
            "min":    float(sub.min()),
            "q1":     q1,
            "median": float(sub.median()),
            "mean":   round(float(sub.mean()), 1),
            "q3":     q3,
            "max":    float(sub.max()),
            "iqr":    round(q3 - q1, 1),
        }
    return jsonify(result)


@app.route("/api/predecir", methods=["POST"])
def predecir_tier():
    """
    Clasifica una nueva factura en un Tier de atención.
    Recibe un JSON con los campos de la factura en formato RAW.
    """
    data = request.get_json(force=True)

    row = {}

    # Estado ordinal
    row["estado_ord"] = pipeline.estado_ord_map.get(data.get("estado_actual", "GN"), 1)

    # Fechas
    fdoc = pd.to_datetime(data.get("fecha_doc"), errors="coerce")
    fing = pd.to_datetime(data.get("fecha_ingreso"), errors="coerce")
    feg  = pd.to_datetime(data.get("fecha_egreso"), errors="coerce")
    fenv = pd.to_datetime(data.get("fecha_envio"), format="%Y/%m/%d", errors="coerce")
    fcuv = pd.to_datetime(data.get("fecha_cuv"),   format="%Y/%m/%d", errors="coerce")

    df = pipeline.df
    row["mes_doc"]              = int(fdoc.month) if pd.notna(fdoc) else int(df["mes_doc"].mode()[0])
    row["trimestre_doc"]        = int(fdoc.quarter) if pd.notna(fdoc) else int(df["trimestre_doc"].mode()[0])
    row["dias_hospitalizacion"] = float((feg - fing).days) if (pd.notna(feg) and pd.notna(fing)) else float(pipeline.med_hosp)
    row["dias_doc_a_envio"]     = float((fenv - fdoc).days) if (pd.notna(fenv) and pd.notna(fdoc)) else -1.0
    row["tiene_envio"]          = 0 if pd.isna(fenv) else 1
    row["tiene_cuv"]            = 0 if pd.isna(fcuv) else 1

    # Valor documento
    val       = float(data.get("valor_doc", 0))
    val_clip  = np.clip(val, pipeline.p01, pipeline.p99)
    row["valor_doc_log"] = float(np.log1p(val_clip))

    row["dias_transcurridos"] = float(data.get("dias_transcurridos", 0))
    row["cod_centro_costos"]  = int(data.get("cod_centro_costos", 3201))

    # Encodings
    tipo = data.get("tipo_responsable", "E")
    le_t = pipeline.le_tipo
    row["tipo_responsable_enc"] = int(le_t.transform([tipo])[0]) if tipo in le_t.classes_ else 0

    contrato = data.get("num_contrato") or "SIN_CONTRATO"
    le_c     = pipeline.le_contrato
    row["num_contrato_enc"] = (
        int(le_c.transform([contrato])[0]) if contrato in le_c.classes_
        else int(le_c.transform(["SIN_CONTRATO"])[0])
    )

    fuente = str(data.get("fuente_doc", 15))
    le_f   = pipeline.le_fuente
    row["fuente_doc_enc"] = (
        int(le_f.transform([fuente])[0]) if fuente in le_f.classes_
        else int(le_f.transform([le_f.classes_[0]])[0])
    )

    cod_resp = str(data.get("cod_responsable", ""))
    row["cod_responsable_freq"] = pipeline.freq_resp.get(cod_resp, 0.0)
    row["fuente_envio"]         = float(data.get("fuente_envio") or 0)
    row["numero_envio"]         = float(data.get("numero_envio") or 0)

    # Vector de features
    feat_row    = pd.DataFrame([row])[pipeline.feature_cols].astype(np.float64)
    feat_scaled = feat_row.copy()
    feat_scaled[pipeline.scale_cols] = pipeline.scaler.transform(feat_row[pipeline.scale_cols])

    # Predicción
    cluster_pred = int(pipeline.kmeans_model.predict(feat_scaled)[0])
    tier_pred    = pipeline.tier_map_raw[cluster_pred]

    # Distancias a cada centroide
    distancias = {}
    for raw_c, tier_name in pipeline.tier_map_raw.items():
        dist = float(np.linalg.norm(feat_scaled.values - pipeline.kmeans_model.cluster_centers_[raw_c]))
        distancias[tier_name] = round(dist, 4)

    return jsonify({
        "tier":                  tier_pred,
        "cluster_raw":           cluster_pred,
        "distancias_centroides": distancias,
        "tier_mas_cercano":      min(distancias, key=distancias.get),
    })


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "pipeline_ready": pipeline.is_ready})


# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("\n" + "═" * 65)
    print("   Dashboard API — Clustering de Facturas Médicas")
    print("   Hospital | Área de Cartera y Cobros a EPS")
    print("═" * 65)
    app.run(debug=True, port=5000)
