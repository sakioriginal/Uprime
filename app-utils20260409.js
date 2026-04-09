/* =========================
   app-utils.js
   共通関数 / ノード・リンク操作 / 補助ロジック
========================= */

(() => {
  "use strict";

  const App = window.App;
  if (!App) {
    throw new Error("App が先に初期化されていません。app-state.js を先に読み込んでください。");
  }

  console.log("app-utils loaded");

  /* =========================
     Basic helpers
  ========================= */
  App.addLog = function addLog(text) {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    App.dom.logEl.textContent += `[${hh}:${mm}:${ss}] ${text}\n`;
    App.dom.logEl.scrollTop = App.dom.logEl.scrollHeight;
  };

  App.escHtml = function escHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  };

  App.uniqueStrings = function uniqueStrings(arr) {
    return [...new Set((arr || []).filter(Boolean))];
  };

  App.normalizeTitleKey = function normalizeTitleKey(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[0-9]/g, "")
      .replace(/関連|入口|候補|編集|採掘|周辺|派生/g, "");
  };

  App.sanitizeGeneratedLabel = function sanitizeGeneratedLabel(text) {
    let s = String(text || "").trim();
    s = s.replace(/[^\p{L}\p{N}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\s]/gu, "");
    const chunks = s.match(/[A-Za-z]+[0-9]*|[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+/gu) || [];
    const result = [];
    const seen = new Set();

    for (const c of chunks) {
      if (seen.has(c)) continue;
      seen.add(c);
      result.push(c);
      if (result.length >= 4) break;
    }

    s = result.join(" ");
    if (!s) s = "未整理ノード";
    if (s.length > 24) s = s.slice(0, 24);
    return s;
  };

  App.nextId = function nextId(prefix = "n") {
    return `${prefix}_${App.idCounter++}`;
  };

  App.getNode = function getNode(id) {
    return App.nodes.find(n => n.id === id) || null;
  };

  App.worldToScreen = function worldToScreen(x, y) {
    return {
      x: (x - App.view.x) * App.view.scale + App.W / 2,
      y: (y - App.view.y) * App.view.scale + App.H / 2
    };
  };

  App.screenToWorld = function screenToWorld(x, y) {
    return {
      x: (x - App.W / 2) / App.view.scale + App.view.x,
      y: (y - App.H / 2) / App.view.scale + App.view.y
    };
  };

  App.syncQuickInputFromSelection = function syncQuickInputFromSelection() {
    const node = App.getNode(App.selectedNodeId);
    if (!node) return;
    if (document.activeElement !== App.dom.quickInput) {
      App.dom.quickInput.value = node.title || node.label || "";
    }
  };

  App.clearLongPressTimer = function clearLongPressTimer() {
    if (App.longPressTimer) {
      clearTimeout(App.longPressTimer);
      App.longPressTimer = null;
    }
  };

  App.isNearPoint = function isNearPoint(x1, y1, x2, y2, dist = App.DOUBLE_TAP_DIST) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy <= dist * dist;
  };

  /* =========================
     Geometry / hit
  ========================= */
  App.pointerPosFromEvent = function pointerPosFromEvent(e) {
    const rect = App.dom.canvas.getBoundingClientRect();
    return {
      x: (e.clientX ?? 0) - rect.left,
      y: (e.clientY ?? 0) - rect.top
    };
  };

  App.hitTestNode = function hitTestNode(worldX, worldY) {
    for (let i = App.nodes.length - 1; i >= 0; i--) {
      const n = App.nodes[i];
      if (!n.isAgentNode && !App.visibleNodeSet.has(n.id)) continue;

      if (n.shape === "rect") {
        const w = n.width || 120;
        const h = n.height || 80;
        if (
          worldX >= n.x - w / 2 &&
          worldX <= n.x + w / 2 &&
          worldY >= n.y - h / 2 &&
          worldY <= n.y + h / 2
        ) return n;
        continue;
      }

      const dx = worldX - n.x;
      const dy = worldY - n.y;
      if (dx * dx + dy * dy <= n.r * n.r) return n;
    }
    return null;
  };

  App.hitResizeHandle = function hitResizeHandle(node, worldX, worldY) {
    if (!node || node.shape !== "rect") return false;

    const hw = (node.width || 120) / 2;
    const hh = (node.height || 80) / 2;
    const handleSize = 12 / App.view.scale;
    const hx = node.x + hw;
    const hy = node.y + hh;

    return (
      worldX >= hx - handleSize &&
      worldX <= hx + handleSize &&
      worldY >= hy - handleSize &&
      worldY <= hy + handleSize
    );
  };

  /* =========================
     Graph helpers
  ========================= */
  App.getNodeDegree = function getNodeDegree(nodeId) {
    let c = 0;
    for (const l of App.links) {
      if (l.source === nodeId || l.target === nodeId) c++;
    }
    return c;
  };

  App.getLinkBias = function getLinkBias(linkType) {
    switch (linkType) {
      case "5w2h-bridge": return 1.25;
      case "candidate": return 0.8;
      case "explore": return 0.9;
      case "agent-think": return 0.3;
      case "related": return 1.0;
      default: return 1.0;
    }
  };

  App.getBaseNodeWeight = function getBaseNodeWeight(node) {
    let w = 0;

    if (typeof node.hensachi === "number") w += node.hensachi;
    else w += 50;

    if (typeof node.attentionScore === "number") w += node.attentionScore * 2;
    if (typeof node.qualityScore === "number") w += node.qualityScore * 3;

    if (node.is5w2h) w += 30;
    if (node.isInterdisciplinary) w += 10;
    if (node.imageSrc) w += 8;
    if (node.tags?.includes("unverified")) w -= 12;
    if (node.tags?.includes("wildcard")) w += 4;

    return w;
  };

  App.computeNodeDisplayWeight = function computeNodeDisplayWeight(node) {
    let weight = App.getBaseNodeWeight(node);
    const relatedLinks = App.links.filter(l => l.source === node.id || l.target === node.id);

    weight += relatedLinks.length * 2.5;

    for (const l of relatedLinks) {
      const otherId = l.source === node.id ? l.target : l.source;
      const other = App.getNode(otherId);
      if (!other) continue;

      const otherBase = App.getBaseNodeWeight(other);
      const bias = App.getLinkBias(l.type);
      weight += (otherBase * 0.05) * bias;
    }

    return weight;
  };

  App.getVisibleNodeSet = function getVisibleNodeSet() {
    const normalNodes = App.nodes.filter(n => !n.isAgentNode);

    if (App.uiState.visibleNodeLimit === Infinity) {
      return new Set(normalNodes.map(n => n.id));
    }

    const scored = normalNodes.map(n => ({
      id: n.id,
      score: App.computeNodeDisplayWeight(n)
    }));

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, App.uiState.visibleNodeLimit);
    return new Set(top.map(x => x.id));
  };

  App.linkExists = function linkExists(aId, bId) {
    return App.links.some(l =>
      (l.source === aId && l.target === bId) ||
      (l.source === bId && l.target === aId)
    );
  };

  App.nodeExistsByLabel = function nodeExistsByLabel(label) {
    const key = App.normalizeTitleKey(label);
    return App.nodes.find(n =>
      App.normalizeTitleKey(n.title || n.label) === key &&
      !n.is5w2h &&
      !n.isAgentNode
    ) || null;
  };

  /* =========================
     Node / Link factory
  ========================= */
  App.restoreImageNode = function restoreImageNode(node) {
    if (!node.imageSrc) return;

    node.imageLoaded = false;
    node.imageEl = new Image();
    node.imageEl.onload = () => { node.imageLoaded = true; };
    node.imageEl.src = node.imageSrc;
  };

  App.makeNode = function makeNode({
    x = 0,
    y = 0,
    label = "ノード",
    memo = "",
    r = 24,
    width = 120,
    height = 80,
    shape = "circle",
    color = "#2b3344",
    textColor = "#eaf1ff",
    fixed = false,
    is5w2h = false,
    isInterdisciplinary = false,
    isAutoCandidate = false,
    isAgentNode = false,
    category = "normal",
    baseNodeId = null,
    wNodeId = null,
    imageSrc = null
  } = {}) {
    const node = {
      id: App.nextId(
        is5w2h ? "5w2h" :
        isInterdisciplinary ? "inter" :
        isAutoCandidate ? "cand" :
        isAgentNode ? "agent" : "n"
      ),
      x, y,
      vx: 0, vy: 0,
      label,
      title: label,
      memo,
      summary: "",
      r,
      width,
      height,
      shape,
      color,
      textColor,
      fixed,

      is5w2h,
      isInterdisciplinary,
      isAutoCandidate,
      isAgentNode,

      category,
      baseNodeId,
      wNodeId,

      imageSrc: imageSrc || null,
      imageEl: null,
      imageLoaded: false,

      createdAt: Date.now(),
      updatedAt: Date.now(),

      keywords: [],
      tags: [],
      qualityScore: 100,
      attentionScore: 0,
      hensachi: null,
      roleKey: null,
      wikiBusy: false,

      authorId: "localUser",
      sourceNodeId: null,
      rootNodeId: null,
      copiedFromMapId: null,
      visibility: "private",
      status: "draft",
      quoteCount: 0,
      pointScore: 0,

      depth: 0,
      mineScore: 100,
      mineHits: 0,
      mineExhaustion: 0
    };

    if (imageSrc) App.restoreImageNode(node);
    return node;
  };

  App.makeLink = function makeLink(source, target, type = "related", weight = 1, auto = false) {
    return {
      id: App.nextId("l"),
      source,
      target,
      type,
      weight,
      auto,

      authorId: "localUser",
      sourceLinkId: null,
      copiedFromMapId: null,
      visibility: "private",
      status: "draft",
      quoteCount: 0,
      pointScore: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  };

  /* =========================
     5W2H / graph ops
  ========================= */
  App.ensure5W2HNodes = function ensure5W2HNodes() {
    const y = -260;
    const gap = 145;

    App.FIVEW2H_LABELS.forEach((label, i) => {
      let node = App.nodes.find(n => n.is5w2h && n.label === label);
      const x = (i - 3) * gap;

      if (!node) {
        node = App.makeNode({
          x, y,
          label,
          r: 28,
          color: "#2a3140",
          textColor: "#ffd166",
          fixed: true,
          is5w2h: true,
          category: "5w2h"
        });
        node.id = `5w2h_${label}`;
        node.title = label;
        node.tags = [label];
        App.nodes.push(node);
      } else {
        node.x = x;
        node.y = y;
        node.fixed = !!App.uiState.fix5w2h;
      }
    });
  };

  App.createInterdisciplinaryNodeBetween = function createInterdisciplinaryNodeBetween(a, b) {
    const normalNode = a.is5w2h ? b : a;
    const wNode = a.is5w2h ? a : b;
    if (!normalNode || !wNode || !wNode.is5w2h || normalNode.is5w2h) return null;

    let existing = App.nodes.find(n =>
      n.isInterdisciplinary &&
      n.baseNodeId === normalNode.id &&
      n.wNodeId === wNode.id
    );
    if (existing) return existing;

    const label = App.sanitizeGeneratedLabel(`${normalNode.title || normalNode.label} ${wNode.title || wNode.label}`);
    const inter = App.makeNode({
      x: (normalNode.x + wNode.x) / 2,
      y: (normalNode.y + wNode.y) / 2,
      label,
      memo: `${normalNode.title || normalNode.label} と ${wNode.title || wNode.label} の学際`,
      r: 22,
      color: "#233848",
      textColor: "#7bdff2",
      isInterdisciplinary: true,
      category: "interdisciplinary",
      baseNodeId: normalNode.id,
      wNodeId: wNode.id
    });

    inter.title = label;
    inter.rootNodeId = inter.id;
    inter.tags = ["interdisciplinary", wNode.label];
    inter.keywords = [normalNode.title || normalNode.label, wNode.label];

    App.nodes.push(inter);
    App.addLog(`学際ノード生成: ${inter.title}`);
    return inter;
  };

  App.addLinkSmart = function addLinkSmart(a, b) {
    if (!a || !b || a.id === b.id) return;

    const aIs5 = !!a.is5w2h;
    const bIs5 = !!b.is5w2h;

    if (App.uiState.inter && (aIs5 !== bIs5)) {
      const inter = App.createInterdisciplinaryNodeBetween(a, b);
      if (inter) {
        if (!App.linkExists(a.id, inter.id)) App.links.push(App.makeLink(a.id, inter.id, "5w2h-bridge", 1, true));
        if (!App.linkExists(inter.id, b.id)) App.links.push(App.makeLink(inter.id, b.id, "5w2h-bridge", 1, true));
        return;
      }
    }

    if (!App.linkExists(a.id, b.id)) {
      App.links.push(App.makeLink(a.id, b.id, "related", 1, false));
      App.addLog(`リンク追加: ${(a.title || a.label)} ↔ ${(b.title || b.label)}`);
    }
  };

  App.calcNodeAffinity = function calcNodeAffinity(a, b) {
    if (!a || !b || a.id === b.id) return -Infinity;

    let score = 0;

    const aTitle = String(a.title || a.label || "");
    const bTitle = String(b.title || b.label || "");

    const aTags = new Set(a.tags || []);
    const bTags = new Set(b.tags || []);
    const aKeywords = new Set(a.keywords || []);
    const bKeywords = new Set(b.keywords || []);

    for (const t of aTags) {
      if (bTags.has(t)) score += 4;
    }

    for (const k of aKeywords) {
      if (bKeywords.has(k)) score += 3;
    }

    if (aTitle.includes(bTitle) || bTitle.includes(aTitle)) score += 3;

    const sameCategory = a.category && b.category && a.category === b.category;
    if (sameCategory) score += 2;

    if (a.isAutoCandidate || b.isAutoCandidate) score -= 1;
    if (a.tags?.includes("unverified")) score -= 3;
    if (b.tags?.includes("unverified")) score -= 3;

    return score;
  };

  App.mergeDuplicateNodes = function mergeDuplicateNodes() {
    const map = new Map();

    for (const node of [...App.nodes]) {
      if (node.is5w2h || node.isAgentNode) continue;

      const key = App.normalizeTitleKey(node.title || node.label);
      if (!key) continue;

      if (!map.has(key)) {
        map.set(key, node);
        continue;
      }

      const keeper = map.get(key);
      const removeId = node.id;

      for (const link of App.links) {
        if (link.source === removeId) link.source = keeper.id;
        if (link.target === removeId) link.target = keeper.id;
      }

      keeper.tags = App.uniqueStrings([...(keeper.tags || []), ...(node.tags || [])]);
      keeper.keywords = App.uniqueStrings([...(keeper.keywords || []), ...(node.keywords || [])]);
      keeper.memo = [keeper.memo, node.memo].filter(Boolean).join("\n");
      keeper.summary = keeper.summary || node.summary;
      keeper.imageSrc = keeper.imageSrc || node.imageSrc;
      keeper.mineScore = Math.max(keeper.mineScore || 0, node.mineScore || 0);

      App.links = App.links.filter(l => l.source !== l.target);

      const seen = new Set();
      App.links = App.links.filter(l => {
        const a = l.source < l.target ? l.source : l.target;
        const b = l.source < l.target ? l.target : l.source;
        const k = `${a}__${b}__${l.type}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

      App.nodes = App.nodes.filter(n => n.id !== removeId);
    }
  };

  /* =========================
     CRUD / search
  ========================= */
  App.createNodeAtWorld = function createNodeAtWorld(x, y, label = "新規ノード") {
    const clean = App.sanitizeGeneratedLabel(label);
    const n = App.makeNode({
      x, y,
      label: clean,
      memo: "",
      r: 24,
      color: "#2b3344",
      textColor: "#eaf1ff",
      category: "normal"
    });

    n.title = clean;
    n.summary = "手動作成";
    n.rootNodeId = n.id;

    App.nodes.push(n);
    App.selectedNodeId = n.id;

    App.addLog(`ノード追加: ${clean}`);
    return n;
  };

  App.createImageNodeAtWorld = function createImageNodeAtWorld(x, y, imageSrc, label = "画像") {
    const n = App.makeNode({
      x, y,
      label,
      memo: "画像ノード",
      width: 160,
      height: 120,
      shape: "rect",
      color: "#2b3344",
      textColor: "#eaf1ff",
      imageSrc
    });

    if (imageSrc) {
      App.restoreImageNode(n);
      if (n.imageEl) {
        n.imageEl.onload = () => {
          n.imageLoaded = true;
          const iw = n.imageEl.width || 4;
          const ih = n.imageEl.height || 3;
          const baseH = 120;
          n.height = baseH;
          n.width = Math.max(80, Math.round(baseH * (iw / ih)));
          n.imageAspect = iw / ih;
        };
        n.imageEl.src = imageSrc;
      }
    }

    n.title = label;
    n.rootNodeId = n.id;
    n.tags = ["image"];

    App.nodes.push(n);
    App.selectedNodeId = n.id;
    App.addLog(`画像ノード追加: ${label}`);
    return n;
  };

  App.renameNode = function renameNode(node, newLabel) {
    if (!node || node.is5w2h) return false;

    const clean = App.sanitizeGeneratedLabel(newLabel || "");
    node.title = clean;
    node.label = clean;
    node.updatedAt = Date.now();

    App.addLog(`ノード名更新: ${clean}`);
    return true;
  };

  App.deleteNode = function deleteNode(nodeId) {
    const n = App.getNode(nodeId);
    if (!n || n.is5w2h) return;

    App.nodes = App.nodes.filter(x => x.id !== nodeId);
    App.links = App.links.filter(l => l.source !== nodeId && l.target !== nodeId);
    App.agents = App.agents.filter(a => a.id !== nodeId);

    if (App.selectedNodeId === nodeId) App.selectedNodeId = null;
    if (App.followAgentId === nodeId) App.followAgentId = null;
    if (App.pendingAgentTargetId === nodeId) App.pendingAgentTargetId = null;
    if (App.zoomedImageNodeId === nodeId) App.zoomedImageNodeId = null;

    App.addLog(`ノード削除: ${n.title || n.label}`);
  };

  App.findNodesByKeyword = function findNodesByKeyword(keyword) {
    const q = String(keyword || "").trim().toLowerCase();
    if (!q) return [];

    return App.nodes.filter(n => {
      if (n.isAgentNode) return false;
      const t = String(n.title || n.label || "").toLowerCase();
      const m = String(n.memo || "").toLowerCase();
      return t.includes(q) || m.includes(q);
    });
  };

  App.focusNode = function focusNode(node) {
    if (!node) return;
    App.selectedNodeId = node.id;
    App.view.x = node.x;
    App.view.y = node.y;
  };

  /* =========================
     Serialization
  ========================= */
  App.compactNode = function compactNode(n) {
    return {
      id: n.id,
      x: Math.round(n.x * 10) / 10,
      y: Math.round(n.y * 10) / 10,
      label: n.label || "",
      title: n.title || n.label || "",
      memo: n.memo || "",
      summary: n.summary || "",
      keywords: Array.isArray(n.keywords) ? n.keywords : [],
      tags: Array.isArray(n.tags) ? n.tags : [],
      qualityScore: typeof n.qualityScore === "number" ? n.qualityScore : 100,
      attentionScore: typeof n.attentionScore === "number" ? n.attentionScore : 0,
      hensachi: typeof n.hensachi === "number" ? n.hensachi : null,
      r: n.r || 24,
      width: n.width || 120,
      height: n.height || 80,
      shape: n.shape || "circle",
      color: n.color || "#2b3344",
      textColor: n.textColor || "#eaf1ff",
      fixed: !!n.fixed,
      is5w2h: !!n.is5w2h,
      isInterdisciplinary: !!n.isInterdisciplinary,
      isAutoCandidate: !!n.isAutoCandidate,
      isAgentNode: !!n.isAgentNode,
      category: n.category || "normal",
      baseNodeId: n.baseNodeId || null,
      wNodeId: n.wNodeId || null,
      imageSrc: n.imageSrc || null,
      roleKey: n.roleKey || null,
      depth: typeof n.depth === "number" ? n.depth : 0,
      mineScore: typeof n.mineScore === "number" ? n.mineScore : 100,
      mineHits: typeof n.mineHits === "number" ? n.mineHits : 0,
      mineExhaustion: typeof n.mineExhaustion === "number" ? n.mineExhaustion : 0,

      authorId: n.authorId || "localUser",
      sourceNodeId: n.sourceNodeId || null,
      rootNodeId: n.rootNodeId || null,
      copiedFromMapId: n.copiedFromMapId || null,
      visibility: n.visibility || "private",
      status: n.status || "draft",
      quoteCount: typeof n.quoteCount === "number" ? n.quoteCount : 0,
      pointScore: typeof n.pointScore === "number" ? n.pointScore : 0,
      createdAt: n.createdAt || Date.now(),
      updatedAt: n.updatedAt || Date.now()
    };
  };

  App.compactLink = function compactLink(l) {
    return {
      id: l.id,
      source: l.source,
      target: l.target,
      type: l.type || "related",
      weight: l.weight ?? 1,
      auto: !!l.auto,

      authorId: l.authorId || "localUser",
      sourceLinkId: l.sourceLinkId || null,
      copiedFromMapId: l.copiedFromMapId || null,
      visibility: l.visibility || "private",
      status: l.status || "draft",
      quoteCount: typeof l.quoteCount === "number" ? l.quoteCount : 0,
      pointScore: typeof l.pointScore === "number" ? l.pointScore : 0,
      createdAt: l.createdAt || Date.now(),
      updatedAt: l.updatedAt || Date.now()
    };
  };

  /* =========================
     RSS headline helpers
  ========================= */
  App.extractHeadlineKeywords = function extractHeadlineKeywords(text) {
    const raw = String(text || "")
      .replace(/[【】\[\]（）()「」『』:：,，.。!！?？/／\-—]+/g, " ")
      .trim();

    const parts = raw.match(/[A-Za-z0-9]+|[\u3040-\u30ff\u3400-\u9fff]{2,}/g) || [];
    const words = [];

    for (const p of parts) {
      const w = p.trim();
      if (!w) continue;
      if (w.length < 2) continue;
      if (App.RSS_STOPWORDS.has(w)) continue;
      words.push(w);
    }

    return App.uniqueStrings(words).slice(0, 8);
  };

  App.spawnHeadlineNode = function spawnHeadlineNode(headline) {
    if (!headline) return null;

    let root = App.nodeExistsByLabel(headline);

    if (!root) {
      root = App.makeNode({
        x: App.view.x + (Math.random() - 0.5) * 200,
        y: App.view.y + (Math.random() - 0.5) * 120,
        label: headline,
        memo: "RSS見出し",
        r: 30,
        color: "#34495e"
      });

      root.title = headline;
      root.tags = ["rss", "headline"];
      root.summary = "RSS見出しから生成";
      root.rootNodeId = root.id;
      App.nodes.push(root);
    }

    App.expandHeadline(root);
    return root;
  };

  App.expandHeadline = function expandHeadline(root) {
    const words = App.extractHeadlineKeywords(root.title);

    for (const word of words) {
      let child = App.nodeExistsByLabel(word);

      if (!child) {
        child = App.makeNode({
          x: root.x + (Math.random() - 0.5) * 240,
          y: root.y + 120 + Math.random() * 100,
          label: word,
          memo: "見出し抽出",
          r: 20
        });

        child.title = word;
        child.tags = ["rss-keyword", "rss-seed", "fresh"];
        child.rootNodeId = child.id;
        child.keywords = [root.title, word];
        App.nodes.push(child);
      }

      if (!App.linkExists(root.id, child.id)) {
        App.links.push(App.makeLink(root.id, child.id, "explore", 1, true));
      }
    }

    App.addLog("見出し展開: " + root.title);
  };

  console.log("app-utils finished");
})();
