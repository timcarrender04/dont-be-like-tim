import { NextRequest, NextResponse } from "next/server";

const GITHUB_URL_RE =
  /^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i;

async function isPublicRepo(repoUrl: string): Promise<boolean> {
  const m = repoUrl.match(GITHUB_URL_RE);
  if (!m) return false;
  const [, owner, repo] = m;
  const res = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    { headers: { Accept: "application/vnd.github.v3+json" } },
  );
  if (!res.ok) return false;
  const json = await res.json().catch(() => ({}));
  return json.private === false;
}

export async function POST(request: NextRequest) {
  let body: { repo_url?: string; github_token?: string; ref?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }
  const repoUrl =
    typeof body?.repo_url === "string" ? body.repo_url.trim() : "";
  const ref =
    typeof body?.ref === "string" ? body.ref.trim() || undefined : undefined;
  const userToken =
    typeof body?.github_token === "string" ? body.github_token.trim() : "";
  const envToken =
    process.env.semprep_app_token || process.env.GITHUB_TOKEN || "";
  const token = userToken || envToken;

  if (!repoUrl) {
    return NextResponse.json(
      { detail: "repo_url is required" },
      { status: 400 },
    );
  }

  if (!GITHUB_URL_RE.test(repoUrl)) {
    return NextResponse.json(
      { detail: "Not a valid GitHub URL (e.g. https://github.com/owner/repo)" },
      { status: 400 },
    );
  }

  const baseUrl =
    process.env.semprep_url ||
    process.env.SEMGREP_API_URL ||
    "http://localhost:8000";

  try {
    const isPublic = await isPublicRepo(repoUrl);

    if (isPublic) {
      const apiBody: { repo_url: string; ref?: string } = { repo_url: repoUrl };
      if (ref) apiBody.ref = ref;
      const res = await fetch(
        `${baseUrl.replace(/\/$/, "")}/scan/github`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(apiBody),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail =
          typeof data?.detail === "string" ? data.detail : "Scan request failed";
        return NextResponse.json({ detail }, { status: res.status });
      }
      return NextResponse.json(data);
    }

    if (!token) {
      return NextResponse.json(
        {
          need_github_token: true,
          detail:
            "This repo is private. Paste a GitHub token with repo access to scan it.",
        },
        { status: 200 },
      );
    }

    const apiBody: { repo_url: string; github_token: string; ref?: string } = {
      repo_url: repoUrl,
      github_token: token,
    };
    if (ref) apiBody.ref = ref;
    const res = await fetch(
      `${baseUrl.replace(/\/$/, "")}/scan/github`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiBody),
      },
    );
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const detail =
        typeof data?.detail === "string" ? data.detail : "Scan request failed";
      return NextResponse.json({ detail }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}
