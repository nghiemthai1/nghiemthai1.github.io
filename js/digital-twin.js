const MAX_HISTORY_MESSAGES = 8;
const MAX_QUESTION_LENGTH = 500;
const REFUSAL = 'I can only answer questions about my public professional experience, projects, education, skills, and credentials.';
const UNKNOWN = 'That detail is not included in my public experience profile.';
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'did', 'do', 'for', 'from', 'have', 'how', 'i',
  'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'the', 'to', 'was', 'what', 'when', 'where',
  'which', 'who', 'why', 'with', 'you', 'your', 'yours', 'about', 'tell', 'please',
]);
const GENERIC_SCOPE_TERMS = new Set([
  'experience', 'work', 'worked', 'career', 'job', 'role', 'professional', 'project', 'projects',
  'skill', 'skills', 'technology', 'technologies', 'education', 'degree', 'credential', 'credentials',
  'certification', 'certifications', 'background', 'achievement', 'achievements', 'responsibility',
  'responsibilities', 'interest', 'interests', 'accomplishment', 'accomplishments',
]);
const IN_SCOPE_PATTERN = /\b(experience|work|career|job|role|project|build|built|develop|developed|skill|technology|education|degree|university|college|gpa|grade|major|minor|course|graduate|graduated|certification|credential|award|honor|uipath|automation|artificial intelligence|ai|java|python|aws|engineering|consultant|intern|employer|company|achievement|accomplish|lead|team|background|professional|resume|portfolio|strength|specialize|who are you|about yourself)\b/i;
const BLOCKED_PATTERNS = [
  /\b(ignore|override|forget|disregard)\b.{0,40}\b(instruction|prompt|rule|system|previous)\b/i,
  /\b(system prompt|developer message|hidden instruction|jailbreak|role[- ]?play|act as|pretend to be)\b/i,
  /\b(weather|forecast|election|politic|president|recipe|sports score|stock price|medical advice|legal advice)\b/i,
  /\b(write|generate|debug|fix|review)\b.{0,30}\b(code|program|script|essay|email)\b/i,
  /\b(home address|street address|phone number|email address|birthday|age|salary|religion|married|family)\b/i,
];

