/**
 * TarotScene — Oracle tarot card reading game in Phaser 3.
 *
 * Visual design: parchment / occult aesthetic with warm ivory background,
 * three tarot cards drawn with Phaser.Graphics:
 *   Back: dark-navy rectangle with gold filigree-style cross + dot pattern
 *   Face: ivory rectangle with an astral symbol drawn based on card archetype
 * Cards flip via scaleX tween on tap.
 * Intent buttons for Clarity / Decision / Momentum.
 */
import Phaser from "phaser";
import { BaseScene } from "@framework/phaser/BaseScene";
import type { GameState } from "@framework/phaser/types";

// ── Palette ────────────────────────────────────────────────────────────────────
const C = {
  bg:        0xfff9f0,
  bgAlt:     0xfef3df,
  border:    0xeadfc8,
  gold:      0xd4a843,
  goldLt:    0xf0c866,
  goldDk:    0x8b6914,
  cardBack:  0x1a0d4a,
  cardFace:  0xfdf8ed,
  muted:     0x8b7355,
  dark:      0x35240f,
  inkDark:   0x2a1a08,
  accent:    0x7b4f12,
  teal:      0x16c784,
};

interface CardData { name: string; keywords: string[]; flipped: boolean; arcana: string; }

export class TarotScene extends BaseScene {
  private cardContainers: Phaser.GameObjects.Container[] = [];
  private drawBtn!: Phaser.GameObjects.Container;
  private resetBtn!: Phaser.GameObjects.Container;
  private titleLabel!: Phaser.GameObjects.Text;
  private statusLabel!: Phaser.GameObjects.Text;
  private intentBtns: Phaser.GameObjects.Container[] = [];

  private static readonly INTENTS = [
    { key: "clarity",  label: "Clarity"  },
    { key: "decision", label: "Decision" },
    { key: "momentum", label: "Momentum" },
  ];
  private static readonly POSITIONS = ["PAST", "PRESENT", "FUTURE"] as const;
  private static readonly CARD_W = 108;
  private static readonly CARD_H = 172;

  constructor() { super("TarotScene"); }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  create(): void {
    super.create();
    const { width: W, height: H } = this.scale;
    this.drawBackground(W, H);
    this.buildCardSlots(W, H);
    this.buildControls(W, H);
    this.buildStatusLabels(W, H);
    this.onStateUpdate(this.state);
  }

  protected onStateUpdate(state: GameState): void {
    const hasDrawn   = this.bool("hasDrawn");
    const allFlipped = this.bool("allFlipped");
    const isLoading  = this.bool("isLoading");
    const drawn      = this.val<CardData[]>("drawn") ?? [];

    this.drawBtn.setVisible(!hasDrawn && !isLoading);
    this.resetBtn.setVisible(allFlipped);
    this.statusLabel.setText(isLoading ? "Consulting the oracle…" : "");
    this.intentBtns.forEach((btn) => btn.setVisible(!hasDrawn));

    // Update existing cards
    drawn.forEach((card, i) => {
      if (i < this.cardContainers.length) this.updateCard(i, card);
    });

    // Add new cards if drawn array grew
    if (drawn.length > this.cardContainers.length) {
      const { width: W, height: H } = this.scale;
      for (let i = this.cardContainers.length; i < drawn.length; i++) {
        this.buildCard(i, W, H);
        this.updateCard(i, drawn[i]!);
        const c = this.cardContainers[i]!;
        c.setAlpha(0).setScale(0.85);
        this.tweens.add({ targets: c, alpha: 1, scale: 1, delay: i * 180, duration: 300, ease: "Back.easeOut" });
      }
    }

    // Oracle verified badge
    if (allFlipped) {
      this.titleLabel.setText("Oracle Verified").setColor("#d4a843");
    } else if (hasDrawn) {
      this.titleLabel.setText("Tap cards to reveal").setColor("#75685a");
    } else {
      this.titleLabel.setText("Choose your intention").setColor("#75685a");
    }
  }

  // ── Background ─────────────────────────────────────────────────────────────

