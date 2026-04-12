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
    if (!App.dom.log) return;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    App.dom.log.textContent += `[${hh}:${mm}:${ss}] ${text}\n`;
    App.dom.log.scrollTop = App.dom.log.scrollHeight;
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
    if (s.length > 32) s = s.slice(0, 32);
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
     Hit / pointer helpers
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
        ) {
          return n;
        }
        continue;
      }

      const dx = worldX - n.x;
      const dy = worldY - n.y;
      if (dx * dx + dy * dy <= (n.r || 24) * (n.r || 24)) return n;
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
    if (typeof node.userFocusScore === "number") w += node.userFocusScore;

    if (node.is5w2h) w += 30;
    if (node.isInterdisciplinary) w += 10;
    if (node.imageSrc) w += 8;
    if (node.tags?.includes("unverified")) w -= 12;
    if (node.tags?.includes("wildcard")) w += 4;
    if (node.isUserCreated) w += 18;

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
     Image restore
  ========================= */
  App.restoreImageNode = function restoreImageNode(node) {
    if (!node.imageSrc) return;

    node.imageLoaded = false;
    node.imageEl = new Image();
    node.imageEl.onload = () => { node.imageLoaded = true; };
    node.imageEl.src = node.imageSrc;
  };

  /* =========================
     Factories
  ========================= */
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
      imageAspect: null,

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
      mineExhaustion: 0,

      isUserCreated: false,
      userFocusScore: 0,
      lastSelectedAt: 0,

      youtubeUrl: null,
      youtubeVideoId: null
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

  App.makeParty = function makeParty({
    name = "探索隊",
    memberIds = [],
    targetNodeId = null,
    objective = "explore",
    centerNodeId = null,
    radius = 1
  } = {}) {
    return {
      id: `party_${App.partyCounter++}`,
      name,
      memberIds,
      targetNodeId,
      objective,
      centerNodeId,
      radius,
      createdAt: Date.now(),
      active: true
    };
  };

  /* =========================
     5W2H / graph structure
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
        node.rootNodeId = node.id;
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

    for (const t of aTags) if (bTags.has(t)) score += 4;
    for (const k of aKeywords) if (bKeywords.has(k)) score += 3;

    if (aTitle.includes(bTitle) || bTitle.includes(aTitle)) score += 3;

    const sameCategory = a.category && b.category && a.category === b.category;
    if (sameCategory) score += 2;

    if (a.isAutoCandidate || b.isAutoCandidate) score -= 1;
    if (a.tags?.includes("unverified")) score -= 3;
    if (b.tags?.includes("unverified")) score -= 3;

    return score;
  };

  App.getPartyNodes = function getPartyNodes(party) {
    const center = App.getNode(party?.centerNodeId);
    if (!center) return [];

    const result = new Set([center.id]);
    let frontier = [center.id];

    for (let depth = 0; depth < (party.radius || 1); depth++) {
      const next = [];
      for (const nodeId of frontier) {
        for (const link of App.links) {
          if (link.source === nodeId && !result.has(link.target)) {
            result.add(link.target);
            next.push(link.target);
          }
          if (link.target === nodeId && !result.has(link.source)) {
            result.add(link.source);
            next.push(link.source);
          }
        }
      }
      frontier = next;
    }

    return [...result].map(id => App.getNode(id)).filter(Boolean);
  };

  /* =========================
     Merge duplicates
  ========================= */
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
      keeper.youtubeUrl = keeper.youtubeUrl || node.youtubeUrl;
      keeper.youtubeVideoId = keeper.youtubeVideoId || node.youtubeVideoId;
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
     CRUD / Search
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
    n.isUserCreated = true;
    n.userFocusScore = 50;
    n.lastSelectedAt = Date.now();

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
    n.isUserCreated = true;
    n.userFocusScore = 40;
    n.lastSelectedAt = Date.now();

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
     YouTube helpers
  ========================= */
  App.isYoutubeUrl = function isYoutubeUrl(text) {
    const s = String(text || "").trim();
    return /youtu\.be\/|youtube\.com\/watch\?v=|youtube\.com\/shorts\/|youtube\.com\/embed\//i.test(s);
  };

  App.extractYoutubeVideoId = function extractYoutubeVideoId(url) {
    const s = String(url || "").trim();

    let m = s.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];

    m = s.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];

    m = s.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];

    m = s.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];

    return null;
  };

  App.getYoutubeThumbUrl = function getYoutubeThumbUrl(videoId) {
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  };

  App.createYoutubeNodeAtWorld = function createYoutubeNodeAtWorld(x, y, url, label = "YouTube") {
    const videoId = App.extractYoutubeVideoId(url);
    if (!videoId) return null;

    const thumb = App.getYoutubeThumbUrl(videoId);

    const n = App.makeNode({
      x, y,
      label,
      memo: url,
      width: 200,
      height: 120,
      shape: "rect",
      color: "#2b3344",
      textColor: "#eaf1ff",
      imageSrc: thumb
    });

    n.title = label;
    n.rootNodeId = n.id;
    n.tags = ["youtube", "video"];
    n.category = "youtube";
    n.youtubeUrl = url;
    n.youtubeVideoId = videoId;
    n.summary = "YouTube動画ノード";
    n.isUserCreated = true;
    n.userFocusScore = 45;
    n.lastSelectedAt = Date.now();

    App.restoreImageNode(n);

    if (n.imageEl) {
      n.imageEl.onload = () => {
        n.imageLoaded = true;
        n.width = 200;
        n.height = 120;
        n.imageAspect = 16 / 9;
      };
      n.imageEl.src = thumb;
    }

    App.nodes.push(n);
    App.selectedNodeId = n.id;
    App.addLog(`YouTubeノード追加: ${label}`);
    return n;
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
      root.userFocusScore = 10;

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
          r: 20,
          color: "#2b3344",
          textColor: "#eaf1ff"
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

  /* =========================
     Save serializers
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
      imageAspect: n.imageAspect || null,

      roleKey: n.roleKey || null,

      authorId: n.authorId || "localUser",
      sourceNodeId: n.sourceNodeId || null,
      rootNodeId: n.rootNodeId || null,
      copiedFromMapId: n.copiedFromMapId || null,
      visibility: n.visibility || "private",
      status: n.status || "draft",
      quoteCount: typeof n.quoteCount === "number" ? n.quoteCount : 0,
      pointScore: typeof n.pointScore === "number" ? n.pointScore : 0,

      createdAt: n.createdAt || Date.now(),
      updatedAt: n.updatedAt || Date.now(),

      depth: typeof n.depth === "number" ? n.depth : 0,
      mineScore: typeof n.mineScore === "number" ? n.mineScore : 100,
      mineHits: typeof n.mineHits === "number" ? n.mineHits : 0,
      mineExhaustion: typeof n.mineExhaustion === "number" ? n.mineExhaustion : 0,

      isUserCreated: !!n.isUserCreated,
      userFocusScore: typeof n.userFocusScore === "number" ? n.userFocusScore : 0,
      lastSelectedAt: typeof n.lastSelectedAt === "number" ? n.lastSelectedAt : 0,

      youtubeUrl: n.youtubeUrl || null,
      youtubeVideoId: n.youtubeVideoId || null
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

  
/* ===== integrated overrides ===== */
App.tryExtractYoutubeVideoId = function tryExtractYoutubeVideoId(url) {
  return App.extractYoutubeVideoId ? App.extractYoutubeVideoId(url) : null;
};

App.normalizeUrlKey = function normalizeUrlKey(url) {
  if (!url) return "";
  try {
    const u = new URL(String(url).trim());
    u.hash = "";
    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
      const vid = App.tryExtractYoutubeVideoId(url);
      if (vid) return `yt:${vid}`;
    }
    const params = [...u.searchParams.entries()]
      .filter(([k]) => !["utm_source","utm_medium","utm_campaign","utm_term","utm_content","fbclid","gclid","t"].includes(k))
      .sort((a,b)=> a[0].localeCompare(b[0]));
    u.search = "";
    for (const [k,v] of params) u.searchParams.append(k,v);
    return u.toString();
  } catch {
    return String(url).trim();
  }
};

