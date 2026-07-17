/**
 * Google Docs Integration
 *
 * Handles template filling (find/replace) and doc creation.
 */

export interface DocsResult {
  id: string;
  title: string;
  url: string;
}

export interface FillTemplateOptions {
  templateId: string;
  fields: Record<string, string>;
  outputName: string;
}

export interface CreateDocOptions {
  title: string;
  content: string;
}

export class DocsClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async driveRequest(endpoint: string, method = "GET", body?: unknown) {
    const res = await fetch(`https://www.googleapis.com/drive/v3${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`Drive error ${res.status}: ${await res.text()}`);
    return res.json();
  }

  private async docsRequest(endpoint: string, method = "GET", body?: unknown) {
    const res = await fetch(`https://docs.googleapis.com/v1${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`Docs error ${res.status}: ${await res.text()}`);
    return res.json();
  }

  async fillTemplate(opts: FillTemplateOptions): Promise<DocsResult> {
    // Step 1: Copy the template to a new file
    const copy = await this.driveRequest(`/files/${opts.templateId}/copy`, "POST", {
      name: opts.outputName,
    });

    // Step 2: Replace all placeholder fields using batchUpdate
    const requests = Object.entries(opts.fields).map(([placeholder, replacement]) => ({
      replaceAllText: {
        containsText: { text: placeholder, matchCase: true },
        replaceText: replacement,
      },
    }));

    await this.docsRequest(`/documents/${copy.id}:batchUpdate`, "POST", { requests });

    return {
      id: copy.id,
      title: opts.outputName,
      url: `https://docs.google.com/document/d/${copy.id}/edit`,
    };
  }

  async createDoc(opts: CreateDocOptions): Promise<DocsResult> {
    // Create a blank doc
    const doc = await this.docsRequest("/documents", "POST", {
      title: opts.title,
    });

    // Insert content
    await this.docsRequest(`/documents/${doc.documentId}:batchUpdate`, "POST", {
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text: opts.content,
          },
        },
      ],
    });

    return {
      id: doc.documentId,
      title: opts.title,
      url: `https://docs.google.com/document/d/${doc.documentId}/edit`,
    };
  }
}
