/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import {
  Check,
  Copy,
  Download,
  FileCode,
  Terminal,
  ShieldCheck,
  Database,
  Webhook,
  Play,
  Server,
} from "lucide-react";
import workerEntry from "./index";

const WRANGLER_TOML_CONTENT = `name = "zenox-worker-bot"
main = "src/index.ts"
compatibility_date = "2026-11-04"
compatibility_flags = ["nodejs_compat"]

[[kv_namespaces]]
binding = "DB"
id = "YOUR_KV_NAMESPACE_ID_HERE"

[vars]
BOT_USERNAME = "ZenoxWorkerBot"`;

const PACKAGE_JSON_WORKER = `{
  "name": "zenox-worker-bot",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "deploy": "wrangler deploy",
    "dev": "wrangler dev"
  },
  "dependencies": {
    "grammy": "^1.35.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20250214.0",
    "typescript": "^5.7.0",
    "wrangler": "^3.109.0"
  }
}`;

export default function App() {
  const [activeFile, setActiveFile] = useState<"wrangler.toml" | "package.json">(
    "wrangler.toml"
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [healthOutput, setHealthOutput] = useState<string | null>(null);
  const [kvIdInput, setKvIdInput] = useState("YOUR_KV_NAMESPACE_ID_HERE");

  const resolvedWranglerToml = WRANGLER_TOML_CONTENT.replace(
    "YOUR_KV_NAMESPACE_ID_HERE",
    kvIdInput.trim() || "YOUR_KV_NAMESPACE_ID_HERE"
  );

  const copyToClipboard = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const testWorkerGetHealth = async () => {
    const req = new Request("https://zenox-worker-bot.workers.dev/", {
      method: "GET",
    });
    const res = await workerEntry.fetch(req, {
      BOT_USERNAME: "ZenoxWorkerBot",
    });
    const text = await res.text();
    setHealthOutput(text);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-white">
                Zenox Worker Bot — Cloudflare Workers Deployment
              </h1>
              <p className="text-xs text-slate-400">
                Pure ES Module Serverless Worker (`has_modules: true`) • grammY + Cloudflare KV (`env.DB`)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={testWorkerGetHealth}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              Test Worker `fetch()` Entrypoint
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Verification Checklist */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-medium text-white">
                Pure Worker Layout (`has_modules: true`)
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                No `[assets]` or `[site]` blocks in `wrangler.toml`. Exports default ES Module `{`{ async fetch(request, env, ctx) }`}` in `src/index.ts`.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-start gap-3">
            <Database className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-medium text-white">
                Cloudflare KV Binding (`env.DB`)
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Configured with `binding = &quot;DB&quot;` and automatic in-memory fallback if KV is unbound during local dry-runs.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-start gap-3">
            <Webhook className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-medium text-white">
                One-Click `/setWebhook` Route
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Visit `https://&lt;your-worker&gt;.workers.dev/setWebhook` in your browser after deployment to bind the Telegram webhook automatically.
              </p>
            </div>
          </div>
        </div>

        {healthOutput && (
          <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <div className="text-xs font-mono text-emerald-200">
                GET / Response from `src/index.ts` → {healthOutput}
              </div>
            </div>
            <button
              onClick={() => setHealthOutput(null)}
              className="text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Configuration & Code Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
              <h3 className="text-sm font-semibold text-white">
                KV Namespace ID Customizer
              </h3>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  Cloudflare KV `DB` Namespace ID
                </label>
                <input
                  type="text"
                  value={kvIdInput}
                  onChange={(e) => setKvIdInput(e.target.value)}
                  placeholder="e.g. a1b2c3d4e5f6..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 space-y-2">
                <div className="text-xs font-medium text-slate-300">
                  Quick CLI Deployment Steps
                </div>
                <ol className="text-xs text-slate-400 space-y-2 list-decimal list-inside">
                  <li>
                    Create KV namespace:{" "}
                    <code className="text-slate-200 bg-slate-950 px-1.5 py-0.5 rounded">
                      npx wrangler kv namespace create DB
                    </code>
                  </li>
                  <li>
                    Paste the returned `id` into `wrangler.toml`
                  </li>
                  <li>
                    Deploy Worker:{" "}
                    <code className="text-slate-200 bg-slate-950 px-1.5 py-0.5 rounded">
                      npx wrangler deploy
                    </code>
                  </li>
                  <li>
                    Open{" "}
                    <code className="text-emerald-400 bg-slate-950 px-1.5 py-0.5 rounded">
                      /setWebhook
                    </code>{" "}
                    on your Worker URL
                  </li>
                </ol>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-2 bg-slate-950/50">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveFile("wrangler.toml")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition cursor-pointer ${
                    activeFile === "wrangler.toml"
                      ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  wrangler.toml
                </button>
                <button
                  onClick={() => setActiveFile("package.json")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition cursor-pointer ${
                    activeFile === "package.json"
                      ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  package.json (Worker)
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    copyToClipboard(
                      activeFile === "wrangler.toml"
                        ? resolvedWranglerToml
                        : PACKAGE_JSON_WORKER,
                      activeFile
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                >
                  {copiedKey === activeFile ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy
                    </>
                  )}
                </button>
                <button
                  onClick={() =>
                    downloadFile(
                      activeFile,
                      activeFile === "wrangler.toml"
                        ? resolvedWranglerToml
                        : PACKAGE_JSON_WORKER
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
              </div>
            </div>

            <pre className="p-4 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed">
              {activeFile === "wrangler.toml"
                ? resolvedWranglerToml
                : PACKAGE_JSON_WORKER}
            </pre>
          </div>
        </div>
      </main>
    </div>
  );
}
