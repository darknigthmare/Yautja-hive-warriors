/* 5-Chapter Story Campaign Manager */

export const CAMPAIGN_CHAPTERS = [
  {
    chapter: 1,
    title: 'CHAPITRE I: INFILTRATION EN COLONIE',
    objective: 'Traversez la forêt de Gunnison et terrassez la Reine Prédalienne.',
    targetKos: 30,
    levelId: 'gunnison_forest'
  },
  {
    chapter: 2,
    title: 'CHAPITRE II: LA JUNGLE MORTELLE',
    objective: 'Repoussez les vagues de Val Verde et terrassez le Prétorien.',
    targetKos: 50,
    levelId: 'val_verde_jungle'
  },
  {
    chapter: 3,
    title: 'CHAPITRE III: LES SECRETS DE LA PYRAMIDE',
    objective: 'Infiltrez la pyramide d\'Antarctique et éliminez sa Reine.',
    targetKos: 80,
    levelId: 'antarctic_pyramid'
  },
  {
    chapter: 4,
    title: 'CHAPITRE IV: L\'ASSAUT DU CŒUR DE LA RUCHE',
    objective: 'Survivez aux assauts de Xenomorph Prime et abattez l\'Impératrice.',
    targetKos: 120,
    levelId: 'xenomorph_prime'
  },
  {
    chapter: 5,
    title: 'CHAPITRE V: LE DUEL SACRÉ CONTRE LA REINE',
    objective: 'Sécurisez la station Renaissance et affrontez The Offspring.',
    targetKos: 200,
    levelId: 'romulus_station'
  }
];

export class StoryCampaignManager {
  constructor(uiManager) {
    this.uiManager = uiManager;
    this.currentChapterIndex = 0;
    this.isActive = false;
  }

  startCampaign() {
    this.currentChapterIndex = 0;
    this.isActive = true;
    return CAMPAIGN_CHAPTERS[0];
  }

  reset() {
    this.currentChapterIndex = 0;
    this.isActive = false;
  }

  getCurrentChapter() {
    return CAMPAIGN_CHAPTERS[this.currentChapterIndex];
  }

  checkChapterProgress(kos) {
    if (!this.isActive) return null;
    const current = this.getCurrentChapter();

    if (Number.isFinite(kos) && kos >= current.targetKos) return this.completeChapter();
    return null;
  }

  // The game calls this only after winning the current chapter's boss encounter.
  completeChapter() {
    if (!this.isActive) return null;
    if (this.currentChapterIndex < CAMPAIGN_CHAPTERS.length - 1) {
      this.currentChapterIndex++;
      return { completed: true, nextChapter: this.getCurrentChapter() };
    }
    this.isActive = false;
    return { victory: true };
  }
}
