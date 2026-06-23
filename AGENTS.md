<!-- markdownlint-disable MD013 -->
# Roma AI — Agentes y Arquitectura

Este documento describe la arquitectura, los agentes y las herramientas que componen el stack de Roma AI.

## Agentes

### Hermes (Orquestador)

Hermes actúa como el orquestador principal del sistema. Su función es delegar tareas, coordinar las acciones entre los diferentes agentes y sistemas, y asegurar que los flujos de trabajo se ejecuten correctamente de principio a fin. Funciona como un gateway independiente.

### Agentes Especialistas (Claude / Codex / DeepSeek)

Son los agentes encargados de tareas específicas de razonamiento profundo, generación de código y respuestas complejas.

- **Claude:** Utilizado para análisis, redacción y tareas generales de alto nivel cognitivo.
- **Codex:** Especializado en la generación y revisión de código fuente.
- **DeepSeek:** Empleado como proveedor de inteligencia artificial, por ejemplo, en la landing page del chat web.

### Jules (Mantenimiento)

Jules es el agente de ingeniería de software. Se encarga de completar tareas de codificación, resolver errores (bugs), implementar nuevas funcionalidades, escribir pruebas (tests) y mantener el código del repositorio en óptimas condiciones de manera autónoma.

## Herramientas y Memoria

### Token Saver (Memoria)

Este componente gestiona la memoria a corto y largo plazo del sistema optimizando el uso de tokens. Permite mantener el contexto entre las interacciones y preservar el estado de forma eficiente sin exceder los límites de las ventanas de contexto de los modelos.

### Obsidian (Segundo Cerebro)

Actúa como la base de conocimiento principal o "segundo cerebro" del ecosistema. Almacena la información persistente, documentación arquitectónica, reglas y notas importantes que los agentes pueden consultar para tomar decisiones informadas y mantener la coherencia a largo plazo.

## Flujos de Trabajo (Workflow)

### GitLab / GitHub Workflow

El ciclo de desarrollo y despliegue se rige mediante un flujo de trabajo basado en Git (GitLab y/o GitHub). Esto incluye:

- Control de versiones.
- Integración y Entrega Continua (CI/CD).
- Revisiones de código impulsadas por agentes (como Jules).
- Sincronización constante para que cualquier cambio o mejora pase por validaciones, testing automatizado y aprobaciones formales antes de integrarse.

---

> Nota: Cualquier agente que opere en este repositorio debe respetar estas pautas arquitectónicas y usar las herramientas designadas.
