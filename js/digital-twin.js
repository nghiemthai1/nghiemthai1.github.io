import { finalizeResponse } from './digital-twin-response.js?v=20260904-3';

const MAX_HISTORY_MESSAGES = 8;
const MAX_QUESTION_LENGTH = 500;
const API_ENDPOINT = 'https://thai-digital-twin-api.nghiemthai1.workers.dev/chat';
const TURNSTILE_SITE_KEY = '0x4AAAAAAEmC_OLXbTSMNe92';
const TURNSTILE_ACTION = 'digital_twin_chat';
const UNKNOWN = 'That detail is not included in my public experience profile.';
export function evaluateQuestion(question) {
  const trimmed = question.trim();
  if (!trimmed) return { action: 'ignore' };
  if (trimmed.length > MAX_QUESTION_LENGTH) {
    return { action: 'reply', answer: 'Please shorten your question to 500 characters or fewer.' };
  }
  return { action: 'generate' };
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

  let turnstileToken = '';
  let sessionToken = '';
  let turnstileWidgetId = null;
  let activeRequest = null;
  let activeController = null;
  let activeAnswer = null;
  let history = [];

  function setStatus(message, state = 'idle') {
    elements.status.textContent = message;
    elements.status.dataset.state = state;
  }

  function setComposerEnabled(enabled) {
    elements.input.disabled = !enabled;
    elements.send.disabled = !enabled;
  }

  function isReady() {
    return Boolean(sessionToken || turnstileToken);
  }

  function showReadyState() {
    if (activeRequest) return;
    setComposerEnabled(isReady());
    if (!sessionToken && !turnstileToken) {
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
    if (!sessionToken && !turnstileToken) resetVerification();
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
    const evaluation = evaluateQuestion(question);
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
      console.error('Digital twin request failed.');
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

  root.dataset.modelReady = 'true';
  showReadyState();

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
    await verificationPromise;
  } catch (error) {
    console.error(error);
    setComposerEnabled(false);
    setStatus('Chat setup could not finish. Please refresh the page.', 'error');
  }
}
