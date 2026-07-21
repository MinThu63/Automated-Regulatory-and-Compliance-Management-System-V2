require('dotenv').config();
var pool = require('./db');

async function fix() {
  // Fix 1: Sync gap status with completed tasks
  var [fixed] = await pool.query(`
    UPDATE compliance_gaps cg
    JOIN tasks t ON t.gap_id = cg.gap_id
    SET cg.status = 'Remediated'
    WHERE t.status = 'Completed' AND cg.status != 'Remediated'
  `);
  console.log('Fixed', fixed.affectedRows, 'gaps → Remediated (task was Completed)');

  // Fix 2: Remove duplicate tasks (keep only one per gap_id)
  var [dupes] = await pool.query(`
    SELECT gap_id, COUNT(*) as cnt, MIN(task_id) as keep_id
    FROM tasks WHERE gap_id IS NOT NULL
    GROUP BY gap_id HAVING cnt > 1
  `);
  var deleted = 0;
  for (var dupe of dupes) {
    var [del] = await pool.query('DELETE FROM tasks WHERE gap_id = ? AND task_id != ?', [dupe.gap_id, dupe.keep_id]);
    deleted += del.affectedRows;
  }
  console.log('Deleted', deleted, 'duplicate tasks');

  // Verify
  var [summary] = await pool.query('SELECT status, COUNT(*) as cnt FROM compliance_gaps GROUP BY status');
  console.log('\nGap status summary:');
  summary.forEach(function(s) { console.log('  ' + s.status + ':', s.cnt); });

  var [taskSummary] = await pool.query('SELECT COUNT(*) as cnt FROM tasks WHERE gap_id IS NOT NULL');
  console.log('Tasks linked to gaps:', taskSummary[0].cnt);

  process.exit();
}

fix().catch(function(e) { console.error(e.message); process.exit(1); });
