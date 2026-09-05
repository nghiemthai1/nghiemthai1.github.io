import { finalizeResponse } from './digital-twin-response.js?v=20260904-3';

const MAX_HISTORY_MESSAGES = 8;
const MAX_QUESTION_LENGTH = 500;
const API_ENDPOINT = 'https://thai-digital-twin-api.nghiemthai1.workers.dev/chat';
const TURNSTILE_SITE_KEY = '0x4AAAAAAEmC_OLXbTSMNe92';
const TURNSTILE_ACTION = 'digital_twin_chat';
const UNKNOWN = "Thanks for asking. That detail is not included in my public experience profile, so I don't want to guess.";
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'did', 'do', 'for', 'from', 'have', 'how', 'i',
  'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'the', 'to', 'was', 'what', 'when', 'where',
  'which', 'who', 'why', 'with', 'you', 'your', 'yours', 'about', 'tell', 'please',
]);
const GENERIC_SCOPE_TERMS = new Set([
  'experience', 'work', 'worked', 'career', 'job', 'role', 'professional', 'project', 'projects',
  'skill', 'skills', 'technology', 'technologies', 'education', 'degree', 'degrees', 'credential', 'credentials',
  'certification', 'certifications', 'background', 'achievement', 'achievements', 'responsibility',
  'responsibilities', 'interest', 'interests', 'accomplishment', 'accomplishments',
]);
const EDUCATION_FACT_PATTERN = /\b(education|degrees?|academics?|gpas?|grades?|majors?|graduation|graduated|college|university|school|study|studied|undergraduate|bachelor'?s?|master'?s?|graduate\s+degree|ph\.?d\.?|doctorate|mba|summa cum laude|honou?rs?)\b|\b[mb]\.?\s*s\.?(?=\s|$)/i;
const IN_SCOPE_PATTERN = /\b(experience|work|career|job|role|project|build|built|develop|developed|development|web|website|app|application|software|skill|technology|technologies|tech|tool|tools|framework|frameworks|language|languages|stack|database|databases|cloud|education|degree|university|college|rowan|gpa|grade|major|minor|course|graduate|graduated|certification|credential|award|honor|uipath|automation|artificial intelligence|generative ai|genai|agentic|governance|ai|robot|robotic|robotics|hardware|firmware|pcb|embedded|circuit|java|python|aws|gcp|gemini|google adk|engineering|consultant|intern|employer|company|achievement|accomplish|lead|team|background|professional|resume|portfolio|strength|specialize|who are you|about yourself)\b/i;
const FOLLOW_UP_PATTERN = /^(?:(?:can|could|would)\s+you\s+)?(?:tell|share|give)\s+me\s+more(?:\s+about\s+(?:that|this|it))?[.!?]*$|^(?:please\s+)?(?:elaborate|expand|go on|what else)(?:\s+on\s+(?:that|this|it))?[.!?]*$/i;
const TECHNOLOGY_STACK_PATTERN = /\b(technolog(?:y|ies)|tech\s+stack|tools?|frameworks?|programming\s+languages?|languages?|databases?|cloud\s+(?:platforms?|technologies|services))\b/i;
const WEB_DEVELOPMENT_PATTERN = /\b(web\s*(?:app|application|development)|website|full[- ]?stack(?:\s+development)?|software\s+development)\b/i;
const PHYSICAL_ROBOTICS_PATTERN = /\b(robot|robotic|robotics|hardware|firmware|pcb|embedded)\b/i;
const CAREER_PROGRESSION_PATTERN = /\b(progress|progression|evolve|evolved|evolution|path|journey|engineering background|from engineering|from hardware)\b/i;
const NAMED_EMPLOYER_QUESTION_PATTERN = /\b(?:did|have|do|are|were)\s+you\s+(?:ever\s+)?(?:work(?:ed)?|employ(?:ed)?)\s+(?:at|for|by|with)\s+([a-z0-9&.'-]+(?:\s+[a-z0-9&.'-]+){0,4})/i;
const BLOCKED_PATTERNS = [
  /\b(ignore|override|forget|disregard)\b.{0,40}\b(instruction|prompt|rule|system|previous)\b/i,
  /\b(system prompt|developer message|hidden instruction|jailbreak|role[- ]?play|act as|pretend to be)\b/i,
  /\b(weather|forecast|election|politic|president|recipe|sports score|stock price|medical advice|legal advice)\b/i,
  /\b(write|generate|debug|fix|review)\b.{0,30}\b(code|program|script|essay|email)\b/i,
  /\b(home address|street address|phone number|email address|birthday|age|salary|religion|married|family)\b/i,
];

