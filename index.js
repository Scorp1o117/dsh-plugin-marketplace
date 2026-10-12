/**
 * dsh-plugin-marketplace — node half.
 *
 * Host side of the marketplace: owns a `plugin-marketplace` settings
 * namespace used as a message channel between the browser UI and this
 * process. The client writes an `install` request; the settings watch here
 * spawns `dsh plugin --profile <p> add <pkg>` (npm install into the profile)
 * and appends the mount row to the profile's cordis.patch.yml, then reports
 * progress/result back through `installState`.
 *
 * The settings section UI itself lives in the browser half (exports["./client"]).
 */
import { AsyncResource } from "node:async_hooks";
import { writeState } from "./runtime.js";
import { managementFields, installManagement } from "./management.js";
import z from "@deepseek-ai/schemastery";
import { BlockAssembler, createUserMessage } from "@deepseek-ai/dsh-llm";

/** Cordis plugin name. */
const name = "plugin-marketplace";
/** Services this plugin needs injected from the host tree (ctx.get requires inject). */
const inject = ["settings", "profileContext", "llm", "agentDefaultModel"];
/** Settings namespace owned by this plugin (Web UI settings section + install channel). */
const NS = "plugin-marketplace";

/** Runtime schema: the install request + the install state report. */
const Config = z.object({
  ...managementFields,
  /** AI-explain request (client writes repo/desc/readme, host answers). */
  aiExplain: z.object({
    repo: z.string().default(""),
    desc: z.string().default(""),
    readme: z.string().default(""),
    ts: z.number().default(0),
  }),
  aiExplainResult: z.object({
    status: z.string().default("idle"), // idle | running | ok | error
    text: z.string().default(""),
    /** repo this result belongs to ("owner/name"); client gates display on it. */
    repo: z.string().default(""),
    ts: z.number().default(0),
  }),
}).volatile();

function apply(ctx, config) {
  const sourceGetter = () => typeof config.get === "function" ? config.get() : config;
  installManagement(ctx, config, NS);
  let lastExplainTs = 0;

  // settings/document-updated may fire inside the Host's HMR transaction.
  // Start consumption on the next task, and cancel scheduled work on unload.
  let scheduled;
  let disposed = false;
  // Capture the plugin's startup context. A timer created by an HMR event
  // inherits its AsyncLocalStorage transaction even after that transaction
  // settles; consume requests in this resource's context instead.
  const consumer = new AsyncResource("plugin-marketplace-requests");
  function scheduleRequests() {
    if (disposed || scheduled !== undefined) return;
    scheduled = setTimeout(() => {
      scheduled = undefined;
      consumer.runInAsyncScope(() => {
        void maybeRunExplain();
      });
    }, 0);
  }
  ctx.on("settings/document-updated", (id) => {
    if (id === NS) scheduleRequests();
  });
  ctx.effect(() => () => { disposed = true; clearTimeout(scheduled); consumer.emitDestroy(); });
  scheduleRequests();

  /** Resolved current config (settings layer over the entry). */
  function current() {
    return sourceGetter();
  }

  /** Write the AI-explain result report (and clear the consumed request). */
  async function reportExplain(status, text, repo) {
    await writeState(ctx.get("settings"), NS, {
      aiExplainResult: { status, text, repo: repo || "", ts: Date.now() },
      aiExplain: { repo: "", desc: "", readme: "", ts: 0 },
    });
  }

  /**
   * Answer an aiExplain request with the deployment's default model: tell the
   * user in plain Chinese what this plugin roughly does. Uses the same
   * settings-backed message channel as the install flow.
   */
  async function maybeRunExplain() {
    let repo = "";
    try {
      const cfg = current();
      const req = cfg?.aiExplain;
      if (!req || !req.repo || req.ts === lastExplainTs || req.ts === 0) return;
      lastExplainTs = req.ts;
      repo = String(req.repo);
      const llm = ctx.llm;
      if (!llm) {
        await reportExplain("error", "LLM service unavailable; configure a model in Settings → Models.", repo);
        return;
      }
      // Route through the deployment's default model when one is configured.
      let route = null;
      try {
        const defaults = ctx.agentDefaultModel?.currentSelection?.();
        if (defaults?.provider && defaults?.model) route = defaults;
      } catch { /* no default model service; fall back to the adapter default */ }
      const desc = String(req.desc || "").trim();
      const readme = String(req.readme || "").trim().slice(0, 1500);
      const prompt =
        `插件仓库：${repo}\n` +
        (desc ? `简介：${desc}\n` : "") +
        (readme ? `README 摘要：\n${readme}\n` : "") +
        `\n请用简体中文、3~5 句话直接告诉我这个插件大概是干嘛的（核心用途、解决什么问题、适合谁）。不要复述仓库名，不要罗列安装步骤。`;
      await reportExplain("running", "", repo);
      ctx.logger.info(`[plugin-marketplace] explaining ${repo} (model=${route ? `${route.provider}/${route.model}` : "default"})…`);
      const messages = [createUserMessage({
        content: [{ type: "text", text: prompt }],
        source: { kind: "plugin", plugin: "dsh-plugin-marketplace" },
      })];
      const options = {
        messages,
        maxTokens: 400,
        purpose: "plugin-marketplace-explain",
      };
      if (route) {
        options.provider = route.provider;
        options.model = route.model;
      }
      const assembler = new BlockAssembler();
      for await (const chunk of ctx.llm.stream(options)) assembler.push(chunk);
      const blocks = assembler.blocks();
      const text = blocks
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join(" ")
        .trim();
      if (!text) throw new Error("model produced no text");
      await reportExplain("ok", text, repo);
    } catch (error) {
      ctx.logger.warn(`[plugin-marketplace] explain flow failed: ${String(error)}`);
      await reportExplain("error", String(error instanceof Error ? error.message : error), repo)
        .catch((writeError) => ctx.logger.warn(`[plugin-marketplace] explain error state write failed: ${String(writeError)}`));
    }
  }
}

export { Config, apply, inject, name };
