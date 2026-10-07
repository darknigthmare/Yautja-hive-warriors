/* Lore Codex & Franchise Encyclopedia - 1:1 Canon AvP Lore Terminal */

export const LORE_ENTRIES = {
  ranks: [
    {
      title: 'UNBLOODED (NON-INITIÉ)',
      desc: 'Jeunes Yautja ayant terminé leur entraînement de base sur Yautja Prime mais n\'ayant pas encore participé à une chasse rituelle contre les Xenomorphes (Hard Meat).'
    },
    {
      title: 'YOUNG BLOOD (JEUNE SANG)',
      desc: 'Chasseurs envoyés sur des terrains d\'épreuve (ex. Pyramide Antarctique d\'AVP 2004). Pour devenir Blooded, ils doivent tuer un Xenomorphe et graver son symbole avec le sang acide sur leur front ou bio-masque.'
    },
    {
      title: 'BLOODED (INITIÉ & CONSACRÉ)',
      desc: 'Guerriers confirmés ayant accompli le rituel de la marque acide. Ils ont le droit d\'arborer des armes cérémonielles et d\'utiliser le Canon Plasma en mission solitaire.'
    },
    {
      title: 'ELITE (CHASSEUR D\'ÉLITE)',
      desc: 'Vétérans redoutables capables d\'affronter des ruches entières sans soutien (ex. Wolf Predator dans AVP Requiem). Maîtrisent les armes complexes comme le fouet en vertèbres et le double canon plasma.'
    },
    {
      title: 'CLAN LEADER & ELDER (ANCIEN DU CLAN)',
      desc: 'Dirigeants sages et centenaires régnant sur les clans (ex. Greyback dans Predator 2). Ils surveillent les rituels et récompensent les humains valeureux avec des artefacts historiques (pistolet à silex de 1715).'
    },
    {
      title: 'BAD BLOOD (PARIA SANS HONNEUR)',
      desc: 'Yautja renégats ayant violé le code d\'honneur (massacre de proies sans défense, refus de l\'auto-destruction). Traqués sans merci par les Enforcers du Clan.'
    }
  ],
  code: [
    {
      title: 'LA PROIE VALEUREUSE',
      desc: 'Ne chasser que les créatures capables de se défendre. Tuer des enfants, des infirmes ou des proies enceintes est un crime impardonnable puni de mort.'
    },
    {
      title: 'LE RESPECT DES VAINQUEURS',
      desc: 'Tout étranger (humain ou autre) triomphant d\'un Yautja ou d\'une Reine Xenomorphe au combat singulier doit être épargné et honoré d\'un trophée digne de son exploit.'
    },
    {
      title: 'L\'AUTO-DESTRUCTION RITUELLE',
      desc: 'En cas de défaite imminente ou de capture, le Yautja doit activer l\'ordinateur de poignet [Touche N] afin d\'anéantir sa technologie et de mourir dans une explosion atomique purificatrice.'
    }
  ],
  xenomorphs: [
    {
      title: 'OVIMORPHE (SAC D\'ŒUF)',
      desc: 'Structure semi-organique créée par la Reine ou le bio-matriçage. Réagit à la chaleur corporelle et s\'ouvre en 4 pétales pour propulser un Facehugger.'
    },
    {
      title: 'FACEHUGGER (AGRIPPATHEUR)',
      desc: 'Parasite à 8 pattes et longue queue. Enserre la gorge pour administrer le Chestburster par voie orale tout en oxygénant l\'hôte inconscient.'
    },
    {
      title: 'CHESTBURSTER (PERCE-THORAX)',
      desc: 'Forme larvaire serpentiforme à mâchoires tranchantes s\'extirpant violemment de la cage thoracique de l\'hôte avant d\'entamer une mue ultra-rapide.'
    },
    {
      title: 'WARRIOR & DRONE (GUERRIER DE RUCHE)',
      desc: 'L\'ossature de la horde. Carapace chitineuse sombre, crâne strié ou lisse, sang d\'acide moléculaire hautement corrosif et seconde mâchoire extensible.'
    },
    {
      title: 'PREDALIEN (HYBRIDE YAUTJA-XENO)',
      desc: 'Créature abominable née de l\'implantation d\'un Facehugger sur un Yautja. Hérite des mandibules, des dreadlocks sensorielles et de la force titanesque du prédateur.'
    },
    {
      title: 'REINE XENOMORPHE & MATRIARCHE',
      desc: 'Souveraine de la ruche mesurant plus de 6 mètres. Crête crânienne cuirassée, bras auxiliaires thoraciques et ponte d\'œufs via un ovipositeur géant.'
    }
  ],
  engineers: [
    {
      title: 'LES INGÉNIEURS (PILOTES / SPACE JOCKEYS)',
      desc: 'Espèce humanoïde antédiluvienne (LV-223 / LV-426 / Prometheus). Créateurs du Pathogène Noir (Chemical A0-3959X.31_15) à l\'origine des mutations primaires Xenomorphes. Leurs crânes imposants sont les plus prestigieux trophées de la citadelle Yautja.'
    }
  ]
};

export class LoreCodexManager {
  constructor() {
    this.modal = document.getElementById('codex-modal');
    this.contentBox = document.getElementById('codex-content-container');
    this.activeTab = 'ranks';
    this.setupListeners();
  }

  setupListeners() {
    const btnOpen = document.getElementById('btn-open-codex');
    if (btnOpen) {
      btnOpen.addEventListener('click', () => this.open());
    }

    const btnClose = document.getElementById('btn-close-codex');
    if (btnClose) {
      btnClose.addEventListener('click', () => this.close());
    }

    document.querySelectorAll('.codex-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.codex-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeTab = btn.dataset.tab;
        this.renderTabContent();
      });
    });
  }

  open() {
    this.renderTabContent();
    if (this.modal) this.modal.classList.remove('hidden');
  }

  close() {
    if (this.modal) this.modal.classList.add('hidden');
  }

  renderTabContent() {
    if (!this.contentBox) return;
    this.contentBox.innerHTML = '';

    const list = LORE_ENTRIES[this.activeTab] || [];
    list.forEach(item => {
      const card = document.createElement('div');
      card.className = 'codex-entry-card';

      const title = document.createElement('h3');
      title.innerText = item.title;
      card.appendChild(title);

      const desc = document.createElement('p');
      desc.innerText = item.desc;
      card.appendChild(desc);

      this.contentBox.appendChild(card);
    });
  }
}