const OUT_OF_SCOPE_TOPICS = [
  [/\b(weather|forecast)\b/i, 'the weather'],
  [/\b(election|politic|president)\b/i, 'politics and current events'],
  [/\b(recipe)\b/i, 'recipes'],
  [/\b(sports score)\b/i, 'sports'],
  [/\b(stock price)\b/i, 'stock prices'],
  [/\bmedical advice\b/i, 'medical advice'],
  [/\blegal advice\b/i, 'legal advice'],
  [/\b(home address|street address|phone number|email address|birthday|age|salary|religion|married|family)\b/i, 'that personal detail'],
  [/\b(ignore|override|forget|disregard|system prompt|developer message|hidden instruction|jailbreak|role[- ]?play|act as|pretend to be)\b/i, 'that request'],
  [/\b(write|generate|debug|fix|review)\b.{0,30}\b(code|program|script|essay|email)\b/i, 'that request'],
];

export function buildScopeFallback(question) {
  const matchedTopic = OUT_OF_SCOPE_TOPICS.find(([pattern]) => pattern.test(question));
  const topicWords = tokenize(question)
    .filter((word) => !['today', 'current', 'latest', 'won', 'know'].includes(word))
    .slice(0, 5);
  const topic = matchedTopic?.[1] || topicWords.join(' ') || 'that topic';
  return `Thank you for your interest in ${topic}. I can only answer questions about my public professional experience, projects, education, skills, and credentials.`;
}

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

function degreeLabel(credential) {
  return credential
    .replace(/^M\.S\.\s*/, 'M.S. in ')
    .replace(/^B\.S\.\s*/, 'B.S. in ');
}

function educationDetail(record, includeHonors) {
  const details = [record.institution, record.dates, record.gpa ? `GPA ${record.gpa}` : ''].filter(Boolean);
  if (includeHonors && record.honors?.length) details.push(record.honors.join(', '));
  return `- **${degreeLabel(record.credential)}:** ${details.join(', ')}.`;
}

