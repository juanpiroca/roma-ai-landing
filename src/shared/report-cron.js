// report-cron.js — Wrapper para correr el generador de reportes (vía cron o PM2 cron)
// Uso: node report-cron.js
// Cron sugerido: 0 8 * * 1  (lunes 8am)
const { generateWeeklyReport } = require('./report-generator');

const start = Date.now();
console.log(`[report-cron] ${new Date().toISOString()} — iniciando generación de reporte semanal`);

generateWeeklyReport()
  .then(result => {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    if (result) {
      console.log(`[report-cron] OK en ${elapsed}s — período: ${result.period}, leads: ${result.leadCount}, WP ID: ${result.wpId}`);
    } else {
      console.log(`[report-cron] Sin datos en ${elapsed}s — reporte omitido`);
    }
    process.exit(0);
  })
  .catch(err => {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.error(`[report-cron] ERROR en ${elapsed}s:`, err.message);
    process.exit(1);
  });
