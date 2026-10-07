// Model input/output is untrusted. Never log original values on error.
export function redactText(value, secrets = []) {
  let text = String(value ?? '');
  for (const secret of secrets) {
    if (typeof secret === 'string' && secret.length >= 4) text = text.split(secret).join('[REDACTED]');
  }
  return text
    .replace(/https?:\/\/[^\s<>"']+/g, value => {
      try { const url = new URL(value); url.username = ''; url.password = ''; url.search = ''; url.hash = ''; return url.href; }
      catch { return '[invalid URL]'; }
    })
    .replace(/\b(?:sk|ghp|gho|github_pat)[-_][A-Za-z0-9_-]{12,}\b/g, '[REDACTED]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED JWT]')
    .replace(/((?:api[_ -]?key|password|passwd|secret|access[_ -]?token|authorization|密码|密钥)\s*[=:：]\s*)[^\s,;"<>]+/gi, '$1[REDACTED]');
}

export function publicUrl(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return '[unsupported URL]';
    url.username = ''; url.password = ''; url.search = ''; url.hash = '';
    return redactText(url.href);
  } catch { return '[invalid URL]'; }
}

export function sanitizeObservation(observation, secrets = []) {
  return {
    snapshotId: observation.snapshotId,
    url: publicUrl(observation.url),
    title: redactText(observation.title, secrets).slice(0, 300),
    text: redactText(observation.text, secrets).slice(0, 12000),
    elements: (observation.elements ?? []).slice(0, 80).map(element => ({
      id: element.id, tag: element.tag, type: element.type,
      ...(typeof element.grantId === 'string' ? { grantId: element.grantId } : {}),
      capabilities: (element.capabilities ?? []).filter(tool => ['click', 'fill', 'select'].includes(tool)),
      label: redactText(element.label, secrets).slice(0, 180),
      ...(element.href ? { href: publicUrl(element.href) } : {}),
      ...(element.options ? { options: element.options.slice(0, 30).map(option => ({
        value: redactText(option.value, secrets).slice(0, 200),
        label: redactText(option.label, secrets).slice(0, 100)
      })) } : {})
    })),
    shadowRoots: observation.shadowRoots ?? 0, coverage: observation.coverage || '当前文档可见 DOM；不含输入值'
  };
}