export function buildEducationAnswer(question, records) {
  if (!EDUCATION_FACT_PATTERN.test(question)) return null;

  const education = records.filter((record) => record.kind === 'education');
  if (!education.length) return UNKNOWN;

  const normalizedQuestion = question.toLowerCase();
  const asksForHonors = /\b(honou?rs?|summa|distinction|award)\b/i.test(question);
  const asksForMasters = /\b(master'?s?|graduate\s+degree)\b|\bm\.?\s*s\.?(?=\s|$)/i.test(question);
  const asksForBachelors = /\b(bachelor'?s?|undergraduate)\b|\bb\.?\s*s\.?(?=\s|$)/i.test(question);
  const asksForUnlistedDegree = /\b(ph\.?d\.?|doctorate|mba|associate(?:'s)?)\b/i.test(question);
  const namedInstitutions = education.filter((record) => normalizedQuestion.includes(record.institution.toLowerCase()));
  const institutionMention = question.match(/\b(?:at|from)\s+([A-Z][A-Za-z&.'-]*(?:\s+[A-Z][A-Za-z&.'-]*)*\s+(?:University|College))\b/);
  const asksForUnlistedInstitution = Boolean(institutionMention && !namedInstitutions.length);

  let selected = education;
  if (namedInstitutions.length) selected = namedInstitutions;
  else if (asksForMasters && !asksForBachelors) selected = education.filter((record) => /^M\.S\./.test(record.credential));
  else if (asksForBachelors && !asksForMasters) selected = education.filter((record) => /^B\.S\./.test(record.credential));

  const introduction = asksForUnlistedDegree || asksForUnlistedInstitution
    ? `That ${asksForUnlistedDegree ? 'degree' : 'institution'} is not listed in my public profile. I hold these two degrees:`
    : selected.length === 1
      ? 'Here is the degree listed in my public profile:'
      : `I hold ${education.length === 2 ? 'two' : education.length} degrees:`;
  const answerRecords = asksForUnlistedDegree || asksForUnlistedInstitution ? education : selected;
  return `${introduction}\n${answerRecords.map((record) => educationDetail(record, asksForHonors)).join('\n')}`;
}

function asksAboutUnknownEmployer(question, records) {
  const employerQuestion = question.match(NAMED_EMPLOYER_QUESTION_PATTERN);
  if (!employerQuestion || /^(?:a|the|government|telecommunications|utilities|clients?)\b/i.test(employerQuestion[1])) return false;
  const normalizedQuestion = question.toLowerCase();
  const target = employerQuestion[1].toLowerCase().replace(/\s+(?:last|in|during|before|after)\b.*$/, '').trim();
  return !records.some((record) => {
    if (record.kind !== 'professional experience' || !record.organization) return false;
    const organization = record.organization.toLowerCase();
    if (normalizedQuestion.includes(organization) || organization.startsWith(target)) return true;
    const aliases = [...organization.matchAll(/\(([^)]+)\)/g)].map((match) => match[1]);
    return aliases.some((alias) => new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(question));
  });
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

  const selectRecords = (ids) => ids.map((id) => records.find((record) => record.id === id)).filter(Boolean);
  if (TECHNOLOGY_STACK_PATTERN.test(question)) {
    return {
      records: selectRecords([
        'identity',
        'experience-ey-senior-technology-consultant',
        'experience-american-water-full-stack-developer',
        'experience-ellenby-engineering-intern',
      ]),
      supported: true,
    };
  }
  if (CAREER_PROGRESSION_PATTERN.test(question)) {
    if (/\bamerican water\b/i.test(question)) {
      return {
        records: selectRecords([
          'experience-american-water-full-stack-developer',
          'experience-american-water-intelligent-automation-engineer',
        ]),
        supported: true,
      };
    }
    return {
      records: selectRecords([
        'experience-ellenby-engineering-intern',
        'experience-american-water-full-stack-developer',
        'experience-ey-ai-intelligent-automation',
        'experience-ey-senior-technology-consultant',
      ]),
      supported: true,
    };
  }
  if (WEB_DEVELOPMENT_PATTERN.test(question)) {
    return {
      records: selectRecords([
        'experience-american-water-full-stack-developer',
        'experience-fpt-software-intern',
        'identity',
      ]),
      supported: true,
    };
  }
  if (/\browan\b/i.test(question)) {
    return {
      records: selectRecords([
        'education-bs-electrical-computer-engineering',
        'project-alzheimers-diagnosis',
        'project-sumo-robot',
      ]),
      supported: true,
    };
  }
  if (PHYSICAL_ROBOTICS_PATTERN.test(question) && !/\b(rpa|robotic process automation|process automation)\b/i.test(question)) {
    return {
      records: selectRecords([
        'experience-ellenby-engineering-intern',
        'project-sumo-robot',
        'project-underwater-rov',
        'project-object-follower',
      ]),
      supported: true,
    };
  }

  const entityTokenGroups = [];
  for (const record of records) {
    const names = [record.organization, record.name, record.credential, record.institution]
      .filter(Boolean)
      .map((value) => value.toLowerCase());
    for (const name of names) {
      if (name.length >= 4 && normalizedQuestion.includes(name)) {
        entityTokenGroups.push(tokenize(name).filter((token) => tokens.includes(token)));
      }
      for (const match of name.matchAll(/\(([^)]+)\)/g)) {
        const aliasTokens = tokenize(match[1]);
        if (aliasTokens.length && aliasTokens.every((token) => tokens.includes(token))) entityTokenGroups.push(aliasTokens);
      }
    }
  }
  const namedMatches = records.filter((record) => entityTokenGroups.some(
    (group) => group.length && group.every((token) => record.searchTokens.has(token)),
  ));
  if (namedMatches.length) return { records: namedMatches.slice(0, limit), supported: true };

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

export function evaluateQuestion(question, records, previousRecordIds = []) {
  const trimmed = question.trim();
  if (!trimmed) return { action: 'ignore' };
  if (trimmed.length > MAX_QUESTION_LENGTH) {
    return { action: 'reply', answer: 'Please shorten your question to 500 characters or fewer.' };
  }
  if (BLOCKED_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return { action: 'reply', answer: buildScopeFallback(trimmed) };
  }

  const educationAnswer = buildEducationAnswer(trimmed, records);
  if (educationAnswer) return { action: 'reply', answer: educationAnswer };
  if (asksAboutUnknownEmployer(trimmed, records)) return { action: 'reply', answer: UNKNOWN };

  if (FOLLOW_UP_PATTERN.test(trimmed) && previousRecordIds.length) {
    const recordIds = previousRecordIds.filter((id) => records.some((record) => record.id === id)).slice(0, 4);
    if (recordIds.length) return { action: 'generate', recordIds };
  }

  const retrieval = retrieveKnowledge(trimmed, records);
  if (!IN_SCOPE_PATTERN.test(trimmed) && !retrieval.supported) {
    return { action: 'reply', answer: buildScopeFallback(trimmed) };
  }
  if (!retrieval.supported) return { action: 'reply', answer: UNKNOWN };
  return {
    action: 'generate',
    recordIds: retrieval.records.map((record) => record.id),
  };
}

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-digital-twin-turnstile]');
    const script = existing || document.createElement('script');
    const timeout = window.setTimeout(() => reject(new Error('Turnstile timed out')), 15_000);
    const ready = () => {
      window.clearTimeout(timeout);
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error('Turnstile did not initialize'));
    };
    script.addEventListener('load', ready, { once: true });
    script.addEventListener('error', () => {
      window.clearTimeout(timeout);
      reject(new Error('Turnstile could not be loaded'));
    }, { once: true });
    if (!existing) {
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.digitalTwinTurnstile = 'true';
      document.head.append(script);
    }
  });
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
    const bulletItem = line.match(/^[-•]\s+(.+)$/);
    if (bulletItem) {
      row.classList.add('digital-twin__response-item');
      const bullet = document.createElement('span');
      bullet.className = 'digital-twin__response-bullet';
      bullet.setAttribute('aria-hidden', 'true');
      bullet.textContent = '•';
      row.append(bullet);
      appendInlineFormatting(row, bulletItem[1]);
    } else if (numberedItem) {
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
    status: root.querySelector('[data-twin-status]'),
    verification: root.querySelector('[data-twin-turnstile]'),
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
  let profileReady = false;
  let turnstileToken = '';
  let sessionToken = '';
  let turnstileWidgetId = null;
  let activeRequest = null;
  let activeController = null;
  let activeAnswer = null;
  let history = [];
  let lastRecordIds = [];

  function setStatus(message, state = 'idle') {
    elements.status.textContent = message;
    elements.status.dataset.state = state;
  }

  function setComposerEnabled(enabled) {
    elements.input.disabled = !enabled;
    elements.send.disabled = !enabled;
  }

  function isReady() {
    return profileReady && Boolean(sessionToken || turnstileToken);
  }

  function showReadyState() {
    if (activeRequest) return;
    setComposerEnabled(isReady());
    if (!profileReady) {
      setStatus('Loading experience profile...', 'loading');
    } else if (!sessionToken && !turnstileToken) {
      setStatus('Complete the quick human check to chat.', 'loading');
    } else {
      setStatus('AI ready · Cloudflare hosted.', 'ready');
    }
  }

  function resetVerification() {
    sessionToken = '';
    turnstileToken = '';
    root.dataset.verified = 'false';
    elements.verification.hidden = false;
    setComposerEnabled(false);
    if (turnstileWidgetId !== null && window.turnstile) {
      window.turnstile.reset(turnstileWidgetId);
    }
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
      (isReady() ? elements.input : elements.verification).focus?.();
    });
  }

  function closePanel() {
    elements.panel.hidden = true;
    elements.launcher.setAttribute('aria-expanded', 'false');
    elements.launcher.focus();
  }

  function finishGeneration(cancelled = false) {
    elements.cancel.hidden = true;
    elements.send.hidden = false;
    clearThinkingState();
    if (cancelled && activeAnswer && !activeAnswer.textContent.trim()) activeAnswer.textContent = 'Response stopped.';
    activeRequest = null;
    activeController = null;
    activeAnswer = null;
    if (profileReady && !sessionToken && !turnstileToken) resetVerification();
    else showReadyState();
  }

  function consumeEvent(eventText, onToken) {
    const data = eventText
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    if (!data || data === '[DONE]') return;
    try {
      const message = JSON.parse(data);
      const token = message.response || message.delta?.content || message.choices?.[0]?.delta?.content || '';
      if (token) onToken(token);
    } catch {
      // Ignore non-JSON keepalive events from the upstream model stream.
    }
  }

  async function generateAnswer(payload, signal, onToken, onSession) {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      const error = new Error(errorBody?.error || `AI service returned ${response.status}`);
      error.status = response.status;
      throw error;
    }
    const issuedSessionToken = response.headers.get('X-Digital-Twin-Session');
    if (issuedSessionToken) onSession(issuedSessionToken);
    if (!response.body) throw new Error('AI service returned no response stream');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let answer = '';
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || '';
      for (const eventText of events) {
        consumeEvent(eventText, (token) => {
          answer += token;
          onToken(token);
        });
      }
      if (done) break;
    }
    if (buffer) consumeEvent(buffer, (token) => {
      answer += token;
      onToken(token);
    });
    return answer;
  }

  function addImmediateReply(answer) {
    const response = createMessage(elements.messages, 'assistant');
    renderAnswer(response, answer);
    history.push({ role: 'assistant', content: answer });
    history = history.slice(-MAX_HISTORY_MESSAGES);
  }

  async function submitQuestion(question) {
    const evaluation = evaluateQuestion(question, records, lastRecordIds);
    if (evaluation.action === 'ignore') return;

    createMessage(elements.messages, 'user', question);
    elements.input.value = '';
    elements.input.style.height = 'auto';
    elements.suggestions.hidden = true;
    history.push({ role: 'user', content: question });
    history = history.slice(-MAX_HISTORY_MESSAGES);

    if (evaluation.action === 'reply') {
      lastRecordIds = [];
      addImmediateReply(evaluation.answer);
      return;
    }

    lastRecordIds = evaluation.recordIds;

    activeRequest = crypto.randomUUID();
    const requestId = activeRequest;
    activeController = new AbortController();
    activeAnswer = createMessage(elements.messages, 'assistant');
    activeAnswer.classList.add('digital-twin__thinking');
    activeAnswer.setAttribute('aria-label', 'Thai AI is thinking');
    activeAnswer.textContent = '...';
    elements.send.hidden = true;
    elements.cancel.hidden = false;
    setComposerEnabled(false);
    setStatus('Thai AI is answering through Cloudflare.', 'loading');
    const verificationToken = turnstileToken;
    turnstileToken = '';

    try {
      const answer = await generateAnswer({
        question,
        recordIds: evaluation.recordIds,
        turnstileToken: sessionToken ? '' : verificationToken,
        sessionToken,
        history: history.slice(0, -1),
      }, activeController.signal, (token) => {
        if (activeRequest !== requestId || !activeAnswer) return;
        clearThinkingState();
        activeAnswer.textContent += token;
        elements.messages.scrollTop = elements.messages.scrollHeight;
      }, (token) => {
        sessionToken = token;
        root.dataset.verified = 'true';
        elements.verification.hidden = true;
      });
      if (activeRequest !== requestId) return;
      clearThinkingState();
      const finalAnswer = finalizeResponse(answer) || UNKNOWN;
      if (activeAnswer) renderAnswer(activeAnswer, finalAnswer);
      history.push({ role: 'assistant', content: finalAnswer });
      history = history.slice(-MAX_HISTORY_MESSAGES);
      finishGeneration();
    } catch (error) {
      if (activeRequest !== requestId) return;
      if (error.name === 'AbortError') {
        finishGeneration(true);
        return;
      }
      console.error('Professional AI Assistant request failed.');
      if (error.status === 403) sessionToken = '';
      clearThinkingState();
      if (activeAnswer) activeAnswer.textContent = error.message || 'I could not finish that response. Please try again.';
      finishGeneration();
    }
  }

  elements.launcher.addEventListener('click', () => {
    if (elements.panel.hidden) openPanel();
    else closePanel();
  });
  elements.close.addEventListener('click', closePanel);
  elements.cancel.addEventListener('click', () => {
    if (activeController) activeController.abort();
  });
  elements.clear.addEventListener('click', () => {
    const wasGenerating = Boolean(activeRequest);
    if (activeController) activeController.abort();
    history = [];
    lastRecordIds = [];
    elements.messages.replaceChildren();
    elements.suggestions.hidden = false;
    if (wasGenerating) {
      finishGeneration(true);
    } else {
      setComposerEnabled(isReady());
      if (isReady()) elements.input.focus();
    }
  });
  elements.form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!isReady() || activeRequest) return;
    submitQuestion(elements.input.value);
  });
  elements.input.addEventListener('input', () => {
    elements.input.style.height = 'auto';
    elements.input.style.height = `${Math.min(elements.input.scrollHeight, 120)}px`;
  });
  elements.input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    if (!isReady() || activeRequest) return;
    submitQuestion(elements.input.value);
  });
  for (const button of elements.suggestionButtons) {
    button.addEventListener('click', () => {
      const question = button.textContent.trim();
      if (isReady() && !activeRequest) {
        submitQuestion(question);
        return;
      }
      elements.input.value = question;
      showReadyState();
    });
  }
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !elements.panel.hidden) closePanel();
  });

  const profilePromise = (async () => {
    const dataUrl = new URL('../assets/data/experience.json', import.meta.url);
    const response = await fetch(dataUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Unable to load experience data (${response.status})`);
    records = buildKnowledgeRecords(await response.json());
    profileReady = true;
    root.dataset.modelReady = 'true';
    showReadyState();
  })();

  const verificationPromise = loadTurnstile().then((turnstile) => {
    turnstileWidgetId = turnstile.render(elements.verification, {
      sitekey: TURNSTILE_SITE_KEY,
      action: TURNSTILE_ACTION,
      theme: 'dark',
      size: 'flexible',
      callback(token) {
        turnstileToken = token;
        root.dataset.verified = 'true';
        elements.verification.hidden = true;
        showReadyState();
      },
      'expired-callback'() {
        turnstileToken = '';
        if (sessionToken) return;
        root.dataset.verified = 'false';
        elements.verification.hidden = false;
        showReadyState();
      },
      'error-callback'() {
        turnstileToken = '';
        if (sessionToken) return;
        root.dataset.verified = 'false';
        elements.verification.hidden = false;
        setComposerEnabled(false);
        setStatus('Human verification could not load. Please refresh and try again.', 'error');
      },
    });
  });

  try {
    await Promise.all([profilePromise, verificationPromise]);
  } catch (error) {
    console.error(error);
    setComposerEnabled(false);
    setStatus('Chat setup could not finish. Please refresh the page.', 'error');
  }
}
