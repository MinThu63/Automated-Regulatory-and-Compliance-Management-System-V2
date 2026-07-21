// =============================================
// ORCHESTRATOR — Starts all 6 agents
// Called once from server.js on startup
// =============================================

const scraper = require('./scraper');
const assessor = require('./assessor');
const analyzer = require('./analyzer');
const dispatcher = require('./dispatcher');
const versioner = require('./versioner');
const notifier = require('./notifier');
const advisor = require('./advisor');

function startAllAgents() {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   AGENTIC SYSTEM — Starting Agents       ║');
  console.log('╚══════════════════════════════════════════╝');

  // Order matters: downstream agents subscribe before upstream emits
  notifier.start();      // Listens to: alert.created, task.created
  advisor.start();       // Listens to: gap.created (proposes new/updated policies)
  dispatcher.start();    // Listens to: alert.created, gap.created
  versioner.start();     // Listens to: policy.updated
  analyzer.start();      // Listens to: regulation.new, regulation.updated
  assessor.start();      // Listens to: regulation.new, regulation.updated
  scraper.start();       // Emits: regulation.new, regulation.updated

  console.log('');
  console.log('[Orchestrator] All 7 agents active');
  console.log('[Orchestrator] Flow: Scraper → Assessor → Analyzer → Dispatcher/Advisor → Notifier');
  console.log('');
}

module.exports = { startAllAgents };