const _origMakeNode = App.makeNode;
App.makeNode = function makeNodeIntegrated(opts={}) {
  const node = _origMakeNode(opts);
  node.z = typeof opts.z === "number" ? opts.z : 0;
  node.hidden = !!opts.hidden;
  node.mediaType = opts.mediaType || node.mediaType || null;
  node.mediaUrl = opts.mediaUrl || node.mediaUrl || null;
  node.thumbUrl = opts.thumbUrl || node.thumbUrl || null;
  node.url = opts.url || node.url || null;
  node.openInOverlay = !!opts.openInOverlay;
  node.authorName = node.authorName || (App.userState?.userName || "guest");
  node.mapType = node.mapType || (App.currentMapType || "private");
  node.aliases = Array.isArray(node.aliases) ? node.aliases : [];
  node.aliasSources = Array.isArray(node.aliasSources) ? node.aliasSources : [];
  node.canonicalTitle = node.canonicalTitle || node.title || node.label || "";
  node.sourceType = node.sourceType || null;
  node.sourceTitle = node.sourceTitle || "";
  node.sourceUrl = node.sourceUrl || "";
  node.sourceDomain = node.sourceDomain || "";
  node.referrerNodeId = node.referrerNodeId || null;
  node.pointSource = node.pointSource || null;
  node.isAliasNode = !!node.isAliasNode;
  node.parentNodeId = node.parentNodeId || null;
  node.aliasIndex = typeof node.aliasIndex === "number" ? node.aliasIndex : -1;
  node.zIndex = typeof node.zIndex === "number" ? node.zIndex : 0;
  return node;
};

