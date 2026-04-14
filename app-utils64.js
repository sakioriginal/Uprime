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

  App.getLink = function getLink(id) {
    return App.links.find(l => l.id === id) || null;
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
     Pointer helpers
  ========================= */
  App.pointerPosFromEvent = function pointerPosFromEvent(e) {
    const rect = App.dom.canvas.getBoundingClientRect();
    return {
      x: (e.clientX ?? 0) - rect.left,
      y: (e.clientY ?? 0) - rect.top
    };
  };

  /* =========================
     Hit tests
  ========================= */
  App.hitTestNode = function hitTestNode(worldX, worldY) {
    for (let i = App.nodes.length - 1; i >= 0; i--) {
      const n = App.nodes[i];
      if (!n.isAgentNode && n.visible === false) continue;
      if (!n.isAgentNode && !App.visibleNodeSet.has(n.id)) continue;

      const scaleFactor = App.getNodeScaleFactor ? App.getNodeScaleFactor(n) : 1;

      if (n.shape === "rect") {
        const w = (n.width || 120) * scaleFactor;
        const h = (n.height || 80) * scaleFactor;
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

      const rr = (n.r || 24) * scaleFactor;
      const dx = worldX - n.x;
      const dy = worldY - n.y;
      if (dx * dx + dy * dy <= rr * rr) return n;
    }
    return null;
  };

  App.hitResizeHandle = function hitResizeHandle(node, worldX, worldY) {
    if (!node || node.shape !== "rect") return false;

    const scaleFactor = App.getNodeScaleFactor ? App.getNodeScaleFactor(node) : 1;
    const hw = ((node.width || 120) * scaleFactor) / 2;
    const hh = ((node.height || 80) * scaleFactor) / 2;
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

  App.hitTestLink = function hitTestLink(worldX, worldY) {
    let best = null;
    let bestDist = Infinity;

    for (const link of App.links) {
      const a = App.getNode(link.source);
      const b = App.getNode(link.target);
      if (!a || !b) continue;

      if ((!a.isAgentNode && a.visible === false) || (!b.isAgentNode && b.visible === false)) continue;
      if (!a.isAgentNode && !App.visibleNodeSet.has(a.id)) continue;
      if (!b.isAgentNode && !App.visibleNodeSet.has(b.id)) continue;

      const d = App.distancePointToSegment(worldX, worldY, a.x, a.y, b.x, b.y);
      if (d < bestDist && d <= 16 / App.view.scale) {
        bestDist = d;
        best = link;
      }
    }

    return best;
  };

  App.distancePointToSegment = function distancePointToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;

    if (dx === 0 && dy === 0) {
      return Math.hypot(px - x1, py - y1);
    }

    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
    const qx = x1 + t * dx;
    const qy = y1 + t * dy;
    return Math.hypot(px - qx, py - qy);
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
    if (node.visible === false) w -= 9999;

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

  App.getNodeScaleFactor = function getNodeScaleFactor(node) {
    const weight = App.computeNodeDisplayWeight(node);
    const raw = Math.sqrt(Math.max(1, weight) / 50);
    return Math.max(
      Number(App.uiState.minNodeScale || 0.6),
      Math.min(Number(App.uiState.maxNodeScale || 2.5), raw)
    );
  };

  App.getVisibleNodeSet = function getVisibleNodeSet() {
    const normalNodes = App.nodes.filter(n => !n.isAgentNode && n.visible !== false);

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
     User focus / boost
  ========================= */
  App.boostNodeByUser = function boostNodeByUser(node, amount = null) {
    if (!node) return;
    const add = typeof amount === "number" ? amount : Number(App.uiState.selectBoostAmount || 10);
    node.userFocusScore = (node.userFocusScore || 0) + add;
    node.lastSelectedAt = Date.now();
    node.updatedAt = Date.now();
  };

  App.decayUserFocusScore = function decayUserFocusScore(node) {
    if (!node || !node.lastSelectedAt) return;

    const dt = Date.now() - node.lastSelectedAt;
    const decaySteps = Math.floor(dt / 5000);
    if (decaySteps <= 0) return;

    node.userFocusScore = Math.max(0, (node.userFocusScore || 0) - decaySteps);
    node.lastSelectedAt = Date.now();
  };

  App.selectNode = function selectNode(node, reason = "select") {
    if (!node) {
      App.selectedNodeId = null;
      App.selectedLinkId = null;
      App.hoveredLinkId = null;
      return;
    }

    App.selectedNodeId = node.id;
    App.selectedLinkId = null;
    App.hoveredLinkId = null;

    if (App.uiState.boostOnSelect) {
      const amount = reason === "tap"
        ? Number(App.uiState.tapBoostAmount || 6)
        : Number(App.uiState.selectBoostAmount || 10);
      App.boostNodeByUser(node, amount);
    }

    if (App.uiState.autoShowNodeDetail) {
      App.uiState.showNodeDetailPanel = true;
    }

    App.syncQuickInputFromSelection();
  };

  /* =========================
     Image restore
  ========================= */
  App.restoreImageNode = function restoreImageNode(node) {
    if (!node.imageSrc) return;

    node.imageLoaded = false;
    node.imageEl = new Image();
    node.imageEl.onload = () => {
      node.imageLoaded = true;
    };
    node.imageEl.src = node.imageSrc;
  };

  /* =========================
     Factories
  ========================= */
  App.makeNode = function makeNode({
    x = 0,
    y = 0,
    z = 0,
    label = "ノード",
    memo = "",
    r = 24,
    width = 120,
    height = 80,
    shape = "circle",
    color = "#2b3344",
    textColor = "#eaf1ff",
    fixed = false,
    visible = true,
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

      x, y, z,
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
      visible,

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
          visible: true,
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
        node.visible = true;
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
      keeper.userFocusScore = Math.max(keeper.userFocusScore || 0, node.userFocusScore || 0);
      keeper.visible = keeper.visible !== false && node.visible !== false;

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
      z: 0,
      label: clean,
      memo: "",
      r: 24,
      color: "#2b3344",
      textColor: "#eaf1ff",
      category: "normal",
      visible: true
    });

    n.title = clean;
    n.summary = "手動作成";
    n.rootNodeId = n.id;
    n.isUserCreated = true;
    n.userFocusScore = 50;
    n.lastSelectedAt = Date.now();

    App.nodes.push(n);
    App.selectNode(n, "select");
    App.addLog(`ノード追加: ${clean}`);
    return n;
  };

  App.createImageNodeAtWorld = function createImageNodeAtWorld(x, y, imageSrc, label = "画像") {
    const n = App.makeNode({
      x, y,
      z: 0,
      label,
      memo: "画像ノード",
      width: 160,
      height: 120,
      shape: "rect",
      color: "#2b3344",
      textColor: "#eaf1ff",
      imageSrc,
      visible: true
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
    App.selectNode(n, "select");
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

    App.pruneState.lastDeletedNodeId = nodeId;
    App.addLog(`ノード削除: ${n.title || n.label}`);
  };

  App.deleteLink = function deleteLink(linkId) {
    const link = App.getLink(linkId);
    if (!link) return false;

    App.links = App.links.filter(l => l.id !== linkId);
    if (App.selectedLinkId === linkId) App.selectedLinkId = null;
    if (App.hoveredLinkId === linkId) App.hoveredLinkId = null;
    App.pruneState.lastDeletedLinkId = linkId;

    const a = App.getNode(link.source);
    const b = App.getNode(link.target);
    App.addLog(`リンク切断: ${(a?.title || a?.label || link.source)} ↔ ${(b?.title || b?.label || link.target)}`);
    return true;
  };

  App.cutLinksOfNode = function cutLinksOfNode(nodeId) {
    const node = App.getNode(nodeId);
    if (!node) return 0;

    const before = App.links.length;
    App.links = App.links.filter(l => l.source !== nodeId && l.target !== nodeId);
    const removed = before - App.links.length;
    App.addLog(`リンク切断: ${node.title || node.label} (${removed}本)`);
    return removed;
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
    App.selectNode(node, "select");
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
      z: 0,
      label,
      memo: url,
      width: 200,
      height: 120,
      shape: "rect",
      color: "#2b3344",
      textColor: "#eaf1ff",
      imageSrc: thumb,
      visible: true
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
    App.selectNode(n, "select");
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

  App.addRssHeadlineAsBranch = function addRssHeadlineAsBranch(headline) {
    const rootLabel = String(headline || "").trim();
    if (!rootLabel) return null;

    let root = App.nodeExistsByLabel(rootLabel);
    if (!root) {
      root = App.makeNode({
        x: App.view.x + (Math.random() - 0.5) * 120,
        y: App.view.y + (Math.random() - 0.5) * 80,
        label: rootLabel,
        memo: "RSS見出しノード",
        r: 26,
        color: "#34495e",
        textColor: "#eaf1ff",
        visible: true
      });
      root.title = rootLabel;
      root.tags = ["rss", "headline"];
      root.summary = "RSS見出しから生成";
      root.rootNodeId = root.id;
      App.nodes.push(root);
    }

    const words = App.extractHeadlineKeywords(rootLabel).slice(0, 8);

    for (const word of words) {
      let child = App.nodeExistsByLabel(word);

      if (!child) {
        child = App.makeNode({
          x: root.x + (Math.random() - 0.5) * 220,
          y: root.y + 100 + Math.random() * 120,
          label: word,
          memo: "RSS見出しから抽出",
          r: 20,
          color: "#2b3344",
          textColor: "#eaf1ff",
          visible: true
        });
        child.title = word;
        child.rootNodeId = child.id;
        child.keywords = [rootLabel, word];
        child.tags = ["rss-keyword", "fresh"];
        child.summary = `${rootLabel} から抽出`;
        App.nodes.push(child);
      }

      if (!App.linkExists(root.id, child.id)) {
        App.links.push(App.makeLink(root.id, child.id, "explore", 0.9, true));
      }
    }

    App.mergeDuplicateNodes();
    App.addLog(`RSS枝生成: ${rootLabel}`);
    return root;
  };

  App.spawnFromHeadlineText = function spawnFromHeadlineText(headline) {
    const root = App.addRssHeadlineAsBranch(headline);
    if (!root) return;

    const children = App.links
      .filter(l => l.source === root.id || l.target === root.id)
      .map(l => App.getNode(l.source === root.id ? l.target : l.source))
      .filter(Boolean);

    for (const child of children) {
      child.attentionScore = Math.max(child.attentionScore || 0, 2);
      child.tags = App.uniqueStrings([...(child.tags || []), "rss-seed"]);
    }

    App.addLog(`見出し展開: ${headline}`);
  };

  App.spawnHeadlineNode = function spawnHeadlineNode(headline) {
    const root = App.addRssHeadlineAsBranch(headline);
    if (!root) return null;
    App.addLog(`RSS見出し追加: ${headline}`);
    return root;
  };

  /* =========================
     Node / link property UI
  ========================= */
  App.loadNodePropsToPanel = function loadNodePropsToPanel(node) {
    const d = App.dom;
    if (!d.nodePropPanel) return;

    if (!node) {
      d.propNameInput.value = "";
      d.propXInput.value = "";
      d.propYInput.value = "";
      d.propZInput.value = "";
      d.propWeightInput.value = "";
      d.propShapeSelect.value = "circle";
      d.propRadiusInput.value = "";
      d.propWidthInput.value = "";
      d.propHeightInput.value = "";
      d.propThumbInput.value = "";
      d.propVisibleChk.checked = true;
      d.propFixedChk.checked = false;
      d.propAuthorView.value = "非表示 / 変更不可";
      return;
    }

    d.propNameInput.value = node.title || node.label || "";
    d.propXInput.value = String(Math.round(node.x || 0));
    d.propYInput.value = String(Math.round(node.y || 0));
    d.propZInput.value = String(Math.round(node.z || 0));
    d.propWeightInput.value = String(Math.round(node.userFocusScore || 0));
    d.propShapeSelect.value = node.shape || "circle";
    d.propRadiusInput.value = String(Math.round(node.r || 24));
    d.propWidthInput.value = String(Math.round(node.width || 120));
    d.propHeightInput.value = String(Math.round(node.height || 80));
    d.propThumbInput.value = node.imageSrc || "";
    d.propVisibleChk.checked = node.visible !== false;
    d.propFixedChk.checked = !!node.fixed;
    d.propAuthorView.value = "非表示 / 変更不可";
  };

  App.applyNodePropsFromPanel = function applyNodePropsFromPanel(node) {
    if (!node) return false;
    if (node.is5w2h) return false;

    const d = App.dom;

    const newName = App.sanitizeGeneratedLabel(d.propNameInput.value || node.title || node.label || "ノード");
    node.label = newName;
    node.title = newName;

    node.x = Number(d.propXInput.value || node.x || 0);
    node.y = Number(d.propYInput.value || node.y || 0);
    node.z = Number(d.propZInput.value || node.z || 0);

    node.userFocusScore = Number(d.propWeightInput.value || node.userFocusScore || 0);

    node.shape = d.propShapeSelect.value || "circle";
    node.r = Math.max(8, Number(d.propRadiusInput.value || node.r || 24));
    node.width = Math.max(20, Number(d.propWidthInput.value || node.width || 120));
    node.height = Math.max(20, Number(d.propHeightInput.value || node.height || 80));

    node.fixed = !!d.propFixedChk.checked;
    node.visible = !!d.propVisibleChk.checked;

    const thumb = String(d.propThumbInput.value || "").trim();
    if (thumb !== (node.imageSrc || "")) {
      node.imageSrc = thumb || null;
      node.imageEl = null;
      node.imageLoaded = false;
      if (node.imageSrc) {
        App.restoreImageNode(node);
      }
    }

    node.updatedAt = Date.now();
    App.addLog(`ノード反映: ${node.title || node.label}`);
    return true;
  };
})();