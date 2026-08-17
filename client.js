/**
 * dsh-plugin-marketplace — browser half.
 *
 * A marketplace section inside the Web UI settings page: browses
 * github.com/topics/dsh-plugin through the public GitHub search API
 * (CORS-enabled), with keyword search, star/update sorting, paging, and a
 * per-plugin detail panel (README summary + install instructions).
 *
 * Hand-written ModuleLoader bundle — no build step required.
 */
window.__ModuleLoader__.load({
  id: "dsh-plugin-marketplace",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    var react = require("react");
    var h = react.createElement;

    // ── CSS (theme tokens) ────────────────────────────────────────────────
    var CSS = ".__mp_grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px;padding:0;margin:0;list-style:none}" +
      ".__mp_item{display:flex;flex-direction:column;gap:8px}" +
      ".__mp_card{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:6px;background:var(--dsw-alias-bg-layer-2);cursor:pointer;text-align:left;font:inherit;color:inherit}" +
      ".__mp_card:hover{border-color:var(--dsw-alias-brand-primary)}" +
      ".__mp_cardHead{display:flex;align-items:center;gap:8px;min-width:0}" +
      ".__mp_name{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".__mp_star{flex:none;font-size:12px;color:var(--dsw-alias-label-secondary)}" +
      ".__mp_desc{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}" +
      ".__mp_meta{display:flex;gap:10px;font-size:11px;color:var(--dsw-alias-label-tertiary)}" +
      ".__mp_toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px}" +
      ".__mp_input{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);height:32px;font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 10px;font-size:13px;min-width:200px;flex:1}" +
      ".__mp_select{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);height:32px;font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 8px;font-size:13px}" +
      ".__mp_more{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 14px;font:inherit;font-size:13px;cursor:pointer;margin-top:12px}" +
      ".__mp_more:hover:not(:disabled){border-color:var(--dsw-alias-brand-primary)}" +
      ".__mp_more:disabled{opacity:.5;cursor:default}" +
      ".__mp_status{font-size:12px;color:var(--dsw-alias-label-tertiary);margin:8px 0 0}" +
      ".__mp_detail{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:14px;margin-top:10px;background:var(--dsw-alias-bg-layer-2);display:flex;flex-direction:column;gap:8px;width:100%;box-sizing:border-box}" +
      ".__mp_detailTitle{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary)}" +
      ".__mp_readme{font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary);white-space:pre-wrap;word-break:break-word;max-height:260px;overflow:auto;width:100%;box-sizing:border-box;min-width:0}" +
      ".__mp_code{display:block;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:6px;padding:8px 10px;font-family:ui-monospace,Consolas,monospace;font-size:12px;color:var(--dsw-alias-label-primary);white-space:pre-wrap;word-break:break-all;width:100%;box-sizing:border-box;min-width:0}" +
      ".__mp_link{color:var(--dsw-alias-brand-primary);font-size:12px;text-decoration:none}" +
      ".__mp_btnPrimary{border-color:var(--dsw-alias-state-business-primary, #679efe);background:var(--dsw-alias-state-business-primary, #679efe);color:#fff}" +
      ".__mp_error{color:var(--dsw-alias-label-error);font-size:12px;margin:8px 0 0}";
    var tagId = "dsh-plugin-marketplace/main.css";
    if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
      var tag = document.createElement("style");
      tag.dataset.plugin = "dsh-plugin-marketplace";
      tag.dataset.pluginCss = tagId;
      tag.textContent = CSS;
      document.head.appendChild(tag);
    }

    // ── locale ────────────────────────────────────────────────────────────
    var NS = "marketplace";
    var inject = ["slots", "locale", "settingsScope", "connection"];
    var zh = {
      nav: "插件市场",
      search: "搜索插件（关键词或留空浏览全部）…",
      sortStars: "按 Star 排序",
      sortUpdated: "按更新时间排序",
      loadMore: "加载更多",
      loading: "加载中…",
      error: "加载失败，请稍后重试",
      empty: "没有找到插件",
      install: "安装方式",
      installHint: "在 profile 目录执行 pnpm 安装，然后在 cordis.patch.yml 挂载：",
      installHintBundle: "标准 bundle 插件：dsh plugin add 后由 bundle 层自动挂载，无需手动改 cordis.patch.yml：",
      readme: "README 摘要",
      readmeEmpty: "（该仓库没有 README）",
      openRepo: "打开 GitHub 仓库 ↗",
      openNpm: "在 npm 搜索同名包 ↗",
      updated: "更新",
      total: "共 {count} 个插件",
      ghError: "GitHub API 请求失败（未认证限流 60 次/小时），请稍后再试",
      installBtn: "一键安装",
      confirmInstall: "确认安装 {pkg}？",
      installing: "安装中…",
      installOk: "已安装：{msg}",
      installErr: "安装失败：{msg}",
      installIdle: "",
      installingHint: "正在后台执行 dsh plugin add，请稍候…",
      aiExplain: "🤖 AI 解释",
      aiExplaining: "AI 解释中，请稍候…",
      aiExplainErr: "AI 解释失败：{msg}",
      notExposed: "设置通道未就绪：插件市场的命名空间还没被配置客户端放行。刚安装/升级过的话，请重启 dsh web；若重启后仍报错，请查看启动日志里的 [settings-expose] 提示（可能需要手动把 \"plugin-marketplace\" 加入 dsh-host-apiproxy 的 WEB_SETTINGS_NAMESPACES）。"
    };
    var en = {
      nav: "Plugin Marketplace",
      search: "Search plugins (keyword, or empty to browse all)…",
      sortStars: "Sort by stars",
      sortUpdated: "Sort by updated",
      loadMore: "Load more",
      loading: "Loading…",
      error: "Failed to load, try again later",
      empty: "No plugins found",
      install: "Install",
      installHint: "Run pnpm in your profile dir, then mount in cordis.patch.yml:",
      installHintBundle: "Standard bundle plugin: dsh plugin add auto-mounts it via its bundle layer — no manual cordis.patch.yml edit needed:",
      readme: "README summary",
      readmeEmpty: "(no README in this repo)",
      openRepo: "Open GitHub repo ↗",
      openNpm: "Search npm ↗",
      updated: "Updated",
      total: "{count} plugins",
      ghError: "GitHub API rate-limited (60/hr unauthenticated), try again later",
      installBtn: "Install",
      confirmInstall: "Install {pkg}?",
      installing: "Installing…",
      installOk: "Installed: {msg}",
      installErr: "Install failed: {msg}",
      installIdle: "",
      installingHint: "Running dsh plugin add in the background…",
      aiExplain: "🤖 AI Explain",
      aiExplaining: "AI is explaining…",
      aiExplainErr: "AI explain failed: {msg}",
      notExposed: "Settings channel not ready: the plugin-marketplace namespace is not yet exposed to configuration clients. If you just installed/upgraded, restart dsh web; if it persists, check the [settings-expose] lines in the boot log (you may need to add \"plugin-marketplace\" to WEB_SETTINGS_NAMESPACES in dsh-host-apiproxy/lib/index.js manually)."
    };

    // ── GitHub API ────────────────────────────────────────────────────────
    var BASE = "https://api.github.com/search/repositories";
    var cache = new Map(); // queryKey -> {items, incomplete}
    function queryKey(q, sort, page) { return q + "|" + sort + "|" + page; }
    function fmtTime(iso) {
      try { return new Date(iso).toISOString().slice(0, 10); } catch { return ""; }
    }
    async function fetchPage(q, sort, page) {
      var key = queryKey(q, sort, page);
      var hit = cache.get(key);
      if (hit) return hit;
      var params = new URLSearchParams({
        q: "topic:dsh-plugin" + (q ? " " + q : ""),
        sort: sort,
        order: "desc",
        per_page: "20",
        page: String(page)
      });
      var res = await fetch(BASE + "?" + params.toString(), { headers: { Accept: "application/vnd.github+json" } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      var data = await res.json();
      var items = (data.items || []).map(function (r) {
        return {
          fullName: r.full_name,
          desc: r.description || "",
          stars: r.stargazers_count || 0,
          updated: r.updated_at || "",
          lang: r.language || "",
          htmlUrl: r.html_url
        };
      });
      var out = { items: items, total: data.total_count || 0 };
      cache.set(key, out);
      return out;
    }
    async function fetchReadme(fullName) {
      var url = "https://api.github.com/repos/" + fullName + "/readme";
      var res = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
      if (!res.ok) {
        var e = new Error("readme http " + res.status);
        e.status = res.status;
        throw e;
      }
      var data = await res.json();
      var bin = atob(data.content.replace(/\s+/g, ""));
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new TextDecoder("utf-8").decode(bytes);
    }
    // npm metadata (bundle detection for the install hint); CORS-enabled, cached.
    var npmCache = new Map(); // pkg -> {isBundle} | null
    async function fetchNpmInfo(pkg) {
      if (npmCache.has(pkg)) return npmCache.get(pkg);
      var promise = fetch("https://registry.npmjs.org/" + encodeURIComponent(pkg) + "/latest", {
        headers: { Accept: "application/vnd.npm.install-v1+json" }
      }).then(function (res) {
        if (!res.ok) return null;
        return res.json();
      }).then(function (data) {
        if (!data || !data.dsh) return { isBundle: false };
        return { isBundle: typeof data.dsh.bundle === "object" && data.dsh.bundle !== null && typeof data.dsh.bundle.patch === "string" && data.dsh.bundle.patch.length > 0 };
      }).catch(function () {
        return null;
      });
      npmCache.set(pkg, promise);
      return promise;
    }

    // ── components ────────────────────────────────────────────────────────
    function PluginCard(props) {
      return h("li", null,
        h("button", { type: "button", className: "__mp_card", onClick: props.onOpen },
          h("div", { className: "__mp_cardHead" },
            h("span", { className: "__mp_name", title: props.plugin.fullName }, props.plugin.fullName),
            h("span", { className: "__mp_star" }, "★ " + props.plugin.stars)
          ),
          props.plugin.desc ? h("div", { className: "__mp_desc" }, props.plugin.desc) : null,
          h("div", { className: "__mp_meta" },
            props.plugin.lang ? h("span", null, props.plugin.lang) : null,
            h("span", null, props.t("updated") + " " + fmtTime(props.plugin.updated))
          )
        )
      );
    }

    function DetailPanel(props) {
      var p = props.plugin;
      var installName = p.fullName.split("/")[1];
      var st = props.installState; // {status, message, pkg} from the settings scope
      var active = st && st.pkg === installName;
      var status = active ? st.status : "idle";
      var explainState = props.explainState; // {status, text, repo} from the settings scope
      // The settings field is namespace-global and persists across sessions,
      // so only show it when it belongs to the plugin currently open.
      var explainMine = !!explainState && explainState.repo === p.fullName;
      var [confirming, setConfirming] = react.useState(false);
      var statusNode = null;
      if (status === "running") {
        statusNode = h("div", { className: "__mp_status" }, props.t("installingHint"));
      } else if (status === "ok") {
        statusNode = h("div", { className: "__mp_status" }, props.t("installOk").replace("{msg}", st.message || ""));
      } else if (status === "error") {
        statusNode = h("div", { className: "__mp_error" }, props.t("installErr").replace("{msg}", st.message || ""));
      }
      var btn;
      if (status === "running") {
        btn = h("button", { type: "button", className: "__mp_more", disabled: true }, props.t("installing"));
      } else if (confirming) {
        btn = h("button", {
          type: "button", className: "__mp_btnPrimary __mp_more",
          onClick: function () { setConfirming(false); props.onInstall(installName); }
        }, props.t("confirmInstall").replace("{pkg}", installName));
      } else {
        btn = h("button", {
          type: "button", className: "__mp_btnPrimary __mp_more",
          onClick: function () { setConfirming(true); }
        }, props.t("installBtn"));
      }
      return h("div", { className: "__mp_detail" },
        h("div", { className: "__mp_detailTitle" }, p.fullName),
        h("div", { className: "__mp_meta" },
          h("span", null, "★ " + p.stars),
          h("span", null, props.t("updated") + " " + fmtTime(p.updated)),
          props.lang ? h("span", null, p.lang) : null
        ),
        h("div", null,
          h("a", { className: "__mp_link", href: p.htmlUrl, target: "_blank", rel: "noreferrer" }, props.t("openRepo")),
          "  ·  ",
          h("a", { className: "__mp_link", href: "https://www.npmjs.com/search?q=" + encodeURIComponent(installName), target: "_blank", rel: "noreferrer" }, props.t("openNpm"))
        ),
        h("div", { className: "__mp_detailTitle" }, props.t("install")),
        h("div", { className: "__mp_readme" }, props.bundleInfo === true ? props.t("installHintBundle") : props.t("installHint")),
        h("code", { className: "__mp_code" },
          "dsh plugin --profile web add " + installName + "\n" +
          (props.bundleInfo === true
            ? "# standard bundle: auto-mounted via dsh.profile.bundles"
            : "# then in $DSH_HOME/profiles/web/cordis.patch.yml:\n" +
              "- insert:\n    - id: " + installName + "\n      name: '" + installName + "'")
        ),
        btn,
        statusNode,
        h("div", { className: "__mp_detailTitle" }, props.t("readme")),
        h("div", { className: "__mp_readme" },
          props.readmeLoading ? props.t("loading")
            : props.readmeRateLimited ? props.ghError
            : props.readmeError ? props.t("readmeEmpty")
            : (props.readme || "")
        ),
        h("div", { className: "__mp_translateRow" },
          h("button", { type: "button", className: "__mp_translateBtn",
            style: { marginTop: "8px", padding: "4px 10px", fontSize: "12px", cursor: "pointer", background: "var(--dsw-alias-bg-hover, #21262d)", color: "var(--dsw-alias-label-primary, #e6edf3)", border: "1px solid var(--dsw-alias-border, #30363d)", borderRadius: "6px" },
            disabled: explainMine && explainState.status === "running",
            onClick: function () { props.onExplain(p.fullName, p.desc, props.readme || ""); }
          }, props.t("aiExplain")),
          h("div", { id: "__mp_translateOut", style: { fontSize: "12px", lineHeight: "1.6", color: "var(--dsw-alias-label-secondary, #8b949e)", whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: "8px", borderTop: "1px solid var(--dsw-alias-border, #21262d)", paddingTop: "8px" } },
            explainMine && props.explainError ? h("span", { style: { color: "var(--dsw-alias-state-danger-text, #f85149)" } }, props.explainError)
              : explainMine && explainState.status === "running" ? props.t("aiExplaining")
              : explainMine && explainState.status === "error" ? props.t("aiExplainErr").replace("{msg}", explainState.text || "unknown")
              : explainMine && explainState.status === "ok" ? explainState.text
              : ""
          )
        )
      );
    }

    function MarketplaceSection(props) {
      var t = props.t;
      var scope = props.scope;
      var api = props.api;
      var state = react.useState({ q: "", sort: "stars", page: 1, items: [], loading: false, error: null, total: 0, open: null, readme: null, readmeLoading: false, readmeError: false, readmeRateLimited: false, bundleInfo: null });
      var s = state[0], set = state[1];
      // install-state subscription (stable pattern: useState + subscribe, never
      // depend on getSnapshot() reference identity).
      var [installState, setInstallState] = react.useState(null);
      react.useEffect(function () {
        var alive = true;
        var sync = function () { if (alive) setInstallState(scope.getSnapshot()); };
        sync();
        var un = typeof scope.subscribe === "function" ? scope.subscribe(sync) : null;
        return function () { alive = false; if (un) un(); if (scope.dispose) scope.dispose(); };
      }, [scope]);
      // settings-not-exposed means the host allowlist gate refused the write:
      // explain the restart/manual-fix path instead of showing the raw code.
      var mutateError = function (detail, fallback) {
        if (detail && detail.code === "settings-not-exposed") return t("notExposed");
        return String(detail && (detail.message || detail.code) || fallback);
      };
      var onInstall = react.useCallback(function (pkg) {
        set(function (prev) { return Object.assign({}, prev, { installError: null }); });
        api.settings.mutate({
          ns: "plugin-marketplace",
          ops: [{ op: "set", path: ["install"], value: { pkg: pkg, ts: Date.now() } }]
        }).then(function (response) {
          if (!response.result.ok) {
            var detail = response.result.error || {};
            set(function (prev) { return Object.assign({}, prev, { installError: mutateError(detail, "unknown") }); });
          }
        }).catch(function (e) {
          set(function (prev) { return Object.assign({}, prev, { installError: String(e && e.message || e) }); });
        });
      }, [api, t]);
      // AI-explain request: the host answers over the same settings channel.
      var onExplain = react.useCallback(function (repo, desc, readme) {
        set(function (prev) { return Object.assign({}, prev, { explainError: null }); });
        api.settings.mutate({
          ns: "plugin-marketplace",
          ops: [{ op: "set", path: ["aiExplain"], value: { repo: repo, desc: desc, readme: readme, ts: Date.now() } }]
        }).then(function (response) {
          if (!response.result.ok) {
            var detail = response.result.error || {};
            set(function (prev) { return Object.assign({}, prev, { explainError: mutateError(detail, "unknown") }); });
          }
        }).catch(function (e) {
          set(function (prev) { return Object.assign({}, prev, { explainError: String(e && e.message || e) }); });
        });
      }, [api, t]);
      var load = react.useCallback(function (q, sort, page, append) {
        set(function (prev) { return Object.assign({}, prev, { loading: true, error: null }); });
        fetchPage(q, sort, page).then(function (out) {
          set(function (prev) {
            var items = append ? prev.items.concat(out.items) : out.items;
            return Object.assign({}, prev, { items: items, total: out.total, loading: false, page: page, q: q, sort: sort });
          });
        }).catch(function () {
          set(function (prev) { return Object.assign({}, prev, { loading: false, error: t("ghError") }); });
        });
      }, [t]);
      react.useEffect(function () {
        load("", "stars", 1, false);
      }, [load]);
      var openDetail = react.useCallback(function (plugin) {
        if (s.open && s.open.fullName === plugin.fullName) { set(function (prev) { return Object.assign({}, prev, { open: null }); }); return; }
        set(function (prev) { return Object.assign({}, prev, { open: plugin, readme: null, readmeError: false, readmeRateLimited: false, readmeLoading: true }); });
        // Detail expands inline under the clicked card; scroll minimally
        // (nearest) only when it would fall outside the viewport.
        setTimeout(function () {
          var el = document.querySelector(".__mp_detail");
          if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 50);
        fetchReadme(plugin.fullName).then(function (text) {
          set(function (prev) {
            if (!prev.open || prev.open.fullName !== plugin.fullName) return prev;
            return Object.assign({}, prev, { readme: text.slice(0, 1200), readmeLoading: false, readmeError: false, readmeRateLimited: false });
          });
        }).catch(function (err) {
          set(function (prev) {
            if (!prev.open || prev.open.fullName !== plugin.fullName) return prev;
            var rateLimited = err && (err.status === 403 || err.status === 429);
            return Object.assign({}, prev, { readmeLoading: false, readmeError: !rateLimited, readmeRateLimited: rateLimited });
          });
        });
        // npm metadata: does the target package declare dsh.bundle.patch?
        // (determines whether the manual cordis.patch.yml row is needed)
        fetchNpmInfo(plugin.fullName.split("/")[1]).then(function (info) {
          set(function (prev) {
            if (!prev.open || prev.open.fullName !== plugin.fullName) return prev;
            return Object.assign({}, prev, { bundleInfo: info ? Boolean(info.isBundle) : null });
          });
        });
      }, [s.open]);
      var submit = function (e) {
        e.preventDefault();
        load(s.q, s.sort, 1, false);
      };
      var more = function () { load(s.q, s.sort, s.page + 1, true); };
      return h("div", null,
        h("form", { className: "__mp_toolbar", onSubmit: submit },
          h("input", { className: "__mp_input", type: "search", value: s.q, placeholder: t("search"), onChange: function (e) { set(function (prev) { return Object.assign({}, prev, { q: e.target.value }); }); } }),
          h("select", { className: "__mp_select", value: s.sort, onChange: function (e) { load(s.q, e.target.value, 1, false); } },
            h("option", { value: "stars" }, t("sortStars")),
            h("option", { value: "updated" }, t("sortUpdated"))
          )
        ),
        s.total > 0 ? h("p", { className: "__mp_status" }, t("total").replace("{count}", String(s.total))) : null,
        h("ul", { className: "__mp_grid" },
          s.items.map(function (p) {
            // Detail expands INLINE right under the clicked card, so there is
            // no jumping around the page.
            var open = s.open && s.open.fullName === p.fullName;
            return h("div", { key: p.fullName, className: "__mp_item" },
              h(PluginCard, { plugin: p, t: t, onOpen: function () { openDetail(p); } }),
              open ? h(DetailPanel, { plugin: s.open, t: t, readme: s.readme, readmeLoading: s.readmeLoading, readmeError: s.readmeError, readmeRateLimited: s.readmeRateLimited, lang: s.open.lang, installState: installState && installState.status === "ready" ? installState.value.installState : null, onInstall: onInstall, ghError: t("ghError"), explainState: installState && installState.status === "ready" ? installState.value.aiExplainResult : null, explainError: s.explainError, onExplain: onExplain, bundleInfo: s.bundleInfo }) : null
            );
          })
        ),
        s.loading ? h("p", { className: "__mp_status" }, t("loading")) : null,
        s.error ? h("p", { className: "__mp_error" }, s.error) : null,
        s.items.length === 0 && !s.loading && !s.error ? h("p", { className: "__mp_status" }, t("empty")) : null,
        s.items.length > 0 ? h("button", { type: "button", className: "__mp_more", onClick: more, disabled: s.loading }, t("loadMore")) : null,
        s.installError ? h("p", { className: "__mp_error" }, s.installError) : null
      );
    }

    // ── plugin ────────────────────────────────────────────────────────────
    function apply(ctx) {
      var t = ctx.locale.bind(NS);
      ctx.effect(function () { return ctx.locale.register(NS, { zh: zh, en: en }); }, "dsh-plugin-marketplace: dictionaries");
      var scope = ctx.settingsScope.bind({ namespace: "plugin-marketplace" });
      var api = ctx.connection.api;
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register({
          name: "settings.section",
          id: "marketplace",
          order: 20,
          label: function () { return t("nav"); },
          locale: NS
        }, function (props) {
          return h(MarketplaceSection, Object.assign({}, props, { scope: scope, api: api }));
        });
      });
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