const _origCompactNode = App.compactNode;
App.compactNode = function compactNodeIntegrated(n){
  const o = _origCompactNode(n);
  return {
    ...o,
    z: typeof n.z === "number" ? n.z : 0,
    hidden: !!n.hidden,
    mediaType: n.mediaType || null,
    mediaUrl: n.mediaUrl || null,
    thumbUrl: n.thumbUrl || null,
    url: n.url || null,
    openInOverlay: !!n.openInOverlay,
    authorName: n.authorName || "guest",
    aliases: Array.isArray(n.aliases) ? n.aliases : [],
    aliasSources: Array.isArray(n.aliasSources) ? n.aliasSources : [],
    canonicalTitle: n.canonicalTitle || n.title || n.label || "",
    sourceType: n.sourceType || null,
    sourceTitle: n.sourceTitle || "",
    sourceUrl: n.sourceUrl || "",
    sourceDomain: n.sourceDomain || "",
    referrerNodeId: n.referrerNodeId || null,
    pointSource: n.pointSource || null,
    isAliasNode: !!n.isAliasNode,
    parentNodeId: n.parentNodeId || null,
    aliasIndex: typeof n.aliasIndex === "number" ? n.aliasIndex : -1,
    zIndex: typeof n.zIndex === "number" ? n.zIndex : 0
  };
};

App.restoreNodeRuntime = function restoreNodeRuntime(n) {
  const node = {
    ...n,
    vx: 0, vy: 0,
    imageEl: null, imageLoaded: false,
    wikiBusy: false,
    title: n.title || n.label || "",
    keywords: Array.isArray(n.keywords) ? n.keywords : [],
    tags: Array.isArray(n.tags) ? n.tags : [],
    summary: typeof n.summary === "string" ? n.summary : "",
    hidden: !!n.hidden,
    z: typeof n.z === "number" ? n.z : 0,
    url: n.url || null,
    mediaUrl: n.mediaUrl || null,
    mediaType: n.mediaType || null,
    thumbUrl: n.thumbUrl || null,
    openInOverlay: !!n.openInOverlay,
    authorName: n.authorName || "guest",
    aliases: Array.isArray(n.aliases) ? n.aliases : [],
    aliasSources: Array.isArray(n.aliasSources) ? n.aliasSources : [],
    canonicalTitle: n.canonicalTitle || n.title || n.label || "",
    sourceType: n.sourceType || null,
    sourceTitle: n.sourceTitle || "",
    sourceUrl: n.sourceUrl || "",
    sourceDomain: n.sourceDomain || "",
    referrerNodeId: n.referrerNodeId || null,
    pointSource: n.pointSource || null,
    isAliasNode: !!n.isAliasNode,
    parentNodeId: n.parentNodeId || null,
    aliasIndex: typeof n.aliasIndex === "number" ? n.aliasIndex : -1,
    zIndex: typeof n.zIndex === "number" ? n.zIndex : 0
  };
  if (node.imageSrc) App.restoreImageNode(node);
  return node;
};

