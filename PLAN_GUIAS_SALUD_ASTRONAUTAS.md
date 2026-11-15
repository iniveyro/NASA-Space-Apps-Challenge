# Astra Hub Health — Especificación e implementación de orientación ante alertas

**Versión:** 1.0 · 15-11-2026  
**Uso:** prototipo educativo NASA Space Apps Challenge 2026  
**Estado clínico:** NO VALIDADO PARA ASISTENCIA MÉDICA REAL

> Este documento reemplaza la especificación extensa anterior **para implementar la funcionalidad de alertas y orientación**. No es un manual médico de vuelo ni prescribe medicamentos, dosis, procedimientos invasivos o tratamientos autónomos. Toda regla clínica, umbral y procedimiento operacional requiere aprobación de profesionales de medicina aeroespacial antes de uso real.

## 1. Objetivo y alcance

Al hacer clic en cualquiera de las diez tarjetas de salud, el astronauta puede comprender **qué dato disparó una alerta, qué podría explicar la alteración, qué puede hacer de forma segura ahora y cuándo escalarla**. El flujo debe ser utilizable sin conexión y sin formación médica.

**Flujo objetivo:** recibir/registrar dato → validar calidad y contexto → evaluar regla → mostrar color y motivo → abrir guía al pulsar tarjeta → completar pasos → registrar acción y nueva medición → resolver o escalar.

### Métricas presentes en la aplicación

| ID estable | Etiqueta UI | Unidad | Particularidades |
|---|---|---|---|
| `heart_rate` | Heart rate | bpm | En reposo / durante ejercicio; pulso y síntomas |
| `blood_pressure` | Blood pressure | mmHg | Valores separados `systolic` y `diastolic`; postura |
| `temperature` | Temperature | °C | Método de toma, ejercicio reciente y ambiente |
| `sleep` | Sleep | h | Tiempo dormido y fatiga, objetivo personal |
| `mood` | Mood | 1–5 | Autoevaluación; **5 = mejor ánimo**, 1 = peor |
| `activity` | Activity | min | Minutos acumulados y plan de ejercicio individual |
| `spo2` | SpO₂ | % | Fiabilidad del oxímetro, condiciones de la cabina |
| `glucose` | Glucose | mg/dL | Ayuno / después de comer, síntomas, método |
| `stress` | Stress | 1–5 | Autoevaluación; **5 = más estrés**, 1 = menos |
| `radiation_cumulative` | Cumulative radiation | mSv | Dosis acumulada: no reemplaza tasa de dosis (`mSv/h`) ni alertas de tormenta solar |

**Nota sobre la captura actual:** sus valores y colores son ficticios y las tarjetas muestran “Reference” aunque no necesariamente exista un intervalo clínico validado. El ejemplo de dosis 153.09 mSv, por sí solo, **no permite decidir** si existe una emergencia. El valor preflight igual al actual no demuestra seguridad. Preservar el aviso de simulación.

## 2. Reglas de seguridad y alcance médico

1. **No diagnosticar.** Mostrar “podría relacionarse con…” en vez de “tenés X enfermedad”.
2. **No indicar** fármacos, oxígeno suplementario, fluidos intravenosos, dosis, maniobras invasivas, cambios de entrenamiento intensos o ajustes de sistemas críticos de soporte vital sin un protocolo autorizado para esa misión.
3. **Los síntomas de alarma prevalecen sobre el color de la métrica.** Un número aparentemente normal no descarta una emergencia.
4. **La severidad no debe depender solo de la desviación del valor preflight.** También importan contexto, síntomas, persistencia y calidad del sensor.
5. **Un dato insuficiente, desactualizado o no confiable = estado `unknown`**, nunca verde automático.
6. **Un umbral que no fue validado no puede clasificarse como límite médico NASA.** En demo se permiten reglas sintéticas claramente identificadas, separadas de reglas clínicas.
7. **La comunicación con Tierra puede retrasarse.** Mostrar procedimientos de seguridad *aprobados por misión* almacenados localmente; nunca hacer depender una emergencia de una respuesta en línea.
8. **Rojo no implica que el sistema pueda tratar al paciente.** Significa priorizar seguridad, involucrar al compañero/responsable médico de misión y abrir el protocolo autorizado.
9. No bloquear acceso a las guías de tarjetas verdes: también son útiles para entender indicadores y prevenir problemas.
10. En producción, revisión médica, aprobación de misión, versiones firmadas, pruebas y trazabilidad son imprescindibles.