function tokenize(value) {
  return (value.toLowerCase().match(/[a-z0-9+#.]+/g) || [])
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function flattenValue(value) {
  if (Array.isArray(value)) return value.map(flattenValue).join(' ');
  if (value && typeof value === 'object') return Object.values(value).map(flattenValue).join(' ');
  return String(value ?? '');
}

export function buildKnowledgeRecords(data) {
  const records = [
    { kind: 'profile', id: 'identity', ...data.identity },
    ...data.experience.map((item) => ({ kind: 'professional experience', ...item })),
    ...data.education.map((item) => ({ kind: 'education', ...item })),
    ...data.certifications.map((item) => ({ kind: 'certification', ...item })),
    ...data.projects.map((item) => ({ kind: 'project', ...item })),
  ];

  return records.map((record) => ({
    ...record,
    searchText: flattenValue(record).toLowerCase(),
    searchTokens: new Set(tokenize(flattenValue(record))),
  }));
}

function scoreRecord(record, tokens, normalizedQuestion) {
  let score = 0;
  for (const token of tokens) {
    if (!record.searchTokens.has(token)) continue;
    score += token.length >= 6 ? 3 : 2;
  }

  for (const value of [record.organization, record.title, record.name, record.credential]) {
    if (value && normalizedQuestion.includes(value.toLowerCase())) score += 8;
  }
  return score;
}

function formatRecord(record) {
  const preferredOrder = [
    'kind', 'organization', 'title', 'dates', 'location', 'credential', 'issuer',
    'institution', 'graduation', 'gpa', 'name', 'role', 'summary', 'responsibilities',
    'highlights', 'skills', 'honors', 'careerInterests', 'professionalThemes',
    'methodologies', 'technologies',
  ];
  const ignored = new Set(['id', 'source', 'searchText', 'searchTokens']);
  const keys = [...preferredOrder, ...Object.keys(record).filter((key) => !preferredOrder.includes(key))];
  const entries = [];

  for (const key of keys) {
    if (ignored.has(key) || record[key] == null || record[key] === '') continue;
    const label = key.replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase();
    if (Array.isArray(record[key])) {
      entries.push(`${label}:\n${record[key].map((item) => `- ${item}`).join('\n')}`);
    } else {
      entries.push(`${label}: ${record[key]}`);
    }
  }
  return entries.join('\n');
}

export function retrieveKnowledge(question, records, limit = 4) {
  const normalizedQuestion = question.toLowerCase();
  const tokens = tokenize(question);
  const subjectTokens = tokens.filter((token) => !GENERIC_SCOPE_TERMS.has(token));
  const broadQuestion = subjectTokens.length === 0 || /\b(tell me about yourself|who are you|overview|summarize|your background)\b/i.test(question);

  if (broadQuestion) {
    const overview = [records.find((record) => record.kind === 'profile')]
      .concat(records.filter((record) => record.kind === 'professional experience').slice(0, 3))
      .filter(Boolean);
    return { records: overview, supported: true };
  }

  const ranked = records
    .map((record) => ({ record, score: scoreRecord(record, subjectTokens, normalizedQuestion) }))
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);

  return {
    records: ranked.map((result) => result.record),
    supported: ranked.length > 0 && ranked[0].score >= 2,
  };
}

export function evaluateQuestion(question, records) {
  const trimmed = question.trim();
  if (!trimmed) return { action: 'ignore' };
  if (trimmed.length > MAX_QUESTION_LENGTH) {
    return { action: 'reply', answer: 'Please shorten your question to 500 characters or fewer.' };
  }
  if (BLOCKED_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return { action: 'reply', answer: REFUSAL };
  }

  const retrieval = retrieveKnowledge(trimmed, records);
  if (!IN_SCOPE_PATTERN.test(trimmed) && !retrieval.supported) {
    return { action: 'reply', answer: REFUSAL };
  }
  if (!retrieval.supported) return { action: 'reply', answer: UNKNOWN };
  return {
    action: 'generate',
    facts: retrieval.records.map(formatRecord).join('\n\n---\n\n'),
  };
}

function createMessage(container, role, text = '') {
  const item = document.createElement('li');
  item.className = `digital-twin__message digital-twin__message--${role}`;
  const label = document.createElement('span');
  label.className = 'digital-twin__message-label';
  label.textContent = role === 'user' ? 'You' : 'Thai AI';
  const body = document.createElement('p');
  body.textContent = text;
  item.append(label, body);
  container.append(item);
  container.scrollTop = container.scrollHeight;
  return body;
}

function appendInlineFormatting(container, text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  for (const part of parts) {
    if (part.startsWith('**') && part.endsWith('**')) {
      const strong = document.createElement('strong');
      strong.textContent = part.slice(2, -2);
      container.append(strong);
    } else {
      container.append(document.createTextNode(part));
    }
  }
}

function renderAnswer(container, answer) {
  container.replaceChildren();
  const lines = answer.split(/\n+/).map((line) => line.trim()).filter(Boolean);

  for (const line of lines) {
    const row = document.createElement('span');
    row.className = 'digital-twin__response-line';
    const numberedItem = line.match(/^([1-9]|1\d)\.\s+(.+)$/);
    if (numberedItem) {
      row.classList.add('digital-twin__response-item');
      const number = document.createElement('span');
      number.className = 'digital-twin__response-number';
      number.textContent = `${numberedItem[1]}.`;
      row.append(number);
      appendInlineFormatting(row, numberedItem[2]);
    } else {
      appendInlineFormatting(row, line);
    }
    container.append(row);
  }
}

export async function initializeDigitalTwin() {
  const root = document.querySelector('[data-digital-twin]');
  if (!root) return;

  const elements = {
    launcher: root.querySelector('[data-twin-launcher]'),
    panel: root.querySelector('[data-twin-panel]'),
    close: root.querySelector('[data-twin-close]'),
    download: root.querySelector('[data-twin-download]'),
    cpu: root.querySelector('[data-twin-cpu]'),
    retry: root.querySelector('[data-twin-retry]'),
    progress: root.querySelector('[data-twin-progress]'),
    progressBar: root.querySelector('[data-twin-progress-bar]'),
    status: root.querySelector('[data-twin-status]'),
    setupCopy: root.querySelector('[data-twin-setup-copy]'),
    suggestions: root.querySelector('[data-twin-suggestions]'),
    suggestionButtons: [...root.querySelectorAll('[data-twin-suggestion]')],
    messages: root.querySelector('[data-twin-messages]'),
    form: root.querySelector('[data-twin-form]'),
    input: root.querySelector('[data-twin-input]'),
    send: root.querySelector('[data-twin-send]'),
    cancel: root.querySelector('[data-twin-cancel]'),
    clear: root.querySelector('[data-twin-clear]'),
  };

  let records = [];
  let worker = null;
  let modelReady = false;
  let loadingConfiguration = null;
  let activeRequest = null;
  let activeAnswer = null;
  let history = [];
  const downloads = new Map();

  function setStatus(message, state = 'idle') {
    elements.status.textContent = message;
    elements.status.dataset.state = state;
  }

  function setComposerEnabled(enabled) {
    elements.input.disabled = !enabled;
    elements.send.disabled = !enabled;
  }

  function clearThinkingState(answer = activeAnswer) {
    if (!answer?.classList.contains('digital-twin__thinking')) return;
    answer.classList.remove('digital-twin__thinking');
    answer.removeAttribute('aria-label');
    answer.textContent = '';
  }

  function openPanel() {
    elements.panel.hidden = false;
    elements.launcher.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => {
      (modelReady ? elements.input : elements.download).focus();
    });
  }

  function closePanel() {
    elements.panel.hidden = true;
    elements.launcher.setAttribute('aria-expanded', 'false');
    elements.launcher.focus();
  }

  function updateProgress(progress) {
    if (progress.status === 'progress' && progress.file && Number.isFinite(progress.total)) {
      downloads.set(progress.file, { loaded: progress.loaded || 0, total: progress.total || 0 });
      const totals = [...downloads.values()].reduce(
        (sum, file) => ({ loaded: sum.loaded + file.loaded, total: sum.total + file.total }),
        { loaded: 0, total: 0 },
      );
      const percent = totals.total ? Math.min(100, Math.round((totals.loaded / totals.total) * 100)) : 0;
      elements.progressBar.style.width = `${percent}%`;
      elements.progress.setAttribute('aria-valuenow', String(percent));
      setStatus(
        percent >= 100
          ? 'Download complete. Setting up the AI on this device...'
          : `Downloading model: ${percent}%`,
        'loading',
      );
      return;
    }
    if (progress.status === 'initiate') setStatus('Preparing model files...', 'loading');
  }

  function finishGeneration(cancelled = false) {
    elements.cancel.hidden = true;
    elements.send.hidden = false;
    setComposerEnabled(modelReady);
    clearThinkingState();
    if (cancelled && activeAnswer && !activeAnswer.textContent.trim()) activeAnswer.textContent = 'Response stopped.';
    activeRequest = null;
    activeAnswer = null;
    if (modelReady) elements.input.focus();
  }

  function handleWorkerMessage(event) {
    const message = event.data;
    if (message.type === 'progress') {
      updateProgress(message.progress);
      return;
    }
    if (message.type === 'ready') {
      modelReady = true;
      loadingConfiguration = null;
      root.dataset.modelReady = 'true';
      elements.progressBar.style.width = '100%';
      elements.progress.setAttribute('aria-valuenow', '100');
      elements.progress.hidden = true;
      elements.setupCopy.hidden = true;
      elements.download.hidden = true;
      elements.cpu.hidden = true;
      elements.retry.hidden = true;
      setStatus(message.device === 'webgpu' ? 'AI ready on this device.' : 'AI ready in CPU mode.', 'ready');
      setComposerEnabled(true);
      elements.input.focus();
      return;
    }
    if (message.type === 'token' && activeRequest === message.requestId && activeAnswer) {
      clearThinkingState();
      activeAnswer.textContent += message.text;
      elements.messages.scrollTop = elements.messages.scrollHeight;
      return;
    }
    if (message.type === 'complete' && activeRequest === message.requestId) {
      clearThinkingState();
      const answer = message.answer || activeAnswer?.textContent.trim() || UNKNOWN;
      if (activeAnswer) renderAnswer(activeAnswer, answer);
      history.push({ role: 'assistant', content: answer });
      history = history.slice(-MAX_HISTORY_MESSAGES);
      finishGeneration();
      return;
    }
    if (message.type === 'cancelled' && activeRequest === message.requestId) {
      finishGeneration(true);
      return;
    }
    if (message.type === 'error') {
      console.error('Digital twin worker error:', message.code, message.message);
      if (message.operation === 'load') {
        modelReady = false;
        loadingConfiguration = null;
        elements.retry.hidden = false;
        elements.cpu.hidden = false;
        elements.download.hidden = true;
        setStatus('The model could not start. Retry, or use slower CPU mode.', 'error');
      } else {
        clearThinkingState();
        if (activeAnswer) activeAnswer.textContent = 'I could not finish that response. Please try again.';
        setStatus('Generation failed. Your question was not sent anywhere.', 'error');
        finishGeneration();
      }
    }
  }

  function getWorker() {
    if (worker) return worker;
    worker = new Worker(new URL('./digital-twin-worker.js?v=20260902-10', import.meta.url), { type: 'module' });
    worker.addEventListener('message', handleWorkerMessage);
    worker.addEventListener('error', () => {
      modelReady = false;
      loadingConfiguration = null;
      elements.retry.hidden = false;
      elements.cpu.hidden = false;
      setComposerEnabled(false);
      setStatus('The local AI worker could not start. Retry, or use slower CPU mode.', 'error');
    });
    return worker;
  }

  function loadModel(device) {
    if (loadingConfiguration) return;
    delete root.dataset.modelReady;
    downloads.clear();
    const configuration = {
      device,
      // WebGPU can use the smaller mixed-precision graph. WASM keeps q4 for
      // broader CPU compatibility.
      dtype: device === 'webgpu' ? 'q4f16' : 'q4',
    };
    loadingConfiguration = configuration;
    elements.setupCopy.hidden = false;
    elements.progress.hidden = false;
    elements.download.hidden = true;
    elements.cpu.hidden = true;
    elements.retry.hidden = true;
    elements.progressBar.style.width = '0%';
    elements.progress.setAttribute('aria-valuenow', '0');
    setComposerEnabled(false);
    setStatus(device === 'webgpu' ? 'Starting private WebGPU download...' : 'Starting slower CPU download...', 'loading');
    getWorker().postMessage({ type: 'load', configuration });
  }

  function addImmediateReply(answer) {
    createMessage(elements.messages, 'assistant', answer);
    history.push({ role: 'assistant', content: answer });
    history = history.slice(-MAX_HISTORY_MESSAGES);
  }

  function submitQuestion(question) {
    const evaluation = evaluateQuestion(question, records);
    if (evaluation.action === 'ignore') return;

    createMessage(elements.messages, 'user', question);
    elements.input.value = '';
    elements.input.style.height = 'auto';
    elements.suggestions.hidden = true;
    history.push({ role: 'user', content: question });
    history = history.slice(-MAX_HISTORY_MESSAGES);

    if (evaluation.action === 'reply') {
      addImmediateReply(evaluation.answer);
      return;
    }

    activeRequest = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    activeAnswer = createMessage(elements.messages, 'assistant');
    activeAnswer.classList.add('digital-twin__thinking');
    activeAnswer.setAttribute('aria-label', 'Thai AI is thinking');
    activeAnswer.textContent = '...';
    elements.send.hidden = true;
    elements.cancel.hidden = false;
    setComposerEnabled(false);
    getWorker().postMessage({
      type: 'generate',
      requestId: activeRequest,
      question,
      facts: evaluation.facts,
      history: history.slice(0, -1),
    });
  }

  elements.launcher.addEventListener('click', () => {
    if (elements.panel.hidden) openPanel();
    else closePanel();
  });
  elements.close.addEventListener('click', closePanel);
  elements.download.addEventListener('click', async () => {
    if (!('gpu' in navigator)) {
      elements.download.hidden = true;
      elements.cpu.hidden = false;
      setStatus('WebGPU is unavailable. You can opt into slower CPU mode.', 'warning');
      elements.cpu.focus();
      return;
    }
    loadModel('webgpu');
  });
  elements.cpu.addEventListener('click', () => loadModel('wasm'));
  elements.retry.addEventListener('click', () => loadModel('webgpu'));
  elements.cancel.addEventListener('click', () => {
    if (activeRequest) getWorker().postMessage({ type: 'cancel', requestId: activeRequest });
  });
  elements.clear.addEventListener('click', () => {
    if (activeRequest) getWorker().postMessage({ type: 'cancel', requestId: activeRequest });
    history = [];
    elements.messages.replaceChildren();
    elements.suggestions.hidden = false;
    finishGeneration();
  });
  elements.form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!modelReady || activeRequest) return;
    submitQuestion(elements.input.value);
  });
  elements.input.addEventListener('input', () => {
    elements.input.style.height = 'auto';
    elements.input.style.height = `${Math.min(elements.input.scrollHeight, 120)}px`;
  });
  elements.input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    if (!modelReady || activeRequest) return;
    submitQuestion(elements.input.value);
  });
  for (const button of elements.suggestionButtons) {
    button.addEventListener('click', () => {
      const question = button.textContent.trim();
      if (modelReady && !activeRequest) {
        submitQuestion(question);
        return;
      }
      elements.input.value = question;
      setStatus('Download the private AI to ask this question.', 'idle');
      elements.download.focus();
    });
  }
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !elements.panel.hidden) closePanel();
  });

  try {
    const dataUrl = new URL('../assets/data/experience.json', import.meta.url);
    const response = await fetch(dataUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Unable to load experience data (${response.status})`);
    records = buildKnowledgeRecords(await response.json());
    setStatus('Ready to download. The model is cached after first use.');
  } catch (error) {
    console.error(error);
    elements.download.disabled = true;
    setStatus('Experience data could not be loaded. Please refresh the page.', 'error');
  }
}