App.makeSavePayload = function makeSavePayload() {
  return {
    idCounter: App.idCounter,
    view: { ...App.view },
    followAgentId: App.followAgentId,
    pendingAgentTargetId: App.pendingAgentTargetId,
    roleCounts: { ...App.roleCounts },
    totalAgentCount: App.totalAgentCount,
    uiState: { ...App.uiState },
    zoomedImageNodeId: App.zoomedImageNodeId,
    currentMapType: App.currentMapType,
    currentMapId: App.currentMapId,
    currentSaveName: App.currentSaveName,
    userState: { ...App.userState },
    integrations: { ...App.integrations },
    searchProviders: JSON.parse(JSON.stringify(App.searchProviders)),
    nodes: App.nodes.map(App.compactNode),
    links: App.links.map(App.compactLink),
    agents: App.agents.map(a => ({
      id: a.id, role: a.role, tickOffset: a.tickOffset, targetNodeId: a.targetNodeId,
      mode: a.mode, taskText: a.taskText, workUntilFrame: a.workUntilFrame, busy: a.busy,
      mineState: a.mineState || null, partyId: a.partyId || null, thinkingStyle: a.thinkingStyle || "balanced",
      displayName: a.displayName || "", hp: typeof a.hp === "number" ? a.hp : 100, hunger: typeof a.hunger === "number" ? a.hunger : 0
    })),
    panelPins: { ...App.panelPins },
    panelPositions: { ...App.panelPositions },
    rssSeenHeadlines: [...App.rssState.seenHeadlines]
  };
};

