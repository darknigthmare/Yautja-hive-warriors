/* 5-Chapter Story Campaign Manager */

export const CAMPAIGN_CHAPTERS = [
  {
    chapter: 1,
    title: 'CHAPITRE I: INFILTRATION EN COLONIE',
    objective: 'Éliminez 30 Xenomorphes en restant sous camouflage optique',
    targetKos: 30,
    levelId: 'weyland_colony'
  },
  {
    chapter: 2,
    title: 'CHAPITRE II: LA JUNGLE MORTELLE',
    objective: 'Traversez la jungle de Val Verde et terrassez le Predalien Brute',
    targetKos: 50,
    levelId: 'val_verde_jungle'
  },
  {
    chapter: 3,
    title: 'CHAPITRE III: LES SECRETS DE LA PYRAMIDE',
    objective: 'Infiltrez les tréfonds de la pyramide d\'Antarctique',
    targetKos: 80,
    levelId: 'antactic_temple'
  },
  {
    chapter: 4,
    title: 'CHAPITRE IV: L\'ASSAUT DU CŒUR DE LA RUCHE',
    objective: 'Survivez à la marée infinie et détruisez les nids d\'œufs',
    targetKos: 120,
    levelId: 'hive_lair'
  },
  {
    chapter: 5,
    title: 'CHAPITRE V: LE DUEL SACRÉ CONTRE LA REINE',
    objective: 'Exécutez la Reine Impériale pour sceller votre place au Clan',
    targetKos: 200,
    levelId: 'endless_horde'
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

  getCurrentChapter() {
    return CAMPAIGN_CHAPTERS[this.currentChapterIndex];
  }

  checkChapterProgress(kos) {
    if (!this.isActive) return null;
    const current = this.getCurrentChapter();

    if (kos >= current.targetKos) {
      if (this.currentChapterIndex < CAMPAIGN_CHAPTERS.length - 1) {
        this.currentChapterIndex++;
        return { completed: true, nextChapter: this.getCurrentChapter() };
      } else {
        return { victory: true };
      }
    }
    return null;
  }
}
