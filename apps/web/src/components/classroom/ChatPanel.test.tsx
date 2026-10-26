import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import enMessages from '../../messages/en.json';
import viMessages from '../../messages/vi.json';
import { ChatPanel } from './ChatPanel';
import { ChatError } from '../../lib/classroom/chat-client';

/**
 * FR-012 / ADR-036 (amended): the in-class chat panel.
 *
 * The behaviours this suite protects are the ones a naive implementation gets wrong:
 *
 * 1. **A refused send keeps the draft.** The window can close mid-sentence; losing the
 *    text is the worst possible response to a routine refusal.
 * 2. **History stays visible when sending is refused.** ADR-036 decision 3 separates
 *    reading from writing; a panel that blanks the thread on a 403 reverses it.
 * 3. **Own messages are attributed from the session.** "You" must be a fact, not a guess.
 * 4. **An empty draft never reaches the network.**
 */

const loadMessages = vi.fn();
const sendMessage = vi.fn();

vi.mock('../../lib/classroom/chat-client', async () => {
  const actual = await vi.importActual<typeof import('../../lib/classroom/chat-client')>(
    '../../lib/classroom/chat-client',
  );
  return {
    ...actual,
    loadMessages: (...args: unknown[]) => loadMessages(...args),
    sendMessage: (...args: unknown[]) => sendMessage(...args),
  };
});

const getStoredUser = vi.fn();
vi.mock('../../lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api-client')>('../../lib/api-client');
  return { ...actual, getStoredUser: () => getStoredUser() };
});

const BOOKING_ID = '7c1e0000-0000-4000-8000-0000000000bb';
const CLASS_ID = '7c1e0000-0000-4000-8000-0000000000aa';
const LEARNER = '7c1e0000-0000-4000-8000-0000000000cc';
const TEACHER = '7c1e0000-0000-4000-8000-0000000000dd';

function message(overrides: Record<string, unknown> = {}) {
  return {
    id: '7c1e0000-0000-4000-8000-000000000011',
    classId: CLASS_ID,
    bookingId: BOOKING_ID,
    senderId: TEACHER,
    senderRole: 'teacher' as const,
    body: 'Bài 3, trang 45',
    createdAt: '2026-10-26T10:00:00.000Z',
    ...overrides,
  };
}

function page(items: unknown[], overrides: Record<string, unknown> = {}) {
  return { items, page: { limit: 50, nextCursor: null, total: items.length, ...overrides } };
}

function renderPanel(locale: 'en' | 'vi' = 'en') {
  const messages = locale === 'en' ? enMessages : viMessages;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Ho_Chi_Minh">
      <ChatPanel bookingId={BOOKING_ID} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  getStoredUser.mockReturnValue({ id: LEARNER, displayName: 'Minh' });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ChatPanel (FR-012)', () => {
  it('renders the conversation in order, attributing each message to its author', async () => {
    loadMessages.mockResolvedValue(
      page([
        message({ id: 'a', senderId: LEARNER, senderRole: 'learner', body: 'Em chào thầy' }),
        message({ id: 'b', senderId: TEACHER, senderRole: 'teacher', body: 'Chào em' }),
      ]),
    );

    renderPanel();

    expect(await screen.findByText('Em chào thầy')).toBeDefined();
    expect(screen.getByText('Chào em')).toBeDefined();
    // Own message says "You"; the teacher's says "Teacher". Never the same label.
    expect(screen.getByText('You')).toBeDefined();
    expect(screen.getByText('Teacher')).toBeDefined();
  });

  it('shows an empty state rather than a blank box when there are no messages', async () => {
    loadMessages.mockResolvedValue(page([]));

    renderPanel();

    expect(await screen.findByText(/No messages yet/)).toBeDefined();
  });

  it('never reaches the network for an empty draft', async () => {
    loadMessages.mockResolvedValue(page([]));
    renderPanel();
    await screen.findByText(/No messages yet/);

    const send = screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement;
    // Disabled, so the click cannot even start a request. The handler also refuses, because a
    // keyboard form submit can reach it without the button.
    expect(send.disabled).toBe(true);
    fireEvent.submit(send.closest('form') as HTMLFormElement);

    await screen.findByRole('alert');
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('sends the trimmed body and appends the stored message', async () => {
    loadMessages.mockResolvedValue(page([]));
    sendMessage.mockResolvedValue(
      message({ id: 'new', senderId: LEARNER, senderRole: 'learner', body: 'Thầy ơi' }),
    );

    renderPanel();
    await screen.findByText(/No messages yet/);

    fireEvent.change(screen.getByLabelText('Message to send'), {
      target: { value: '  Thầy ơi  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('Thầy ơi')).toBeDefined();
    expect(sendMessage).toHaveBeenCalledWith(BOOKING_ID, 'Thầy ơi');
    // The composer is cleared only on success.
    expect((screen.getByLabelText('Message to send') as HTMLTextAreaElement).value).toBe('');
  });

  it('keeps the draft when the window closed while the message was being sent', async () => {
    loadMessages.mockResolvedValue(page([message({ body: 'tin nhắn cũ' })]));
    sendMessage.mockRejectedValue(new ChatError('CHAT_WINDOW_CLOSED', 403));

    renderPanel();
    await screen.findByText('tin nhắn cũ');

    fireEvent.change(screen.getByLabelText('Message to send'), {
      target: { value: 'câu trả lời dở dang' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('still in the box');
    // The draft survives a refusal: that is the whole point.
    expect((screen.getByLabelText('Message to send') as HTMLTextAreaElement).value).toBe(
      'câu trả lời dở dang',
    );
    // And the history is untouched: reading is not windowed (ADR-036 decision 3).
    expect(screen.getByText('tin nhắn cũ')).toBeDefined();
  });

  it('explains a closed chat when the thread itself is not readable', async () => {
    loadMessages.mockRejectedValue(new ChatError('CHAT_WINDOW_CLOSED', 403));

    renderPanel();

    expect(await screen.findByText('Chat is not available')).toBeDefined();
    expect(screen.getByText(/opens 15 minutes before/)).toBeDefined();
  });

  it('says a stranger is not a party, without offering a composer', async () => {
    loadMessages.mockRejectedValue(new ChatError('CHAT_NOT_A_PARTY', 403));

    renderPanel();

    expect(await screen.findByText(/not part of this booking/)).toBeDefined();
    expect(screen.queryByLabelText('Message to send')).toBeNull();
  });

  it('loads earlier messages through the cursor without losing the current page', async () => {
    loadMessages
      .mockResolvedValueOnce(page([message({ id: 'b', body: 'mới hơn' })], { nextCursor: 'cur' }))
      .mockResolvedValueOnce(page([message({ id: 'a', body: 'cũ hơn' })]));

    renderPanel();
    await screen.findByText('mới hơn');

    fireEvent.click(screen.getByRole('button', { name: 'Load earlier messages' }));

    expect(await screen.findByText('cũ hơn')).toBeDefined();
    // Appended, not replaced.
    expect(screen.getByText('mới hơn')).toBeDefined();
    expect(loadMessages).toHaveBeenLastCalledWith(BOOKING_ID, { limit: 50, cursor: 'cur' });
  });

  it('renders in Vietnamese without leaking English', async () => {
    loadMessages.mockResolvedValue(page([message({ senderRole: 'teacher' })]));

    renderPanel('vi');

    expect(await screen.findByText('Trò chuyện lớp học')).toBeDefined();
    expect(screen.getByText('Giảng viên')).toBeDefined();
    expect(screen.getByText('Gửi')).toBeDefined();
    expect(screen.queryByText('Send')).toBeNull();
  });
});