App.defaultSaveName = function defaultSaveName() {
  const d = new Date();
  const pad = n => String(n).padStart(2,"0");
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${App.userState?.userName || "guest"}`;
};

App.getSlotStore = function getSlotStore() {
  try { const raw = localStorage.getItem(App.SLOT_KEY); return raw ? (JSON.parse(raw) || []) : []; } catch { return []; }
};
App.setSlotStore = function setSlotStore(list) { localStorage.setItem(App.SLOT_KEY, JSON.stringify(Array.isArray(list) ? list : [])); };

App.googleSearch = async function googleSearch(query, maxResults = 8) {
  const apiKey = String(App.integrations?.googleApiKey || "").trim();
  const cx = String(App.integrations?.googleCx || "").trim();
  if (!apiKey || !cx) return [];
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey); url.searchParams.set("cx", cx); url.searchParams.set("q", query);
  url.searchParams.set("num", String(Math.min(10, Math.max(1, maxResults))));
  const res = await fetch(url.toString(), { cache: "no-store" }); const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "Google search failed");
  return (data.items || []).map((item, i) => ({ id: `gweb_${i}_${item.cacheId || i}`, type: "web", title: item.title || item.link || "Google result", url: item.link || "", snippet: item.snippet || "", source: "google" }));
};
App.googleImageSearch = async function googleImageSearch(query, maxResults = 8) {
  const apiKey = String(App.integrations?.googleApiKey || "").trim();
  const cx = String(App.integrations?.googleCx || "").trim();
  if (!apiKey || !cx) return [];
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey); url.searchParams.set("cx", cx); url.searchParams.set("q", query); url.searchParams.set("searchType", "image");
  url.searchParams.set("num", String(Math.min(10, Math.max(1, maxResults))));
  const res = await fetch(url.toString(), { cache: "no-store" }); const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "Google image search failed");
  return (data.items || []).map((item, i) => ({ id: `gimg_${i}_${item.cacheId || i}`, type: "image", title: item.title || "Google image", url: item.link || "", imageUrl: item.link || "", snippet: item.snippet || "", thumbUrl: item.image?.thumbnailLink || item.link || "", source: "google" }));
};
App.searchWebAll = async function searchWebAll(query) {
  const providers = App.searchProviders?.web || {};
  let results = [];
  if (providers.duckduckgo) {
    const words = await App.webSuggestWords(query);
    results.push(...words.map((w, i) => ({ id: `ddg_${i}_${w}`, type: "web", title: w, url: `https://duckduckgo.com/?q=${encodeURIComponent(w)}`, snippet: `${query} の関連候補`, source: "duckduckgo" })));
  }
  if (providers.wikipedia) {
    const wiki = await App.wikiOpenSearch(query, 6);
    results.push(...wiki.map((w, i) => ({ id: `wiki_${i}_${w}`, type: "web", title: w, url: `https://ja.wikipedia.org/wiki/${encodeURIComponent(w)}`, snippet: `${query} のWikipedia候補`, source: "wikipedia" })));
  }
  if (providers.google) results.push(...await App.googleSearch(query, 8));
  const seen = new Set();
  return results.filter(r => { const key = `${r.source}__${r.url}`; if (seen.has(key)) return false; seen.add(key); return true; });
};
App.searchImageAll = async function searchImageAll(query) {
  const providers = App.searchProviders?.image || {};
  let results = [];
  if (providers.wikipedia) {
    const titles = await App.wikiOpenSearch(query, 8);
    for (let i=0;i<titles.length;i++) {
      const t = titles[i]; const img = await App.wikiImageForTitle(t); if (!img) continue;
      results.push({ id:`wimg_${i}_${t}`, type:"image", title:t, imageUrl:img, thumbUrl:img, url:`https://ja.wikipedia.org/wiki/${encodeURIComponent(t)}`, snippet:`${query} のWikipedia画像候補`, source:"wikipedia" });
    }
  }
  if (providers.google) results.push(...await App.googleImageSearch(query, 8));
  const seen = new Set();
  return results.filter(r => { const key = `${r.source}__${r.imageUrl || r.url}`; if (seen.has(key)) return false; seen.add(key); return true; });
};

const _origCreateImageNodeAtWorld = App.createImageNodeAtWorld;
App.createImageNodeAtWorld = function(x,y,imageSrc,label="画像",opts={}) {
  const n = _origCreateImageNodeAtWorld(x,y,imageSrc,label);
  n.url = opts.url || n.url || null;
  n.sourceUrl = opts.url || n.sourceUrl || "";
  n.sourceType = opts.sourceType || n.sourceType || "image";
  n.thumbUrl = imageSrc || n.thumbUrl || null;
  n.mediaType = "image";
  return n;
};

const _origCreateNodeAtWorld = App.createNodeAtWorld;
App.createNodeAtWorld = function(x,y,label="新規ノード",opts={}) {
  const n = _origCreateNodeAtWorld(x,y,label);
  n.z = typeof opts.z === "number" ? opts.z : n.z || 0;
  n.hidden = !!opts.hidden;
  n.url = opts.url || n.url || null;
  n.sourceUrl = opts.sourceUrl || n.sourceUrl || "";
  n.sourceType = opts.sourceType || n.sourceType || null;
  n.sourceTitle = opts.sourceTitle || n.sourceTitle || "";
  n.sourceDomain = opts.sourceDomain || n.sourceDomain || "";
  n.summary = opts.summary || n.summary || "手動作成";
  return n;
};

const _origCreateYoutubeNodeAtWorld = App.createYoutubeNodeAtWorld;
App.createYoutubeNodeAtWorld = function(x,y,url,label="YouTube") {
  const n = _origCreateYoutubeNodeAtWorld(x,y,url,label);
  if (!n) return null;
  n.sourceUrl = n.sourceUrl || url;
  n.sourceType = n.sourceType || "youtube";
  n.sourceDomain = n.sourceDomain || App.tryGetHostname(url);
  n.thumbUrl = n.thumbUrl || n.imageSrc;
  return n;
};