## 3. Estados y presentación

| Estado | Significado | Respuesta en UI |
|---|---|---|
| `normal` / verde | Sin desviación detectada según reglas disponibles, no garantía de salud | Mostrar valor, contexto y recomendaciones preventivas |
| `warning` / amarillo | Desviación, tendencia adversa o preocupación no urgente según regla válida | Mostrar causa posible, 2–4 acciones, comprobación y seguimiento |
| `critical` / rojo | Señal de posible urgencia o evento peligroso según regla o síntomas | Abrir guía prioritaria, avisar a tripulación, utilizar protocolo aprobado y registrar evento |
| `sleeping` / azul | Estado operativo “durmiendo”, **no gravedad médica** | Mostrar modo sueño por separado de la evaluación clínica |
| `unknown` / gris | Lectura ausente, vencida, defectuosa o sin criterio validado | Pedir medición/confirmación; no inferir salud normal |

**Invariante:** `status` y `activity_state` son propiedades distintas. Un astronauta puede estar dormido y tener una alerta clínica. No mezclar semánticas de color.

## 4. Componente de orientación al hacer clic

Cada tarjeta abre un **panel lateral (drawer)** o modal accesible con este orden:

1. **Título, estado, valor y hora:** `Sleep · Attention · 5.2 h · updated 08:20 UTC`.
2. **Por qué apareció:** regla activada, comparación correcta (objetivo/baseline), contexto y confiabilidad; si es simulación, indicarlo.
3. **Qué significa:** una o dos frases sin diagnóstico.
4. **Posibles causas:** máximo tres hipótesis generales, no afirmaciones clínicas.
5. **Qué hacer ahora:** de dos a cuatro pasos breves, ordenados, numerados y accionables.
6. **Cuándo escalar:** síntomas preocupantes, persistencia, empeoramiento o evento de misión; vínculo a protocolo autorizado.
7. **Verificación:** cuándo repetir o qué registrar; solo mostrar plazos respaldados por la guía/protocolo elegido.
8. **Acciones:** `Registrar acción`, `Agregar síntomas`, `Registrar nueva lectura`, `Notificar responsable` (si se implementó), `Ver historial`.
9. **Fuentes/alcance:** acceso opcional a fundamento y rótulo **“Orientación educativa / simulación”**.

En rojo, colocar arriba las acciones inmediatas de protección y escalamiento. Evitar un párrafo largo, interacciones que bloqueen las instrucciones o textos médicos alarmistas. Diseñar accesibilidad no basada únicamente en el color (etiquetas + iconos + contraste + navegación por teclado).

### Ejemplo de copy, alerta amarilla de sueño (escenario ficticio)

- **Qué pasa:** “Dormiste 5,2 h, por debajo de tu objetivo configurado de 7,5 h.”
- **Posible impacto:** “La falta de sueño puede aumentar la fatiga y afectar la atención.”
- **Qué hacer:** “1. Indicá si tenés somnolencia. 2. Revisá luz, ruido y temperatura del área de descanso. 3. Si te cuesta mantenerte alerta, consultá antes de realizar tareas críticas. 4. Registrá el próximo descanso.”
- **Escalar si:** “No podés mantenerte despierto, aparece confusión o el problema afecta la seguridad de la operación.”
- **Aviso:** “Objetivo y estado configurados para demostración; no es una evaluación clínica.”

## 5. Biblioteca de guías por métrica

Las siguientes son **orientaciones conservadoras de autocuidado y escalamiento**, no protocolos terapéuticos aeronáuticos. Cada guía exige un campo separado de `reviewStatus = needs_medical_review` hasta su aprobación.

### 5.1. Frecuencia cardíaca (`heart_rate`)
- **Qué puede significar:** pulso más alto o bajo de lo habitual; depende de reposo, esfuerzo y síntomas.
- **Posibles causas:** ejercicio, estrés, falta de descanso, variación individual o problema de medición.
- **Amarillo:** 1) Comprobar si estaba en reposo o haciendo esfuerzo. 2) Repetir/confirmar lectura en condiciones comparables. 3) Registrar síntomas y actividad reciente. 4) Consultar protocolo/responsable de salud si persiste.
- **Rojo / síntomas preocupantes:** detener la actividad, asegurar posición segura, avisar inmediatamente a un compañero/responsable y seguir protocolo médico autorizado, especialmente con dolor torácico, desmayo o dificultad para respirar.
- **Nunca:** sugerir ejercicio intenso para “corregir” una frecuencia anormal.

