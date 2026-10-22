"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProviderOption = {
  id: string;
  name: string;
  placeholder: string;
};

const PROVIDERS: ProviderOption[] = [
  { id: "openai", name: "OpenAI (GPT-4o, o3-mini)", placeholder: "sk-..." },
  { id: "gemini", name: "Google Gemini (Gemini 2.5 Flash / Pro)", placeholder: "AIzaSy..." },
  { id: "anthropic", name: "Anthropic (Claude 3.5 Sonnet / Haiku)", placeholder: "sk-ant-..." },
  { id: "groq", name: "Groq (Llama 3.3 70B)", placeholder: "gsk_..." },
  { id: "openrouter", name: "OpenRouter", placeholder: "sk-or-..." },
  { id: "qwen", name: "Qwen / DashScope", placeholder: "sk-..." },
];

export function AiKeySettings() {
  const [provider, setProvider] = useState<string>("openai");
  const [apiKey, setApiKey] = useState<string>("");
  const [showKey, setShowKey] = useState<boolean>(false);
  const [hasCustomKey, setHasCustomKey] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    async function loadStatus() {
      try {
        const res = await fetch("/api/settings/ai-key");
        if (res.ok) {
          const body = await res.json();
          if (body.ok && body.data) {
            setProvider(body.data.provider || "openai");
            setHasCustomKey(Boolean(body.data.hasCustomKey));
          }
        }
      } catch {
        // Silently fallback to default
      } finally {
        setLoading(false);
      }
    }
    loadStatus();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey.trim()) {
      setMessage({ text: "Please enter your API key.", error: true });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/settings/ai-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          provider,
          apiKey: apiKey.trim(),
        }),
      });

      const body = await res.json();
      if (!res.ok || !body.ok) {
        setMessage({ text: body.error?.message || "Failed to save API key.", error: true });
      } else {
        setHasCustomKey(true);
        setApiKey("");
        setMessage({ text: `Custom API key saved! CodeWiz will use your ${provider} key for drills and quizzes.` });
      }
    } catch {
      setMessage({ text: "Network error saving API key.", error: true });
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/settings/ai-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear" }),
      });

      const body = await res.json();
      if (res.ok && body.ok) {
        setHasCustomKey(false);
        setApiKey("");
        setMessage({ text: "Reset to server default keys." });
      }
    } catch {
      setMessage({ text: "Network error clearing API key.", error: true });
    } finally {
      setSaving(false);
    }
  }

  const selectedProviderMeta = PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0];

  return (
    <Card className="border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Plug In Your Own AI Key</CardTitle>
            <CardDescription className="mt-1 text-sm text-muted-foreground">
              Bring your own API key to bypass server daily limits or test with your preferred AI provider.
            </CardDescription>
          </div>
          <div>
            {loading ? (
              <span className="text-xs text-muted-foreground">Checking...</span>
            ) : hasCustomKey ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-500 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Custom Key Active ({provider})
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground border">
                Using Server Default Keys
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="provider-select">AI Provider</Label>
              <select
                id="provider-select"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="api-key-input">API Key</Label>
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {showKey ? "Hide" : "Show"}
                </button>
              </div>
              <Input
                id="api-key-input"
                type={showKey ? "text" : "password"}
                placeholder={hasCustomKey ? "••••••••••••••••" : selectedProviderMeta.placeholder}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>

          {message && (
            <p
              className={`text-xs ${
                message.error ? "text-destructive" : "text-emerald-500 font-medium"
              }`}
            >
              {message.text}
            </p>
          )}

          <div className="flex items-center justify-between pt-2">
            <p className="text-[11px] text-muted-foreground max-w-sm">
              Stored securely in an encrypted HTTP-only session cookie. Never committed to database or shared.
            </p>
            <div className="flex items-center gap-2">
              {hasCustomKey && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClear}
                  disabled={saving}
                >
                  Clear Key
                </Button>
              )}
              <Button type="submit" size="sm" disabled={saving || !apiKey.trim()}>
                {saving ? "Saving..." : "Save Key"}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