App.createLinkNodeAtWorld = function createLinkNodeAtWorld(x, y, url, label = "") {
  const fixedUrl = App.normalizeUrl(url);
  const linkKind = App.inferLinkKind(fixedUrl);
  if (linkKind === "youtube") return App.createYoutubeNodeAtWorld(x, y, fixedUrl, label || "YouTube");
  if (linkKind === "image") return App.createImageNodeAtWorld(x, y, fixedUrl, label || "画像リンク", { memo: fixedUrl, url: fixedUrl, sourceType: "image" });
  const display = label || App.tryGetHostname(fixedUrl) || "リンク";
  const n = App.makeNode({ x, y, label: display, memo: fixedUrl, width: 180, height: 80, shape: "rect", color: "#2f3748", textColor: "#eaf1ff", category: "link" });
  n.title = display; n.url = fixedUrl; n.mediaUrl = fixedUrl; n.mediaType = linkKind; n.tags = ["link", linkKind]; n.summary = "URLリンクノード"; n.rootNodeId = n.id; n.isUserCreated = true; n.userFocusScore = 30; n.lastSelectedAt = Date.now();
  n.sourceUrl = fixedUrl; n.sourceType = linkKind || "link"; n.sourceDomain = App.tryGetHostname(fixedUrl);
  App.nodes.push(n); App.selectedNodeId = n.id; App.bringNodeToFront(n); App.addLog(`リンクノード追加: ${display}`); return n;
};

App.importWebSearchResultAsNode = function importWebSearchResultAsNode(sourceNode, result) {
  if (!sourceNode || !result) return null;
  const baseX = sourceNode.x + (Math.random() - 0.5) * 240;
  const baseY = sourceNode.y + 120 + Math.random() * 120;
  let child = null;
  if (result.type === "image") {
    child = App.createImageNodeAtWorld(baseX, baseY, result.imageUrl || result.url, result.title || "画像", { url: result.url || null, sourceType: result.source || "image" });
    if (child) child.memo = result.snippet || "";
  } else if (result.type === "youtube") {
    child = App.createYoutubeNodeAtWorld(baseX, baseY, result.url, result.title || "YouTube");
    if (child) {
      child.memo = result.snippet || child.memo;
      child.thumbUrl = result.thumbUrl || child.thumbUrl;
      if (result.thumbUrl && result.thumbUrl !== child.imageSrc) { child.imageSrc = result.thumbUrl; App.restoreImageNode(child); }
      child.tags = App.uniqueStrings([...(child.tags || []), "search-import", "youtube-api"]);
    }
  } else {
    child = App.createLinkNodeAtWorld(baseX, baseY, result.url, result.title || "Web");
    if (child) child.summary = result.snippet || child.summary;
  }
  if (child) {
    child.sourceType = result.source || null;
    child.sourceTitle = result.title || "";
    child.sourceUrl = result.url || "";
    child.sourceDomain = App.tryGetHostname(result.url || "");
    child.referrerNodeId = sourceNode.id;
    child.pointSource = { origin: result.source || "", url: result.url || "", weight: 1 };
    App.addLinkSmart(sourceNode, child, result.type === "image" ? "media" : "search");
    App.mergeDuplicateNodes();
    App.syncAllAliasChildNodes?.();
  }
  return child;
};

