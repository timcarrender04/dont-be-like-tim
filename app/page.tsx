"use client";

import { useState } from "react";
import Image from "next/image";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Spinner } from "@heroui/spinner";

import { title, subtitle } from "../components/primitives";

type Finding = {
  path?: string;
  check_id?: string;
  extra?: { message?: string; severity?: string };
};

type ScanResult = {
  path: string;
  stdout: string;
  findings: { results?: Finding[] };
};

export default function Home() {
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [needToken, setNeedToken] = useState(false);

  async function handleScan(withToken = false) {
    const url = repoUrl.trim();

    if (!url) {
      setError("Please enter a GitHub repo URL.");
      return;
    }
    setError(null);
    setResult(null);
    setNeedToken(false);
    setLoading(true);
    try {
      const body: { repo_url: string; github_token?: string; ref?: string } = {
        repo_url: url,
      };
      if (withToken && githubToken.trim()) body.github_token = githubToken.trim();
      if (branch.trim()) body.ref = branch.trim();

      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(
          typeof data?.detail === "string" ? data.detail : "Scan failed.",
        );
        return;
      }

      if (data.need_github_token === true) {
        setNeedToken(true);
        setError(
          typeof data?.detail === "string"
            ? data.detail
            : "This repo is private. Paste a GitHub token to scan it.",
        );
        return;
      }

      setResult(data as ScanResult);
    } catch {
      setError("Request failed. Is the scan API running?");
    } finally {
      setLoading(false);
    }
  }

  const results = result?.findings?.results ?? [];
  const hasResults = Array.isArray(results) && results.length > 0;

  return (
    <section className="flex flex-col items-center gap-8 py-8 md:py-10">
      {/* Hero banner */}
      <div className="w-full max-w-3xl overflow-hidden rounded-lg border border-default-200 bg-default-100">
        <Image
          priority
          alt="Don't be like Tim"
          className="w-full h-auto object-contain"
          height={630}
          src="/image.png"
          width={1200}
        />
      </div>

      <div className="inline-block max-w-2xl text-center">
        <span className={title()}>Don't&nbsp;</span>
        <span className={title({ color: "violet" })}>be like Tim</span>
        <span className={title()}>.</span>
        <div className={subtitle({ class: "mt-4" })}>
          Paste a GitHub repo URL (public or private) and we&apos;ll run a
          vulnerability scan with Semgrep. No code is stored — scan and stay
          smart.
        </div>
      </div>

      {/* URL input + Scan */}
      <div className="flex flex-col gap-3 w-full max-w-xl">
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            aria-label="GitHub repository URL"
            classNames={{ input: "text-sm" }}
            isDisabled={loading}
            placeholder="https://github.com/owner/repo"
            size="lg"
            type="url"
            value={repoUrl}
            onValueChange={setRepoUrl}
          />
          <Button
            color="primary"
            isDisabled={loading}
            isLoading={loading}
            size="lg"
            onPress={() => handleScan(false)}
          >
            {loading ? "Scanning…" : "Scan"}
          </Button>
        </div>
        <Input
          aria-label="Branch or ref (optional)"
          classNames={{ input: "text-sm" }}
          description="Leave empty for default branch. Use branch name (e.g. develop) to scan where your fix is."
          isDisabled={loading}
          placeholder="Branch (optional), e.g. develop"
          size="md"
          value={branch}
          onValueChange={setBranch}
        />
      </div>

      {/* Privacy disclaimer */}
      <p className="text-sm text-default-500 text-center max-w-xl">
        We do not store any of your code. Keep your repo private.
      </p>

      {/* Error */}
      {error && (
        <Card className="w-full max-w-xl border-danger-200 bg-danger-50 dark:bg-danger-950/20">
          <CardBody className="flex flex-col gap-3">
            <p className="text-danger-700 dark:text-danger-400">{error}</p>
            {needToken && (
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  aria-label="GitHub token for private repo"
                  classNames={{ input: "text-sm" }}
                  isDisabled={loading}
                  placeholder="ghp_… (token with repo access)"
                  size="md"
                  type="password"
                  value={githubToken}
                  onValueChange={setGithubToken}
                />
                <Button
                  color="primary"
                  isDisabled={loading || !githubToken.trim()}
                  size="md"
                  onPress={() => handleScan(true)}
                >
                  Scan with token
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Results */}
      {result && !error && (
        <Card className="w-full max-w-4xl">
          <CardHeader className="flex flex-col items-start gap-1">
            <h2 className="text-lg font-semibold">
              {hasResults
                ? `${results.length} finding${results.length === 1 ? "" : "s"}`
                : "No issues found"}
            </h2>
            <p className="text-small text-default-500">
              Scanned: {result.path}
            </p>
          </CardHeader>
          <CardBody className="pt-0">
            {hasResults ? (
              <ul className="space-y-4">
                {results.map((f, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-default-200 p-3 text-left"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-small">
                      {f.path != null && (
                        <code className="bg-default-100 px-1.5 py-0.5 rounded">
                          {f.path}
                        </code>
                      )}
                      {f.extra?.severity != null && (
                        <span
                          className={
                            f.extra.severity === "ERROR"
                              ? "text-danger-600"
                              : "text-warning-600"
                          }
                        >
                          {f.extra.severity}
                        </span>
                      )}
                      {f.check_id != null && (
                        <span className="text-default-500">{f.check_id}</span>
                      )}
                    </div>
                    {f.extra?.message != null && (
                      <p className="mt-2 text-default-700">{f.extra.message}</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-default-500">No vulnerabilities reported.</p>
            )}
          </CardBody>
        </Card>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-default-500">
          <Spinner size="sm" />
          <span>Cloning repo and running Semgrep…</span>
        </div>
      )}
    </section>
  );
}
