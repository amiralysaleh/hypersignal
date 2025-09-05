const fs = require('fs').promises;
const path = require('path');

const LOGS_FILE_PATH = path.resolve(process.cwd(), 'logs.json');

async function readLogs() {
  try {
    await fs.access(LOGS_FILE_PATH);
    const fileContent = await fs.readFile(LOGS_FILE_PATH, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.writeFile(LOGS_FILE_PATH, JSON.stringify([]));
      return [];
    }
    throw error;
  }
}

async function writeLogs(logs) {
  await fs.writeFile(LOGS_FILE_PATH, JSON.stringify(logs, null, 2));
}

async function log(entry) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level: entry.level || 'INFO',
    message: entry.message,
    context: entry.context || {}
  };
  
  console.log(`[${timestamp}] ${logEntry.level}: ${logEntry.message}`, logEntry.context);
  
  try {
    const logs = await readLogs();
    logs.push(logEntry);
    
    // Keep only the last 1000 log entries to prevent file from getting too large
    if (logs.length > 1000) {
      logs.splice(0, logs.length - 1000);
    }
    
    await writeLogs(logs);
  } catch (error) {
    console.error('Failed to write log to file:', error);
  }
}

async function getLogs() {
  return await readLogs();
}

module.exports = {
  log,
  getLogs
};