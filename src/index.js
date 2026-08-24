const {
  Client,
  GatewayIntentBits,
  Events,
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const fs = require("fs");
const path = require("path");

// ======================================================
// CONFIGURATION
// ======================================================

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const UNBELIEVABOAT_TOKEN = process.env.UNBELIEVABOAT_TOKEN;

if (!TOKEN) {
  console.error("❌ DISCORD_TOKEN manquant.");
  process.exit(1);
}

if (!GUILD_ID) {
  console.error("❌ GUILD_ID manquant.");
  process.exit(1);
}

if (!UNBELIEVABOAT_TOKEN) {
  console.error("❌ UNBELIEVABOAT_TOKEN manquant.");
  process.exit(1);
}

// ======================================================
// FICHIERS
// ======================================================

const DATA_DIR = process.env.DATA_DIR || ".";
const DATA_FILE = path.join(DATA_DIR, "plaintes.json");

if (!fs.existsSync(DATA_DIR) && DATA_DIR !== ".") {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, "[]", "utf8");
      return [];
    }

    const content = fs.readFileSync(DATA_FILE, "utf8");

    if (!content.trim()) {
      return [];
    }

    return JSON.parse(content);
  } catch (error) {
    console.error("❌ Erreur chargement plaintes :", error);
    return [];
  }
}

function saveData(data) {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(data, null, 2),
      "utf8"
    );
  } catch (error) {
    console.error("❌ Erreur sauvegarde :", error);
  }
}

let plaintes = loadData();

// ======================================================
// CLIENT
// ======================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// ======================================================
// RÔLES
// ======================================================

const ROLE_COUR = "Cour";
const ROLE_JUGE = "Juge";
const ROLE_AVOCAT = "Avocat";
const ROLE_REPRESENTANT = "Représentant de la défense";
const ROLE_QOD = "Quitte ou double";

const PRIX_ROLES = {
  [ROLE_AVOCAT]: 500000,
  [ROLE_REPRESENTANT]: 750000,
  [ROLE_QOD]: 500000,
  [ROLE_JUGE]: 5000000
};

// ======================================================
// RÉCOMPENSES
// ======================================================

const RECOMPENSE_PLAIGNANT = 10000;
const RECOMPENSE_REPRESENTANT = 20000;
const RECOMPENSE_ACCUSE_ACQUITTE = 10000;
const RECOMPENSE_AVOCAT_ACQUITTE = 10000;

const QOD_GAIN = 20000;
const QOD_PERTE = -10000;

// ======================================================
// OUTILS
// ======================================================

function nextId() {
  if (plaintes.length === 0) {
    return 1;
  }

  return Math.max(...plaintes.map(p => p.id)) + 1;
}

function getPlainte(id) {
  return plaintes.find(p => p.id === id);
}

function getRole(guild, name) {
  return guild.roles.cache.find(
    role => role.name === name
  );
}

function estJuge(member) {
  return member.roles.cache.some(
    role => role.name === ROLE_JUGE
  );
}

function estAvocat(member) {
  return member.roles.cache.some(
    role => role.name === ROLE_AVOCAT
  );
}

function estRepresentant(member) {
  return member.roles.cache.some(
    role => role.name === ROLE_REPRESENTANT
  );
}

function estQOD(member) {
  return member.roles.cache.some(
    role => role.name === ROLE_QOD
  );
}

// ======================================================
// UNBELIEVABOAT
// ======================================================

async function modifierArgent(userId, montant, raison) {
  try {
    const response = await fetch(
      `https://unbelievaboat.com/api/v1/guilds/${GUILD_ID}/users/${userId}`,
      {
        method: "PATCH",
        headers: {
          "Authorization": UNBELIEVABOAT_TOKEN,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          cash: montant,
          reason: raison
        })
      }
    );

    if (!response.ok) {
      const texte = await response.text();

      console.error(
        `❌ Erreur UnbelievaBoat (${response.status}) :`,
        texte
      );

      return false;
    }

    return true;

  } catch (error) {
    console.error(
      "❌ Erreur connexion UnbelievaBoat :",
      error
    );

    return false;
  }
}

// ======================================================
// RÉCUPÉRER LE CASH
// ======================================================

