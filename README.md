# Dashboard — Clustering de Facturas Médicas
## Hospital · Área de Cartera y Cobros a EPS

---

## Estructura del Proyecto

```
proyecto/
├── app.py            ← Backend Flask (API REST)
├── Dashboard.jsx     ← Frontend React (dashboard interactivo)
├── requirements.txt  ← Dependencias Python
└── README.md
```

---

## Instalación y Ejecución

### 1. Backend (Flask)

```bash
# Instalar dependencias
pip install flask flask-cors numpy pandas scikit-learn openpyxl scipy

# Coloca el archivo Excel en el mismo directorio:
# "PENDIENTE POR RADICAR CON CORTE AL 16-04-2026.xlsx"

# Ejecutar (el pipeline corre automáticamente al arrancar)
python app.py
# → API disponible en http://localhost:5000
```

### 2. Frontend (React)

```bash
# Con Vite (recomendado)
npm create vite@latest dashboard -- --template react
cd dashboard
npm install recharts

# Reemplaza src/App.jsx con el contenido de Dashboard.jsx
npm run dev
# → Frontend en http://localhost:5173
```

---

## Endpoints de la API

| Método | Endpoint                    | Descripción                                      |
|--------|-----------------------------|--------------------------------------------------|
| GET    | `/api/health`               | Estado del servidor y pipeline                   |
| GET    | `/api/kpis`                 | KPIs principales (totales, tiers, valor)         |
| GET    | `/api/estados`              | Distribución de estados (global y por tier)      |
| GET    | `/api/centroides`           | Perfil de centroides desescalado por tier        |
| GET    | `/api/correlaciones_spearman`| Correlaciones de variables con dias_transcurridos|
| GET    | `/api/elbow`                | Datos del método del codo (k=2..8)               |
| GET    | `/api/pca`                  | Proyección PCA 2D (muestra 3,000 puntos)         |
| GET    | `/api/tipo_responsable`     | Distribución E/P por tier                        |
| GET    | `/api/top_eps`              | Top 10 EPS por número de facturas                |
| GET    | `/api/dias_boxplot`         | Estadísticas de días transcurridos por tier      |
| POST   | `/api/predecir`             | Clasifica una nueva factura en un tier           |

### Ejemplo: POST /api/predecir

```json
{
  "tipo_responsable": "E",
  "cod_responsable": "101005",
  "valor_doc": 500000,
  "estado_actual": "RD",
  "dias_transcurridos": 45,
  "cod_centro_costos": 3201,
  "fuente_doc": 15,
  "num_contrato": null,
  "fecha_doc": "2026-03-01",
  "fecha_ingreso": "2026-02-28",
  "fecha_egreso": "2026-03-01",
  "fecha_envio": null,
  "fecha_cuv": null,
  "fuente_envio": null,
  "numero_envio": null
}
```

**Respuesta:**
```json
{
  "tier": "MEDIO",
  "cluster_raw": 1,
  "distancias_centroides": {
    "BAJO": 4.23,
    "MEDIO": 1.87,
    "ALTO": 5.61
  },
  "tier_mas_cercano": "MEDIO"
}
```

---

## Secciones del Dashboard

| # | Sección                    | Contenido                                                          |
|---|----------------------------|--------------------------------------------------------------------|
| 01| KPIs Principales           | Total facturas, valor cartera, silhouette, distribución de tiers   |
| 02| Composición de la Cartera  | Distribución de estados (global y por tier, validación del modelo) |
| 03| Selección de k Óptimo      | Método del codo + silhouette score por k                           |
| 04| Importancia de Variables   | Correlaciones de Spearman con dias_transcurridos                   |
| 05| Perfil de Tiers            | Tabla de centroides + radar multidimensional                       |
| 06| Clasificador en Tiempo Real| Formulario de predicción para nuevas facturas                      |
| 07| Limitaciones               | Consideraciones técnicas y de negocio del modelo                   |

---

## Interpretación de Tiers

| Tier  | Perfil                                  | Acción Recomendada          | Frecuencia |
|-------|-----------------------------------------|-----------------------------|------------|
| BAJO  | AP/RD recientes, proceso fluido         | Monitoreo pasivo             | Quincenal  |
| MEDIO | RD en trámite activo + glosas (DV/RV)   | Seguimiento activo de glosas | Semanal    |
| ALTO  | GN sin enviar, alta antigüedad          | Intervención inmediata       | Diaria     |

---

## Notas Técnicas

- El backend ejecuta el **pipeline completo** (preprocesamiento + KMeans) al arrancar.
  Esto puede tomar 2-4 minutos dependiendo del hardware.
- Para producción, considera guardar el modelo con `pickle` y cargarlo al iniciar,
  en lugar de reentrenar cada vez (ver sección 10.4 del notebook).
- El frontend consume la API en `http://localhost:5000`. Ajusta `const API` en
  `Dashboard.jsx` si cambias el puerto o despliegas en un servidor remoto.
