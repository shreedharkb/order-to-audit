const logAudit = async (pool, tableName, recordId, action, oldValues, newValues, userId, ipAddress = null) => {
  try {
    const text = `
      INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, user_id, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    await pool.query(text, [
      tableName,
      recordId,
      action,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      userId,
      ipAddress
    ]);
  } catch (err) {
    console.error('Audit log error (non-fatal):', err.message);
  }
};

module.exports = { logAudit };