### 5.2. Presión arterial (`blood_pressure`)
- **Qué puede significar:** sistólica y/o diastólica fuera del rango individual; una sola medida puede estar afectada por la técnica.
- **Posibles causas:** postura, esfuerzo, estrés, cambios de fluidos en microgravedad o error del manguito.
- **Amarillo:** 1) Comprobar unidad, brazo, manguito y postura. 2) Repetir medición según protocolo del dispositivo. 3) Registrar síntomas (mareos, cefalea, visión alterada). 4) Consultar si persiste.
- **Rojo / síntomas preocupantes:** suspender tareas de riesgo, avisar al responsable y seguir guía médica de misión; especial cuidado ante dolor torácico, disnea, debilidad focal o cambios visuales.
- **Nunca:** equiparar presión arterial sistémica con presión intracraneal; no recomendar LBNP, compresión o intravenosas como indicación universal.

### 5.3. Temperatura corporal (`temperature`)
- **Qué puede significar:** temperatura mayor o menor que la referencia; método y contexto importan.
- **Posibles causas:** actividad reciente, temperatura ambiental, infección u otra condición.
- **Amarillo:** 1) Confirmar método y repetir según instrucciones del instrumento. 2) Registrar síntomas y ejercicio reciente. 3) Revisar condiciones ambientales mediante el procedimiento operacional habitual. 4) Notificar si persiste.
- **Rojo / síntomas preocupantes:** priorizar seguridad y evaluación por responsable de salud ante alteración importante con confusión, desmayo, deterioro respiratorio o mal estado general.
- **Nunca:** indicar antibióticos, diagnósticos infecciosos o modificaciones no autorizadas al traje/sistema térmico.

### 5.4. Sueño (`sleep`)
- **Qué puede significar:** duración inferior al objetivo individual o patrón de descanso alterado.
- **Posibles causas:** horarios, luz, ruido, estrés, carga de trabajo.
- **Amarillo:** 1) Confirmar si realmente durmió esa cantidad. 2) Registrar somnolencia. 3) Revisar iluminación, ruido y descanso previsto. 4) Consultar antes de tareas críticas si hay fatiga.
- **Rojo / deterioro funcional importante:** informar al responsable de misión y no iniciar una tarea peligrosa sin evaluación.
- **Nunca:** hacer equivaler automáticamente una noche corta a emergencia médica.

### 5.5. Estado de ánimo (`mood`)
- **Qué puede significar:** percepción subjetiva de bienestar emocional; la escala no diagnostica trastornos.
- **Posibles causas:** aislamiento, preocupación, conflictos, cambios en el descanso.
- **Amarillo:** 1) Identificar cómo se siente en una nota privada. 2) Elegir una actividad recuperadora breve. 3) Buscar conversación con persona de confianza si se desea. 4) Registrar seguimiento.
- **Rojo / riesgo agudo:** facilitar contacto inmediato con compañero y profesional/responsable médico; si expresa riesgo de hacerse daño, activar protocolo de seguridad y acompañamiento.
- **Privacidad:** no divulgar el diario ni el detalle emocional automáticamente a toda la tripulación.

### 5.6. Actividad física (`activity`)
- **Qué puede significar:** actividad registrada por debajo del plan individual, no enfermedad en sí.
- **Posibles causas:** carga operativa, cansancio, lesión, falla de equipo o falta de registro.
- **Amarillo:** 1) Comprobar si el dato está completo. 2) Revisar el plan aprobado. 3) Coordinar actividad permitida en el próximo turno. 4) Registrar impedimentos o molestias.
- **Rojo:** **no** se asigna únicamente por pocos minutos; si aparecen dolor torácico, desmayo, dificultad respiratoria o lesión seria, activar la guía de síntomas/urgencia pertinente.
- **Nunca:** prescribir entrenamiento intenso sin conocer estado y plan individual; 120 min/día es referencia operacional de algunas misiones, no umbral médico universal.