App.mergeNodes = function mergeNodes(base, other, reason = "duplicate") {
  if (!base || !other || base.id === other.id) return base;
  const otherName = other.title || other.label || "";
  const otherSourceUrl = other.sourceUrl || other.url || "";
  const otherSourceType = other.sourceType || other.mediaType || "";
  const aliasSet = new Set([...(base.aliases || []), ...(other.aliases || []), otherName].filter(Boolean));
  base.aliases = [...aliasSet].filter(a => a !== (base.title || base.label));
  const aliasSources = [...(base.aliasSources || []), ...(other.aliasSources || [])];
  if (otherName || otherSourceUrl) aliasSources.push({ title: otherName, url: otherSourceUrl, type: otherSourceType, reason });
  const aliasSourceSeen = new Set();
  base.aliasSources = aliasSources.filter(x => { const key = `${x.title || ""}__${x.url || ""}__${x.type || ""}`; if (aliasSourceSeen.has(key)) return false; aliasSourceSeen.add(key); return true; });
  base.tags = App.uniqueStrings([...(base.tags || []), ...(other.tags || [])]);
  base.keywords = App.uniqueStrings([...(base.keywords || []), ...(other.keywords || [])]);
  base.memo = [base.memo, other.memo].filter(Boolean).join("\n");
  base.summary = base.summary || other.summary;
  if (!base.url && other.url) base.url = other.url;
  if (!base.sourceUrl && other.sourceUrl) base.sourceUrl = other.sourceUrl;
  if (!base.sourceType && other.sourceType) base.sourceType = other.sourceType;
  if (!base.sourceTitle && other.sourceTitle) base.sourceTitle = other.sourceTitle;
  if (!base.sourceDomain && other.sourceDomain) base.sourceDomain = other.sourceDomain;
  if (!base.referrerNodeId && other.referrerNodeId) base.referrerNodeId = other.referrerNodeId;
  if (!base.pointSource && other.pointSource) base.pointSource = other.pointSource;
  if (!base.imageSrc && other.imageSrc) { base.imageSrc = other.imageSrc; base.thumbUrl = other.thumbUrl || other.imageSrc; base.shape = "rect"; App.restoreImageNode(base); }
  if (!base.youtubeUrl && other.youtubeUrl) base.youtubeUrl = other.youtubeUrl;
  if (!base.youtubeVideoId && other.youtubeVideoId) base.youtubeVideoId = other.youtubeVideoId;
  if (!base.mediaType && other.mediaType) base.mediaType = other.mediaType;
  if (!base.mediaUrl && other.mediaUrl) base.mediaUrl = other.mediaUrl;
  base.pointScore = (base.pointScore || 0) + (other.pointScore || 0);
  base.quoteCount = (base.quoteCount || 0) + (other.quoteCount || 0);
  base.userFocusScore = Math.max(base.userFocusScore || 0, other.userFocusScore || 0);
  base.mineScore = Math.max(base.mineScore || 0, other.mineScore || 0);
  base.updatedAt = Date.now();
  if (!base.canonicalTitle) base.canonicalTitle = base.title || base.label || "";
  App.links.forEach(link => { if (link.source === other.id) link.source = base.id; if (link.target === other.id) link.target = base.id; });
  App.links = App.links.filter(l => l.source !== l.target);
  const seenLinks = new Set();
  App.links = App.links.filter(l => { const a = l.source < l.target ? l.source : l.target; const b = l.source < l.target ? l.target : l.source; const key = `${a}__${b}__${l.type || "related"}`; if (seenLinks.has(key)) return false; seenLinks.add(key); return true; });
  App.nodes = App.nodes.filter(n => n.id !== other.id);
  if (App.selectedNodeId === other.id) App.selectedNodeId = base.id;
  if (App.zoomedImageNodeId === other.id) App.zoomedImageNodeId = base.id;
  App.syncAliasChildNodes?.(base);
  return base;
};
App.mergeDuplicateNodesByUrl = function mergeDuplicateNodesByUrl() {
  const map = new Map();
  for (const node of [...App.nodes]) {
    if (!node || node.is5w2h || node.isAgentNode || node.isAliasNode) continue;
    const urlKey = App.normalizeUrlKey(node.url || node.sourceUrl || node.mediaUrl || node.youtubeUrl || "");
    if (!urlKey) continue;
    if (!map.has(urlKey)) map.set(urlKey, node);
    else App.mergeNodes(map.get(urlKey), node, "same-url");
  }
};
App.mergeDuplicateNodes = function mergeDuplicateNodes() {
  App.mergeDuplicateNodesByUrl();
  const map = new Map();
  for (const node of [...App.nodes]) {
    if (!node || node.is5w2h || node.isAgentNode || node.isAliasNode) continue;
    const key = App.normalizeTitleKey(node.title || node.label);
    if (!key) continue;
    if (!map.has(key)) map.set(key, node);
    else App.mergeNodes(map.get(key), node, "same-title");
  }
  App.syncAllAliasChildNodes?.();
};
App.makeAliasChildNode = function makeAliasChildNode(parentNode, aliasText, aliasIndex = 0) {
  if (!parentNode || !aliasText) return null;
  const angle = (Math.PI * 2 / Math.max(1, (parentNode.aliases || []).length)) * aliasIndex;
  const radius = Math.max(70, (parentNode.r || 24) + 48);
  const x = parentNode.x + Math.cos(angle) * radius;
  const y = parentNode.y + Math.sin(angle) * radius;
  const child = App.makeNode({ x, y, label: aliasText, memo: "別名サブノード", r: 14, color: "#3d4b63", textColor: "#dbeafe", category: "alias" });
  child.title = aliasText; child.summary = "統合ノードの別名"; child.isAliasNode = true; child.parentNodeId = parentNode.id; child.aliasIndex = aliasIndex;
  child.tags = ["alias","subnode"]; child.isUserCreated = false; child.userFocusScore = 0; child.rootNodeId = parentNode.rootNodeId || parentNode.id;
  return child;
};
App.syncAliasChildNodes = function syncAliasChildNodes(parentNode) {
  if (!parentNode || parentNode.isAliasNode) return;
  const aliases = (parentNode.aliases || []).filter(Boolean);
  const existing = App.nodes.filter(n => n.isAliasNode && n.parentNodeId === parentNode.id);
  for (let i = existing.length; i < aliases.length; i++) {
    const aliasNode = App.makeAliasChildNode(parentNode, aliases[i], i);
    if (aliasNode) { App.nodes.push(aliasNode); App.links.push(App.makeLink(parentNode.id, aliasNode.id, "alias", 0.6, true)); }
  }
  if (existing.length > aliases.length) {
    const remove = existing.slice(aliases.length); const removeIds = new Set(remove.map(n => n.id));
    App.nodes = App.nodes.filter(n => !removeIds.has(n.id));
    App.links = App.links.filter(l => !removeIds.has(l.source) && !removeIds.has(l.target));
  }
  const children = App.nodes.filter(n => n.isAliasNode && n.parentNodeId === parentNode.id);
  children.forEach((child, i) => {
    const aliasText = aliases[i]; child.aliasIndex = i; child.title = aliasText; child.label = aliasText;
    const angle = (Math.PI * 2 / Math.max(1, aliases.length)) * i;
    const radius = Math.max(70, (parentNode.shape === "rect" ? Math.max(parentNode.width || 120, parentNode.height || 80) * 0.5 : (parentNode.r || 24)) + 52);
    child.x = parentNode.x + Math.cos(angle) * radius;
    child.y = parentNode.y + Math.sin(angle) * radius;
  });
};
App.syncAllAliasChildNodes = function syncAllAliasChildNodes() {
  const parents = App.nodes.filter(n => !n.isAliasNode && !n.is5w2h && !n.isAgentNode && Array.isArray(n.aliases) && n.aliases.length > 0);
  parents.forEach(parent => App.syncAliasChildNodes(parent));
};
App.grantUserPoints = function grantUserPoints(value, reason = "") { const add = Number(value || 0); if (!Number.isFinite(add) || add === 0) return; App.userState.points = Math.max(0, (App.userState.points || 0) + add); if (reason) App.addLog(`Pt ${add > 0 ? "+" : ""}${add}: ${reason}`); };
App.applyWorldCreateReward = function applyWorldCreateReward(node, isNew = true) { if (!node || App.currentMapType !== "world") return; const delta = isNew ? 1 : 0.1; node.pointScore = (node.pointScore || 0) + delta; App.grantUserPoints(delta, `ワールド作成 ${node.title || node.label}`); };

console.log("app-utils finished");
})();