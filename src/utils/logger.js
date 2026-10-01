function write(level, event, fields = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: 'clipforge-api',
    event,
    ...fields,
  };
  const output = JSON.stringify(entry);
  if (level === 'error') console.error(output);
  else console.log(output);
}

export const logger = {
  info: (event, fields) => write('info', event, fields),
  warn: (event, fields) => write('warn', event, fields),
  error: (event, fields) => write('error', event, fields),
};

export function jobLogger(job, fields = {}) {
  const jobId = job?._id ? String(job._id) : undefined;
  return {
    info: (event, extra = {}) => logger.info(event, { jobId, ...fields, ...extra }),
    warn: (event, extra = {}) => logger.warn(event, { jobId, ...fields, ...extra }),
    error: (event, extra = {}) => logger.error(event, { jobId, ...fields, ...extra }),
  };
}