### 5.7. Saturación de oxígeno (`spo2`)
- **Qué puede significar:** posible cambio en oxigenación o lectura inexacta.
- **Posibles causas:** ajuste/perfusión del sensor, movimiento, condiciones ambientales o problema respiratorio.
- **Amarillo:** 1) Comprobar colocación y calidad de la señal. 2) Repetir sin ignorar síntomas. 3) Registrar respiración, contexto y lectura de sensores ambientales disponibles. 4) Escalar caída persistente.
- **Rojo / síntomas preocupantes:** si hay dificultad respiratoria, confusión o deterioro, alertar inmediatamente a compañero/responsable y seguir protocolo de emergencia de misión; consultar telemetría ambiental mediante el procedimiento autorizado.
- **Nunca:** asumir precisión perfecta del oxímetro o indicar cambios manuales de oxígeno en cabina/traje.

### 5.8. Glucosa (`glucose`)
- **Qué puede significar:** valor de glucosa fuera del objetivo, condicionado por ayuno, ingesta y síntomas.
- **Posibles causas:** momento de la comida, ejercicio, variación metabólica, error de muestra.
- **Amarillo:** 1) Registrar si fue en ayunas o después de comer. 2) Verificar técnica/equipo y síntomas. 3) Confirmar medición según protocolo. 4) Consultar el plan individual autorizado.
- **Rojo / síntomas preocupantes:** ante confusión, pérdida de conciencia, convulsión o incapacidad para tragar, llamar al responsable y seguir protocolo de emergencia; no dar alimentos o líquidos por boca a una persona incapaz de tragar.
- **Nota de fuente terrestre:** CDC clasifica menos de 70 mg/dL como glucosa baja y describe la regla 15-15 para una persona consciente y capaz de tragar. **No incorporarla como indicación automatizada de misión sin aprobación de la tripulación médica y disponibilidad de insumos.**

### 5.9. Estrés (`stress`)
- **Qué puede significar:** aumento subjetivo del estrés respecto de lo habitual.
- **Posibles causas:** trabajo exigente, falta de sueño, aislamiento o conflicto.
- **Amarillo:** 1) Identificar desencadenante si es posible. 2) Hacer una pausa en lugar seguro cuando la operación lo permita. 3) Utilizar una estrategia personal de regulación aprobada. 4) Registrar evolución y buscar apoyo.
- **Rojo / interferencia severa:** informar a responsable de misión cuando comprometa capacidad de operar con seguridad o exista riesgo de daño.
- **Nunca:** inferir hormonas del estrés o daño inmunitario a partir de una escala de 1–5.

### 5.10. Radiación acumulada (`radiation_cumulative`)
- **Qué puede significar:** dosis total registrada; NO representa por sí sola la intensidad de exposición actual ni síntomas.
- **Posibles causas de aumento:** tiempo de misión, EVA, entorno de radiación, evento solar o cambios en el registro.
- **Amarillo:** 1) Verificar dosímetro e intervalo temporal. 2) Consultar dosis acumulada frente a límites *aprobados para esa misión*. 3) Revisar **tasa de dosis** y alertas ambientales si están disponibles. 4) Informar al responsable de radioprotección.
- **Rojo / evento radiológico activo:** ejecutar el procedimiento autorizado de protección y refugio de radiación, comunicar a control de misión y registrar el evento. Seguir instrucciones de la tripulación responsable.
- **Nunca:** calcular rojo solo a partir de 153.09 mSv del ejemplo sin límites, exposición histórica, tasa y escenario; no ofrecer redistribución improvisada de materiales de blindaje.

## 6. Motor de reglas (prototipo)

**No codificar una tabla universal de “valores normales de astronautas”.** Mantener configuración versionada y dos modos:

- `demo`: escenarios predefinidos con valores, reglas y colores **sintéticos**, rotulados visiblemente como simulación. Permite mostrar verde, amarillo y rojo sin validar umbrales clínicos.
- `validated`: futuro; reglas activadas solo con fuentes, ámbito, aprobación clínica y contexto compatibles. Si faltan, devolver `unknown` o `requires_review`, nunca convertir una simulación en criterio clínico.

### Orden de evaluación recomendado

