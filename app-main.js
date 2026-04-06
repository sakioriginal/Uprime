/* =========================
   app-main.js
   描画 / 物理 / UI / 保存読込 / イベント / 初期化
========================= */

(() => {
  "use strict";

  const App = window.App;
  if (!App) {
    throw new Error("App が先に初期化されていません。app-state.js を先に読み込んでください。");
  }

  const ctx = App.ctx;
  const d = App.dom;

  /* =========================
     Layout / Resize
  ========================= */
  App.updateZoomHud = function updateZoomHud() {
    d.zoomHud.textContent = `${Math.round(App.view.scale * 100)}%`;
  };

  App.resize = function resize() {
    App.W = window.innerWidth;
    App.H = window.innerHeight;
    App.DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

    d.canvas.width = Math.floor(App.W * App.DPR);
    d.canvas.height = Math.floor(App.H * App.DPR);
    d.canvas.style.width = App.W + "px";
    d.canvas.style.height = App.H + "px";

    ctx.setTransform(App.DPR, 0, 0, App.DPR, 0, 0);

    App.applyPanelLayout();
    App.updateZoomHud();
  };

  App.setPinButtonState = function setPinButtonState(btn, pinned) {
    btn.classList.toggle("pinned", pinned);
    btn.textContent = pinned ? "📌" : "📍";
  };

  App.applyPanelLayout = function applyPanelLayout() {
    if (App.panelPins.topBarPanel) {
      d.topBarPanel.style.left = "8px";
      d.topBarPanel.style.top = "8px";
      d.topBarPanel.style.right = "8px";
      d.topBarPanel.style.width = "";
    } else {
      d.topBarPanel.style.right = "auto";
      d.topBarPanel.style.left = App.panelPositions.topBarPanel.left + "px";
      d.topBarPanel.style.top = App.panelPositions.topBarPanel.top + "px";
      d.topBarPanel.style.width = Math.min(App.W - 16, d.topBarPanel.offsetWidth || 700) + "px";
    }

    if (App.panelPins.settingsPanel) {
      d.settingsPanel.style.left = "8px";
      d.settingsPanel.style.top = "88px";
      d.settingsPanel.style.right = "8px";
      d.settingsPanel.style.width = "";
    } else {
      d.settingsPanel.style.right = "auto";
      d.settingsPanel.style.left = App.panelPositions.settingsPanel.left + "px";
      d.settingsPanel.style.top = App.panelPositions.settingsPanel.top + "px";
      d.settingsPanel.style.width = Math.min(App.W - 16, d.settingsPanel.offsetWidth || 700) + "px";
    }

    if (App.panelPins.nodeDetailPanel) {
      d.nodeDetailPanel.style.right = "8px";
      d.nodeDetailPanel.style.left = "auto";
      d.nodeDetailPanel.style.top = "150px";
      d.nodeDetailPanel.style.width = "min(390px,90vw)";
    } else {
      d.nodeDetailPanel.style.right = "auto";
      d.nodeDetailPanel.style.left = App.panelPositions.nodeDetailPanel.left + "px";
      d.nodeDetailPanel.style.top = App.panelPositions.nodeDetailPanel.top + "px";
      d.nodeDetailPanel.style.width = Math.min(App.W - 16, 390) + "px";
    }

    App.setPinButtonState(d.pinTopBarBtn, App.panelPins.topBarPanel);
    App.setPinButtonState(d.pinSettingsBtn, App.panelPins.settingsPanel);
    App.setPinButtonState(d.pinDetailBtn, App.panelPins.nodeDetailPanel);
  };

  App.makePanelDraggable = function makePanelDraggable(panel, panelKey) {
    const header = panel.querySelector(".panelHeader");
    let dragging = false;
    let startX = 0, startY = 0, startLeft = 0, startTop = 0;

    header.addEventListener("pointerdown", (e) => {
      if (App.panelPins[panelKey]) return;
      if (e.target.classList.contains("pinBtn")) return;

      dragging = true;
      header.classList.add("dragging");
      header.setPointerCapture(e.pointerId);

      const rect = panel.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;
    });

    header.addEventListener("pointermove", (e) => {
      if (!dragging) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      let left = startLeft + dx;
      let top = startTop + dy;

      left = Math.max(0, Math.min(App.W - 80, left));
      top = Math.max(0, Math.min(App.H - 40, top));

      App.panelPositions[panelKey].left = left;
      App.panelPositions[panelKey].top = top;

      panel.style.left = left + "px";
      panel.style.top = top + "px";
      panel.style.right = "auto";
    });

    function endDrag() {
      dragging = false;
      header.classList.remove("dragging");
      App.scheduleAutoSave();
    }

    header.addEventListener("pointerup", endDrag);
    header.addEventListener("pointercancel", endDrag);
  };

  /* =========================
     UI state
  ========================= */
  App.updateFollowUI = function updateFollowUI() {
    const node = App.followAgentId ? App.getNode(App.followAgentId) : null;
    d.followBtn.textContent = node ? "追従:ON" : "追従:OFF";
    d.followBtn.classList.toggle("active", !!node);
    d.followMini.textContent = node ? node.label.replace("\n", " ") : "なし";
  };

  App.renderNodeDetail = function renderNodeDetail() {
    const node = App.getNode(App.selectedNodeId);
    d.nodeDetailPanel.style.display = "block";

    if (!node) {
      d.nodeDetailBody.innerHTML = "未選択";
      return;
    }

    const title = node.title || node.label || "";
    const tags = Array.isArray(node.tags) ? node.tags : [];
    const keywords = Array.isArray(node.keywords) ? node.keywords : [];
    const summary = node.summary || "";
    const memo = node.memo || "";
    const degree = App.getNodeDegree(node.id);
    const isPendingTarget = App.pendingAgentTargetId && node.id === App.pendingAgentTargetId;
    const displayWeight = Math.round(App.computeNodeDisplayWeight(node) * 10) / 10;

    d.nodeDetailBody.innerHTML = `
      <div style="font-size:14px;font-weight:700;margin-bottom:8px;">${App.escHtml(title)}</div>
      <div style="margin-bottom:6px;"><b>種別:</b> ${App.escHtml(node.category || "normal")}</div>
      <div style="margin-bottom:6px;"><b>リンク数:</b> ${degree}</div>
      <div style="margin-bottom:6px;"><b>移動指定:</b> ${isPendingTarget ? "行き先選択中" : "なし"}</div>
      <div style="margin-bottom:6px;"><b>注目度:</b> ${node.attentionScore ?? 0}</div>
      <div style="margin-bottom:6px;"><b>偏差値:</b> ${node.hensachi ?? "なし"}</div>
      <div style="margin-bottom:6px;"><b>品質:</b> ${node.qualityScore ?? "なし"}</div>
      <div style="margin-bottom:6px;"><b>表示重み:</b> ${displayWeight}</div>
      <div style="margin-bottom:6px;"><b>タグ:</b> ${tags.length ? App.escHtml(tags.join(", ")) : "なし"}</div>
      <div style="margin-bottom:6px;"><b>キーワード:</b> ${keywords.length ? App.escHtml(keywords.join(", ")) : "なし"}</div>
      <div style="margin-bottom:6px;"><b>概要:</b><br>${summary ? App.escHtml(summary) : "なし"}</div>
      <div style="margin-bottom:6px;"><b>メモ:</b><br>${memo ? App.escHtml(memo) : "なし"}</div>
      <div><b>画像:</b> ${node.imageSrc ? "あり" : "なし"}</div>

<div style="margin-bottom:6px;"><b>採掘スコア:</b> ${node.mineScore ?? 0}</div>
<div style="margin-bottom:6px;"><b>採掘回数:</b> ${node.mineHits ?? 0}</div>


    `;
  };

  App.updateInfo = function updateInfo() {
    d.nodeCountEl.textContent = App.nodes.length;
    d.linkCountEl.textContent = App.links.length;

    const selected = App.getNode(App.selectedNodeId);
    d.selectedInfoEl.textContent = selected
      ? (selected.title || selected.label).replace(/\n/g, " / ")
      : "なし";

    d.agentCountMini.textContent = String(App.agentCount);
    App.updateFollowUI();
    App.renderNodeDetail();

    if (selected && document.activeElement !== d.quickInput) {
      d.quickInput.value = selected.title || selected.label || "";
    }
  };

  App.setMode = function setMode(next) {
    App.mode = next;

    d.viewModeBtn.classList.toggle("active", App.mode === "view");
    d.editModeBtn.classList.toggle("active", App.mode === "edit");
    d.linkModeBtn.classList.toggle("active", App.mode === "link");

    d.modeBadge.textContent =
      `モード: ${App.mode === "view" ? "閲覧" : App.mode === "edit" ? "編集" : "リンク"}`;

    App.linkingFromId = null;
    if (App.mode !== "view") App.pendingAgentTargetId = null;

    App.updateInfo();
  };

  App.openSettingsTab = function openSettingsTab(tabName) {
    d.settingsAgentSection.style.display = tabName === "agent" ? "block" : "none";
    d.settingsViewSection.style.display = tabName === "view" ? "block" : "none";
    d.settingsPhysicsSection.style.display = tabName === "physics" ? "block" : "none";
    d.settingsDataSection.style.display = tabName === "data" ? "block" : "none";

    d.tabAgentBtn.classList.toggle("active", tabName === "agent");
    d.tabViewBtn.classList.toggle("active", tabName === "view");
    d.tabPhysicsBtn.classList.toggle("active", tabName === "physics");
    d.tabDataBtn.classList.toggle("active", tabName === "data");
  };

  /* =========================
     Drawing
  ========================= */
  App.roundRect = function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  App.drawGrid = function drawGrid() {
    if (!App.uiState.showGrid) return;

    const step = 80;
    const worldLeft = App.view.x - App.W / (2 * App.view.scale);
    const worldRight = App.view.x + App.W / (2 * App.view.scale);
    const worldTop = App.view.y - App.H / (2 * App.view.scale);
    const worldBottom = App.view.y + App.H / (2 * App.view.scale);

    const startX = Math.floor(worldLeft / step) * step;
    const endX = Math.ceil(worldRight / step) * step;
    const startY = Math.floor(worldTop / step) * step;
    const endY = Math.ceil(worldBottom / step) * step;

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,.05)";
    ctx.lineWidth = 1;

    for (let x = startX; x <= endX; x += step) {
      const p1 = App.worldToScreen(x, worldTop);
      const p2 = App.worldToScreen(x, worldBottom);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    for (let y = startY; y <= endY; y += step) {
      const p1 = App.worldToScreen(worldLeft, y);
      const p2 = App.worldToScreen(worldRight, y);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    ctx.restore();
  };

  App.drawLinks = function drawLinks() {
    for (const l of App.links) {
      const a = App.getNode(l.source);
      const b = App.getNode(l.target);
      if (!a || !b) continue;

      const isAgentLink = l.type === "agent-think" || a.isAgentNode || b.isAgentNode;
      if (isAgentLink && !App.uiState.showAgentLinks) continue;

      const aVisible = a.isAgentNode || App.visibleNodeSet.has(a.id);
      const bVisible = b.isAgentNode || App.visibleNodeSet.has(b.id);
      if (!aVisible || !bVisible) continue;

      const pa = App.worldToScreen(a.x, a.y);
      const pb = App.worldToScreen(b.x, b.y);

      ctx.save();

      if (l.type === "5w2h-bridge") {
        ctx.strokeStyle = "rgba(123,223,242,.78)";
        ctx.lineWidth = 2.2;
      } else if (l.type === "candidate" || l.type === "explore" || l.type === "hypothesis") {
        ctx.strokeStyle = "rgba(156,220,240,.42)";
        ctx.lineWidth = 1.2;
      } else if (l.type === "agent-think") {
        ctx.strokeStyle = "rgba(255,139,230,.28)";
        ctx.lineWidth = 1.0;
      } else {
        ctx.strokeStyle = "rgba(180,210,255,.45)";
        ctx.lineWidth = 1.6;
      }

      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();

      if (App.uiState.showLinkType && App.view.scale > 0.7) {
        const mx = (pa.x + pb.x) / 2;
        const my = (pa.y + pb.y) / 2;
        const text = l.type;

        ctx.font = "11px sans-serif";
        const tw = ctx.measureText(text).width + 10;
        ctx.fillStyle = "rgba(10,14,22,.75)";
        ctx.strokeStyle = "rgba(255,255,255,.08)";
        App.roundRect(mx - tw / 2, my - 10, tw, 20, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#dce8ff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, mx, my);
      }

      ctx.restore();
    }
  };

  App.drawNode = function drawNode(n) {
    if (!n.isAgentNode && !App.visibleNodeSet.has(n.id)) return;

    const p = App.worldToScreen(n.x, n.y);

    if (n.shape === "rect") {
      const rw = (n.width || 120) * App.view.scale;
      const rh = (n.height || 80) * App.view.scale;
      if (p.x < -rw || p.y < -rh || p.x > App.W + rw || p.y > App.H + rh) return;

      ctx.save();

      ctx.beginPath();
      App.roundRect(p.x - rw / 2, p.y - rh / 2, rw, rh, 12);
      ctx.fillStyle = n.color || "#2b3344";
      ctx.fill();

      if (n.imageSrc && n.imageEl) {
        ctx.save();
        ctx.beginPath();
        App.roundRect(p.x - rw / 2, p.y - rh / 2, rw, rh, 12);
        ctx.clip();

        if (n.imageLoaded) {
          const iw = n.imageEl.width || 1;
          const ih = n.imageEl.height || 1;
          const scale = Math.max(rw / iw, rh / ih);
          const dw = iw * scale;
          const dh = ih * scale;
          ctx.drawImage(n.imageEl, p.x - dw / 2, p.y - dh / 2, dw, dh);
        } else {
          ctx.fillStyle = "#334155";
          ctx.fillRect(p.x - rw / 2, p.y - rh / 2, rw, rh);
        }
        ctx.restore();
      }

      ctx.strokeStyle = "rgba(255,255,255,.18)";
      ctx.lineWidth = 1.5;

      if (App.selectedNodeId === n.id) {
        ctx.strokeStyle = "#ffcc66";
        ctx.lineWidth = 3;
      }

      App.roundRect(p.x - rw / 2, p.y - rh / 2, rw, rh, 12);
      ctx.stroke();

      if (App.view.scale >= 0.75) {
        ctx.font = `${Math.max(10, 12 * App.view.scale)}px sans-serif`;
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        const text = (n.title || n.label || "");
        const shortText = App.view.scale < 1 ? text.slice(0, 8) : text;
        ctx.fillText(shortText, p.x, p.y + rh / 2 - 6);
      }

      if (App.mode === "edit" && App.selectedNodeId === n.id) {
        const hs = 16;
        ctx.fillStyle = "#7db0ff";
        ctx.fillRect(p.x + rw / 2 - hs / 2, p.y + rh / 2 - hs / 2, hs, hs);
        ctx.strokeStyle = "#eaf1ff";
        ctx.lineWidth = 1;
        ctx.strokeRect(p.x + rw / 2 - hs / 2, p.y + rh / 2 - hs / 2, hs, hs);
      }

      ctx.restore();
      return;
    }

    const rr = n.r * App.view.scale;
    if (p.x < -120 || p.y < -120 || p.x > App.W + 120 || p.y > App.H + 120) return;

    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);

    if (n.isAgentNode) ctx.fillStyle = App.roleColor(n.roleKey || "agent");
    else if (n.is5w2h) ctx.fillStyle = "#2a3140";
    else if (n.isInterdisciplinary) ctx.fillStyle = "#233848";
    else if (n.isAutoCandidate) ctx.fillStyle = "#1f2e3a";
    else ctx.fillStyle = n.color || "#2b3344";

    ctx.fill();

    if (n.is5w2h) {
      ctx.strokeStyle = "#ffd166";
      ctx.lineWidth = 3;
    } else if (n.isInterdisciplinary) {
      ctx.strokeStyle = "#7bdff2";
      ctx.lineWidth = 2.2;
    } else if (n.isAutoCandidate) {
      ctx.strokeStyle = "#9cdcf0";
      ctx.lineWidth = 1.3;
    } else if (n.isAgentNode) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.8;
    } else {
      ctx.strokeStyle = "rgba(255,255,255,.18)";
      ctx.lineWidth = 1.2;
    }

    if (App.selectedNodeId === n.id) {
      ctx.strokeStyle = "#ffcc66";
      ctx.lineWidth += 2;
    }
    if (App.followAgentId === n.id) {
      ctx.strokeStyle = "#7db0ff";
      ctx.lineWidth += 1.5;
    }
    if (App.pendingAgentTargetId === n.id) {
      ctx.strokeStyle = "#ff8f8f";
      ctx.lineWidth += 2;
    }

    ctx.stroke();

    const zoom = App.view.scale;
    const title = String(n.title || n.label || "");

    if (!App.uiState.compactText || zoom >= 0.9) {
      const lines = title.split("\n");
      ctx.font = `${Math.max(10, 12 * zoom)}px sans-serif`;
      ctx.fillStyle = n.textColor || "#eaf1ff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      lines.forEach((line, i) => {
        ctx.fillText(line, p.x, p.y + (i - (lines.length - 1) / 2) * 13);
      });
    } else if (zoom >= 0.55) {
      ctx.font = `${Math.max(9, 10 * zoom)}px sans-serif`;
      ctx.fillStyle = n.textColor || "#eaf1ff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const shortText = title.length > 6 ? title.slice(0, 6) : title;
      ctx.fillText(shortText, p.x, p.y);
    }

    if (n.isAgentNode && zoom > 0.75) {
      const agent = App.agents.find(a => a.id === n.id);
      if (agent) {
        const status =
          `${App.roleLabelJa(agent.role)} | ${agent.mode === "move" ? "移動" : agent.mode === "work" ? "作業" : "待機"}`;
        ctx.font = "10px sans-serif";
        const tw = ctx.measureText(status).width + 12;
        const tx = p.x - tw / 2;
        const ty = p.y - rr - 22;

        ctx.fillStyle = "rgba(8,10,16,.82)";
        ctx.strokeStyle = "rgba(255,255,255,.25)";
        App.roundRect(tx, ty, tw, 18, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(status, p.x, ty + 9);
      }
    }

    ctx.restore();
  };

  App.draw = function draw() {
    App.visibleNodeSet = App.getVisibleNodeSet();
    ctx.clearRect(0, 0, App.W, App.H);
    App.drawGrid();
    App.drawLinks();
    App.nodes.forEach(App.drawNode);
  };

  /* =========================
     Physics
  ========================= */
  App.applyRepulsion = function applyRepulsion() {
    const repel = Number(App.uiState.repel);

    for (let i = 0; i < App.nodes.length; i++) {
      const a = App.nodes[i];
      for (let j = i + 1; j < App.nodes.length; j++) {
        const b = App.nodes[j];
        if (a.isAgentNode || b.isAgentNode) continue;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) d2 = 1;
        const d = Math.sqrt(d2);
        const force = repel / d2;
        const fx = force * dx / d;
        const fy = force * dy / d;

        if (!a.fixed) { a.vx -= fx; a.vy -= fy; }
        if (!b.fixed) { b.vx += fx; b.vy += fy; }
      }
    }
  };

  App.updateCameraFollow = function updateCameraFollow() {
    if (!App.followAgentId) return;
    const node = App.getNode(App.followAgentId);
    if (!node) return;

    App.view.x += (node.x - App.view.x) * 0.05;
    App.view.y += (node.y - App.view.y) * 0.05;
  };

  App.physicsStep = function physicsStep() {
    if (!App.running || !App.uiState.physics) return;

    const spring = Number(App.uiState.spring) / 1000;
    const damping = Number(App.uiState.damping) / 100;

    App.nodes.forEach(n => {
      if (n.is5w2h && App.uiState.fix5w2h) n.fixed = true;
    });

    App.applyRepulsion();

    for (const l of App.links) {
      const a = App.getNode(l.source);
      const b = App.getNode(l.target);
      if (!a || !b) continue;
      if (a.isAgentNode || b.isAgentNode) continue;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(1, Math.hypot(dx, dy));

      let target = 160;
      if (l.type === "5w2h-bridge") target = 140;
      if (l.type === "candidate" || l.type === "explore" || l.type === "hypothesis") target = 95;

      const force = (dist - target) * spring;
      const fx = force * dx / dist;
      const fy = force * dy / dist;

      if (!a.fixed) { a.vx += fx; a.vy += fy; }
      if (!b.fixed) { b.vx -= fx; b.vy -= fy; }
    }

    App.nodes.forEach(n => {
      if (n.fixed && !n.isAgentNode) {
        n.vx = 0;
        n.vy = 0;
        return;
      }

      if (!n.isAgentNode) {
        n.x += n.vx;
        n.y += n.vy;
        n.vx *= damping;
        n.vy *= damping;
      }
    });

    const panSpeed = 7 / App.view.scale;
    if (App.stickState.active || Math.abs(App.stickState.dx) > 0.01 || Math.abs(App.stickState.dy) > 0.01) {
      App.view.x += App.stickState.dx * panSpeed;
      App.view.y += App.stickState.dy * panSpeed;
    }

    App.moveAgents();
    App.updateAgentThinking(App.frame);
    App.updateCameraFollow();
    App.ensure5W2HNodes();
  };

  /* =========================
     Editor
  ========================= */
  App.openEditor = function openEditor(node, screenX, screenY) {
    if (!node || node.is5w2h) return;

    App.editingNodeId = node.id;
    d.nodeLabelInput.value = node.title || node.label || "";
    d.nodeMemoInput.value = node.memo || "";
    d.nodeColorInput.value = node.color || "#2b3344";

    d.nodeEditor.style.left = Math.min(App.W - 340, Math.max(8, screenX + 10)) + "px";
    d.nodeEditor.style.top = Math.min(App.H - 240, Math.max(8, screenY + 10)) + "px";
    d.nodeEditor.classList.add("open");
  };

  App.closeEditor = function closeEditor() {
    d.nodeEditor.classList.remove("open");
    App.editingNodeId = null;
  };

  /* =========================
     Search
  ========================= */
  App.runQuickSearch = function runQuickSearch() {
    const q = d.quickInput.value.trim();
    if (!q) {
      App.addLog("検索語が空です");
      return;
    }

    if (App.lastSearchQuery !== q) {
      App.searchResults = App.findNodesByKeyword(q);
      App.searchIndex = 0;
      App.lastSearchQuery = q;
    } else {
      App.searchIndex++;
    }

    if (App.searchResults.length === 0) {
      App.addLog(`検索結果なし: ${q}`);
      return;
    }

    if (App.searchIndex >= App.searchResults.length) App.searchIndex = 0;

    const node = App.searchResults[App.searchIndex];
    if (!node) {
      App.searchResults = [];
      App.searchIndex = 0;
      App.lastSearchQuery = "";
      App.addLog("検索結果が無効になりました");
      return;
    }

    App.focusNode(node);
    App.updateInfo();
    App.syncQuickInputFromSelection();
    App.addLog(`検索ヒット ${App.searchIndex + 1}/${App.searchResults.length}: ${node.title || node.label}`);
  };

  /* =========================
     Save / Load
  ========================= */
  App.saveState = function saveState() {
    try {
      const data = {
        idCounter: App.idCounter,
        view: { ...App.view },
        followAgentId: App.followAgentId,
        pendingAgentTargetId: App.pendingAgentTargetId,
        roleCounts: { ...App.roleCounts },
        totalAgentCount: App.totalAgentCount,
        uiState: { ...App.uiState },
        nodes: App.nodes.map(App.compactNode),
        links: App.links.map(App.compactLink),
        agents: App.agents.map(a => ({
          id: a.id,
          role: a.role,
          tickOffset: a.tickOffset,
          targetNodeId: a.targetNodeId,
          mode: a.mode,
          taskText: a.taskText,
          workUntilFrame: a.workUntilFrame,
          busy: a.busy,
          mineState: a.mineState || null
        })),
        panelPins: { ...App.panelPins },
        panelPositions: { ...App.panelPositions },
        rssSeenHeadlines: [...App.rssState.seenHeadlines]
      };

      localStorage.setItem(App.SAVE_KEY, JSON.stringify(data));
      App.addLog("保存しました");
      return true;
    } catch (err) {
      console.error(err);
      App.addLog("保存に失敗しました");
      return false;
    }
  };

  App.loadState = function loadState(showLog = true) {
    const raw = localStorage.getItem(App.SAVE_KEY);
    if (!raw) return false;

    try {
      const data = JSON.parse(raw);

      App.idCounter = data.idCounter || 1;
      Object.assign(App.view, data.view || { x: 0, y: 0, scale: 1 });

      App.followAgentId = data.followAgentId || null;
      App.pendingAgentTargetId = data.pendingAgentTargetId || null;

      if (data.roleCounts && typeof data.roleCounts === "object") {
        App.roleCounts = { ...App.roleCounts, ...data.roleCounts };
      }
      if (typeof data.totalAgentCount === "number") {
        App.totalAgentCount = data.totalAgentCount;
      }
      if (data.uiState && typeof data.uiState === "object") {
        Object.assign(App.uiState, data.uiState);
      }

      App.nodes = Array.isArray(data.nodes)
        ? data.nodes.map(n => ({
            ...n,
            vx: 0,
            vy: 0,
            createdAt: n.createdAt || Date.now(),
            updatedAt: n.updatedAt || Date.now(),
            imageEl: null,
            imageLoaded: false,
            wikiBusy: false,
            title: n.title || n.label || "",
            keywords: Array.isArray(n.keywords) ? n.keywords : [],
            tags: Array.isArray(n.tags) ? n.tags : [],
            summary: typeof n.summary === "string" ? n.summary : "",
            qualityScore: typeof n.qualityScore === "number" ? n.qualityScore : 100,
            attentionScore: typeof n.attentionScore === "number" ? n.attentionScore : 0,
            hensachi: typeof n.hensachi === "number" ? n.hensachi : null,
            authorId: n.authorId || "localUser",
            sourceNodeId: n.sourceNodeId || null,
            rootNodeId: n.rootNodeId || n.id,
            copiedFromMapId: n.copiedFromMapId || null,
            visibility: n.visibility || "private",
            status: n.status || "draft",
            quoteCount: typeof n.quoteCount === "number" ? n.quoteCount : 0,
            pointScore: typeof n.pointScore === "number" ? n.pointScore : 0,

            depth: typeof n.depth === "number" ? n.depth : 0,

            mineScore: typeof n.mineScore === "number" ? n.mineScore : 100,
            mineHits: typeof n.mineHits === "number" ? n.mineHits : 0,
            mineExhaustion: typeof n.mineExhaustion === "number" ? n.mineExhaustion : 0



          }))
        : [];

      App.links = Array.isArray(data.links)
        ? data.links.map(l => ({
            ...l,
            authorId: l.authorId || "localUser",
            sourceLinkId: l.sourceLinkId || null,
            copiedFromMapId: l.copiedFromMapId || null,
            visibility: l.visibility || "private",
            status: l.status || "draft",
            quoteCount: typeof l.quoteCount === "number" ? l.quoteCount : 0,
            pointScore: typeof l.pointScore === "number" ? l.pointScore : 0,
            createdAt: l.createdAt || Date.now(),
            updatedAt: l.updatedAt || Date.now()
          }))
        : [];

      App.agents = Array.isArray(data.agents) ? data.agents : [];

      if (data.panelPins) Object.assign(App.panelPins, data.panelPins);
      if (data.panelPositions) Object.assign(App.panelPositions, data.panelPositions);

      App.rssState.seenHeadlines = new Set(data.rssSeenHeadlines || []);

      App.nodes.forEach(n => {
        if (n.imageSrc) App.restoreImageNode(n);
      });

      App.renderAllSettings();
      App.ensure5W2HNodes();
      App.syncAgentsFromRoleCounts();
      App.applyPanelLayout();
      App.updateInfo();
      App.updateZoomHud();

      if (showLog) App.addLog("読込しました");
      return true;
    } catch (err) {
      console.error(err);
      App.addLog("読込に失敗しました");
      return false;
    }
  };

  App.scheduleAutoSave = function scheduleAutoSave() {
    if (!App.uiState.autoSave) return;
    if (App.autoSaveTimer) clearTimeout(App.autoSaveTimer);

    App.autoSaveTimer = setTimeout(() => {
      App.saveState();
    }, Number(App.uiState.autoSaveSec || 15) * 1000);
  };

  /* =========================
     Settings render
  ========================= */
  App.renderAgentSettings = function renderAgentSettings() {
    d.settingsAgentSection.innerHTML = `
      <h4>エージェント</h4>
      <div class="row">
        <label>エージェント数: <span id="totalAgentCountLabel">${App.totalAgentCount}</span></label>
        <div style="display:flex;gap:6px;">
          <button id="totalAgentMinusBtn">－</button>
          <button id="totalAgentPlusBtn">＋</button>
        </div>
      </div>
      <div id="roleCountSettingsInner"></div>
      <div class="miniNote">閲覧モードでエージェントをタップ後、行き先ノードをタップすると移動指定できます。</div>
    `;

    const roleWrap = d.settingsAgentSection.querySelector("#roleCountSettingsInner");
    const minusBtn = d.settingsAgentSection.querySelector("#totalAgentMinusBtn");
    const plusBtn = d.settingsAgentSection.querySelector("#totalAgentPlusBtn");

    minusBtn.addEventListener("click", () => {
      if (App.totalAgentCount <= 0) return;
      App.totalAgentCount--;
      App.rebalanceRoleCounts();
      App.renderAgentSettings();
      App.syncAgentsFromRoleCounts();
      App.updateInfo();
      App.scheduleAutoSave();
    });

    plusBtn.addEventListener("click", () => {
      App.totalAgentCount++;
      App.roleCounts.unassigned = (App.roleCounts.unassigned || 0) + 1;
      App.renderAgentSettings();
      App.syncAgentsFromRoleCounts();
      App.updateInfo();
      App.scheduleAutoSave();
    });

    App.ROLE_DEFS.forEach(role => {
      const row = document.createElement("div");
      row.className = "row";

      const label = document.createElement("label");
      label.textContent = `${role.label}: ${App.roleCounts[role.key] ?? 0}`;

      const controls = document.createElement("div");
      controls.style.display = "flex";
      controls.style.gap = "6px";

      const minus = document.createElement("button");
      minus.textContent = "－";
      const plus = document.createElement("button");
      plus.textContent = "＋";

      minus.addEventListener("click", () => {
        if ((App.roleCounts[role.key] || 0) <= 0) return;

        if (role.key === "unassigned") {
          App.roleCounts.unassigned = Math.max(0, (App.roleCounts.unassigned || 0) - 1);
          App.totalAgentCount = Math.max(0, App.totalAgentCount - 1);
        } else {
          App.roleCounts[role.key]--;
          App.roleCounts.unassigned = (App.roleCounts.unassigned || 0) + 1;
        }

        App.renderAgentSettings();
        App.syncAgentsFromRoleCounts();
        App.updateInfo();
        App.scheduleAutoSave();
      });

      plus.addEventListener("click", () => {
        if (role.key === "unassigned") {
          App.roleCounts.unassigned++;
          App.totalAgentCount++;
        } else {
          if ((App.roleCounts.unassigned || 0) <= 0) return;
          App.roleCounts[role.key] = (App.roleCounts[role.key] || 0) + 1;
          App.roleCounts.unassigned = Math.max(0, (App.roleCounts.unassigned || 0) - 1);
        }

        App.renderAgentSettings();
        App.syncAgentsFromRoleCounts();
        App.updateInfo();
        App.scheduleAutoSave();
      });

      controls.appendChild(minus);
      controls.appendChild(plus);
      row.appendChild(label);
      row.appendChild(controls);
      roleWrap.appendChild(row);
    });
  };

  App.renderViewSettings = function renderViewSettings() {
    d.settingsViewSection.innerHTML = `
      <h4>表示</h4>
      <div class="row"><label>グリッド表示</label><input type="checkbox" id="showGridChkProxy"></div>
      <div class="row"><label>5W2H固定</label><input type="checkbox" id="fix5w2hChkProxy"></div>
      <div class="row"><label>リンク種別表示</label><input type="checkbox" id="showLinkTypeChkProxy"></div>
      <div class="row"><label>小ズームで文字省略</label><input type="checkbox" id="compactTextChkProxy"></div>
      <div class="row"><label>エージェント線表示</label><input type="checkbox" id="showAgentLinksChkProxy"></div>
      <div class="row">
        <label>ノード表示上限</label>
        <select id="visibleNodeLimitProxy">
          <option value="50">50</option>
          <option value="100">100</option>
          <option value="Infinity">∞</option>
        </select>
      </div>
      <div class="row"><label>エージェントは非表示ノードを無視</label><input type="checkbox" id="agentsIgnoreHiddenNodesProxy"></div>
      <div class="miniNote">表示上限は偏差値・接続数・接続先重み・リンクバイアスから計算した表示重みによって決まります。</div>
    `;

    const a = d.settingsViewSection.querySelector("#showGridChkProxy");
    const b = d.settingsViewSection.querySelector("#fix5w2hChkProxy");
    const c = d.settingsViewSection.querySelector("#showLinkTypeChkProxy");
    const e = d.settingsViewSection.querySelector("#showAgentLinksChkProxy");
    const f = d.settingsViewSection.querySelector("#visibleNodeLimitProxy");
    const g = d.settingsViewSection.querySelector("#agentsIgnoreHiddenNodesProxy");
    const compact = d.settingsViewSection.querySelector("#compactTextChkProxy");

    a.checked = App.uiState.showGrid;
    b.checked = App.uiState.fix5w2h;
    c.checked = App.uiState.showLinkType;
    compact.checked = App.uiState.compactText;
    e.checked = App.uiState.showAgentLinks;
    f.value = App.uiState.visibleNodeLimit === Infinity ? "Infinity" : String(App.uiState.visibleNodeLimit);
    g.checked = App.uiState.agentsIgnoreHiddenNodes;

    a.addEventListener("input", () => { App.uiState.showGrid = a.checked; App.scheduleAutoSave(); });
    b.addEventListener("input", () => { App.uiState.fix5w2h = b.checked; App.scheduleAutoSave(); });
    c.addEventListener("input", () => { App.uiState.showLinkType = c.checked; App.scheduleAutoSave(); });
    compact.addEventListener("input", () => { App.uiState.compactText = compact.checked; App.scheduleAutoSave(); });
    e.addEventListener("input", () => { App.uiState.showAgentLinks = e.checked; App.scheduleAutoSave(); });
    f.addEventListener("change", () => {
      App.uiState.visibleNodeLimit = f.value === "Infinity" ? Infinity : Number(f.value);
      App.scheduleAutoSave();
    });
    g.addEventListener("input", () => {
      App.uiState.agentsIgnoreHiddenNodes = g.checked;
      App.scheduleAutoSave();
    });
  };

  App.renderPhysicsSettings = function renderPhysicsSettings() {
    d.settingsPhysicsSection.innerHTML = `
      <h4>物理</h4>
      <div class="row"><label>物理ON</label><input type="checkbox" id="physicsChkProxy"></div>
      <div class="row"><label>反発強度</label><input type="range" id="repelRangeProxy" min="10" max="300"></div>
      <div class="row"><label>ばね強度</label><input type="range" id="springRangeProxy" min="1" max="80"></div>
      <div class="row"><label>減衰</label><input type="range" id="dampingRangeProxy" min="70" max="99"></div>
    `;

    const a = d.settingsPhysicsSection.querySelector("#physicsChkProxy");
    const b = d.settingsPhysicsSection.querySelector("#repelRangeProxy");
    const c = d.settingsPhysicsSection.querySelector("#springRangeProxy");
    const dd = d.settingsPhysicsSection.querySelector("#dampingRangeProxy");

    a.checked = App.uiState.physics;
    b.value = App.uiState.repel;
    c.value = App.uiState.spring;
    dd.value = App.uiState.damping;

    a.addEventListener("input", () => { App.uiState.physics = a.checked; App.scheduleAutoSave(); });
    b.addEventListener("input", () => { App.uiState.repel = Number(b.value); App.scheduleAutoSave(); });
    c.addEventListener("input", () => { App.uiState.spring = Number(c.value); App.scheduleAutoSave(); });
    dd.addEventListener("input", () => { App.uiState.damping = Number(dd.value); App.scheduleAutoSave(); });
  };

  App.renderDataSettings = function renderDataSettings() {
    d.settingsDataSection.innerHTML = `
      <h4>データ</h4>
      <div class="row"><label>学際自動生成</label><input type="checkbox" id="interChkProxy"></div>
      <div class="row"><label>自動展開</label><input type="checkbox" id="autoExpandChkProxy"></div>
      <div class="row"><label>展開数</label><input type="range" id="expandCountRangeProxy" min="1" max="8"></div>
      <div class="row"><label>自動保存</label><input type="checkbox" id="autoSaveChkProxy"></div>
      <div class="row"><label>保存間隔(秒)</label><input type="range" id="autoSaveSecRangeProxy" min="5" max="60"></div>
      <div class="row"><label>RSS連動</label><input type="checkbox" id="rssEnabledProxy"></div>
      <div class="row"><label>RSS更新間隔(分)</label><input type="range" id="rssRefreshMinProxy" min="1" max="60"></div>
      <button id="rssRefreshNowBtn">RSS今すぐ更新</button>
      <div class="miniNote">冒険者はRSS見出しからも新ノードを拾います。村人はRSS出現頻度も使って注目度を計算します。</div>
    `;

    const a = d.settingsDataSection.querySelector("#interChkProxy");
    const b = d.settingsDataSection.querySelector("#autoExpandChkProxy");
    const c = d.settingsDataSection.querySelector("#expandCountRangeProxy");
    const e = d.settingsDataSection.querySelector("#autoSaveChkProxy");
    const f = d.settingsDataSection.querySelector("#autoSaveSecRangeProxy");
    const g = d.settingsDataSection.querySelector("#rssEnabledProxy");
    const h = d.settingsDataSection.querySelector("#rssRefreshMinProxy");
    const i = d.settingsDataSection.querySelector("#rssRefreshNowBtn");

    a.checked = App.uiState.inter;
    b.checked = App.uiState.autoExpand;
    c.value = App.uiState.expandCount;
    e.checked = App.uiState.autoSave;
    f.value = App.uiState.autoSaveSec;
    g.checked = App.uiState.rssEnabled;
    h.value = App.uiState.rssRefreshMin;

    a.addEventListener("input", () => { App.uiState.inter = a.checked; App.scheduleAutoSave(); });
    b.addEventListener("input", () => { App.uiState.autoExpand = b.checked; App.scheduleAutoSave(); });
    c.addEventListener("input", () => { App.uiState.expandCount = Number(c.value); App.scheduleAutoSave(); });
    e.addEventListener("input", () => { App.uiState.autoSave = e.checked; App.scheduleAutoSave(); });
    f.addEventListener("input", () => { App.uiState.autoSaveSec = Number(f.value); App.scheduleAutoSave(); });
    g.addEventListener("input", () => {
      App.uiState.rssEnabled = g.checked;
      App.restartRssTimer();
      App.scheduleAutoSave();
    });
    h.addEventListener("input", () => {
      App.uiState.rssRefreshMin = Number(h.value);
      App.restartRssTimer();
      App.scheduleAutoSave();
    });
    i.addEventListener("click", async () => {
      await App.refreshRssFeeds(true);
      App.updateInfo();
      App.scheduleAutoSave();
    });
  };

  App.renderAllSettings = function renderAllSettings() {
    App.renderAgentSettings();
    App.renderViewSettings();
    App.renderPhysicsSettings();
    App.renderDataSettings();
  };

  /* =========================
     Fit / Reset
  ========================= */
  App.fitToAll = function fitToAll() {
    if (!App.nodes || App.nodes.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    App.nodes.forEach(n => {
      const hw = n.shape === "rect" ? (n.width || 120) / 2 : (n.r || 20);
      const hh = n.shape === "rect" ? (n.height || 80) / 2 : (n.r || 20);

      minX = Math.min(minX, n.x - hw);
      minY = Math.min(minY, n.y - hh);
      maxX = Math.max(maxX, n.x + hw);
      maxY = Math.max(maxY, n.y + hh);
    });

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const ww = Math.max(200, maxX - minX + 140);
    const hh = Math.max(200, maxY - minY + 140);

    App.view.x = cx;
    App.view.y = cy;
    App.view.scale = Math.max(0.15, Math.min(2.5, Math.min(App.W / ww, App.H / hh)));

    App.updateZoomHud();
  };

  App.resetMap = function resetMap() {
    App.nodes = [];
    App.links = [];
    App.selectedNodeId = null;
    App.hoveredNodeId = null;
    App.linkingFromId = null;
    App.editingNodeId = null;
    App.followAgentId = null;
    App.pendingAgentTargetId = null;
    App.idCounter = 1;
    App.searchResults = [];
    App.searchIndex = 0;
    App.lastSearchQuery = "";
    App.rssState.seenHeadlines = new Set();

    App.ensure5W2HNodes();

    const seeds = [
      { label: "AI", x: 0, y: 0, memo: "中心テーマ" },
      { label: "原油", x: -360, y: 180, memo: "資源・価格" },
      { label: "ドローン", x: 360, y: 180, memo: "機体・用途" },
      { label: "半導体", x: 0, y: 320, memo: "部品・産業" }
    ];

    seeds.forEach(s => {
      const n = App.makeNode({
        x: s.x,
        y: s.y,
        label: s.label,
        memo: s.memo,
        r: 24,
        color: "#2b3344",
        textColor: "#eaf1ff",
        category: "normal"
      });

      n.title = s.label;
      n.summary = s.memo;
      n.rootNodeId = n.id;
      App.nodes.push(n);
    });

    App.syncAgentsFromRoleCounts();

    const ai = App.nodeExistsByLabel("AI");
    const oil = App.nodeExistsByLabel("原油");
    const drone = App.nodeExistsByLabel("ドローン");
    const semi = App.nodeExistsByLabel("半導体");

    if (ai) {
      const why = App.getNode("5w2h_Why");
      const how = App.getNode("5w2h_How");
      if (why) App.addLinkSmart(ai, why);
      if (how) App.addLinkSmart(ai, how);
    }
    if (oil) {
      const where = App.getNode("5w2h_Where");
      if (where) App.addLinkSmart(oil, where);
    }
    if (drone) {
      const who = App.getNode("5w2h_Who");
      if (who) App.addLinkSmart(drone, who);
    }
    if (semi) {
      const what = App.getNode("5w2h_What");
      if (what) App.addLinkSmart(semi, what);
    }

    if (App.agents.length > 0) App.followAgentId = App.agents[0].id;

    App.fitToAll();
    App.updateInfo();
    App.addLog("新規マップを作成");
    App.scheduleAutoSave();
  };

  /* =========================
     Pointer / Wheel / Stick
  ========================= */
  App.onCanvasPointerDown = function onCanvasPointerDown(e) {
    const p = App.pointerPosFromEvent(e);
    const w = App.screenToWorld(p.x, p.y);
    const node = App.hitTestNode(w.x, w.y);

    App.pointerDown = true;
    App.lastPointer = p;
    App.hoveredNodeId = node ? node.id : null;

    App.clearLongPressTimer();

    if (App.mode === "edit" && !node) {
      App.longPressTimer = setTimeout(() => {
        const newNode = App.createNodeAtWorld(w.x, w.y, d.quickInput.value.trim() || "新規ノード");
        App.selectedNodeId = newNode.id;
        App.syncQuickInputFromSelection();
        App.openEditor(newNode, p.x, p.y);
        App.updateInfo();
      }, App.LONG_PRESS_MS);
    }

    const now = Date.now();
    const isDoubleTap =
      now - App.lastTapTime <= App.DOUBLE_TAP_MS &&
      App.isNearPoint(p.x, p.y, App.lastTapX, App.lastTapY);

    App.lastTapTime = now;
    App.lastTapX = p.x;
    App.lastTapY = p.y;

    if (App.mode === "edit") {
      if (node) {
        App.selectedNodeId = node.id;

        if (isDoubleTap && !node.is5w2h) {
          App.openEditor(node, p.x, p.y);
          App.updateInfo();
          App.syncQuickInputFromSelection();
          return;
        }

        if (node.shape === "rect" && App.hitResizeHandle(node, w.x, w.y)) {
          App.resizingNodeId = node.id;
        } else if (!node.fixed) {
          App.draggingNodeId = node.id;
          App.dragOffsetWorldX = w.x - node.x;
          App.dragOffsetWorldY = w.y - node.y;
        }
      } else {
        App.selectedNodeId = null;
        App.panning = true;
      }
    } else if (App.mode === "view") {
      if (node) {
        if (App.pendingAgentTargetId && !node.isAgentNode) {
          const agent = App.agents.find(a => a.id === App.pendingAgentTargetId);
          if (agent) {
            agent.targetNodeId = node.id;
            agent.taskText = `${node.title || node.label} へ移動指定`;
            App.addLog(`移動指定: ${App.getNode(agent.id)?.label || "Agent"} → ${node.title || node.label}`);
          }
          App.pendingAgentTargetId = null;
          App.selectedNodeId = node.id;
          App.updateInfo();
          App.syncQuickInputFromSelection();
          App.scheduleAutoSave();
          return;
        }

        App.selectedNodeId = node.id;

        if (node.isAgentNode) {
          App.followAgentId = node.id;
          App.pendingAgentTargetId = node.id;
          App.updateFollowUI();
          App.addLog(`行き先指定待ち: ${node.label.replace("\n", " ")}`);
        }
      } else {
        App.selectedNodeId = null;
        if (!App.pendingAgentTargetId) {
          App.panning = true;
        }
      }
    } else if (App.mode === "link") {
      if (node) {
        App.selectedNodeId = node.id;

        if (!App.linkingFromId) {
          App.linkingFromId = node.id;
          App.addLog(`リンク開始: ${node.title || node.label}`);
        } else if (App.linkingFromId === node.id) {
          App.linkingFromId = null;
          App.addLog("リンク選択解除");
        } else {
          App.addLinkSmart(App.getNode(App.linkingFromId), node);
          App.linkingFromId = null;
          App.scheduleAutoSave();
        }
      } else {
        App.linkingFromId = null;
        App.selectedNodeId = null;
      }
    }

    App.updateInfo();
    App.syncQuickInputFromSelection();
  };

  App.onCanvasPointerMove = function onCanvasPointerMove(e) {
    const p = App.pointerPosFromEvent(e);
    const w = App.screenToWorld(p.x, p.y);
    const hit = App.hitTestNode(w.x, w.y);
    App.hoveredNodeId = hit ? hit.id : null;

    if (App.pointerDown) {
      const dx = p.x - App.lastPointer.x;
      const dy = p.y - App.lastPointer.y;

      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
        App.clearLongPressTimer();
      }

      if (App.resizingNodeId) {
        const node = App.getNode(App.resizingNodeId);
        if (node && node.shape === "rect") {
          node.width = Math.max(60, (w.x - node.x) * 2);
          node.height = Math.max(40, (w.y - node.y) * 2);
        }
      } else if (App.draggingNodeId) {
        const node = App.getNode(App.draggingNodeId);
        if (node && !node.fixed) {
          node.x = w.x - App.dragOffsetWorldX;
          node.y = w.y - App.dragOffsetWorldY;
          node.vx = 0;
          node.vy = 0;
        }
      } else if (App.panning) {
        App.view.x -= dx / App.view.scale;
        App.view.y -= dy / App.view.scale;
      }
    }

    App.lastPointer = p;
  };

  App.onCanvasPointerUp = function onCanvasPointerUp() {
    App.clearLongPressTimer();
    App.pointerDown = false;

    if (App.draggingNodeId || App.resizingNodeId) {
      App.scheduleAutoSave();
    }

    App.draggingNodeId = null;
    App.resizingNodeId = null;
    App.panning = false;
  };

  App.onWheel = function onWheel(e) {
    e.preventDefault();

    const mouse = App.pointerPosFromEvent(e);
    const before = App.screenToWorld(mouse.x, mouse.y);

    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    App.view.scale = Math.max(0.15, Math.min(4, App.view.scale * factor));

    const after = App.screenToWorld(mouse.x, mouse.y);
    App.view.x += before.x - after.x;
    App.view.y += before.y - after.y;

    App.updateZoomHud();
  };

  App.handleStickMove = function handleStickMove(clientX, clientY) {
    const rect = d.stickWrap.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    let dx = clientX - cx;
    let dy = clientY - cy;

    const len = Math.hypot(dx, dy);
    const max = App.stickState.max;

    if (len > max) {
      dx = dx / len * max;
      dy = dy / len * max;
    }

    App.stickState.dx = dx / max;
    App.stickState.dy = dy / max;
    App.stickState.active = true;

    const knobRect = d.stickKnob.getBoundingClientRect();
    const knobW = knobRect.width || 56;
    const knobH = knobRect.height || 56;

    d.stickKnob.style.left = rect.width / 2 - knobW / 2 + dx + "px";
    d.stickKnob.style.top = rect.height / 2 - knobH / 2 + dy + "px";
  };

  App.resetStick = function resetStick() {
    App.stickState.active = false;
    App.stickState.dx = 0;
    App.stickState.dy = 0;

    const baseSize = d.stickWrap.getBoundingClientRect();
    const knobSize = d.stickKnob.getBoundingClientRect();

    d.stickKnob.style.left = (baseSize.width - knobSize.width) / 2 + "px";
    d.stickKnob.style.top = (baseSize.height - knobSize.height) / 2 + "px";
  };

  /* =========================
     Animation
  ========================= */
  App.animate = function animate() {
    App.frame++;
    App.physicsStep();
    App.draw();
    requestAnimationFrame(App.animate);
  };

  /* =========================
     Event bindings
  ========================= */
  App.bindEvents = function bindEvents() {
    d.startBtn.addEventListener("click", () => {
      App.running = true;
      App.addLog("開始");
    });

    d.stopBtn.addEventListener("click", () => {
      App.running = false;
      App.addLog("停止");
    });

    d.saveBtn.addEventListener("click", App.saveState);

    d.loadBtn.addEventListener("click", () => {
      if (!App.loadState(true)) App.addLog("保存データがありません");
    });

    d.fitBtn.addEventListener("click", App.fitToAll);

    d.alignBtn.addEventListener("click", () => {
      App.addLog("整列は簡易版です");
      App.fitToAll();
    });

    d.settingsBtn.addEventListener("click", () => {
      d.settingsPanel.classList.toggle("open");
    });

    d.toggleLogBtn.addEventListener("click", () => {
      d.logPanel.classList.toggle("collapsed");
      d.toggleLogBtn.textContent = d.logPanel.classList.contains("collapsed") ? "ログ▼" : "ログ▲";
    });

    d.followBtn.addEventListener("click", () => {
      if (App.followAgentId) {
        App.followAgentId = null;
      } else if (App.selectedNodeId) {
        const n = App.getNode(App.selectedNodeId);
        if (n && n.isAgentNode) App.followAgentId = n.id;
      }
      App.updateFollowUI();
      App.scheduleAutoSave();
    });

    d.quickAddBtn.addEventListener("click", () => {
      const text = d.quickInput.value.trim();
      const x = App.view.x + (Math.random() - 0.5) * 60;
      const y = App.view.y + (Math.random() - 0.5) * 60;
      const node = App.createNodeAtWorld(x, y, text || "新規ノード");

      App.selectedNodeId = node.id;
      App.syncQuickInputFromSelection();

      if (!text) {
        const p = App.worldToScreen(node.x, node.y);
        App.openEditor(node, p.x, p.y);
      }

      App.updateInfo();
      App.scheduleAutoSave();
    });

    d.quickEditBtn.addEventListener("click", () => {
      const node = App.getNode(App.selectedNodeId);
      if (!node) {
        App.addLog("編集対象ノードが未選択です");
        return;
      }

      const text = d.quickInput.value.trim();

      if (text) {
        App.renameNode(node, text);
        App.updateInfo();
        App.syncQuickInputFromSelection();
        App.scheduleAutoSave();
        return;
      }

      const p = App.worldToScreen(node.x, node.y);
      App.openEditor(node, p.x, p.y);
    });

    d.quickSearchBtn.addEventListener("click", App.runQuickSearch);

    d.viewModeBtn.addEventListener("click", () => App.setMode("view"));
    d.editModeBtn.addEventListener("click", () => App.setMode("edit"));
    d.linkModeBtn.addEventListener("click", () => App.setMode("link"));

    d.tabAgentBtn.addEventListener("click", () => App.openSettingsTab("agent"));
    d.tabViewBtn.addEventListener("click", () => App.openSettingsTab("view"));
    d.tabPhysicsBtn.addEventListener("click", () => App.openSettingsTab("physics"));
    d.tabDataBtn.addEventListener("click", () => App.openSettingsTab("data"));

    d.pinTopBarBtn.addEventListener("click", () => {
      App.panelPins.topBarPanel = !App.panelPins.topBarPanel;
      App.applyPanelLayout();
      App.scheduleAutoSave();
    });

    d.pinSettingsBtn.addEventListener("click", () => {
      App.panelPins.settingsPanel = !App.panelPins.settingsPanel;
      App.applyPanelLayout();
      App.scheduleAutoSave();
    });

    d.pinDetailBtn.addEventListener("click", () => {
      App.panelPins.nodeDetailPanel = !App.panelPins.nodeDetailPanel;
      App.applyPanelLayout();
      App.scheduleAutoSave();
    });

    d.zoomInBtn.addEventListener("click", () => {
      App.view.scale = Math.min(4, App.view.scale * 1.15);
      App.updateZoomHud();
    });

    d.zoomOutBtn.addEventListener("click", () => {
      App.view.scale = Math.max(0.15, App.view.scale / 1.15);
      App.updateZoomHud();
    });

    d.nodeSaveBtn.addEventListener("click", () => {
      const node = App.getNode(App.editingNodeId);
      if (!node) return;

      const clean = App.sanitizeGeneratedLabel(d.nodeLabelInput.value.trim() || "無題");
      node.title = clean;
      node.label = clean;
      node.memo = d.nodeMemoInput.value.trim();
      node.color = d.nodeColorInput.value;
      node.updatedAt = Date.now();

      App.closeEditor();
      App.addLog(`ノード更新: ${clean}`);
      App.updateInfo();
      App.syncQuickInputFromSelection();
      App.scheduleAutoSave();
    });

    d.nodeDeleteBtn.addEventListener("click", () => {
      const id = App.editingNodeId;
      App.closeEditor();
      App.deleteNode(id);
      App.updateInfo();
      App.scheduleAutoSave();
    });

    d.nodeCloseBtn.addEventListener("click", App.closeEditor);

    d.canvas.addEventListener("pointerdown", App.onCanvasPointerDown);
    d.canvas.addEventListener("pointermove", App.onCanvasPointerMove);
    window.addEventListener("pointerup", App.onCanvasPointerUp);
    d.canvas.addEventListener("wheel", App.onWheel, { passive: false });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        App.linkingFromId = null;
        App.pendingAgentTargetId = null;
        App.closeEditor();
        App.updateInfo();
      }

      if (document.activeElement === d.quickInput && e.key === "Enter") {
        if (App.mode === "edit") {
          d.quickAddBtn.click();
        } else {
          App.runQuickSearch();
        }
      }
    });

    window.addEventListener("paste", (e) => {
      const items = e.clipboardData?.items || [];
      for (const item of items) {
        if (item.type && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (!file) continue;

          const reader = new FileReader();
          reader.onload = () => {
            App.createImageNodeAtWorld(App.view.x, App.view.y, reader.result, "貼り付け画像");
            App.updateInfo();
            App.scheduleAutoSave();
          };
          reader.readAsDataURL(file);

          e.preventDefault();
          return;
        }
      }
    });

    window.addEventListener("dragover", (e) => {
      e.preventDefault();
    });

    window.addEventListener("drop", (e) => {
      e.preventDefault();

      const files = [...(e.dataTransfer?.files || [])];
      const imageFile = files.find(f => f.type && f.type.startsWith("image/"));
      if (!imageFile) return;

      const reader = new FileReader();
      reader.onload = () => {
        const rect = d.canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const w = App.screenToWorld(sx, sy);
        App.createImageNodeAtWorld(w.x, w.y, reader.result, imageFile.name || "画像");
        App.updateInfo();
        App.scheduleAutoSave();
      };
      reader.readAsDataURL(imageFile);
    });

    window.addEventListener("resize", () => {
      App.resize();
      App.resetStick();
      App.draw();
    });

    d.stickWrap.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      d.stickWrap.setPointerCapture(e.pointerId);
      App.handleStickMove(e.clientX, e.clientY);
    });

    d.stickWrap.addEventListener("pointermove", (e) => {
      if (!App.stickState.active) return;
      App.handleStickMove(e.clientX, e.clientY);
    });

    d.stickWrap.addEventListener("pointerup", App.resetStick);
    d.stickWrap.addEventListener("pointercancel", App.resetStick);
  };

  /* =========================
     Boot
  ========================= */
  App.boot = async function boot() {
    App.resize();
    App.renderAllSettings();
    App.openSettingsTab("agent");

    App.makePanelDraggable(d.topBarPanel, "topBarPanel");
    App.makePanelDraggable(d.settingsPanel, "settingsPanel");
    App.makePanelDraggable(d.nodeDetailPanel, "nodeDetailPanel");

    App.bindEvents();

    if (!App.loadState(false)) {
      App.resetMap();
    } else {
      App.syncAgentsFromRoleCounts();
      App.renderAllSettings();
      App.openSettingsTab("agent");
      App.addLog("前回データを復元");
    }

    App.setMode("view");
    App.updateInfo();
    App.updateZoomHud();

    await App.refreshRssFeeds(true);
    App.restartRssTimer();
    App.animate();
  };

  App.boot();
})();