async function getCash(userId) {
  try {
    const response = await fetch(
      `https://unbelievaboat.com/api/v1/guilds/${GUILD_ID}/users/${userId}`,
      {
        headers: {
          "Authorization": UNBELIEVABOAT_TOKEN
        }
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    return Number(data.cash || 0);

  } catch (error) {
    console.error(
      "❌ Erreur récupération argent :",
      error
    );

    return null;
  }
}

// ======================================================
// RÉCOMPENSES DU PROCÈS
// ======================================================

async function donnerRecompenses(plainte, condamne) {

  if (plainte.recompenses_distribuees) {
    console.log(
      `⚠️ Récompenses déjà distribuées pour #${plainte.id}`
    );

    return [];
  }

  const guild = client.guilds.cache.get(GUILD_ID);

  if (!guild) {
    return [];
  }

  const recompenses = [];

  const plaignant =
    await guild.members.fetch(plainte.plaignant).catch(() => null);

  const accuse =
    await guild.members.fetch(plainte.accuse).catch(() => null);

  const avocat = plainte.avocat
    ? await guild.members.fetch(plainte.avocat).catch(() => null)
    : null;

  const representant = plainte.representant
    ? await guild.members
        .fetch(plainte.representant)
        .catch(() => null)
    : null;

  // ====================================================
  // CONDAMNATION
  // ====================================================

  if (condamne) {

    // PLAIGNANT
    if (plaignant) {

      if (estQOD(plaignant)) {

        const ok = await modifierArgent(
          plainte.plaignant,
          QOD_GAIN,
          `Affaire #${plainte.id} - Quitte ou double gagné`
        );

        if (ok) {
          recompenses.push(
            `🎲 <@${plainte.plaignant}> — **+20 000** (Quitte ou double)`
          );
        }

      } else {

        const ok = await modifierArgent(
          plainte.plaignant,
          RECOMPENSE_PLAIGNANT,
          `Affaire #${plainte.id} - Procès gagné`
        );

        if (ok) {
          recompenses.push(
            `👤 <@${plainte.plaignant}> — **+10 000**`
          );
        }
      }
    }

    // REPRÉSENTANT DE LA DÉFENSE
    if (representant) {

      const ok = await modifierArgent(
        plainte.representant,
        RECOMPENSE_REPRESENTANT,
        `Affaire #${plainte.id} - Représentant de la défense`
      );

      if (ok) {
        recompenses.push(
          `🛡️ <@${plainte.representant}> — **+20 000**`
        );
      }
    }

    // ACCUSÉ QUITTE OU DOUBLE = PERD
    if (accuse && estQOD(accuse)) {

      const ok = await modifierArgent(
        plainte.accuse,
        QOD_PERTE,
        `Affaire #${plainte.id} - Quitte ou double perdu`
      );

      if (ok) {
        recompenses.push(
          `🎲 <@${plainte.accuse}> — **-10 000** (Quitte ou double)`
        );
      }
    }

  } else {

    // ==================================================
    // ACQUITTEMENT
    // ==================================================

    // ACCUSÉ
    if (accuse) {

      if (estQOD(accuse)) {

        const ok = await modifierArgent(
          plainte.accuse,
          QOD_GAIN,
          `Affaire #${plainte.id} - Quitte ou double gagné`
        );

        if (ok) {
          recompenses.push(
            `🎲 <@${plainte.accuse}> — **+20 000** (Quitte ou double)`
          );
        }

      } else {

        const ok = await modifierArgent(
          plainte.accuse,
          RECOMPENSE_ACCUSE_ACQUITTE,
          `Affaire #${plainte.id} - Accusé acquitté`
        );

        if (ok) {
          recompenses.push(
            `⚠️ <@${plainte.accuse}> — **+10 000**`
          );
        }
      }
    }

    // AVOCAT
    if (avocat) {

      const ok = await modifierArgent(
        plainte.avocat,
        RECOMPENSE_AVOCAT_ACQUITTE,
        `Affaire #${plainte.id} - Avocat`
      );

      if (ok) {
        recompenses.push(
          `🧑‍💼 <@${plainte.avocat}> — **+10 000**`
        );
      }
    }

    // PLAIGNANT QUITTE OU DOUBLE = PERD
    if (plaignant && estQOD(plaignant)) {

      const ok = await modifierArgent(
        plainte.plaignant,
        QOD_PERTE,
        `Affaire #${plainte.id} - Quitte ou double perdu`
      );

      if (ok) {
        recompenses.push(
          `🎲 <@${plainte.plaignant}> — **-10 000** (Quitte ou double)`
        );
      }
    }
  }

  plainte.recompenses_distribuees = true;

  saveData(plaintes);

  return recompenses;
}

// ======================================================
// CHOIX AUTOMATIQUE APRÈS 2 MINUTES
// ======================================================

async function choisirAutomatiquement(guild, plainte) {

  if (plainte.statut === "Fermée") {
    return;
  }

  // AVOCAT
  if (!plainte.avocat) {

    const role = getRole(guild, ROLE_AVOCAT);

    if (role) {

      const candidats = role.members.filter(
        member =>
          member.id !== plainte.accuse &&
          member.id !== plainte.plaignant
      );

      if (candidats.size > 0) {

        const tableau = [...candidats.values()];

        const choisi =
          tableau[Math.floor(Math.random() * tableau.length)];

        plainte.avocat = choisi.id;

        saveData(plaintes);

        const channel =
          guild.channels.cache.get(plainte.channel_id);

        if (channel) {
          await channel.send(
            `🧑‍💼 **AVOCAT CHOISI AUTOMATIQUEMENT**\n\n` +
            `L'accusé n'ayant pas choisi d'avocat dans les **2 minutes**, ` +
            `${choisi} a été désigné aléatoirement.`
          );
        }
      }
    }
  }

  // REPRÉSENTANT
  if (!plainte.representant) {

    const role =
      getRole(guild, ROLE_REPRESENTANT);

    if (role) {

      const candidats = role.members.filter(
        member =>
          member.id !== plainte.accuse &&
          member.id !== plainte.plaignant
      );

      if (candidats.size > 0) {

        const tableau = [...candidats.values()];

        const choisi =
          tableau[Math.floor(Math.random() * tableau.length)];

        plainte.representant = choisi.id;

        saveData(plaintes);

        const channel =
          guild.channels.cache.get(plainte.channel_id);

        if (channel) {
          await channel.send(
            `🛡️ **REPRÉSENTANT CHOISI AUTOMATIQUEMENT**\n\n` +
            `Le plaignant n'ayant pas choisi de représentant dans les **2 minutes**, ` +
            `${choisi} a été désigné aléatoirement.`
          );
        }
      }
    }
  }
}

// ======================================================
// CRÉATION DU DOSSIER
// ======================================================

async function creerDossier(guild, plainte) {

  const categorie = guild.channels.cache.find(
    channel =>
      channel.type === ChannelType.GuildCategory &&
      (
        channel.name === "⚖️ TRIBUNAL" ||
        channel.name === "📂 AFFAIRES"
      )
  );

  const jugeRole = getRole(guild, ROLE_JUGE);
  const courRole = getRole(guild, ROLE_COUR);
  const avocatRole = getRole(guild, ROLE_AVOCAT);
  const representantRole =
    getRole(guild, ROLE_REPRESENTANT);

  const permissions = [
    {
      id: guild.roles.everyone.id,
      deny: [
        PermissionFlagsBits.ViewChannel
      ]
    },

    {
      id: plainte.plaignant,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    },

    {
      id: plainte.accuse,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    }
  ];

  if (jugeRole) {
    permissions.push({
      id: jugeRole.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    });
  }

  if (courRole) {
    permissions.push({
      id: courRole.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    });
  }

  if (avocatRole) {
    permissions.push({
      id: avocatRole.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    });
  }

  if (representantRole) {
    permissions.push({
      id: representantRole.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    });
  }

  const channel = await guild.channels.create({
    name: `📁・affaire-${plainte.id}`,
    type: ChannelType.GuildText,
    parent: categorie ? categorie.id : null,
    permissionOverwrites: permissions
  });

  plainte.channel_id = channel.id;

  await channel.send(
    `⚖️ **DOSSIER JUDICIAIRE #${plainte.id}**\n\n` +
    `👤 **Plaignant :** <@${plainte.plaignant}>\n` +
    `⚠️ **Accusé :** <@${plainte.accuse}>\n` +
    `📌 **Motif :** ${plainte.motif}\n` +
    `📄 **Description :** ${plainte.description}\n\n` +
    `⏳ **Statut :** ${plainte.statut}\n\n` +
    `🧑‍💼 **Avocat :** Aucun\n` +
    `🛡️ **Représentant de la défense :** Aucun\n\n` +
    `⚠️ L'accusé choisit son avocat avec :\n` +
    `\`/avocat id:${plainte.id} avocat:@Nom\`\n\n` +
    `⚠️ Le plaignant choisit son représentant avec :\n` +
    `\`/representant id:${plainte.id} representant:@Nom\`\n\n` +
    `⏱️ Après **2 minutes**, le bot tentera de choisir automatiquement.`
  );

  return channel;
                                  }
// ======================================================
// BOUTONS DE LA BOUTIQUE
// ======================================================

function creerBoutonsRoles() {

  return new ActionRowBuilder().addComponents(

    new ButtonBuilder()
      .setCustomId("role_acheter_avocat")
      .setLabel("Avocat — 500 000")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("role_acheter_representant")
      .setLabel("Représentant — 750 000")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("role_acheter_qod")
      .setLabel("Quitte ou double — 500 000")
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId("role_acheter_juge")
      .setLabel("Juge — 5 000 000")
      .setStyle(ButtonStyle.Success)
  );
}

function creerBoutonsEquipement() {

  return new ActionRowBuilder().addComponents(

    new ButtonBuilder()
      .setCustomId("role_equiper_avocat")
      .setLabel("Équiper Avocat")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("role_equiper_representant")
      .setLabel("Équiper Représentant")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("role_equiper_qod")
      .setLabel("Équiper Quitte ou double")
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId("role_equiper_juge")
      .setLabel("Équiper Juge")
      .setStyle(ButtonStyle.Success)
  );
}

// ======================================================
// ACHETER UN RÔLE
// ======================================================

async function acheterRole(interaction, roleName) {

  const role = getRole(
    interaction.guild,
    roleName
  );

  if (!role) {
    return interaction.reply({
      content:
        `❌ Le rôle **${roleName}** n'existe pas.`,
      ephemeral: true
    });
  }

  const prix = PRIX_ROLES[roleName];

  if (!prix) {
    return interaction.reply({
      content:
        "❌ Ce rôle n'est pas achetable.",
      ephemeral: true
    });
  }

  if (interaction.member.roles.cache.has(role.id)) {
    return interaction.reply({
      content:
        `❌ Tu possèdes déjà le rôle **${roleName}**.`,
      ephemeral: true
    });
  }

  const cash = await getCash(interaction.user.id);

  if (cash === null) {
    return interaction.reply({
      content:
        "❌ Impossible de vérifier ton argent sur UnbelievaBoat.",
      ephemeral: true
    });
  }

  if (cash < prix) {
    return interaction.reply({
      content:
        `❌ Tu n'as pas assez d'argent.\n\n` +
        `💰 Ton cash : **${cash.toLocaleString("fr-FR")}**\n` +
        `💵 Prix : **${prix.toLocaleString("fr-FR")}**`,
      ephemeral: true
    });
  }

  const paiement = await modifierArgent(
    interaction.user.id,
    -prix,
    `Achat du rôle ${roleName}`
  );

  if (!paiement) {
    return interaction.reply({
      content:
        "❌ Le paiement n'a pas pu être effectué.",
      ephemeral: true
    });
  }

  try {

    await interaction.member.roles.add(role);

    return interaction.reply({
      content:
        `✅ **Achat effectué !**\n\n` +
        `🎫 Rôle : **${roleName}**\n` +
        `💰 Prix : **${prix.toLocaleString("fr-FR")}**\n\n` +
        `Tu peux maintenant l'équiper.`,
      ephemeral: true
    });

  } catch (error) {

    console.error(
      "❌ Impossible de donner le rôle :",
      error
    );

    // Remboursement si Discord refuse de donner le rôle
    await modifierArgent(
      interaction.user.id,
      prix,
      `Remboursement - impossible de donner ${roleName}`
    );

    return interaction.reply({
      content:
        "❌ Impossible de te donner le rôle. Ton argent a été remboursé.",
      ephemeral: true
    });
  }
}

// ======================================================
// ÉQUIPER UN RÔLE
// ======================================================

async function equiperRole(interaction, roleName) {

  const role = getRole(
    interaction.guild,
    roleName
  );

  if (!role) {
    return interaction.reply({
      content:
        `❌ Le rôle **${roleName}** n'existe pas.`,
      ephemeral: true
    });
  }

  if (!interaction.member.roles.cache.has(role.id)) {
    return interaction.reply({
      content:
        `❌ Tu ne possèdes pas le rôle **${roleName}**.`,
      ephemeral: true
    });
  }

  const rolesSpecials = [
    ROLE_AVOCAT,
    ROLE_REPRESENTANT,
    ROLE_QOD,
    ROLE_JUGE
  ];

  for (const nom of rolesSpecials) {

    if (nom === roleName) {
      continue;
    }

    const autreRole = getRole(
      interaction.guild,
      nom
    );

    if (
      autreRole &&
      interaction.member.roles.cache.has(autreRole.id)
    ) {
      await interaction.member.roles.remove(
        autreRole
      );
    }
  }

  await interaction.member.roles.add(role);

  // Le rôle Cour reste toujours présent
  const cour = getRole(
    interaction.guild,
    ROLE_COUR
  );

  if (
    cour &&
    !interaction.member.roles.cache.has(cour.id)
  ) {
    await interaction.member.roles.add(cour);
  }

  return interaction.reply({
    content:
      `✅ **${roleName}** est maintenant ton rôle équipé.\n\n` +
      `⚖️ Tu gardes également le rôle **Cour**.`,
    ephemeral: true
  });
}

// ======================================================
// DÉSÉQUIPER
// ======================================================

async function desequiperRole(interaction) {

  const roles = [
    ROLE_AVOCAT,
    ROLE_REPRESENTANT,
    ROLE_QOD,
    ROLE_JUGE
  ];

  let retire = false;

  for (const nom of roles) {

    const role = getRole(
      interaction.guild,
      nom
    );

    if (
      role &&
      interaction.member.roles.cache.has(role.id)
    ) {

      await interaction.member.roles.remove(
        role
      );

      retire = true;
    }
  }

  const cour = getRole(
    interaction.guild,
    ROLE_COUR
  );

  if (
    cour &&
    !interaction.member.roles.cache.has(cour.id)
  ) {
    await interaction.member.roles.add(cour);
  }

  if (!retire) {
    return interaction.reply({
      content:
        "ℹ️ Tu n'avais aucun rôle spécial équipé.",
      ephemeral: true
    });
  }

  return interaction.reply({
    content:
      "✅ Ton rôle spécial a été déséquipé.\n" +
      "⚖️ Tu conserves le rôle **Cour**.",
    ephemeral: true
  });
}

// ======================================================
// BOUTIQUE
// ======================================================

async function afficherRoles(interaction) {

  return interaction.reply({
    content:
      `⚖️ **BOUTIQUE DES RÔLES**\n\n` +

      `⚖️ **Cour** — Gratuit\n` +
      `Disponible dès ton arrivée.\n\n` +

      `🧑‍💼 **Avocat** — **500 000**\n` +
      `Défend l'accusé.\n\n` +

      `🛡️ **Représentant de la défense** — **750 000**\n` +
      `Représente le plaignant.\n\n` +

      `🎲 **Quitte ou double** — **500 000**\n` +
      `Gagne **20 000** si ton côté gagne.\n` +
      `Perds **10 000** si ton côté perd.\n\n` +

      `👨‍⚖️ **Juge** — **5 000 000**\n` +
      `Permet de gérer les procès.\n\n` +

      `💡 Achète un rôle puis équipe-le.\n` +
      `⚠️ Un seul rôle spécial peut être équipé à la fois.\n` +
      `💰 La boutique ne modifie pas **collect income**.`,

    components: [
      creerBoutonsRoles(),
      creerBoutonsEquipement(),

      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("role_desequiper")
          .setLabel("Déséquiper")
          .setStyle(ButtonStyle.Secondary)
      )
    ]
  });
}

// ======================================================
// PRÊT DU BOT
// ======================================================

client.once(Events.ClientReady, bot => {

  console.log(
    `⚖️ Tribunal en ligne : ${bot.user.tag}`
  );

  console.log(
    `📁 ${plaintes.length} plainte(s) chargée(s).`
  );

  const guild =
    bot.guilds.cache.get(GUILD_ID);

  if (!guild) {
    console.error(
      "❌ Le serveur GUILD_ID est introuvable."
    );

    return;
  }

  console.log(
    `🏛️ Serveur : ${guild.name}`
  );

  console.log(
    "Cour :",
    getRole(guild, ROLE_COUR) ? "✅" : "❌"
  );

  console.log(
    "Juge :",
    getRole(guild, ROLE_JUGE) ? "✅" : "❌"
  );

  console.log(
    "Avocat :",
    getRole(guild, ROLE_AVOCAT) ? "✅" : "❌"
  );

  console.log(
    "Représentant de la défense :",
    getRole(guild, ROLE_REPRESENTANT)
      ? "✅"
      : "❌"
  );

  console.log(
    "Quitte ou double :",
    getRole(guild, ROLE_QOD)
      ? "✅"
      : "❌"
  );
});

// ======================================================
// INTERACTIONS
// ======================================================

client.on(
  Events.InteractionCreate,
  async interaction => {

    try {

      // ==================================================
      // BOUTONS
      // ==================================================

      if (interaction.isButton()) {

        if (
          interaction.customId ===
          "role_acheter_avocat"
        ) {
          return acheterRole(
            interaction,
            ROLE_AVOCAT
          );
        }

        if (
          interaction.customId ===
          "role_acheter_representant"
        ) {
          return acheterRole(
            interaction,
            ROLE_REPRESENTANT
          );
        }

        if (
          interaction.customId ===
          "role_acheter_qod"
        ) {
          return acheterRole(
            interaction,
            ROLE_QOD
          );
        }

        if (
          interaction.customId ===
          "role_acheter_juge"
        ) {
          return acheterRole(
            interaction,
            ROLE_JUGE
          );
        }

        if (
          interaction.customId ===
          "role_equiper_avocat"
        ) {
          return equiperRole(
            interaction,
            ROLE_AVOCAT
          );
        }

        if (
          interaction.customId ===
          "role_equiper_representant"
        ) {
          return equiperRole(
            interaction,
            ROLE_REPRESENTANT
          );
        }

        if (
          interaction.customId ===
          "role_equiper_qod"
        ) {
          return equiperRole(
            interaction,
            ROLE_QOD
          );
        }

        if (
          interaction.customId ===
          "role_equiper_juge"
        ) {
          return equiperRole(
            interaction,
            ROLE_JUGE
          );
        }

        if (
          interaction.customId ===
          "role_desequiper"
        ) {
          return desequiperRole(
            interaction
          );
        }

        return;
      }

      // ==================================================
      // COMMANDES
      // ==================================================

      if (!interaction.isChatInputCommand()) {
        return;
      }

      // ==================================================
      // /ROLES
      // ==================================================

      if (
        interaction.commandName === "roles"
      ) {
        return afficherRoles(
          interaction
        );
      }

      // ==================================================
      // /PLAINTE
      // ==================================================

      if (
        interaction.commandName === "plainte"
      ) {

        const accuse =
          interaction.options.getUser("accuse");

        const motif =
          interaction.options.getString("motif");

        const description =
          interaction.options.getString("description");

        if (accuse.id === interaction.user.id) {
          return interaction.reply({
            content:
              "❌ Tu ne peux pas porter plainte contre toi-même.",
            ephemeral: true
          });
        }

        const plainte = {
          id: nextId(),

          plaignant:
            interaction.user.id,

          accuse:
            accuse.id,

          motif:
            motif,

          description:
            description,

          statut:
            "En attente",

          juge:
            null,

          avocat:
            null,

          representant:
            null,

          peine:
            null,

          raison:
            null,

          channel_id:
            null,

          created_at:
            new Date().toISOString(),

          verdict_at:
            null,

          recompenses_distribuees:
            false
        };

        plaintes.push(
          plainte
        );

        saveData(
          plaintes
        );

        let channel = null;

        try {

          channel =
            await creerDossier(
              interaction.guild,
              plainte
            );

          saveData(
            plaintes
          );

        } catch (error) {

          console.error(
            "❌ Erreur création dossier :",
            error
          );
        }

        // Lancement du délai de 2 minutes
        setTimeout(
          async () => {

            try {

              await choisirAutomatiquement(
                interaction.guild,
                plainte
              );

            } catch (error) {

              console.error(
                "❌ Erreur sélection automatique :",
                error
              );
            }

          },
          2 * 60 * 1000
        );

        return interaction.reply({
          content:
            `⚖️ **PLAINTE ENREGISTRÉE**\n\n` +
            `📁 Affaire : **#${plainte.id}**\n` +
            `👤 Plaignant : ${interaction.user}\n` +
            `⚠️ Accusé : ${accuse}\n` +
            `📌 Motif : **${motif}**\n` +
            `📄 Description : ${description}\n\n` +
            `⏳ Statut : **En attente**` +
            (
              channel
                ? `\n\n📂 Dossier : ${channel}`
                : `\n\n⚠️ Le dossier n'a pas pu être créé.`
            ) +
            `\n\n⏱️ Les choix d'avocat et de représentant sont disponibles pendant **2 minutes**.`
        });
      }

      // ==================================================
      // /PLAINTES
      // ==================================================

      if (
        interaction.commandName === "plaintes"
      ) {

        if (!estJuge(interaction.member)) {
          return interaction.reply({
            content:
              "❌ Commande réservée au rôle **Juge**.",
            ephemeral: true
          });
        }

        if (plaintes.length === 0) {
          return interaction.reply({
            content:
              "📁 Aucune plainte enregistrée.",
            ephemeral: true
          });
        }

        const liste =
          plaintes
            .slice()
            .reverse()
            .map(
              p =>
                `**#${p.id}** — ${p.statut}\n` +
                `👤 Accusé : <@${p.accuse}>\n` +
                `📌 Motif : ${p.motif}\n` +
                `🧑‍💼 Avocat : ${
                  p.avocat
                    ? `<@${p.avocat}>`
                    : "Aucun"
                }\n` +
                `🛡️ Représentant : ${
                  p.representant
                    ? `<@${p.representant}>`
                    : "Aucun"
                }`
            )
            .join("\n\n");

        return interaction.reply({
          content:
            `⚖️ **PLAINTES DU TRIBUNAL**\n\n${liste}`,
          ephemeral: true
        });
}
            // ==================================================
      // /AVOCAT
      // ==================================================

      if (
        interaction.commandName === "avocat"
      ) {

        const id =
          interaction.options.getInteger("id");

        const avocat =
          interaction.options.getUser("avocat");

        const plainte =
          getPlainte(id);

        if (!plainte) {
          return interaction.reply({
            content:
              "❌ Cette affaire n'existe pas.",
            ephemeral: true
          });
        }

        if (
          interaction.user.id !==
          plainte.accuse
        ) {
          return interaction.reply({
            content:
              "❌ Seul **l'accusé** peut choisir son avocat.",
            ephemeral: true
          });
        }

        if (
          plainte.statut === "Fermée"
        ) {
          return interaction.reply({
            content:
              "❌ Cette affaire est fermée.",
            ephemeral: true
          });
        }

        if (plainte.avocat) {
          return interaction.reply({
            content:
              "❌ Un avocat est déjà désigné.",
            ephemeral: true
          });
        }

        const avocatMember =
          await interaction.guild.members
            .fetch(avocat.id)
            .catch(() => null);

        if (!avocatMember) {
          return interaction.reply({
            content:
              "❌ Cette personne n'est pas sur le serveur.",
            ephemeral: true
          });
        }

        if (!estAvocat(avocatMember)) {
          return interaction.reply({
            content:
              "❌ Cette personne n'a pas le rôle **Avocat**.",
            ephemeral: true
          });
        }

        plainte.avocat =
          avocat.id;

        saveData(
          plaintes
        );

        const channel =
          interaction.guild.channels.cache.get(
            plainte.channel_id
          );

        if (channel) {

          await channel.send(
            `🧑‍💼 **AVOCAT DÉSIGNÉ**\n\n` +
            `L'accusé <@${plainte.accuse}> a choisi ${avocat} comme avocat.`
          );
        }

        return interaction.reply({
          content:
            `✅ ${avocat} est maintenant l'avocat de l'accusé pour l'affaire **#${id}**.`,
          ephemeral: true
        });
      }

      // ==================================================
      // /REPRESENTANT
      // ==================================================

      if (
        interaction.commandName === "representant"
      ) {

        const id =
          interaction.options.getInteger("id");

        const representant =
          interaction.options.getUser("representant");

        const plainte =
          getPlainte(id);

        if (!plainte) {
          return interaction.reply({
            content:
              "❌ Cette affaire n'existe pas.",
            ephemeral: true
          });
        }

        if (
          interaction.user.id !==
          plainte.plaignant
        ) {
          return interaction.reply({
            content:
              "❌ Seul **le plaignant** peut choisir le représentant de la défense.",
            ephemeral: true
          });
        }

        if (
          plainte.statut === "Fermée"
        ) {
          return interaction.reply({
            content:
              "❌ Cette affaire est fermée.",
            ephemeral: true
          });
        }

        if (plainte.representant) {
          return interaction.reply({
            content:
              "❌ Un représentant est déjà désigné.",
            ephemeral: true
          });
        }

        const representantMember =
          await interaction.guild.members
            .fetch(representant.id)
            .catch(() => null);

        if (!representantMember) {
          return interaction.reply({
            content:
              "❌ Cette personne n'est pas sur le serveur.",
            ephemeral: true
          });
        }

        if (
          !estRepresentant(
            representantMember
          )
        ) {
          return interaction.reply({
            content:
              "❌ Cette personne n'a pas le rôle **Représentant de la défense**.",
            ephemeral: true
          });
        }

        plainte.representant =
          representant.id;

        saveData(
          plaintes
        );

        const channel =
          interaction.guild.channels.cache.get(
            plainte.channel_id
          );

        if (channel) {

          await channel.send(
            `🛡️ **REPRÉSENTANT DE LA DÉFENSE DÉSIGNÉ**\n\n` +
            `Le plaignant <@${plainte.plaignant}> a choisi ${representant}.`
          );
        }

        return interaction.reply({
          content:
            `✅ ${representant} est maintenant le représentant de la défense pour l'affaire **#${id}**.`,
          ephemeral: true
        });
      }

      // ==================================================
      // /AUDIENCE
      // ==================================================

      if (
        interaction.commandName === "audience"
      ) {

        if (!estJuge(interaction.member)) {
          return interaction.reply({
            content:
              "❌ Commande réservée au rôle **Juge**.",
            ephemeral: true
          });
        }

        const id =
          interaction.options.getInteger("id");

        const plainte =
          getPlainte(id);

        if (!plainte) {
          return interaction.reply({
            content:
              "❌ Cette affaire n'existe pas.",
            ephemeral: true
          });
        }

        if (
          plainte.statut === "Fermée"
        ) {
          return interaction.reply({
            content:
              "❌ Cette affaire est déjà fermée.",
            ephemeral: true
          });
        }

        // Vérification obligatoire
        // Avocat
        if (!plainte.avocat) {

          const role =
            getRole(
              interaction.guild,
              ROLE_AVOCAT
            );

          if (
            role &&
            role.members.size > 0
          ) {
            return interaction.reply({
              content:
                "❌ Impossible de commencer le procès : l'accusé doit encore choisir son avocat ou attendre la sélection automatique.",
              ephemeral: true
            });
          }
        }

        // Représentant
        if (!plainte.representant) {

          const role =
            getRole(
              interaction.guild,
              ROLE_REPRESENTANT
            );

          if (
            role &&
            role.members.size > 0
          ) {
            return interaction.reply({
              content:
                "❌ Impossible de commencer le procès : le plaignant doit encore choisir son représentant ou attendre la sélection automatique.",
              ephemeral: true
            });
          }
        }

        plainte.statut =
          "Audience ouverte";

        plainte.juge =
          interaction.user.id;

        saveData(
          plaintes
        );

        const channel =
          interaction.guild.channels.cache.get(
            plainte.channel_id
          );

        const message =
          `⚖️ **OUVERTURE DE L'AUDIENCE**\n\n` +

          `Le Tribunal est officiellement réuni.\n\n` +

          `━━━━━━━━━━━━━━━━━━\n\n` +

          `📁 **Affaire #${id}**\n` +
          `👤 Accusé : <@${plainte.accuse}>\n` +
          `👤 Plaignant : <@${plainte.plaignant}>\n` +
          `🧑‍💼 Avocat : ${
            plainte.avocat
              ? `<@${plainte.avocat}>`
              : "Aucun"
          }\n` +
          `🛡️ Représentant : ${
            plainte.representant
              ? `<@${plainte.representant}>`
              : "Aucun"
          }\n` +
          `📌 Motif : **${plainte.motif}**\n` +
          `⚖️ Juge : ${interaction.user}\n\n` +

          `🔔 **L'audience commence maintenant.**`;

        if (channel) {
          await channel.send(
            message
          );
        }

        return interaction.reply({
          content:
            message
        });
      }

      // ==================================================
      // /CONDAMNER
      // ==================================================

      if (
        interaction.commandName === "condamner"
      ) {

        if (!estJuge(interaction.member)) {
          return interaction.reply({
            content:
              "❌ Commande réservée au rôle **Juge**.",
            ephemeral: true
          });
        }

        const id =
          interaction.options.getInteger("id");

        const peine =
          interaction.options.getString("peine");

        const plainte =
          getPlainte(id);

        if (!plainte) {
          return interaction.reply({
            content:
              "❌ Cette affaire n'existe pas.",
            ephemeral: true
          });
        }

        if (
          plainte.statut === "Fermée"
        ) {
          return interaction.reply({
            content:
              "❌ Cette affaire est déjà fermée.",
            ephemeral: true
          });
        }

        plainte.statut =
          "Coupable / Condamné";

        plainte.juge =
          interaction.user.id;

        plainte.peine =
          peine;

        plainte.verdict_at =
          new Date().toISOString();

        saveData(
          plaintes
        );

        const recompenses =
          await donnerRecompenses(
            plainte,
            true
          );

        const message =
          `⚖️ **VERDICT DU TRIBUNAL**\n\n` +

          `📁 Affaire : **#${id}**\n` +
          `👤 Accusé : <@${plainte.accuse}>\n` +
          `👤 Plaignant : <@${plainte.plaignant}>\n\n` +

          `🔨 Verdict : **COUPABLE**\n\n` +

          `📜 Peine : ${peine}\n\n` +

          `💰 **RÉCOMPENSES**\n` +
          (
            recompenses.length > 0
              ? recompenses.join("\n")
              : "Aucune récompense"
          ) +
          `\n\n` +

          `⚖️ Jugement rendu par ${interaction.user}\n\n` +

          `🔔 L'affaire peut maintenant être fermée avec \`/fermer\`.`;

        if (plainte.channel_id) {

          const channel =
            interaction.guild.channels.cache.get(
              plainte.channel_id
            );

          if (channel) {
            await channel.send(
              message
            );
          }
        }

        return interaction.reply({
          content:
            message
        });
      }

      // ==================================================
      // /ACQUITTER
      // ==================================================

      if (
        interaction.commandName === "acquitter"
      ) {

        if (!estJuge(interaction.member)) {
          return interaction.reply({
            content:
              "❌ Commande réservée au rôle **Juge**.",
            ephemeral: true
          });
        }

        const id =
          interaction.options.getInteger("id");

        const raison =
          interaction.options.getString("raison");

        const plainte =
          getPlainte(id);

        if (!plainte) {
          return interaction.reply({
            content:
              "❌ Cette affaire n'existe pas.",
            ephemeral: true
          });
        }

        if (
          plainte.statut === "Fermée"
        ) {
          return interaction.reply({
            content:
              "❌ Cette affaire est déjà fermée.",
            ephemeral: true
          });
        }

        plainte.statut =
          "Acquitté";

        plainte.juge =
          interaction.user.id;

        plainte.raison =
          raison;

        plainte.verdict_at =
          new Date().toISOString();

        saveData(
          plaintes
        );

        const recompenses =
          await donnerRecompenses(
            plainte,
            false
          );

        const message =
          `⚖️ **VERDICT DU TRIBUNAL**\n\n` +

          `📁 Affaire : **#${id}**\n` +
          `👤 Accusé : <@${plainte.accuse}>\n` +
          `👤 Plaignant : <@${plainte.plaignant}>\n\n` +

          `✅ Verdict : **ACQUITTÉ**\n\n` +

          `📄 Raison : ${raison}\n\n` +

          `💰 **RÉCOMPENSES**\n` +
          (
            recompenses.length > 0
              ? recompenses.join("\n")
              : "Aucune récompense"
          ) +
          `\n\n` +

          `⚖️ Jugement rendu par ${interaction.user}\n\n` +

          `🔔 L'affaire peut maintenant être fermée avec \`/fermer\`.`;

        if (plainte.channel_id) {

          const channel =
            interaction.guild.channels.cache.get(
              plainte.channel_id
            );

          if (channel) {
            await channel.send(
              message
            );
          }
        }

        return interaction.reply({
          content:
            message
        });
      }

      // ==================================================
      // /VERDICT
      // ==================================================

      if (
        interaction.commandName === "verdict"
      ) {

        const id =
          interaction.options.getInteger("id");

        const plainte =
          getPlainte(id);

        if (!plainte) {
          return interaction.reply({
            content:
              "❌ Cette affaire n'existe pas.",
            ephemeral: true
          });
        }

        let texte =
          `⚖️ **VERDICT — AFFAIRE #${id}**\n\n` +

          `👤 Accusé : <@${plainte.accuse}>\n` +
          `👤 Plaignant : <@${plainte.plaignant}>\n` +
          `📌 Motif : ${plainte.motif}\n` +
          `📊 Statut : **${plainte.statut}**`;

        if (plainte.peine) {
          texte +=
            `\n🔨 Peine : ${plainte.peine}`;
        }

        if (plainte.raison) {
          texte +=
            `\n📄 Raison : ${plainte.raison}`;
        }

        if (plainte.juge) {
          texte +=
            `\n⚖️ Juge : <@${plainte.juge}>`;
        }

        if (plainte.avocat) {
          texte +=
            `\n🧑‍💼 Avocat : <@${plainte.avocat}>`;
        }

        if (plainte.representant) {
          texte +=
            `\n🛡️ Représentant : <@${plainte.representant}>`;
        }

        return interaction.reply({
          content:
            texte,
          ephemeral: true
        });
      }

      // ==================================================
      // /FERMER
      // ==================================================

      if (
        interaction.commandName === "fermer"
      ) {

        if (!estJuge(interaction.member)) {
          return interaction.reply({
            content:
              "❌ Commande réservée au rôle **Juge**.",
            ephemeral: true
          });
        }

        const id =
          interaction.options.getInteger("id");

        const plainte =
          getPlainte(id);

        if (!plainte) {
          return interaction.reply({
            content:
              "❌ Cette affaire n'existe pas.",
            ephemeral: true
          });
        }

        if (
          plainte.statut === "Fermée"
        ) {
          return interaction.reply({
            content:
              "❌ Cette affaire est déjà fermée.",
            ephemeral: true
          });
        }

        plainte.statut =
          "Fermée";

        saveData(
          plaintes
        );

        if (plainte.channel_id) {

          const channel =
            interaction.guild.channels.cache.get(
              plainte.channel_id
            );

          if (channel) {

            await channel.send(
              `🔒 **AFFAIRE #${id} FERMÉE**\n\n` +
              `Cette affaire est maintenant officiellement fermée.\n\n` +
              `⚖️ Fermée par ${interaction.user}`
            );

            // Accusé
            await channel.permissionOverwrites.edit(
              plainte.accuse,
              {
                SendMessages: false
              }
            );

            // Plaignant
            await channel.permissionOverwrites.edit(
              plainte.plaignant,
              {
                SendMessages: false
              }
            );

            // Avocats
            const avocatRole =
              getRole(
                interaction.guild,
                ROLE_AVOCAT
              );

            if (avocatRole) {
              await channel.permissionOverwrites.edit(
                avocatRole.id,
                {
                  SendMessages: false
                }
              );
            }

            // Représentants
            const representantRole =
              getRole(
                interaction.guild,
                ROLE_REPRESENTANT
              );

            if (representantRole) {
              await channel.permissionOverwrites.edit(
                representantRole.id,
                {
                  SendMessages: false
                }
              );
            }
          }
        }

        return interaction.reply({
          content:
            `🔒 **AFFAIRE FERMÉE**\n\n` +
            `L'affaire **#${id}** est maintenant officiellement fermée.`
        });
      }

      // ==================================================
      // /AIDE
      // ==================================================

      if (
        interaction.commandName === "aide"
      ) {

        return interaction.reply({
          content:
            `⚖️ **TRIBUNAL — COMMANDES**\n\n` +

            `📝 \`/plainte\` — Déposer une plainte.\n` +
            `📁 \`/plaintes\` — Voir les plaintes.\n` +
            `🧑‍💼 \`/avocat\` — L'accusé choisit son avocat.\n` +
            `🛡️ \`/representant\` — Le plaignant choisit son représentant.\n` +
            `⚖️ \`/audience\` — Commencer l'audience.\n` +
            `🔨 \`/condamner\` — Condamner l'accusé.\n` +
            `✅ \`/acquitter\` — Acquitter l'accusé.\n` +
            `📜 \`/verdict\` — Voir le verdict.\n` +
            `🔒 \`/fermer\` — Fermer l'affaire.\n` +
            `🛒 \`/roles\` — Boutique des rôles.`
        });
      }

    } catch (error) {

      console.error(
        "❌ Erreur interaction :",
        error
      );

      if (!interaction.replied && !interaction.deferred) {

        await interaction.reply({
          content:
            "❌ Une erreur est survenue.",
          ephemeral: true
        }).catch(() => {});
      }
    }
  }
);

// ======================================================
// CONNEXION
// ======================================================

client.login(TOKEN);