1. Validar dato: unidad, rango físicamente plausible, fecha, sensor, contexto.
2. Aplicar protocolo de **síntomas graves** (independiente del resultado numérico).
3. Aplicar alertas operacionales autorizadas (p. ej., radiación ambiental activa).
4. Aplicar reglas médicas específicas validadas para métrica y condiciones.
5. Examinar tendencia / línea base personal **solo si la regla está configurada para hacerlo**.
6. Si falta evidencia, `unknown` con `reasonCode` explicativo.
7. Devolver `status`, `reasonCode`, `triggeredRuleId`, `guideId`, `ruleVersion`, `isSimulated` y trazabilidad.

**Casos especiales:** presión = par sistólica/diastólica; sueño/actividad = suma por intervalo definido, no lectura puntual; ánimo y estrés = escalas ordinales con sentidos inversos; radiación = acumulado + tasa + evento ambiental; azul dormido no cancela rojo; síntomas urgentes con verde abren igualmente procedimiento de seguridad.

### Contrato TypeScript de referencia

```ts
type MetricId =
  | 'heart_rate' | 'blood_pressure' | 'temperature' | 'sleep'
  | 'mood' | 'activity' | 'spo2' | 'glucose' | 'stress'
  | 'radiation_cumulative';

type MedicalStatus = 'normal' | 'warning' | 'critical' | 'unknown';
type ActivityState = 'awake' | 'sleeping' | 'unknown';
type RuleMode = 'demo' | 'validated';

type Reading = {
  id: string;
  astronautId: string;
  metricId: MetricId;
  timestampUtc: string;
  value: number | { systolic: number; diastolic: number };
  unit: string;
  source: 'manual' | 'sensor' | 'synthetic';
  context?: {
    resting?: boolean;
    recentExercise?: boolean;
    fasting?: boolean;
    posture?: string;
    temperatureMethod?: string;
    symptoms?: string[];
    gravity?: 'microgravity' | 'moon' | 'mars' | 'earth';
    measurementQuality?: 'good' | 'uncertain' | 'invalid';
  };
};

type Evaluation = {
  readingId: string;
  status: MedicalStatus;
  activityState?: ActivityState;
  reasonCode: string;
  triggeredRuleId?: string;
  ruleVersion: string;
  guideId: string;
  isSimulated: boolean;
  evaluatedAtUtc: string;
};

type Guidance = {
  id: string;
  metricId: MetricId;
  status: MedicalStatus;
  title: string;
  whatIsHappening: string;
  possibleCauses: string[];
  immediateSteps: string[];
  escalationCriteria: string[];
  verification: string;
  sourceUrls: string[];
  reviewStatus: 'needs_medical_review' | 'approved';
  approvedForMissionId?: string;
  version: string;
};
```

### Ejemplo de regla sintética (no clínica)

```ts
const scenario = {
  id: 'demo-sleep-short-01',
  mode: 'demo' as const,
  metricId: 'sleep' as const,
  value: 5.2,
  target: 7.5, // objetivo inventado PARA DEMO
  status: 'warning' as const, // estado autorado, NO diagnóstico
  reasonCode: 'DEMO_SLEEP_BELOW_TARGET',
  guideId: 'sleep-warning-v1',
  isSimulated: true,
};
```

El cálculo de estado vive en un módulo independiente de React. El contenido de las guías vive en un catálogo versionado; **no** incrustar frases clínicas por tarjeta en componentes JSX. Nunca permitir que una IA generativa invente tratamientos en tiempo real.

## 7. Arquitectura sugerida para Next.js / React

**Adaptar a la estructura existente; no duplicar stores, modelos ni componentes.**

```text
src/
  features/
    crew-health/
      domain/
        metric-types.ts
        evaluate-metric.ts
        evaluation-rules.ts
      data/
        guidance-catalog.ts (o .json)
        demo-scenarios.ts
      components/
        MetricCard.tsx              (reutilizar tarjeta existente)
        MetricGuidanceDrawer.tsx
        GuidanceSteps.tsx
        ReadingContext.tsx
      hooks/
        useMetricGuidance.ts
      tests/
        evaluate-metric.test.ts
        guidance-catalog.test.ts
        metric-guidance-drawer.test.tsx
```

