/**
 * Gmail Integration
 *
 * Wraps Gmail API calls. In production, plug in your OAuth2 tokens here.
 * This uses the Google APIs Node.js client.
 *
 * Setup: npm install googleapis
 * Auth: Users connect via Google OAuth (see src/setup/oauth.ts)
 */

export interface GmailDraft {
  id: string;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  snippet: string;
  date: string;
}

export interface GmailSendResult {
  id: string;
}

export interface CreateDraftOptions {
  to: string;
  subject: string;
  body: string;
  cc?: string;
}

export interface ListThreadsOptions {
  count?: number;
  query?: string;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  body: string;
}

export interface ReplyOptions {
  threadId: string;
  body: string;
}

export class GmailClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request(endpoint: string, method = "GET", body?: unknown) {
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gmail API error ${res.status}: ${err}`);
    }

    return res.json();
  }

  private encodeEmail(opts: { to: string; from?: string; subject: string; body: string; cc?: string; threadId?: string; messageId?: string }): string {
    const lines = [
      `To: ${opts.to}`,
      opts.cc ? `Cc: ${opts.cc}` : null,
      `Subject: ${opts.subject}`,
      `Content-Type: text/plain; charset=utf-8`,
      opts.threadId ? `In-Reply-To: ${opts.messageId}` : null,
      "",
      opts.body,
    ].filter(Boolean);

    return Buffer.from(lines.join("\r\n"))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  async createDraft(opts: CreateDraftOptions): Promise<GmailDraft> {
    const raw = this.encodeEmail(opts);
    const res = await this.request("/users/me/drafts", "POST", {
      message: { raw },
    });
    return { id: res.id };
  }

  async listThreads(opts: ListThreadsOptions = {}): Promise<GmailMessage[]> {
    const params = new URLSearchParams({
      maxResults: String(opts.count ?? 10),
      ...(opts.query ? { q: opts.query } : {}),
    });

    const list = await this.request(`/users/me/threads?${params}`);
    if (!list.threads) return [];

    // Fetch each thread's snippet
    const messages: GmailMessage[] = await Promise.all(
      list.threads.slice(0, opts.count ?? 10).map(async (t: { id: string }) => {
        const thread = await this.request(`/users/me/threads/${t.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`);
        const msg = thread.messages?.[0];
        const headers = msg?.payload?.headers ?? [];
        const get = (name: string) => headers.find((h: { name: string; value: string }) => h.name === name)?.value ?? "";
        return {
          id: msg?.id ?? t.id,
          threadId: t.id,
          subject: get("Subject"),
          from: get("From"),
          snippet: thread.snippet ?? "",
          date: get("Date"),
        };
      })
    );

    return messages;
  }

  async sendEmail(opts: SendEmailOptions): Promise<GmailSendResult> {
    const raw = this.encodeEmail(opts);
    const res = await this.request("/users/me/messages/send", "POST", { raw });
    return { id: res.id };
  }

  async replyToThread(opts: ReplyOptions): Promise<GmailSendResult> {
    // Fetch thread to get latest message info
    const thread = await this.request(`/users/me/threads/${opts.threadId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Message-ID`);
    const lastMsg = thread.messages?.[thread.messages.length - 1];
    const headers = lastMsg?.payload?.headers ?? [];
    const get = (name: string) => headers.find((h: { name: string; value: string }) => h.name === name)?.value ?? "";

    const raw = this.encodeEmail({
      to: get("From"),
      subject: `Re: ${get("Subject")}`,
      body: opts.body,
      threadId: opts.threadId,
      messageId: get("Message-ID"),
    });

    const res = await this.request("/users/me/messages/send", "POST", {
      raw,
      threadId: opts.threadId,
    });
    return { id: res.id };
  }
}
