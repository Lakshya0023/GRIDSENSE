"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MAX_HISTORY,
  PLANT_BROKER_URL,
  PLANT_TOPICS,
  type PlantAlert,
  type PlantCascadeEvent,
  type PlantFeedSource,
  type PlantHistoryPoint,
  type PlantPrediction,
  type PlantTelemetry,
} from "@/lib/plantTelemetry";

type PlantFeed = {
  source: PlantFeedSource;
  connected: boolean;
  latest: PlantTelemetry;
  prediction: PlantPrediction | null;
  history: PlantHistoryPoint[];
  alerts: PlantAlert[];
  cascadeEvents: PlantCascadeEvent[];
  messageCount: number;
  error: string | null;
};

const EMPTY: PlantFeed = {
  source: "offline",
  connected: false,
  latest: {},
  prediction: null,
  history: [],
  alerts: [],
  cascadeEvents: [],
  messageCount: 0,
  error: null,
};

function clockLabel(iso?: string): string {
  const date = iso ? new Date(iso) : new Date();
  const valid = Number.isFinite(date.getTime()) ? date : new Date();
  return valid.toLocaleTimeString("en-IN", { hour12: false });
}

/**
 * Live plant telemetry for the maintenance panel.
 *
 * Primary path is the same HiveMQ WebSocket subscription the standalone
 * dashboard.html used, so the browser sees sensor packets the instant they are
 * published. `mqtt` is imported dynamically because it is a browser-only
 * dependency and must not be pulled into the server render.
 *
 * If the broker cannot be reached (locked-down network, blocked WSS), the hook
 * falls back to polling the merged GridSense endpoints under /api/pdm, which are
 * fed by the server-side MQTT subscriber. Either way the panel reports which
 * source it is showing rather than pretending.
 */