Si ya existen `CrewCard.tsx` y `MissionCrewBoard.tsx`, integrar el evento `onClick` y la selección de métrica en la composición actual; **no reemplazar** toda la página ni cambiar otros módulos. Usar estilos existentes y conservar el diseño claro con tarjetas destacadas por color.

### Estado mínimo de UI

- `selectedAstronautId`
- `selectedMetricId`
- `isGuidanceOpen`
- `activeEvaluation`
- `completedStepIds` (por evento, no global)
- `eventLog` (local en demo; persistente en producto)

### Persistencia sugerida

`health_readings`, `health_evaluations`, `guidance_catalog`, `health_events`, `event_actions`.

Registrar `astronautId`, `readingId`, evaluación y versión de regla, pasos marcados, nueva lectura, momento de notificación y resolución. Guardar **solo** los datos necesarios y proteger la privacidad, especialmente en ánimo y estrés.

## 8. Plan de ejecución incremental

### Fase 1 — Ajustar los datos y los estados (prioridad alta)
- [ ] Identificar origen real de las 10 tarjetas y del color actual.
- [ ] Asegurar IDs estables, unidades, timestamps y fuente (`synthetic`).
- [ ] Separar color clínico, modo durmiendo y estado desconocido.
- [ ] Mantener los escenarios demo existentes como demo y no darles significado médico.
- [ ] Incorporar evaluación con `reasonCode` y enlace a guía.

**Resultado verificable:** ninguna lectura se muestra como “clínicamente normal” sin regla validada.

### Fase 2 — Crear 10 guías de orientación (prioridad alta)
- [ ] Convertir sección 5 a registros de catálogo para las diez métricas.
- [ ] Definir versiones para `warning`, `critical` y `normal/unknown`.
- [ ] Asociar cada guía con sus fuentes, estado de revisión y textos breves.
- [ ] Añadir contexto faltante antes de orientar (reposo, ayuno, etc.).

**Resultado verificable:** cada tarjeta abre una guía consistente, aunque el estado sea verde.

### Fase 3 — Implementar interacción (prioridad alta)
- [ ] Hacer tarjetas accesibles por clic y teclado.
- [ ] Mostrar panel con motivo, valor, causas posibles, pasos y escalamiento.
- [ ] Diferenciar rojo, amarillo, azul y gris con texto además de color.
- [ ] Permitir cerrar, registrar acciones y volver a medir.
- [ ] Agregar etiqueta “Simulación / no diagnóstico” en modo demo.

**Resultado verificable:** completar un escenario de alerta de punta a punta sin navegar fuera del dashboard.

### Fase 4 — Guardar eventos y verificar evolución (prioridad media)
- [ ] Crear evento al activar alerta.
- [ ] Registrar pasos realizados y momento.
- [ ] Vincular lectura de seguimiento y mostrar evolución.
- [ ] Permitir resolución manual justificada, sin borrar historial.
- [ ] Preparar mecanismo de notificación y cola offline (simulación si no hay backend).

**Resultado verificable:** trazabilidad de “alerta → acción → nueva lectura”.

### Fase 5 — Demostración y pruebas (prioridad alta para hackathon)
- [ ] Preparar tres escenarios: sueño bajo (amarillo), señal respiratoria/síntomas preocupantes (rojo), radiación con **evento ambiental simulado** (rojo).
- [ ] Probar las diez métricas y las dos severidades con sus guías.
- [ ] Probar dato inválido, ausente, vencido, sin umbral, y síntomas con lectura normal.
- [ ] Probar que `sleeping` no oculta una alerta.
- [ ] Verificar funcionamiento sin conexión y sin llamadas a IA remota.
- [ ] Confirmar que ningún texto presenta reglas sintéticas como estándares NASA.

**Resultado verificable:** demostración completa en 2–3 minutos, sin afirmaciones clínicas infundadas.

### Fase 6 — Validación clínica para uso fuera de demo (NO forma parte del MVP)
- [ ] Obtener revisión de profesional competente en medicina aeroespacial.
- [ ] Seleccionar protocolos autorizados por misión, dispositivo y contexto.
- [ ] Configurar umbrales clínicos aprobados y referencias auditables.
- [ ] Evaluar riesgos de falsos negativos, falsos positivos y fallos de sensores.
- [ ] Hacer pruebas de usabilidad, incidentes y seguridad, privacidad, cambios de versión y aprobación operacional.

