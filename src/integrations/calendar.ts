/**
 * Google Calendar Integration
 */

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  description?: string;
  htmlLink: string;
}

export interface CreateEventOptions {
  title: string;
  start: string;
  end: string;
  description?: string;
  attendees?: string[];
}

export interface GetEventsOptions {
  daysAhead?: number;
}

import type { TokenProvider } from "./google-auth.js";

export class CalendarClient {
  private getToken: TokenProvider;

  constructor(getToken: TokenProvider) {
    this.getToken = getToken;
  }

  private async request(endpoint: string, method = "GET", body?: unknown): Promise<any> {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3${endpoint}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${await this.getToken()}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Calendar API error ${res.status}: ${err}`);
    }

    return res.json();
  }

  async createEvent(opts: CreateEventOptions): Promise<CalendarEvent> {
    const body = {
      summary: opts.title,
      description: opts.description,
      start: { dateTime: new Date(opts.start).toISOString(), timeZone: "America/Los_Angeles" },
      end: { dateTime: new Date(opts.end).toISOString(), timeZone: "America/Los_Angeles" },
      attendees: opts.attendees?.map((email) => ({ email })),
    };

    const res = await this.request("/calendars/primary/events", "POST", body);
    return {
      id: res.id,
      title: res.summary,
      start: res.start?.dateTime,
      end: res.end?.dateTime,
      description: res.description,
      htmlLink: res.htmlLink,
    };
  }

  async getEvents(opts: GetEventsOptions = {}): Promise<CalendarEvent[]> {
    const now = new Date();
    const future = new Date();
    future.setDate(now.getDate() + (opts.daysAhead ?? 7));

    const params = new URLSearchParams({
      timeMin: now.toISOString(),
      timeMax: future.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "20",
    });

    const res = await this.request(`/calendars/primary/events?${params}`);

    return (res.items ?? []).map((e: Record<string, unknown>) => ({
      id: e.id,
      title: e.summary,
      start: (e.start as Record<string, string>)?.dateTime ?? (e.start as Record<string, string>)?.date,
      end: (e.end as Record<string, string>)?.dateTime ?? (e.end as Record<string, string>)?.date,
      description: e.description,
      htmlLink: e.htmlLink,
    }));
  }
}
