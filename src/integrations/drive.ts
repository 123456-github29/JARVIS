/**
 * Google Drive Integration
 */

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  createdTime: string;
}

export interface CreateFileOptions {
  name: string;
  content: string;
  folderId?: string;
  mimeType?: string;
}

export interface ListFilesOptions {
  folderId?: string;
  count?: number;
}

import type { TokenProvider } from "./google-auth.js";

export class DriveClient {
  private getToken: TokenProvider;

  constructor(getToken: TokenProvider) {
    this.getToken = getToken;
  }

  private async request(endpoint: string, method = "GET", body?: unknown, isUpload = false): Promise<any> {
    const base = isUpload
      ? "https://www.googleapis.com/upload/drive/v3"
      : "https://www.googleapis.com/drive/v3";

    const res = await fetch(`${base}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${await this.getToken()}`,
        "Content-Type": isUpload ? "text/plain" : "application/json",
      },
      body: body ? (isUpload ? String(body) : JSON.stringify(body)) : undefined,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Drive API error ${res.status}: ${err}`);
    }

    return res.json();
  }

  async createFile(opts: CreateFileOptions): Promise<DriveFile> {
    // Two-step multipart upload: metadata + content
    const metadata = {
      name: opts.name,
      mimeType: opts.mimeType ?? "text/plain",
      ...(opts.folderId ? { parents: [opts.folderId] } : {}),
    };

    const boundary = "boundary_jarvis_upload";
    const body = [
      `--${boundary}`,
      "Content-Type: application/json",
      "",
      JSON.stringify(metadata),
      `--${boundary}`,
      `Content-Type: ${opts.mimeType ?? "text/plain"}`,
      "",
      opts.content,
      `--${boundary}--`,
    ].join("\r\n");

    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,createdTime",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await this.getToken()}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Drive upload error ${res.status}: ${err}`);
    }

    return res.json() as Promise<DriveFile>;
  }

  async listFiles(opts: ListFilesOptions = {}): Promise<DriveFile[]> {
    const query = opts.folderId
      ? `'${opts.folderId}' in parents and trashed=false`
      : "trashed=false";

    const params = new URLSearchParams({
      q: query,
      pageSize: String(opts.count ?? 10),
      fields: "files(id,name,mimeType,webViewLink,createdTime)",
      orderBy: "modifiedTime desc",
    });

    const res = await this.request(`/files?${params}`);
    return res.files ?? [];
  }

  async readFile(fileId: string): Promise<string> {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: { Authorization: `Bearer ${await this.getToken()}` },
      }
    );

    if (!res.ok) {
      throw new Error(`Drive read error ${res.status}: ${await res.text()}`);
    }

    return res.text();
  }
}