## 9. Pruebas de aceptación indispensables

| Caso | Resultado esperado |
|---|---|
| Click en métrica amarilla | Abre guía de esa métrica con motivo y pasos concretos |
| Click en métrica roja | Instrucción de protección/escalamiento primero; sin tratamiento improvisado |
| Click en métrica verde | Muestra explicación y prevención, sin declarar ausencia de enfermedad |
| Métrica no disponible | Gris / desconocido; invita a nueva lectura |
| Presión 122/68 de ejemplo | Se muestran ambos valores; **no** se declara seguro por defecto |
| Radiación 153.09 mSv de ejemplo | No aparece “emergencia” sin regla de misión/tasa/evento configurados |
| Mood 1 de 5 | Bajo ánimo, no “bajo estrés” |
| Stress 5 de 5 | Alto estrés, no “muy buen estado” |
| Astronauta durmiendo + alerta roja | Sueño es modo operativo; alerta sigue visible |
| Síntomas graves + valor aparentemente normal | Aparece escalamiento por síntomas |
| Sensor inválido / dato viejo | No pintar verde; comunicar incertidumbre |
| Modo demo | Todos los pasos y resultados indican simulación; nunca diagnóstico |
| Registro de nueva lectura | La evaluación se recalcula y queda historial de acciones |
| Catálogo incompleto | Mensaje de guía no disponible y escalamiento seguro; no fabricar contenido |

## 10. Qué NO construir ahora

No implementar para este MVP: ultrasonidos, pruebas sanguíneas complejas, terapia intravenosa, fármacos, dosificación, prescripción de ejercicio intenso, manejo autónomo de soporte vital, diagnóstico por IA, predicción de enfermedades con datos insuficientes, ajuste automático de límites NASA no contrastados ni motor complejo de correlaciones biomédicas. Se pueden mencionar como investigación futura, **no** como recomendaciones accionables actuales.

## 11. Fuentes comprobables y límites de evidencia

1. NASA Space Apps Challenge 2026, descripción del reto: https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/
2. NASA Human Research Program, cinco riesgos del vuelo: https://www.nasa.gov/hrp/hazards/
3. NASA Human Research Program, riesgos para la salud: https://www.nasa.gov/hrp/risks/
4. NASA Human Health and Performance, arquitectura Moon to Mars (contexto, no tabla de umbrales): https://www.nasa.gov/wp-content/uploads/2024/01/human-health-and-performance.pdf
5. American Heart Association, presión y síntomas de urgencia (referencia **terrestre**, no protocolo espacial): https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings/when-to-call-911-for-high-blood-pressure
6. CDC, hipoglucemia y regla 15-15 (referencia **terrestre**, no instrucción aeroespacial validada): https://www.cdc.gov/diabetes/es/treatment/tratamiento-de-los-niveles-bajos-de-azucar-en-la-sangre-hipoglucemia.html
7. FDA, limitaciones de los oxímetros de pulso: https://www.fda.gov/medical-devices/products-and-medical-procedures/pulse-oximeters

**Trazabilidad:** el documento original proporcionó los nombres de las diez métricas, contexto RIDGE y conceptos de línea base; esta versión prioriza el flujo UI y elimina intervenciones que no deberían recomendarse automáticamente. Las fuentes NASA aportan el **contexto espacial**, no la validación de cada umbral ni de cada acción. El equipo debe identificar quién aprueba cada regla antes de presentarla como orientación clínica real.

## 12. Orden recomendado para el próximo cambio de código

1. Conectar `onClick` de cada tarjeta a `selectedMetricId`.
2. Renderizar `MetricGuidanceDrawer` con textos del catálogo (aunque el estado actual sea demo).
3. Mostrar `reasonCode`, `isSimulated` y acciones numeradas.
4. Añadir 3 escenarios demostrables y pruebas de no regresión.
5. Solo después, añadir historial y una capa de reglas configurables.

**Definición de terminado del MVP:** desde cualquier tarjeta se puede entrar en una guía que identifica correctamente el indicador, explica en lenguaje simple la anomalía simulada, propone acciones no invasivas y un escalamiento apropiado, permite registrar un seguimiento y nunca confunde una simulación con una evaluación médica validada.
