# Commande musicale : créer les pistes avec Google Flow Music

> **Mise à jour du 16 novembre 2026.** L'auteur souhaite rester proche des bandes originales des films. Les thèmes eux-mêmes ne peuvent pas être reproduits : ce sont des œuvres protégées.
>
> La partition procédurale reprend donc l'esprit des films sans en copier aucune mélodie, aucun rythme ni aucune harmonie : caisse claire militaire, ostinatos de cuivres graves, tambours tribaux, chœur sans paroles, frappes métalliques et cliquetis du chasseur.
>
> Chaque monde a sa propre transposition et ses propres accents. Les prompts ci-dessous suivent la même règle : ils décrivent un style et ne citent aucune œuvre.

Ce document accompagne la spécification 003 (présentation cinématique). Le jeu joue déjà une partition procédurale originale pour chaque moment. Vos pistes la remplacent repère par repère, sans toucher au code : il suffit de déposer le fichier et de le déclarer dans le manifeste.

## 1. Où déposer les fichiers

| Type | Dossier | Manifeste |
| --- | --- | --- |
| Musique | `public/audio/music/` | `public/audio/music/manifest.json` |
| Ambiances | `public/audio/ambient/` | `public/audio/ambient/manifest.json` |
| Images de fond du menu | `public/menu/` | `public/menu/manifest.json` |

- **Noms de fichiers** : lettres, chiffres, `-` et `_` seulement, avec une extension `ogg`, `mp3`, `m4a`, `wav` ou `webm`. Les images acceptent `jpg`, `png`, `webp` ou `avif`.
- **Format conseillé** : OGG Vorbis 48 kHz stéréo, qualité 6 (environ 190 kb/s). Visez un niveau intégré de -16 LUFS et une crête à -1 dBTP pour que toutes les pistes s'enchaînent sans saut de volume.
- **Repère absent du manifeste** : il garde sa version procédurale.
- **Fichier introuvable ou illisible** : la version procédurale continue, sans erreur.

### Exemple de manifeste musical

```json
{
  "version": 1,
  "tracks": {
    "menu":    { "file": "menu-theme.ogg", "loopStart": 8.0, "loopEnd": 104.0 },
    "explore": { "layers": { "calm": "explore-calm.ogg", "tension": "explore-tension.ogg", "combat": "explore-combat.ogg" } },
    "victory": { "file": "victory.ogg" }
  }
}
```

- **Fichier unique** (`file`) : il joue à plein volume, en boucle si le repère boucle. Les champs `loopStart` et `loopEnd` (en secondes) bouclent sans répéter l'introduction.
- **Couches** (`layers`) : livrez les trois stems `calm`, `tension` et `combat`.
  - Ils sont lancés ensemble et mixés en direct selon le danger.
  - Ils doivent avoir exactement la même durée, le même tempo et la même tonalité.
  - Exportez-les depuis le même projet en solo de pistes.

## 2. Les couches et le danger

| Couche | Rôle | Quand elle monte |
| --- | --- | --- |
| `calm` | Nappe, thème, harmonie | Toujours présente ; baisse un peu au plus fort du combat |
| `tension` | Pulsation, cliquetis, arpèges | Dès qu'un ennemi approche |
| `combat` | Percussions, basse ostinato | Au-delà d'environ 4 ennemis proches, et pleine face à un boss |

Le jeu change aussi de repère selon la situation :
- `explore` devient `combat` après 2,5 s face à au moins 6 ennemis ;
- `combat` revient à `explore` après 9 s de calme ;
- `boss` joue tant qu'un boss est en vie.

## 3. Les repères à composer

Les tempos et tonalités sont ceux de la version procédurale. Gardez-les si vous livrez des couches. Pour un fichier unique, ils restent indicatifs.

Les prompts sont en anglais, la langue que ces générateurs suivent le mieux. Ils décrivent une ambiance originale et ne citent aucune bande originale ni aucun compositeur existant. N'en ajoutez pas : le jeu reste un projet de fan sans emprunt sonore.

| Repère | Moment | Durée | Tempo · tonalité | Boucle |
| --- | --- | --- | --- | --- |
| `title` | Écran titre | 1:30 | 64 BPM · ré phrygien | oui |
| `menu` | Menu principal | 2:00 | 72 BPM · mi mineur | oui |
| `loading` | Écran de chargement | 1:00 | 80 BPM · mi phrygien | oui |
| `briefing` | Intel avant mission | 1:30 | 76 BPM · do# hijaz | oui |
| `hub` | *La Lame Patiente* (Ascension) | 2:00 | 60 BPM · do mineur | oui |
| `explore` | Mission, calme ou approche | 3:00 | 84 BPM · ré phrygien | oui, en 3 couches |
| `combat` | Mêlée soutenue | 2:00 | 116 BPM · ré phrygien | oui, en 3 couches |
| `boss` | Boss en vie | 2:30 | 124 BPM · do hijaz | oui, en 3 couches |
| `victory` | Victoire | 0:20 à 0:30 | 92 BPM · sol mineur | non, finit franchement |
| `defeat` | Défaite | 0:20 à 0:30 | 54 BPM · si phrygien | non |

### Prompts prêts à coller

**title**
> Dark cinematic title theme for an alien hunting game. Slow 64 BPM, D phrygian. Deep sustained brass swells, low taiko hits far in the distance, sparse metallic clicks like a predator's throat clicking, wind and breath textures. Ominous, ritual, patient. No vocals, no melody hooks from existing films. Loopable, 90 seconds.

