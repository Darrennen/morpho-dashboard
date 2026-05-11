"use client";

import { useState } from "react";

export interface AppSettings {
  slackWebhook: string;
  hfWarning: number;
  hfDanger: number;
  refreshSecs: number;
  alertCooldownMins: number;
}

interface Props {
  settings: AppSettings;
  onSave: (s: AppSettings) => void;
  onClose: () => void;
}

export const DEFAULT_SETTINGS: AppSettings = {
  slackWebhook: "",
  hfWarning: 1.5,
  hfDanger: 1.2,
  refreshSecs: 60,
  alertCooldownMins: 60,
};

export default function Settings({ settings, onSave, onClose }: Props) {
  const [form, setForm] = useState<AppSettings>({ ...settings });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  function set<K extends keyof AppSettings>(key: K, val: AppSettings[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function testSlack() {
    setTesting(true);
    setTestResult(null);
    const res = await fetch("/api/slack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        webhook: form.slackWebhook,
        text: "Morpho Dashboard: Slack alerts are working!",
      }),
    });
    setTestResult(res.ok ? "Sent successfully!" : "Failed — check webhook URL");
    setTesting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-md bg-gray-900 border-l border-morpho-border flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-morpho-border">
          <h2 className="text-white font-semibold text-lg">Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        <div className="p-5 space-y-6 flex-1">
          {/* Slack */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Slack Alerts</h3>
            <div>
              <label className="text-sm text-gray-300 mb-1 block">Webhook URL</label>
              <input
                type="text"
                value={form.slackWebhook}
                onChange={(e) => set("slackWebhook", e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={testSlack}
              disabled={testing || !form.slackWebhook}
              className="text-sm bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white px-4 py-1.5 rounded-lg disabled:opacity-40 transition-colors"
            >
              {testing ? "Sending…" : "Test Slack"}
            </button>
            {testResult && (
              <p className={`text-sm ${testResult.includes("success") ? "text-emerald-400" : "text-red-400"}`}>
                {testResult}
              </p>
            )}
          </section>

          {/* Alert thresholds */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Alert Thresholds</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-300 mb-1 block">HF Warning</label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  value={form.hfWarning}
                  onChange={(e) => set("hfWarning", parseFloat(e.target.value))}
                  className="w-full bg-gray-800 border border-yellow-800 rounded-lg px-3 py-2 text-sm text-yellow-300 focus:outline-none focus:border-yellow-500"
                />
              </div>
              <div>
                <label className="text-sm text-gray-300 mb-1 block">HF Danger</label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  value={form.hfDanger}
                  onChange={(e) => set("hfDanger", parseFloat(e.target.value))}
                  className="w-full bg-gray-800 border border-red-800 rounded-lg px-3 py-2 text-sm text-red-400 focus:outline-none focus:border-red-500"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Alert fires when health factor falls below these values.
            </p>
          </section>

          {/* Refresh & cooldown */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Refresh</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-300 mb-1 block">Interval (secs)</label>
                <input
                  type="number"
                  step="10"
                  min="10"
                  value={form.refreshSecs}
                  onChange={(e) => set("refreshSecs", parseInt(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-sm text-gray-300 mb-1 block">Alert cooldown (mins)</label>
                <input
                  type="number"
                  step="5"
                  min="1"
                  value={form.alertCooldownMins}
                  onChange={(e) => set("alertCooldownMins", parseInt(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </section>
        </div>

        <div className="p-5 border-t border-morpho-border">
          <button
            onClick={() => onSave(form)}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-xl transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