export function usePlantTelemetry(pollMs = 2000): PlantFeed {
  const [feed, setFeed] = useState<PlantFeed>(EMPTY);
  const historyRef = useRef<PlantHistoryPoint[]>([]);
  const latestRef = useRef<PlantTelemetry>({});
  const mqttLiveRef = useRef(false);

  const pushTelemetry = useCallback(
    (payload: PlantTelemetry, source: PlantFeedSource) => {
      const point: PlantHistoryPoint = {
        label: clockLabel(payload.timestamp),
        temperature: Number(payload.temperature ?? 0),
        // Original dashboard plotted vibration x10 so it shares the sensor axis
        // with temperature. Kept so the curve reads the same.
        vibration: Number(payload.vibration ?? 0) * 10,
        health: Number(payload.health_score ?? 100),
      };
      historyRef.current = [...historyRef.current, point].slice(-MAX_HISTORY);
      latestRef.current = payload;

      setFeed((prev) => ({
        ...prev,
        source,
        connected: true,
        latest: payload,
        history: historyRef.current,
        messageCount: prev.messageCount + 1,
        error: null,
      }));
    },
    []
  );

  // ── MQTT over WebSocket ────────────────────────────────────────────────
  useEffect(() => {
    let client: { end: (force?: boolean) => void } | null = null;
    let cancelled = false;

    (async () => {
      try {
        // MQTT is an optional dependency; if the module is absent at runtime
        // the catch below falls back to HTTP polling. No suppression comment is
        // needed here: `mqtt` ships its own types, so the line type-checks, and
        // an expect-error directive would itself fail the build as unused.
        const mqtt: any = await import(/* webpackIgnore: true */ "mqtt").catch(() => null);
        if (!mqtt || cancelled) return;

        const clientId = `gridsense_ui_${Math.random().toString(36).slice(2, 8)}`;
        const c = mqtt.connect(PLANT_BROKER_URL, {
          clientId,
          clean: true,
          connectTimeout: 8000,
          reconnectPeriod: 5000,
        });
        client = c;

        c.on("connect", () => {
          if (cancelled) return;
          mqttLiveRef.current = true;
          PLANT_TOPICS.forEach((topic) => c.subscribe(topic, { qos: 1 }));
          setFeed((prev) => ({ ...prev, source: "mqtt", connected: true, error: null }));
        });

        c.on("message", (topic: string, raw: Uint8Array) => {
          if (cancelled) return;
          let payload: unknown;
          try {
            payload = JSON.parse(new TextDecoder().decode(raw));
          } catch {
            return; // a malformed packet must not break the stream
          }

          if (topic === "powerplant/telemetry/full") {
            pushTelemetry(payload as PlantTelemetry, "mqtt");
          } else if (topic === "powerplant/grid/cascade_event") {
            setFeed((prev) => ({
              ...prev,
              cascadeEvents: [...prev.cascadeEvents, payload as PlantCascadeEvent].slice(-50),
            }));
          } else if (topic.startsWith("powerplant/alerts/")) {
            const value = payload as Record<string, unknown>;
            if (typeof value?.level === "string") {
              setFeed((prev) => ({
                ...prev,
                alerts: [
                  ...prev.alerts,
                  {
                    timestamp: new Date().toISOString(),
                    level: String(value.level),
                    message: String(value.message ?? value.level),
                    rul_hours: typeof value.rul_hours === "number" ? value.rul_hours : null,
                  },
                ].slice(-50),
              }));
            }
          }
        });

        c.on("error", (err: Error) => {
          mqttLiveRef.current = false;
          setFeed((prev) => ({ ...prev, error: err.message }));
        });

        c.on("close", () => {
          mqttLiveRef.current = false;
        });
      } catch (err) {
        setFeed((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : "MQTT unavailable",
        }));
      }
    })();

    return () => {
      cancelled = true;
      try {
        client?.end(true);
      } catch {
        /* closing a socket that never opened is not an error worth surfacing */
      }
    };
  }, [pushTelemetry]);

  // ── Backend fallback ───────────────────────────────────────────────────
  useEffect(() => {
    let stopped = false;

    const poll = async () => {
      // The broker is authoritative when it is up; do not double-count packets.
      if (mqttLiveRef.current || stopped) return;
      try {
        const res = await fetch("/api/pdm/live");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (stopped) return;

        const sensors = (data?.sensors ?? {}) as PlantTelemetry;
        const prediction = (data?.prediction ?? null) as PlantPrediction | null;

        if (Object.keys(sensors).length > 0) {
          pushTelemetry(sensors, "api");
        }
        setFeed((prev) => ({
          ...prev,
          prediction: prediction ?? prev.prediction,
          source: prev.source === "mqtt" ? "mqtt" : "api",
        }));
      } catch {
        if (!stopped) setFeed((prev) => ({ ...prev, connected: prev.source === "mqtt" }));
      }
    };

    void poll();
    const id = window.setInterval(() => void poll(), pollMs);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [pollMs, pushTelemetry]);

  // ── Model output for the current reading ───────────────────────────────
  useEffect(() => {
    let stopped = false;
    const run = async () => {
      // Read through the ref: depending on feed.latest here would re-arm this
      // effect every time it stores its own result.
      const s = latestRef.current;
      if (!s || s.temperature === undefined) return;
      try {
        const params = new URLSearchParams({
          temperature: String(s.temperature ?? 75),
          vibration: String(s.vibration ?? 2.5),
          current: String(s.current ?? 140),
          resistance: String(s.resistance ?? 0.12),
          voltage_a: String(s.voltage_a ?? 10500),
          voltage_b: String(s.voltage_b ?? 10800),
          voltage_c: String(s.voltage_c ?? 11000),
        });
        const res = await fetch(`/api/pdm/simulate?${params.toString()}`);
        if (!res.ok || stopped) return;
        const prediction = (await res.json()) as PlantPrediction;
        if (!stopped) setFeed((prev) => ({ ...prev, prediction }));
      } catch {
        /* prediction is supplementary; the raw telemetry still renders */
      }
    };
    void run();
    return () => {
      stopped = true;
    };
    // Re-score whenever a new reading lands.
  }, [feed.messageCount]);

  return feed;
}
