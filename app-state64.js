(() => {
  "use strict";

  const App = {};
  window.App = App;

  console.log("app-state loaded");

  /* =========================
     Save key
  ========================= */
  App.SAVE_KEY = "mindmap_full_integrated_v72";

  /* =========================
     Constants
  ========================= */
  App.DOUBLE_TAP_MS = 320;
  App.DOUBLE_TAP_DIST = 26;
  App.LONG_PRESS_MS = 420;

  App.FIVEW2H_LABELS = ["Who", "What", "When", "Where", "Why", "How", "HowMuch"];

  /* =========================
     Role definitions
  ========================= */
  App.ROLE_DEFS = [
    { key: "unassigned", label: "未配属", defaultCount: 2, color: "#9aa4b2" },
    { key: "adventurer", label: "冒険者", defaultCount: 1, color: "#f28b82" },
    { key: "interdisciplinary", label: "学際", defaultCount: 2, color: "#7bdff2" },
    { key: "editor", label: "編集者", defaultCount: 2, color: "#c7b8ff" },
    { key: "miner", label: "採掘", defaultCount: 2, color: "#ffd166" },
    { key: "painter", label: "画家", defaultCount: 1, color: "#8ce99a" },
    { key: "villager", label: "村人", defaultCount: 1, color: "#a5d8ff" }
  ];

  /* =========================
     RSS sources
  ========================= */
  App.RSS_SOURCES = [
    { name: "NHK", url: "https://www3.nhk.or.jp/rss/news/cat0.xml" }
  ];

  App.RSS_STOPWORDS = new Set([
    "こと","もの","ため","これ","それ","など","よう",
    "日本","東京","全国","速報","最新","発表","判明",
    "ニュース","記事","動画","写真","会見","政府"
  ]);

  /* =========================
     DOM references
  ========================= */
  App.dom = {
    canvas: document.getElementById("canvas"),

    startBtn: document.getElementById("startBtn"),
    stopBtn: document.getElementById("stopBtn"),
    saveBtn: document.getElementById("saveBtn"),
    loadBtn: document.getElementById("loadBtn"),
    fitBtn: document.getElementById("fitBtn"),
    alignBtn: document.getElementById("alignBtn"),
    settingsBtn: document.getElementById("settingsBtn"),
    toggleLogBtn: document.getElementById("toggleLogBtn"),
    followBtn: document.getElementById("followBtn"),

    quickInput: document.getElementById("quickInput"),
    quickEditBtn: document.getElementById("quickEditBtn"),
    quickAddBtn: document.getElementById("quickAddBtn"),
    quickSearchBtn: document.getElementById("quickSearchBtn"),

    viewModeBtn: document.getElementById("viewModeBtn"),
    editModeBtn: document.getElementById("editModeBtn"),
    linkModeBtn: document.getElementById("linkModeBtn"),
    pruneModeBtn: document.getElementById("pruneModeBtn"),

    settingsPanel: document.getElementById("settingsPanel"),
    logPanel: document.getElementById("logPanel"),
    log: document.getElementById("log"),

    nodeCount: document.getElementById("nodeCount"),
    linkCount: document.getElementById("linkCount"),
    selectedInfo: document.getElementById("selectedInfo"),
    agentCountMini: document.getElementById("agentCountMini"),
    followMini: document.getElementById("followMini"),
    zoomHud: document.getElementById("zoomHud"),
    modeBadge: document.getElementById("modeBadge"),

    stickWrap: document.getElementById("stickWrap"),
    stickKnob: document.getElementById("stickKnob"),

    topBarPanel: document.getElementById("topBarPanel"),
    pinTopBarBtn: document.getElementById("pinTopBarBtn"),
    pinSettingsBtn: document.getElementById("pinSettingsBtn"),
    zoomInBtn: document.getElementById("zoomInBtn"),
    zoomOutBtn: document.getElementById("zoomOutBtn"),

    nodeEditor: document.getElementById("nodeEditor"),
    nodeLabelInput: document.getElementById("nodeLabelInput"),
    nodeMemoInput: document.getElementById("nodeMemoInput"),
    nodeColorInput: document.getElementById("nodeColorInput"),
    nodeSaveBtn: document.getElementById("nodeSaveBtn"),
    nodeDeleteBtn: document.getElementById("nodeDeleteBtn"),
    nodeCloseBtn: document.getElementById("nodeCloseBtn"),

    nodeDetailPanel: document.getElementById("nodeDetailPanel"),
    nodeDetailBody: document.getElementById("nodeDetailBody"),
    pinDetailBtn: document.getElementById("pinDetailBtn"),
    toggleNodeDetailBtn: document.getElementById("toggleNodeDetailBtn"),

    nodePropPanel: document.getElementById("nodePropPanel"),
    pinPropBtn: document.getElementById("pinPropBtn"),
    nodePropBody: document.getElementById("nodePropBody"),
    propNameInput: document.getElementById("propNameInput"),
    propXInput: document.getElementById("propXInput"),
    propYInput: document.getElementById("propYInput"),
    propZInput: document.getElementById("propZInput"),
    propWeightInput: document.getElementById("propWeightInput"),
    propShapeSelect: document.getElementById("propShapeSelect"),
    propRadiusInput: document.getElementById("propRadiusInput"),
    propWidthInput: document.getElementById("propWidthInput"),
    propHeightInput: document.getElementById("propHeightInput"),
    propThumbInput: document.getElementById("propThumbInput"),
    propVisibleChk: document.getElementById("propVisibleChk"),
    propFixedChk: document.getElementById("propFixedChk"),
    propAuthorView: document.getElementById("propAuthorView"),
    propApplyBtn: document.getElementById("propApplyBtn"),
    propDeleteNodeBtn: document.getElementById("propDeleteNodeBtn"),
    propCutLinksBtn: document.getElementById("propCutLinksBtn"),

    tabAgentBtn: document.getElementById("tabAgentBtn"),
    tabViewBtn: document.getElementById("tabViewBtn"),
    tabPhysicsBtn: document.getElementById("tabPhysicsBtn"),
    tabDataBtn: document.getElementById("tabDataBtn"),

    settingsAgentSection: document.getElementById("settingsAgentSection"),
    settingsViewSection: document.getElementById("settingsViewSection"),
    settingsPhysicsSection: document.getElementById("settingsPhysicsSection"),
    settingsDataSection: document.getElementById("settingsDataSection"),

    youtubeOverlay: document.getElementById("youtubeOverlay"),
    youtubePlayerWrap: document.getElementById("youtubePlayerWrap"),
    closeYoutubeOverlayBtn: document.getElementById("closeYoutubeOverlayBtn")
  };

  App.ctx = App.dom.canvas ? App.dom.canvas.getContext("2d") : null;

  /* =========================
     View / canvas
  ========================= */
  App.W = 0;
  App.H = 0;
  App.DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  App.view = { x: 0, y: 0, scale: 1 };

  /* =========================
     UI state
  ========================= */
  App.uiState = {
    showGrid: true,
    fix5w2h: true,
    showLinkType: false,
    compactText: true,

    physics: true,
    repel: 150,
    spring: 10,
    damping: 92,

    inter: true,
    autoExpand: true,
    expandCount: 2,

    autoSave: true,
    autoSaveSec: 15,

    rssEnabled: true,
    rssRefreshMin: 15,

    showAgentLinks: true,
    visibleNodeLimit: Infinity,
    agentsIgnoreHiddenNodes: true,

    showNodeDetailPanel: true,
    autoShowNodeDetail: true,
    nodeDetailCollapsed: true,

    showNodePropPanel: true,
    boostOnSelect: true,
    selectBoostAmount: 10,
    tapBoostAmount: 6,
    maxNodeScale: 2.5,
    minNodeScale: 0.6
  };

  /* =========================
     RSS state
  ========================= */
  App.rssState = {
    items: [],
    keywordCounts: new Map(),
    lastFetchAt: 0,
    fetching: false,
    seenHeadlines: new Set()
  };

  App.rssTimer = null;
  App.visibleNodeSet = new Set();

  /* =========================
     Main graph state
  ========================= */
  App.roleCounts = Object.fromEntries(
    App.ROLE_DEFS.map(r => [r.key, r.defaultCount])
  );

  App.totalAgentCount = Object.values(App.roleCounts).reduce((a, b) => a + b, 0);

  App.nodes = [];
  App.links = [];
  App.agents = [];
  App.parties = [];
  App.partyCounter = 1;

  App.agentCount = 0;
  App.followAgentId = null;
  App.pendingAgentTargetId = null;

  App.selectedNodeId = null;
  App.hoveredNodeId = null;
  App.hoveredLinkId = null;
  App.selectedLinkId = null;
  App.linkingFromId = null;
  App.editingNodeId = null;
  App.zoomedImageNodeId = null;
  App.playingYoutubeNodeId = null;

  App.running = true;
  App.mode = "view";

  App.idCounter = 1;
  App.frame = 0;

  App.autoSaveTimer = null;

  /* =========================
     Pointer / interaction state
  ========================= */
  App.pointerDown = false;
  App.draggingNodeId = null;
  App.resizingNodeId = null;
  App.panning = false;

  App.dragOffsetWorldX = 0;
  App.dragOffsetWorldY = 0;
  App.lastPointer = { x: 0, y: 0 };

  App.lastTapTime = 0;
  App.lastTapX = 0;
  App.lastTapY = 0;
  App.longPressTimer = null;

  /* =========================
     Search state
  ========================= */
  App.searchResults = [];
  App.searchIndex = 0;
  App.lastSearchQuery = "";

  /* =========================
     Panel state
  ========================= */
  App.panelPins = {
    topBarPanel: true,
    settingsPanel: true,
    nodeDetailPanel: true,
    nodePropPanel: true
  };

  App.panelPositions = {
    topBarPanel: { left: 8, top: 8 },
    settingsPanel: { left: 8, top: 88 },
    nodeDetailPanel: { left: Math.max(8, window.innerWidth - 398), top: 150 },
    nodePropPanel: { left: Math.max(8, window.innerWidth - 428), top: 380 }
  };

  /* =========================
     Stick / joystick state
  ========================= */
  App.stickState = {
    active: false,
    dx: 0,
    dy: 0,
    max: 32
  };

  /* =========================
     Link pruning state
  ========================= */
  App.pruneState = {
    lastDeletedNodeId: null,
    lastDeletedLinkId: null
  };

  /* =========================
     Serialization helpers
  ========================= */
  App.compactNode = function compactNode(node) {
    return {
      id: node.id,
      x: node.x,
      y: node.y,
      z: node.z || 0,
      vx: 0,
      vy: 0,

      label: node.label,
      title: node.title,
      memo: node.memo,
      summary: node.summary,

      r: node.r,
      width: node.width,
      height: node.height,
      shape: node.shape,

      color: node.color,
      textColor: node.textColor,
      fixed: !!node.fixed,
      visible: node.visible !== false,

      is5w2h: !!node.is5w2h,
      isInterdisciplinary: !!node.isInterdisciplinary,
      isAutoCandidate: !!node.isAutoCandidate,
      isAgentNode: !!node.isAgentNode,

      category: node.category,
      baseNodeId: node.baseNodeId,
      wNodeId: node.wNodeId,

      imageSrc: node.imageSrc || null,
      imageAspect: node.imageAspect || null,

      createdAt: node.createdAt || Date.now(),
      updatedAt: node.updatedAt || Date.now(),

      keywords: Array.isArray(node.keywords) ? node.keywords : [],
      tags: Array.isArray(node.tags) ? node.tags : [],

      qualityScore: typeof node.qualityScore === "number" ? node.qualityScore : 100,
      attentionScore: typeof node.attentionScore === "number" ? node.attentionScore : 0,
      hensachi: typeof node.hensachi === "number" ? node.hensachi : null,
      roleKey: node.roleKey || null,

      authorId: node.authorId || "localUser",
      sourceNodeId: node.sourceNodeId || null,
      rootNodeId: node.rootNodeId || null,
      copiedFromMapId: node.copiedFromMapId || null,
      visibility: node.visibility || "private",
      status: node.status || "draft",
      quoteCount: typeof node.quoteCount === "number" ? node.quoteCount : 0,
      pointScore: typeof node.pointScore === "number" ? node.pointScore : 0,

      depth: typeof node.depth === "number" ? node.depth : 0,
      mineScore: typeof node.mineScore === "number" ? node.mineScore : 100,
      mineHits: typeof node.mineHits === "number" ? node.mineHits : 0,
      mineExhaustion: typeof node.mineExhaustion === "number" ? node.mineExhaustion : 0,

      isUserCreated: !!node.isUserCreated,
      userFocusScore: typeof node.userFocusScore === "number" ? node.userFocusScore : 0,
      lastSelectedAt: typeof node.lastSelectedAt === "number" ? node.lastSelectedAt : 0,

      youtubeUrl: node.youtubeUrl || null,
      youtubeVideoId: node.youtubeVideoId || null
    };
  };

  App.compactLink = function compactLink(link) {
    return {
      id: link.id,
      source: link.source,
      target: link.target,
      type: link.type || "related",
      weight: typeof link.weight === "number" ? link.weight : 1,
      auto: !!link.auto,

      authorId: link.authorId || "localUser",
      sourceLinkId: link.sourceLinkId || null,
      copiedFromMapId: link.copiedFromMapId || null,
      visibility: link.visibility || "private",
      status: link.status || "draft",
      quoteCount: typeof link.quoteCount === "number" ? link.quoteCount : 0,
      pointScore: typeof link.pointScore === "number" ? link.pointScore : 0,
      createdAt: link.createdAt || Date.now(),
      updatedAt: link.updatedAt || Date.now()
    };
  };

  /* =========================
     Defaults / boot flags
  ========================= */
  App.hasBooted = false;

  /* =========================
     Debug safe checks
  ========================= */
  if (!App.dom.canvas) {
    console.error("canvas が見つかりません");
  }
  if (!App.dom.nodeCount) {
    console.warn("nodeCount 要素が見つかりません");
  }
  if (!App.dom.linkCount) {
    console.warn("linkCount 要素が見つかりません");
  }
  if (!App.dom.nodePropPanel) {
    console.warn("nodePropPanel 要素が見つかりません");
  }

  console.log("app-state finished");
})();