**menu**
> Tense ambient menu music, 72 BPM, E minor. Warm analog pad, slow arpeggiated synth pluck, soft heartbeat pulse, distant tribal percussion, subtle clicking rhythm. Mysterious and confident, like a hunter preparing gear in the dark. Seamless loop, 2 minutes, no vocals.

**loading**
> Short suspense loop for a loading screen, 80 BPM, E phrygian. Low drone, ticking metallic percussion, rising filtered noise, heartbeat. Builds anticipation without resolving. Seamless 60-second loop.

**briefing**
> Military-tribal briefing underscore, 76 BPM, C sharp hijaz scale. Radio static texture, low strings ostinato, soft frame drum, clicking motif, a lone horn call every 16 bars. Focused and grave, leaves room for spoken lines. Loop 90 seconds.

**hub**
> Calm interior theme aboard an ancient alien hunting ship, 60 BPM, C minor. Deep hull hum, slow choir-like pad without words, sparse metallic chimes, distant engine throb. Contemplative, honour and tradition. Loop 2 minutes.

**explore** (3 couches de durée identique)
> Exploration underscore for a jungle and space-station hunt, 84 BPM, D phrygian, 3 minutes, seamless loop. Deliver three aligned stems from the same arrangement:
> (1) CALM: low pads, wind, sparse horn.
> (2) TENSION: heartbeat pulse, clicking rhythm, muted arpeggio.
> (3) COMBAT: taiko and low drums, driving bass ostinato.
> Each stem must play alone and together.

**combat** (3 couches)
> High-energy combat music, 116 BPM, D phrygian, 2-minute seamless loop. Tribal war drums, distorted low brass stabs, fast bass ostinato, metallic clicks, synth risers every 8 bars. Brutal and relentless. Deliver aligned stems: CALM (pads and brass), TENSION (arps, clicks), COMBAT (drums, bass).

**boss** (3 couches)
> Epic boss battle theme, 124 BPM, C hijaz scale, 2.5-minute loop. Massive taiko ensemble, choir-like synth without words, aggressive low brass, screeching string clusters, alien textures. Deliver three aligned stems: CALM, TENSION, COMBAT.

**victory**
> Triumphant short stinger after a hunt, 92 BPM, G minor resolving to a strong final chord. Big drums, rising brass, a final ritual horn, ringing tail. 25 seconds, no loop.

**defeat**
> Somber defeat stinger, 54 BPM, B phrygian. Low drone, a slow falling horn line, distant thunder, fading heartbeat. 25 seconds, no loop.

## 4. Les ambiances par biome

Une ambiance est une nappe sans musique : vent, pluie, faune, machines. Elle se déclare ainsi :

```json
{ "version": 1, "beds": { "jungle": "jungle-night.ogg", "station": "station-hum.ogg" } }
```

| Biome | Cartes | Contenu à viser | Prompt |
| --- | --- | --- | --- |
| `jungle` | Val Verde, planète-réserve | Insectes, oiseaux lointains, feuillage, humidité | *Dense tropical jungle at dusk, insects, distant birds, leaves rustling, humid air, no music, seamless 2-minute loop.* |
| `rain` | Gunnison | Pluie sur forêt, tonnerre lointain | *Heavy rain on a pine forest, distant thunder rolls, dripping branches, no music, loop.* |
| `snow` | Pyramide antarctique | Blizzard, glace qui craque | *Antarctic blizzard, howling wind gusts, ice creaking, no music, loop.* |
| `city` | Toits de Los Angeles | Pluie urbaine, rumeur, sirènes lointaines | *Night city rooftop in heavy rain, distant traffic hum and sirens, neon buzz, no music, loop.* |
| `station` | Romulus, Charon | Ventilation, ronronnement, métal qui travaille | *Derelict space station interior, air vents, low machine hum, metal creaks, no music, loop.* |
| `hive` | Planète-ruche | Gouttes, souffle organique, sifflements | *Organic alien hive cavern, dripping resin, wet breathing textures, faint hisses, no music, loop.* |
| `plains` | Stargazer, territoire comanche | Vent dans les herbes, oiseaux | *Open plains at morning, wind through tall grass, birds, no music, loop.* |
| `arena` | Arène | Grande salle, foule absente, échos | *Vast ancient arena hall, low resonance, distant echoes, no music, loop.* |
| `ship` | *La Lame Patiente* | Coque, moteurs lointains | *Alien hunting ship interior, deep hull hum, distant engines, soft hydraulic hisses, no music, loop.* |

## 5. Images du menu

```json
{ "version": 1, "images": [ { "file": "key-art-jungle.webp", "credit": "Darknigthmare" } ] }
```

- **Taille** : 1920 × 1080 au moins, en WebP.
- **Composition** : gardez le tiers gauche sombre et peu chargé, car le menu s'y affiche.
- **Rotation** : dès qu'une image est listée, le style « images » entre dans l'alternance des fonds. Les images défilent en fondu lent avec un léger zoom.

## 6. Vérifier

1. Déposez le fichier et complétez le manifeste.
2. Lancez `npm run dev`, ouvrez le menu et laissez jouer, ou lancez une mission.
3. Ouvrez la console du navigateur : aucune erreur ne doit apparaître. Un fichier absent fait simplement revenir la version procédurale.

Le volume de la musique se règle à part dans *Options > Musique*. Le volume général règle tout le reste.