  private drawBackground(W: number, H: number): void {
    this.add.rectangle(W / 2, H / 2, W, H, C.bg);

    const g = this.add.graphics();
    // Cloth-like diagonal lines
    g.lineStyle(1, C.border, 0.3);
    for (let d = -H; d < W + H; d += 22) {
      g.lineBetween(d, 0, d + H, H);
    }

    // Gold border
    g.lineStyle(2, C.gold, 0.5);
    g.strokeRoundedRect(10, 10, W - 20, H - 20, 18);

    // Outer thin border
    g.lineStyle(1, C.goldDk, 0.25);
    g.strokeRoundedRect(6, 6, W - 12, H - 12, 20);

    // Center astral symbol (background watermark)
    const wm = this.add.graphics();
    wm.setAlpha(0.04);
    this.drawAstralSymbol(wm, W / 2, H / 2, 60, C.goldDk);
  }

  // ── Card slots ─────────────────────────────────────────────────────────────

  private buildCardSlots(W: number, H: number): void {
    const spacing = TarotScene.CARD_W + 16;
    const startX  = W / 2 - spacing;
    for (let i = 0; i < 3; i++) {
      const x = startX + i * spacing;
      const y = H * 0.46;

      // Slot placeholder (dashed border)
      const g = this.add.graphics();
      g.lineStyle(1, C.gold, 0.25);
      g.strokeRoundedRect(x - TarotScene.CARD_W / 2 - 2, y - TarotScene.CARD_H / 2 - 2,
        TarotScene.CARD_W + 4, TarotScene.CARD_H + 4, 6);

      // Position label above
      this.add.text(x, y - TarotScene.CARD_H / 2 - 18, TarotScene.POSITIONS[i]!, {
        fontSize: "9px", color: "#b8860b", letterSpacing: 3,
      }).setOrigin(0.5);
    }
  }

  // ── Card construction ──────────────────────────────────────────────────────

  private buildCard(index: number, W: number, H: number): void {
    const spacing = TarotScene.CARD_W + 16;
    const startX  = W / 2 - spacing;
    const x = startX + index * spacing;
    const y = H * 0.46;
    const cW = TarotScene.CARD_W - 4;
    const cH = TarotScene.CARD_H - 4;

    const container = this.add.container(x, y);

    // ── Card back ──────────────────────────────────────────────────────────
    const back = this.add.graphics();
    back.fillStyle(C.cardBack);
    back.fillRoundedRect(-cW / 2, -cH / 2, cW, cH, 7);
    back.lineStyle(3, C.gold, 0.9);
    back.strokeRoundedRect(-cW / 2, -cH / 2, cW, cH, 7);

    // Back filigree pattern (cross + diamond)
    back.lineStyle(1, C.gold, 0.3);
    back.lineBetween(-cW / 2 + 10, 0, cW / 2 - 10, 0);
    back.lineBetween(0, -cH / 2 + 10, 0, cH / 2 - 10);
    back.strokeRect(-cW / 2 + 12, -cH / 2 + 12, cW - 24, cH - 24);
    this.drawAstralSymbol(back, 0, 0, 20, C.gold);
    back.lineStyle(1, C.goldDk, 0.2);
    back.strokeCircle(0, 0, 32);

    // Corner dots on back
    back.fillStyle(C.gold, 0.4);
    const corners = [[-cW / 2 + 10, -cH / 2 + 10], [cW / 2 - 10, -cH / 2 + 10],
      [-cW / 2 + 10, cH / 2 - 10], [cW / 2 - 10, cH / 2 - 10]] as const;
    corners.forEach(([cx2, cy2]) => back.fillCircle(cx2, cy2, 3));

    // ── Card face (hidden initially) ───────────────────────────────────────
    const face = this.add.graphics();
    face.setAlpha(0);
    this.drawCardFaceBlank(face, cW, cH);

    // Symbol drawn on face (placeholder — redrawn on flip)
    const symbolG = this.add.graphics();
    symbolG.setAlpha(0);

    // Card name label
    const nameLabel = this.add.text(0, cH / 2 - 22, "", {
      fontSize: "9px",
      fontStyle: "bold",
      color: "#2a1a08",
      wordWrap: { width: cW - 12 },
      align: "center",
    }).setOrigin(0.5).setAlpha(0);

    // Keywords label
    const kwLabel = this.add.text(0, cH / 2 - 10, "", {
      fontSize: "7px",
      color: "#8b6914",
      wordWrap: { width: cW - 12 },
      align: "center",
    }).setOrigin(0.5).setAlpha(0);

    back.setInteractive(
      new Phaser.Geom.Rectangle(-cW / 2, -cH / 2, cW, cH),
      Phaser.Geom.Rectangle.Contains,
    );
    back.on("pointerdown", () => {
      if (!container.getData("flipped")) this.dispatch("flipCard", index);
    });
    back.on("pointerover", () => {
      if (!container.getData("flipped")) {
        this.tweens.add({ targets: container, scale: 1.04, duration: 100 });
      }
    });
    back.on("pointerout", () => this.tweens.add({ targets: container, scale: 1, duration: 100 }));

    container.setData("back", back);
    container.setData("face", face);
    container.setData("symbolG", symbolG);
    container.setData("name", nameLabel);
    container.setData("kw", kwLabel);
    container.setData("flipped", false);

    container.add([back, face, symbolG, nameLabel, kwLabel]);
    this.cardContainers.push(container);
  }

  private drawCardFaceBlank(g: Phaser.GameObjects.Graphics, cW: number, cH: number): void {
    g.fillStyle(C.cardFace);
    g.fillRoundedRect(-cW / 2, -cH / 2, cW, cH, 7);
    g.lineStyle(3, C.gold, 0.9);
    g.strokeRoundedRect(-cW / 2, -cH / 2, cW, cH, 7);
    // Inner margin
    g.lineStyle(1, C.goldDk, 0.3);
    g.strokeRoundedRect(-cW / 2 + 6, -cH / 2 + 6, cW - 12, cH - 12, 4);
    // Horizontal divider (separating symbol from name)
    g.lineStyle(1, C.gold, 0.3);
    g.lineBetween(-cW / 2 + 8, cH / 2 - 36, cW / 2 - 8, cH / 2 - 36);
  }

  private drawAstralSymbol(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number, color: number): void {
    g.lineStyle(1, color, 0.7);
    // 6-pointed star (Star of David / hexagram)
    for (let p = 0; p < 2; p++) {
      const offset = p * 60;
      g.beginPath();
      for (let v = 0; v < 4; v++) {
        const a = Phaser.Math.DegToRad(offset + v * 120);
        if (v === 0) g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        else g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      g.closePath();
      g.strokePath();
    }
    // Center dot
    g.fillStyle(color, 0.5);
    g.fillCircle(cx, cy, r * 0.12);
  }

  /** Draw an archetype-specific symbol on the card face. */
  private drawCardSymbol(g: Phaser.GameObjects.Graphics, archetype: string, cx: number, cy: number): void {
    g.clear();
    const name = archetype.toLowerCase();

    if (name.includes("sun") || name.includes("fire") || name.includes("wand")) {
      // Sun: radiating circle with rays
      g.lineStyle(2, C.gold, 0.9);
      g.strokeCircle(cx, cy, 20);
      g.fillStyle(0xfde68a, 0.8);
      g.fillCircle(cx, cy, 12);
      for (let r = 0; r < 8; r++) {
        const a = Phaser.Math.DegToRad(r * 45);
        g.lineStyle(2, C.goldLt, 0.7);
        g.lineBetween(cx + Math.cos(a) * 22, cy + Math.sin(a) * 22,
          cx + Math.cos(a) * 32, cy + Math.sin(a) * 32);
      }

    } else if (name.includes("moon") || name.includes("water") || name.includes("cup")) {
      // Crescent moon
      g.fillStyle(C.gold, 0.85);
      g.fillCircle(cx, cy, 22);
      g.fillStyle(C.cardFace, 1);
      g.fillCircle(cx + 11, cy - 6, 18);
      // Stars
      g.fillStyle(C.goldLt, 0.7);
      g.fillCircle(cx + 20, cy - 22, 3);
      g.fillCircle(cx - 10, cy - 28, 2);
      g.fillCircle(cx + 28, cy + 4, 2);

    } else if (name.includes("star") || name.includes("hope")) {
      // Eight-pointed star
      g.fillStyle(C.goldLt, 0.9);
      for (let p = 0; p < 8; p++) {
        const a = Phaser.Math.DegToRad(p * 45);
        const b = Phaser.Math.DegToRad(p * 45 + 22.5);
        g.fillTriangle(
          cx + Math.cos(a) * 26, cy + Math.sin(a) * 26,
          cx + Math.cos(b) * 10, cy + Math.sin(b) * 10,
          cx - Math.cos(b) * 10, cy - Math.sin(b) * 10,
        );
      }
      g.fillStyle(0xffffff, 0.6);
      g.fillCircle(cx, cy, 6);

    } else if (name.includes("tower") || name.includes("lightning")) {
      // Tower: vertical rectangle with lightning bolt
      g.fillStyle(C.accent);
      g.fillRect(cx - 8, cy - 22, 16, 26);
      g.fillStyle(0x4a2808);
      g.fillRect(cx - 4, cy - 18, 8, 14);
      g.lineStyle(2, C.goldLt);
      g.lineBetween(cx + 2, cy + 6, cx - 4, cy + 18);
      g.lineBetween(cx - 4, cy + 18, cx + 6, cy + 16);
      g.lineBetween(cx + 6, cy + 16, cx - 2, cy + 28);

    } else if (name.includes("wheel") || name.includes("fortune")) {
      // Wheel of Fortune
      g.lineStyle(2, C.gold);
      g.strokeCircle(cx, cy, 24);
      g.strokeCircle(cx, cy, 12);
      for (let sp = 0; sp < 4; sp++) {
        const a = Phaser.Math.DegToRad(sp * 90);
        g.lineBetween(cx + Math.cos(a) * 12, cy + Math.sin(a) * 12,
          cx + Math.cos(a) * 24, cy + Math.sin(a) * 24);
      }
      for (let sp = 0; sp < 4; sp++) {
        const a = Phaser.Math.DegToRad(sp * 90 + 45);
        g.lineStyle(1, C.goldDk, 0.5);
        g.lineBetween(cx + Math.cos(a) * 12, cy + Math.sin(a) * 12,
          cx + Math.cos(a) * 24, cy + Math.sin(a) * 24);
      }
      g.fillStyle(C.gold, 0.8);
      g.fillCircle(cx, cy, 5);

    } else if (name.includes("world") || name.includes("completion")) {
      // World: ellipse wreath with center star
      g.lineStyle(2, C.teal, 0.8);
      g.strokeEllipse(cx, cy, 30, 46);
      g.lineStyle(1, C.gold, 0.6);
      g.strokeEllipse(cx, cy, 38, 54);
      g.fillStyle(C.gold, 0.9);
      g.fillCircle(cx, cy, 7);
      g.fillStyle(0xffffff, 0.5);
      g.fillCircle(cx, cy, 3);

    } else if (name.includes("fool") || name.includes("joker")) {
      // Fool: jester zigzag
      g.lineStyle(2, C.accent);
      g.lineBetween(cx - 18, cy + 16, cx - 6, cy - 6);
      g.lineBetween(cx - 6, cy - 6, cx + 6, cy + 10);
      g.lineBetween(cx + 6, cy + 10, cx + 18, cy - 8);
      g.fillStyle(C.goldLt);
      g.fillCircle(cx - 18, cy + 16, 4);
      g.fillCircle(cx, cy + 4, 4);
      g.fillCircle(cx + 18, cy - 8, 4);

    } else if (name.includes("sword") || name.includes("justice")) {
      // Upward sword
      g.lineStyle(2, C.goldDk);
      g.lineBetween(cx, cy + 26, cx, cy - 22);
      // Guard
      g.lineBetween(cx - 12, cy + 6, cx + 12, cy + 6);
      // Pommel
      g.fillStyle(C.gold);
      g.fillCircle(cx, cy + 26, 5);

    } else {
      // Default: astral symbol (triquetra-inspired)
      this.drawAstralSymbol(g, cx, cy, 22, C.goldDk);
      g.fillStyle(C.gold, 0.6);
      g.fillCircle(cx, cy, 4);
    }
  }

  // ── Card update / flip ─────────────────────────────────────────────────────

  private updateCard(index: number, card: CardData): void {
    const c = this.cardContainers[index];
    if (!c) return;
    const alreadyFlipped = c.getData("flipped") as boolean;
    if (card.flipped && !alreadyFlipped) this.flipCard(c, card);
  }

  private flipCard(c: Phaser.GameObjects.Container, card: CardData): void {
    const back  = c.getData("back")    as Phaser.GameObjects.Graphics;
    const face  = c.getData("face")    as Phaser.GameObjects.Graphics;
    const sym   = c.getData("symbolG") as Phaser.GameObjects.Graphics;
    const name  = c.getData("name")    as Phaser.GameObjects.Text;
    const kw    = c.getData("kw")      as Phaser.GameObjects.Text;

    c.setData("flipped", true);

    this.tweens.add({
      targets: c,
      scaleX: 0,
      duration: 140,
      ease: "Linear",
      onComplete: () => {
        back.setAlpha(0);
        face.setAlpha(1);

        // Draw the archetype symbol
        this.drawCardSymbol(sym, card.name ?? card.arcana ?? "", 0, -34);
        sym.setAlpha(1);

        // Labels
        name.setText(card.name ?? "").setAlpha(1);
        kw.setText(card.keywords?.slice(0, 2).join(" · ") ?? "").setAlpha(1);

        this.tweens.add({ targets: c, scaleX: 1, duration: 180, ease: "Back.easeOut" });
      },
    });
  }

  // ── Controls ───────────────────────────────────────────────────────────────

  private buildControls(W: number, H: number): void {
    // Intent buttons
    TarotScene.INTENTS.forEach(({ key, label }, i) => {
      const x = W / 2 + (i - 1) * 118;
      const y = H * 0.8;
      const btn = this.add.container(x, y);

      const bg = this.add.graphics();
      bg.fillStyle(0xfff8ee);
      bg.fillRoundedRect(-50, -20, 100, 40, 8);
      bg.lineStyle(2, C.gold);
      bg.strokeRoundedRect(-50, -20, 100, 40, 8);
      bg.setInteractive(new Phaser.Geom.Rectangle(-50, -20, 100, 40), Phaser.Geom.Rectangle.Contains);
      bg.on("pointerdown", () => this.dispatch("setIntent", key));
      bg.on("pointerover", () => bg.setAlpha(0.8));
      bg.on("pointerout",  () => bg.setAlpha(1.0));

      const lbl = this.add.text(0, 0, label, {
        fontSize: "12px", color: "#8b6914",
      }).setOrigin(0.5);

      btn.add([bg, lbl]);
      this.intentBtns.push(btn);
    });

    // Draw button
    this.drawBtn = this.add.container(W / 2, H * 0.88);
    const drawBg = this.add.graphics();
    drawBg.fillStyle(C.gold);
    drawBg.fillRoundedRect(-88, -26, 176, 52, 14);
    drawBg.fillStyle(0xffffff, 0.1);
    drawBg.fillRoundedRect(-88, -26, 176, 22, { tl: 14, tr: 14, bl: 0, br: 0 });
    drawBg.lineStyle(2, C.goldLt);
    drawBg.strokeRoundedRect(-88, -26, 176, 52, 14);
    drawBg.setInteractive(new Phaser.Geom.Rectangle(-88, -26, 176, 52), Phaser.Geom.Rectangle.Contains);
    drawBg.on("pointerdown", () => this.dispatch("draw"));
    drawBg.on("pointerover", () => this.tweens.add({ targets: this.drawBtn, scale: 1.04, duration: 80 }));
    drawBg.on("pointerout",  () => this.tweens.add({ targets: this.drawBtn, scale: 1.0, duration: 80 }));
    const drawLbl = this.add.text(0, 0, "DRAW CARDS", {
      fontSize: "17px", fontStyle: "bold", color: "#35240f", letterSpacing: 2,
    }).setOrigin(0.5);
    this.drawBtn.add([drawBg, drawLbl]);

    // Reset button
    this.resetBtn = this.add.container(W / 2, H * 0.88);
    const resetBg = this.add.graphics();
    resetBg.fillStyle(0x374151);
    resetBg.fillRoundedRect(-80, -24, 160, 48, 12);
    resetBg.lineStyle(2, 0x6b7280);
    resetBg.strokeRoundedRect(-80, -24, 160, 48, 12);
    resetBg.setInteractive(new Phaser.Geom.Rectangle(-80, -24, 160, 48), Phaser.Geom.Rectangle.Contains);
    resetBg.on("pointerdown", () => {
      this.dispatch("reset");
      this.cardContainers.forEach((cc) => cc.destroy());
      this.cardContainers = [];
    });
    const resetLbl = this.add.text(0, 0, "NEW READING", {
      fontSize: "15px", color: "#d1d5db",
    }).setOrigin(0.5);
    this.resetBtn.add([resetBg, resetLbl]);
    this.resetBtn.setVisible(false);
  }

  // ── Status labels ──────────────────────────────────────────────────────────

  private buildStatusLabels(W: number, H: number): void {
    this.titleLabel = this.add.text(W / 2, H * 0.13, "Choose your intention", {
      fontSize: "15px", color: "#75685a",
    }).setOrigin(0.5);

    this.statusLabel = this.add.text(W / 2, H * 0.96, "", {
      fontSize: "12px", color: "#b8860b",
    }).setOrigin(0.5);
  }
}
