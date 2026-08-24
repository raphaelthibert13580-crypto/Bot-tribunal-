const {
  Client,
  GatewayIntentBits,
  Events,
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  REST,
  Routes
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

const DATA_FILE = path.join(
  DATA_DIR,
  "plaintes.json"
);

const ROLES_FILE = path.join(
  DATA_DIR,
  "roles.json"
);

if (!fs.existsSync(DATA_DIR) && DATA_DIR !== ".") {
  fs.mkdirSync(DATA_DIR, {
    recursive: true
  });
}

// ======================================================
// PLAINTES
// ======================================================

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(
        DATA_FILE,
        "[]",
        "utf8"
      );

      return [];
    }

    const content =
      fs.readFileSync(
        DATA_FILE,
        "utf8"
      );

    if (!content.trim()) {
      return [];
    }

    return JSON.parse(content);

  } catch (error) {

    console.error(
      "❌ Erreur chargement plaintes :",
      error
    );

    return [];
  }
}

function saveData(data) {
  try {

    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(
        data,
        null,
        2
      ),
      "utf8"
    );

  } catch (error) {

    console.error(
      "❌ Erreur sauvegarde plaintes :",
      error
    );
  }
}

let plaintes = loadData();

// ======================================================
// ACHATS DE RÔLES
// ======================================================

function loadRolesData() {

  try {

    if (!fs.existsSync(ROLES_FILE)) {

      fs.writeFileSync(
        ROLES_FILE,
        "{}",
        "utf8"
      );

      return {};
    }

    const content =
      fs.readFileSync(
        ROLES_FILE,
        "utf8"
      );

    if (!content.trim()) {
      return {};
    }

    return JSON.parse(content);

  } catch (error) {

    console.error(
      "❌ Erreur chargement rôles :",
      error
    );

    return {};
  }
}

function saveRolesData(data) {

  try {

    fs.writeFileSync(
      ROLES_FILE,
      JSON.stringify(
        data,
        null,
        2
      ),
      "utf8"
    );

  } catch (error) {

    console.error(
      "❌ Erreur sauvegarde rôles :",
      error
    );
  }
}

let rolesData = loadRolesData();

function getUserOwnedRoles(userId) {

  if (!rolesData[userId]) {

    rolesData[userId] = {
      achetes: []
    };

    saveRolesData(rolesData);
  }

  if (!Array.isArray(rolesData[userId].achetes)) {
    rolesData[userId].achetes = [];
  }

  return rolesData[userId].achetes;
}

function hasPurchasedRole(userId, roleName) {

  const roles =
    getUserOwnedRoles(userId);

  return roles.includes(roleName);
}

function addPurchasedRole(userId, roleName) {

  const roles =
    getUserOwnedRoles(userId);

  if (!roles.includes(roleName)) {

    roles.push(roleName);

    saveRolesData(rolesData);
  }
}

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

const ROLE_COUR =
  "Cour";

const ROLE_JUGE =
  "Juge";

const ROLE_AVOCAT =
  "Avocat";

const ROLE_REPRESENTANT =
  "Représentant de la défense";

const ROLE_QOD =
  "Quitte ou double";

// ======================================================
// PRIX
// ======================================================

const PRIX_ROLES = {

  [ROLE_AVOCAT]:
    500000,

  [ROLE_REPRESENTANT]:
    750000,

  [ROLE_QOD]:
    500000,

  [ROLE_JUGE]:
    5000000
};

// ======================================================
// RÉCOMPENSES
// ======================================================

const RECOMPENSE_PLAIGNANT =
  10000;

const RECOMPENSE_REPRESENTANT =
  20000;

const RECOMPENSE_ACCUSE_ACQUITTE =
  10000;

const RECOMPENSE_AVOCAT_ACQUITTE =
  10000;

const QOD_GAIN =
  20000;

const QOD_PERTE =
  -10000;

// ======================================================
// OUTILS
// ======================================================

function nextId() {

  if (plaintes.length === 0) {
    return 1;
  }

  return (
    Math.max(
      ...plaintes.map(
        p => p.id
      )
    ) + 1
  );
}

function getPlainte(id) {

  return plaintes.find(
    p => p.id === id
  );
}

function getRole(guild, name) {

  return guild.roles.cache.find(
    role => role.name === name
  );
}

function estJuge(member) {

  return member.roles.cache.some(
    role =>
      role.name === ROLE_JUGE
  );
}

function estAvocat(member) {

  return member.roles.cache.some(
    role =>
      role.name === ROLE_AVOCAT
  );
}

function estRepresentant(member) {

  return member.roles.cache.some(
    role =>
      role.name === ROLE_REPRESENTANT
  );
}

function estQOD(member) {

  return member.roles.cache.some(
    role =>
      role.name === ROLE_QOD
  );
}

// ======================================================
// UNBELIEVABOAT
// ======================================================

async function modifierArgent(
  userId,
  montant,
  raison
) {

  try {

    const response =
      await fetch(
        `https://unbelievaboat.com/api/v1/guilds/${GUILD_ID}/users/${userId}`,
        {
          method: "PATCH",

          headers: {
            "Authorization":
              UNBELIEVABOAT_TOKEN,

            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            cash: montant,
            reason: raison
          })
        }
      );

    if (!response.ok) {

      const texte =
        await response.text();

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

async function getCash(userId) {

  try {

    const response =
      await fetch(
        `https://unbelievaboat.com/api/v1/guilds/${GUILD_ID}/users/${userId}`,
        {
          headers: {
            "Authorization":
              UNBELIEVABOAT_TOKEN
          }
        }
      );

    if (!response.ok) {
      return null;
    }

    const data =
      await response.json();

    return Number(
      data.cash || 0
    );

  } catch (error) {

    console.error(
      "❌ Erreur récupération argent :",
      error
    );

    return null;
  }
}

// ======================================================
// RÉCOMPENSES
// ======================================================

async function donnerRecompenses(
  plainte,
  condamne
) {

  if (
    plainte.recompenses_distribuees
  ) {

    console.log(
      `⚠️ Récompenses déjà distribuées pour #${plainte.id}`
    );

    return [];
  }

  const guild =
    client.guilds.cache.get(
      GUILD_ID
    );

  if (!guild) {
    return [];
  }

  const recompenses = [];

  const plaignant =
    await guild.members
      .fetch(plainte.plaignant)
      .catch(() => null);

  const accuse =
    await guild.members
      .fetch(plainte.accuse)
      .catch(() => null);

  const avocat =
    plainte.avocat
      ? await guild.members
          .fetch(plainte.avocat)
          .catch(() => null)
      : null;

  const representant =
    plainte.representant
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

        const ok =
          await modifierArgent(
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

        const ok =
          await modifierArgent(
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

    // REPRÉSENTANT
    if (representant) {

      const ok =
        await modifierArgent(
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

    // ACCUSÉ QUITTE OU DOUBLE
    if (
      accuse &&
      estQOD(accuse)
    ) {

      const ok =
        await modifierArgent(
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

        const ok =
          await modifierArgent(
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

        const ok =
          await modifierArgent(
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

      const ok =
        await modifierArgent(
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

    // PLAIGNANT QUITTE OU DOUBLE
    if (
      plaignant &&
      estQOD(plaignant)
    ) {

      const ok =
        await modifierArgent(
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

  plainte.recompenses_distribuees =
    true;

  saveData(plaintes);

  return recompenses;
}

// ======================================================
// CHOIX AUTOMATIQUE APRÈS 2 MINUTES
// ======================================================

async function choisirAutomatiquement(
  guild,
  plainte
) {

  if (
    plainte.statut === "Fermée"
  ) {
    return;
  }

  // AVOCAT
  if (!plainte.avocat) {

    const role =
      getRole(
        guild,
        ROLE_AVOCAT
      );

    if (role) {

      const candidats =
        role.members.filter(
          member =>
            member.id !==
              plainte.accuse &&
            member.id !==
              plainte.plaignant
        );

      if (candidats.size > 0) {

        const tableau =
          [...candidats.values()];

        const choisi =
          tableau[
            Math.floor(
              Math.random() *
              tableau.length
            )
          ];

        plainte.avocat =
          choisi.id;

        saveData(plaintes);

        const channel =
          guild.channels.cache.get(
            plainte.channel_id
          );

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
      getRole(
        guild,
        ROLE_REPRESENTANT
      );

    if (role) {

      const candidats =
        role.members.filter(
          member =>
            member.id !==
              plainte.accuse &&
            member.id !==
              plainte.plaignant
        );

      if (candidats.size > 0) {

        const tableau =
          [...candidats.values()];

        const choisi =
          tableau[
            Math.floor(
              Math.random() *
              tableau.length
            )
          ];

        plainte.representant =
          choisi.id;

        saveData(plaintes);

        const channel =
          guild.channels.cache.get(
            plainte.channel_id
          );

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

  saveData(plaintes);
}

// ======================================================
// CRÉATION DU DOSSIER
// ======================================================

async function creerDossier(
  guild,
  plainte
) {

  const categorie =
    guild.channels.cache.find(
      channel =>
        channel.type ===
          ChannelType.GuildCategory &&
        (
          channel.name ===
            "⚖️ TRIBUNAL" ||
          channel.name ===
            "📂 AFFAIRES"
        )
    );

  const jugeRole =
    getRole(
      guild,
      ROLE_JUGE
    );

  const courRole =
    getRole(
      guild,
      ROLE_COUR
    );

  const avocatRole =
    getRole(
      guild,
      ROLE_AVOCAT
    );

  const representantRole =
    getRole(
      guild,
      ROLE_REPRESENTANT
    );

  const permissions = [

    {
      id:
        guild.roles.everyone.id,

      deny: [
        PermissionFlagsBits.ViewChannel
      ]
    },

    {
      id:
        plainte.plaignant,

      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    },

    {
      id:
        plainte.accuse,

      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    }
  ];

  if (jugeRole) {

    permissions.push({

      id:
        jugeRole.id,

      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]

    });
  }

  if (courRole) {

    permissions.push({

      id:
        courRole.id,

      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]

    });
  }

  if (avocatRole) {

    permissions.push({

      id:
        avocatRole.id,

      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]

    });
  }

  if (representantRole) {

    permissions.push({

      id:
        representantRole.id,

      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]

    });
  }

  const channel =
    await guild.channels.create({

      name:
        `📁・affaire-${plainte.id}`,

      type:
        ChannelType.GuildText,

      parent:
        categorie
          ? categorie.id
          : null,

      permissionOverwrites:
        permissions
    });

  plainte.channel_id =
    channel.id;

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

  // Vérification automatique après 2 minutes
  setTimeout(
    async () => {

      try {

        await choisirAutomatiquement(
          guild,
          plainte
        );

      } catch (error) {

        console.error(
          "❌ Erreur choix automatique :",
          error
        );
      }

    },
    2 * 60 * 1000
  );

  return channel;
}

// ======================================================
// PARTIE 2 À SUIVRE
// ======================================================// ======================================================
// PARTIE 2/3 — CRÉATION DES DOSSIERS + COMMANDES
// ======================================================

// ======================================================
// SALONS
// ======================================================

function getChannel(guild, channelId) {

  if (!guild || !channelId) {
    return null;
  }

  return guild.channels.cache.get(
    channelId
  ) || null;
}

// ======================================================
// CHOIX AUTOMATIQUE AVOCAT / REPRÉSENTANT
// ======================================================

async function choisirAutomatiquement(
  guild,
  plainte
) {

  if (
    plainte.statut === "Fermée" ||
    plainte.statut === "Condamné" ||
    plainte.statut === "Acquitté"
  ) {
    return;
  }

  const channel =
    getChannel(
      guild,
      plainte.channel_id
    );

  // ====================================================
  // AVOCAT
  // ====================================================

  if (!plainte.avocat) {

    const role =
      getRole(
        guild,
        ROLE_AVOCAT
      );

    if (role) {

      const candidats =
        role.members.filter(
          member =>
            member.id !==
              plainte.accuse &&
            member.id !==
              plainte.plaignant
        );

      if (candidats.size > 0) {

        const tableau =
          [...candidats.values()];

        const choisi =
          tableau[
            Math.floor(
              Math.random() *
              tableau.length
            )
          ];

        plainte.avocat =
          choisi.id;

        saveJSON(
          DATA_FILE,
          plaintes
        );

        if (channel) {

          await channel
            .permissionOverwrites
            .edit(
              choisi.id,
              {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
              }
            )
            .catch(() => {});

          await channel.send(
            `🧑‍💼 **AVOCAT CHOISI AUTOMATIQUEMENT**\n\n` +
            `${choisi} a été désigné aléatoirement comme avocat de l'accusé.`
          );
        }
      }
    }
  }

  // ====================================================
  // REPRÉSENTANT
  // ====================================================

  if (!plainte.representant) {

    const role =
      getRole(
        guild,
        ROLE_REPRESENTANT
      );

    if (role) {

      const candidats =
        role.members.filter(
          member =>
            member.id !==
              plainte.accuse &&
            member.id !==
              plainte.plaignant
        );

      if (candidats.size > 0) {

        const tableau =
          [...candidats.values()];

        const choisi =
          tableau[
            Math.floor(
              Math.random() *
              tableau.length
            )
          ];

        plainte.representant =
          choisi.id;

        saveJSON(
          DATA_FILE,
          plaintes
        );

        if (channel) {

          await channel
            .permissionOverwrites
            .edit(
              choisi.id,
              {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
              }
            )
            .catch(() => {});

          await channel.send(
            `🛡️ **REPRÉSENTANT CHOISI AUTOMATIQUEMENT**\n\n` +
            `${choisi} a été désigné aléatoirement comme représentant de la défense.`
          );
        }
      }
    }
  }

  saveJSON(
    DATA_FILE,
    plaintes
  );
}

// ======================================================
// CRÉATION DU DOSSIER
// ======================================================

async function creerDossier(
  guild,
  plainte
) {

  const categorie =
    guild.channels.cache.find(
      channel =>
        channel.type ===
          ChannelType.GuildCategory &&
        (
          channel.name ===
            "⚖️ TRIBUNAL" ||
          channel.name ===
            "📂 AFFAIRES"
        )
    );

  const jugeRole =
    getRole(
      guild,
      ROLE_JUGE
    );

  const courRole =
    getRole(
      guild,
      ROLE_COUR
    );

  const avocatRole =
    getRole(
      guild,
      ROLE_AVOCAT
    );

  const representantRole =
    getRole(
      guild,
      ROLE_REPRESENTANT
    );

  const permissions = [

    {
      id:
        guild.roles.everyone.id,

      deny: [
        PermissionFlagsBits.ViewChannel
      ]
    },

    {
      id:
        plainte.plaignant,

      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    },

    {
      id:
        plainte.accuse,

      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    }
  ];

  if (jugeRole) {

    permissions.push({

      id:
        jugeRole.id,

      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    });
  }

  if (courRole) {

    permissions.push({

      id:
        courRole.id,

      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    });
  }

  if (avocatRole) {

    permissions.push({

      id:
        avocatRole.id,

      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    });
  }

  if (representantRole) {

    permissions.push({

      id:
        representantRole.id,

      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    });
  }

  const channel =
    await guild.channels.create({

      name:
        `📁・affaire-${plainte.id}`,

      type:
        ChannelType.GuildText,

      parent:
        categorie
          ? categorie.id
          : null,

      permissionOverwrites:
        permissions
    });

  plainte.channel_id =
    channel.id;

  saveJSON(
    DATA_FILE,
    plaintes
  );

  await channel.send(

    `⚖️ **DOSSIER JUDICIAIRE #${plainte.id}**\n\n` +

    `👤 **Plaignant :** <@${plainte.plaignant}>\n` +

    `⚠️ **Accusé :** <@${plainte.accuse}>\n` +

    `📌 **Motif :** ${plainte.motif}\n` +

    `📄 **Description :** ${plainte.description}\n\n` +

    `⏳ **Statut :** ${plainte.statut}\n\n` +

    `🧑‍💼 **Avocat :** Aucun\n` +

    `🛡️ **Représentant de la défense :** Aucun\n\n` +

    `⚠️ L'accusé peut choisir son avocat avec :\n` +

    `\`/avocat id:${plainte.id} avocat:@Nom\`\n\n` +

    `⚠️ Le plaignant peut choisir son représentant avec :\n` +

    `\`/representant id:${plainte.id} representant:@Nom\`\n\n` +

    `⏱️ Après **2 minutes**, le bot choisira automatiquement si personne n'a été choisi.`
  );

  // ====================================================
  // CHOIX AUTOMATIQUE APRÈS 2 MINUTES
  // ====================================================

  setTimeout(
    async () => {

      try {

        await choisirAutomatiquement(
          guild,
          plainte
        );

      } catch (error) {

        console.error(
          "❌ Erreur choix automatique :",
          error
        );
      }

    },
    2 * 60 * 1000
  );

  return channel;
}

// ======================================================
// COMMANDES
// ======================================================

const commands = [

  // ----------------------------------------------------
  // /plainte
  // ----------------------------------------------------

  new SlashCommandBuilder()
    .setName("plainte")
    .setDescription(
      "Déposer une plainte"
    )
    .addUserOption(
      option =>
        option
          .setName("accuse")
          .setDescription(
            "Personne contre qui porter plainte"
          )
          .setRequired(true)
    )
    .addStringOption(
      option =>
        option
          .setName("motif")
          .setDescription(
            "Motif de la plainte"
          )
          .setRequired(true)
    )
    .addStringOption(
      option =>
        option
          .setName("description")
          .setDescription(
            "Description des faits"
          )
          .setRequired(true)
    ),

  // ----------------------------------------------------
  // /avocat
  // ----------------------------------------------------

  new SlashCommandBuilder()
    .setName("avocat")
    .setDescription(
      "Choisir un avocat pour une affaire"
    )
    .addIntegerOption(
      option =>
        option
          .setName("id")
          .setDescription(
            "Numéro de l'affaire"
          )
          .setRequired(true)
    )
    .addUserOption(
      option =>
        option
          .setName("avocat")
          .setDescription(
            "Avocat choisi"
          )
          .setRequired(true)
    ),

  // ----------------------------------------------------
  // /representant
  // ----------------------------------------------------

  new SlashCommandBuilder()
    .setName("representant")
    .setDescription(
      "Choisir un représentant de la défense"
    )
    .addIntegerOption(
      option =>
        option
          .setName("id")
          .setDescription(
            "Numéro de l'affaire"
          )
          .setRequired(true)
    )
    .addUserOption(
      option =>
        option
          .setName("representant")
          .setDescription(
            "Représentant choisi"
          )
          .setRequired(true)
    ),

  // ----------------------------------------------------
  // /audience
  // ----------------------------------------------------

  new SlashCommandBuilder()
    .setName("audience")
    .setDescription(
      "Lancer l'audience d'une affaire"
    )
    .addIntegerOption(
      option =>
        option
          .setName("id")
          .setDescription(
            "Numéro de l'affaire"
          )
          .setRequired(true)
    ),

  // ----------------------------------------------------
  // /condamner
  // ----------------------------------------------------

  new SlashCommandBuilder()
    .setName("condamner")
    .setDescription(
      "Condamner un accusé"
    )
    .addIntegerOption(
      option =>
        option
          .setName("id")
          .setDescription(
            "Numéro de l'affaire"
          )
          .setRequired(true)
    ),

  // ----------------------------------------------------
  // /acquitter
  // ----------------------------------------------------

  new SlashCommandBuilder()
    .setName("acquitter")
    .setDescription(
      "Acquitter un accusé"
    )
    .addIntegerOption(
      option =>
        option
          .setName("id")
          .setDescription(
            "Numéro de l'affaire"
          )
          .setRequired(true)
    ),

  // ----------------------------------------------------
  // /fermer
  // ----------------------------------------------------

  new SlashCommandBuilder()
    .setName("fermer")
    .setDescription(
      "Fermer une affaire"
    )
    .addIntegerOption(
      option =>
        option
          .setName("id")
          .setDescription(
            "Numéro de l'affaire"
          )
          .setRequired(true)
    ),

  // ----------------------------------------------------
  // /plaintes
  // ----------------------------------------------------

  new SlashCommandBuilder()
    .setName("plaintes")
    .setDescription(
      "Voir les affaires ouvertes"
    ),

  // ----------------------------------------------------
  // /verdict
  // ----------------------------------------------------

  new SlashCommandBuilder()
    .setName("verdict")
    .setDescription(
      "Voir le verdict d'une affaire"
    )
    .addIntegerOption(
      option =>
        option
          .setName("id")
          .setDescription(
            "Numéro de l'affaire"
          )
          .setRequired(true)
    ),

  // ----------------------------------------------------
  // /acheter-role
  // ----------------------------------------------------

  new SlashCommandBuilder()
    .setName("acheter-role")
    .setDescription(
      "Acheter un rôle"
    )
    .addStringOption(
      option =>
        option
          .setName("role")
          .setDescription(
            "Rôle à acheter"
          )
          .setRequired(true)
          .addChoices(
            {
              name:
                "Avocat — 500 000",
              value:
                ROLE_AVOCAT
            },
            {
              name:
                "Représentant — 750 000",
              value:
                ROLE_REPRESENTANT
            },
            {
              name:
                "Quitte ou double — 500 000",
              value:
                ROLE_QOD
            },
            {
              name:
                "Juge — 5 000 000",
              value:
                ROLE_JUGE
            }
          )
    ),

  // ----------------------------------------------------
  // /mes-roles
  // ----------------------------------------------------

  new SlashCommandBuilder()
    .setName("mes-roles")
    .setDescription(
      "Voir les rôles achetés"
    )

];

// ======================================================
// ENREGISTREMENT DES COMMANDES
// ======================================================

async function enregistrerCommandes() {

  try {

    const guild =
      await client.guilds.fetch(
        GUILD_ID
      );

    await guild.commands.set(
      commands.map(
        command =>
          command.toJSON()
      )
    );

    console.log(
      "✅ Commandes slash enregistrées."
    );

  } catch (error) {

    console.error(
      "❌ Erreur enregistrement commandes :",
      error
    );
  }
}

// ======================================================
// PARTIE 3 À COLLER À LA SUITE
// ======================================================// ======================================================
// PARTIE 3/3 — INTERACTIONS + ACHATS + DÉMARRAGE
// ======================================================

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

        const id =
          interaction.customId.split("_")[1];

        const plainte =
          getPlainte(Number(id));

        if (!plainte) {

          return interaction.reply({
            content:
              "❌ Affaire introuvable.",
            ephemeral: true
          });
        }

        // ----------------------------------------------
        // VÉRIFICATION DU JUGE
        // ----------------------------------------------

        if (
          interaction.customId.startsWith(
            "condamner_"
          ) ||
          interaction.customId.startsWith(
            "acquitter_"
          ) ||
          interaction.customId.startsWith(
            "fermer_"
          )
        ) {

          if (
            !estJuge(
              interaction.member
            )
          ) {

            return interaction.reply({
              content:
                "❌ Seul le rôle **Juge** peut utiliser ce bouton.",
              ephemeral: true
            });
          }
        }

        // ----------------------------------------------
        // CONDAMNER
        // ----------------------------------------------

        if (
          interaction.customId.startsWith(
            "condamner_"
          )
        ) {

          if (
            plainte.statut !==
            "En attente"
          ) {

            return interaction.reply({
              content:
                "❌ Un verdict a déjà été rendu pour cette affaire.",
              ephemeral: true
            });
          }

          plainte.statut =
            "Condamné";

          plainte.verdict_par =
            interaction.user.id;

          plainte.date_verdict =
            Date.now();

          saveJSON(
            DATA_FILE,
            plaintes
          );

          const recompenses =
            await donnerRecompenses(
              plainte,
              true
            );

          const channel =
            getChannel(
              interaction.guild,
              plainte.channel_id
            );

          if (channel) {

            await channel.send(
              `⚖️ **VERDICT — AFFAIRE #${plainte.id}**\n\n` +
              `🔴 L'accusé <@${plainte.accuse}> est **CONDAMNÉ**.\n\n` +
              `💰 **Récompenses :**\n` +
              (
                recompenses.length > 0
                  ? recompenses.join("\n")
                  : "Aucune récompense distribuée."
              )
            );
          }

          return interaction.reply({
            content:
              `🔴 L'affaire **#${plainte.id}** est maintenant **CONDAMNÉE**.`,
            ephemeral: true
          });
        }

        // ----------------------------------------------
        // ACQUITTER
        // ----------------------------------------------

        if (
          interaction.customId.startsWith(
            "acquitter_"
          )
        ) {

          if (
            plainte.statut !==
            "En attente"
          ) {

            return interaction.reply({
              content:
                "❌ Un verdict a déjà été rendu pour cette affaire.",
              ephemeral: true
            });
          }

          plainte.statut =
            "Acquitté";

          plainte.verdict_par =
            interaction.user.id;

          plainte.date_verdict =
            Date.now();

          saveJSON(
            DATA_FILE,
            plaintes
          );

          const recompenses =
            await donnerRecompenses(
              plainte,
              false
            );

          const channel =
            getChannel(
              interaction.guild,
              plainte.channel_id
            );

          if (channel) {

            await channel.send(
              `⚖️ **VERDICT — AFFAIRE #${plainte.id}**\n\n` +
              `🟢 L'accusé <@${plainte.accuse}> est **ACQUITTÉ**.\n\n` +
              `💰 **Récompenses :**\n` +
              (
                recompenses.length > 0
                  ? recompenses.join("\n")
                  : "Aucune récompense distribuée."
              )
            );
          }

          return interaction.reply({
            content:
              `🟢 L'affaire **#${plainte.id}** est maintenant **ACQUITTÉE**.`,
            ephemeral: true
          });
        }

        // ----------------------------------------------
        // FERMER
        // ----------------------------------------------

        if (
          interaction.customId.startsWith(
            "fermer_"
          )
        ) {

          plainte.statut =
            "Fermée";

          saveJSON(
            DATA_FILE,
            plaintes
          );

          await interaction.reply({
            content:
              `🔒 L'affaire **#${plainte.id}** sera fermée dans 5 secondes.`,
            ephemeral: true
          });

          const channel =
            getChannel(
              interaction.guild,
              plainte.channel_id
            );

          if (channel) {

            await channel.send(
              `🔒 **AFFAIRE #${plainte.id} FERMÉE**\n\n` +
              `Cette affaire a été clôturée par <@${interaction.user.id}>.`
            );

            setTimeout(
              async () => {

                try {

                  await channel.delete();

                } catch (error) {

                  console.error(
                    "❌ Impossible de supprimer le dossier :",
                    error
                  );

                }

              },
              5000
            );
          }

          return;
        }

        return;
      }

      // ==================================================
      // COMMANDES SLASH
      // ==================================================

      if (
        !interaction.isChatInputCommand()
      ) {
        return;
      }

      // ==================================================
      // /PLAINTE
      // ==================================================

      if (
        interaction.commandName ===
        "plainte"
      ) {

        if (
          estJuge(
            interaction.member
          )
        ) {

          return interaction.reply({
            content:
              "❌ Un juge ne peut pas porter plainte.",
            ephemeral: true
          });
        }

        const accuse =
          interaction.options.getUser(
            "accuse"
          );

        const motif =
          interaction.options.getString(
            "motif"
          );

        const description =
          interaction.options.getString(
            "description"
          );

        if (
          accuse.id ===
          interaction.user.id
        ) {

          return interaction.reply({
            content:
              "❌ Tu ne peux pas porter plainte contre toi-même.",
            ephemeral: true
          });
        }

        const membreAccuse =
          await interaction.guild.members
            .fetch(accuse.id)
            .catch(() => null);

        if (!membreAccuse) {

          return interaction.reply({
            content:
              "❌ L'accusé doit être présent sur le serveur.",
            ephemeral: true
          });
        }

        const id =
          nextId();

        const plainte = {

          id,

          plaignant:
            interaction.user.id,

          accuse:
            accuse.id,

          motif,

          description,

          avocat:
            null,

          representant:
            null,

          channel_id:
            null,

          statut:
            "En attente",

          recompenses_distribuees:
            false,

          date_creation:
            Date.now(),

          verdict_par:
            null,

          date_verdict:
            null

        };

        plaintes.push(
          plainte
        );

        saveJSON(
          DATA_FILE,
          plaintes
        );

        await interaction.reply({
          content:
            `⚖️ **Plainte #${id} créée !**\n` +
            `Le dossier va être créé.`,
          ephemeral: true
        });

        try {

          await creerDossier(
            interaction.guild,
            plainte
          );

        } catch (error) {

          console.error(
            "❌ Erreur création dossier :",
            error
          );

          plainte.statut =
            "Erreur";

          saveJSON(
            DATA_FILE,
            plaintes
          );

          await interaction.followUp({
            content:
              "❌ Impossible de créer le dossier. Vérifie les permissions du bot.",
            ephemeral: true
          });
        }

        return;
      }

      // ==================================================
      // /AVOCAT
      // ==================================================

      if (
        interaction.commandName ===
        "avocat"
      ) {

        const id =
          interaction.options.getInteger(
            "id"
          );

        const avocat =
          interaction.options.getUser(
            "avocat"
          );

        const plainte =
          getPlainte(id);

        if (!plainte) {

          return interaction.reply({
            content:
              "❌ Affaire introuvable.",
            ephemeral: true
          });
        }

        if (
          plainte.statut !==
          "En attente"
        ) {

          return interaction.reply({
            content:
              "❌ Cette affaire n'est plus en attente.",
            ephemeral: true
          });
        }

        if (
          interaction.user.id !==
          plainte.accuse
        ) {

          return interaction.reply({
            content:
              "❌ Seul l'accusé peut choisir son avocat.",
            ephemeral: true
          });
        }

        const membre =
          await interaction.guild.members
            .fetch(avocat.id)
            .catch(() => null);

        if (!membre) {

          return interaction.reply({
            content:
              "❌ Cet utilisateur n'est pas sur le serveur.",
            ephemeral: true
          });
        }

        if (
          !estAvocat(membre)
        ) {

          return interaction.reply({
            content:
              "❌ Cette personne n'a pas le rôle **Avocat**.",
            ephemeral: true
          });
        }

        if (
          avocat.id ===
          plainte.accuse ||
          avocat.id ===
          plainte.plaignant
        ) {

          return interaction.reply({
            content:
              "❌ Tu ne peux pas choisir cette personne.",
            ephemeral: true
          });
        }

        plainte.avocat =
          avocat.id;

        saveJSON(
          DATA_FILE,
          plaintes
        );

        const channel =
          getChannel(
            interaction.guild,
            plainte.channel_id
          );

        if (channel) {

          await channel.permissionOverwrites
            .edit(
              avocat.id,
              {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
              }
            );

          await channel.send(
            `🧑‍💼 **AVOCAT DÉSIGNÉ**\n\n` +
            `<@${avocat.id}> représente désormais l'accusé.`
          );
        }

        return interaction.reply({
          content:
            `✅ <@${avocat.id}> a été choisi comme avocat.`,
          ephemeral: true
        });
      }

      // ==================================================
      // /REPRESENTANT
      // ==================================================

      if (
        interaction.commandName ===
        "representant"
      ) {

        const id =
          interaction.options.getInteger(
            "id"
          );

        const representant =
          interaction.options.getUser(
            "representant"
          );

        const plainte =
          getPlainte(id);

        if (!plainte) {

          return interaction.reply({
            content:
              "❌ Affaire introuvable.",
            ephemeral: true
          });
        }

        if (
          plainte.statut !==
          "En attente"
        ) {

          return interaction.reply({
            content:
              "❌ Cette affaire n'est plus en attente.",
            ephemeral: true
          });
        }

        if (
          interaction.user.id !==
          plainte.plaignant
        ) {

          return interaction.reply({
            content:
              "❌ Seul le plaignant peut choisir son représentant.",
            ephemeral: true
          });
        }

        const membre =
          await interaction.guild.members
            .fetch(representant.id)
            .catch(() => null);

        if (!membre) {

          return interaction.reply({
            content:
              "❌ Cet utilisateur n'est pas sur le serveur.",
            ephemeral: true
          });
        }

        if (
          !estRepresentant(membre)
        ) {

          return interaction.reply({
            content:
              "❌ Cette personne n'a pas le rôle **Représentant de la défense**.",
            ephemeral: true
          });
        }

        if (
          representant.id ===
          plainte.plaignant ||
          representant.id ===
          plainte.accuse
        ) {

          return interaction.reply({
            content:
              "❌ Tu ne peux pas choisir cette personne.",
            ephemeral: true
          });
        }

        plainte.representant =
          representant.id;

        saveJSON(
          DATA_FILE,
          plaintes
        );

        const channel =
          getChannel(
            interaction.guild,
            plainte.channel_id
          );

        if (channel) {

          await channel.permissionOverwrites
            .edit(
              representant.id,
              {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
              }
            );

          await channel.send(
            `🛡️ **REPRÉSENTANT DÉSIGNÉ**\n\n` +
            `<@${representant.id}> représente désormais la défense.`
          );
        }

        return interaction.reply({
          content:
            `✅ <@${representant.id}> a été choisi comme représentant.`,
          ephemeral: true
        });
      }

      // ==================================================
      // /AUDIENCE
      // ==================================================

      if (
        interaction.commandName ===
        "audience"
      ) {

        if (
          !estJuge(
            interaction.member
          )
        ) {

          return interaction.reply({
            content:
              "❌ Seul un **Juge** peut lancer une audience.",
            ephemeral: true
          });
        }

        const id =
          interaction.options.getInteger(
            "id"
          );

        const plainte =
          getPlainte(id);

        if (!plainte) {

          return interaction.reply({
            content:
              "❌ Affaire introuvable.",
            ephemeral: true
          });
        }

        if (
          plainte.statut !==
          "En attente"
        ) {

          return interaction.reply({
            content:
              "❌ Cette affaire a déjà reçu un verdict.",
            ephemeral: true
          });
        }

        const channel =
          getChannel(
            interaction.guild,
            plainte.channel_id
          );

        if (!channel) {

          return interaction.reply({
            content:
              "❌ Salon de l'affaire introuvable.",
            ephemeral: true
          });
        }

        const row =
          new ActionRowBuilder()
            .addComponents(

              new ButtonBuilder()
                .setCustomId(
                  `condamner_${id}`
                )
                .setLabel(
                  "Condamner"
                )
                .setEmoji("⚠️")
                .setStyle(
                  ButtonStyle.Danger
                ),

              new ButtonBuilder()
                .setCustomId(
                  `acquitter_${id}`
                )
                .setLabel(
                  "Acquitter"
                )
                .setEmoji("✅")
                .setStyle(
                  ButtonStyle.Success
                ),

              new ButtonBuilder()
                .setCustomId(
                  `fermer_${id}`
                )
                .setLabel(
                  "Fermer"
                )
                .setEmoji("🔒")
                .setStyle(
                  ButtonStyle.Secondary
                )

            );

        await channel.send({

          content:
            `⚖️ **AUDIENCE — AFFAIRE #${id}**\n\n` +
            `Le juge peut maintenant rendre son verdict.`,

          components: [
            row
          ]

        });

        return interaction.reply({
          content:
            `⚖️ Audience de l'affaire **#${id}** lancée.`,
          ephemeral: true
        });
      }

      // ==================================================
      // /CONDAMNER
      // ==================================================

      if (
        interaction.commandName ===
        "condamner"
      ) {

        if (
          !estJuge(
            interaction.member
          )
        ) {

          return interaction.reply({
            content:
              "❌ Seul un **Juge** peut condamner.",
            ephemeral: true
          });
        }

        const id =
          interaction.options.getInteger(
            "id"
          );

        const plainte =
          getPlainte(id);

        if (!plainte) {

          return interaction.reply({
            content:
              "❌ Affaire introuvable.",
            ephemeral: true
          });
        }

        if (
          plainte.statut !==
          "En attente"
        ) {

          return interaction.reply({
            content:
              "❌ Cette affaire a déjà été jugée.",
            ephemeral: true
          });
        }

        plainte.statut =
          "Condamné";

        plainte.verdict_par =
          interaction.user.id;

        plainte.date_verdict =
          Date.now();

        saveJSON(
          DATA_FILE,
          plaintes
        );

        const recompenses =
          await donnerRecompenses(
            plainte,
            true
          );

        return interaction.reply(
          `🔴 **AFFAIRE #${id} — CONDAMNÉE**\n\n` +
          `L'accusé <@${plainte.accuse}> est condamné.\n\n` +
          `💰 **Récompenses :**\n` +
          (
            recompenses.length
              ? recompenses.join("\n")
              : "Aucune."
          )
        );
      }

      // ==================================================
      // /ACQUITTER
      // ==================================================

      if (
        interaction.commandName ===
        "acquitter"
      ) {

        if (
          !estJuge(
            interaction.member
          )
        ) {

          return interaction.reply({
            content:
              "❌ Seul un **Juge** peut acquitter.",
            ephemeral: true
          });
        }

        const id =
          interaction.options.getInteger(            "id"
          );

        const plainte =
          getPlainte(id);

        if (!plainte) {

          return interaction.reply({
            content:
              "❌ Affaire introuvable.",
            ephemeral: true
          });
        }

        if (
          plainte.statut !==
          "En attente"
        ) {

          return interaction.reply({
            content:
              "❌ Cette affaire a déjà été jugée.",
            ephemeral: true
          });
        }

        plainte.statut =
          "Condamné";

        plainte.verdict_par =
          interaction.user.id;

        plainte.date_verdict =
          Date.now();

        saveJSON(
          DATA_FILE,
          plaintes
        );

        const recompenses =
          await donnerRecompenses(
            plainte,
            true
          );

        return interaction.reply({
          content:
            `🔴 **AFFAIRE #${id} — CONDAMNÉE**\n\n` +
            `L'accusé <@${plainte.accuse}> est condamné.\n\n` +
            `💰 **Récompenses :**\n` +
            (
              recompenses.length
                ? recompenses.join("\n")
                : "Aucune."
            )
        });
      }

      // ==================================================
      // /ACQUITTER
      // ==================================================

      if (
        interaction.commandName ===
        "acquitter"
      ) {

        if (
          !estJuge(
            interaction.member
          )
        ) {

          return interaction.reply({
            content:
              "❌ Seul un **Juge** peut acquitter.",
            ephemeral: true
          });
        }

        const id =
          interaction.options.getInteger(
            "id"
          );

        const plainte =
          getPlainte(id);

        if (!plainte) {

          return interaction.reply({
            content:
              "❌ Affaire introuvable.",
            ephemeral: true
          });
        }

        if (
          plainte.statut !==
          "En attente"
        ) {

          return interaction.reply({
            content:
              "❌ Cette affaire a déjà été jugée.",
            ephemeral: true
          });
        }

        plainte.statut =
          "Acquitté";

        plainte.verdict_par =
          interaction.user.id;

        plainte.date_verdict =
          Date.now();

        saveJSON(
          DATA_FILE,
          plaintes
        );

        const recompenses =
          await donnerRecompenses(
            plainte,
            false
          );

        return interaction.reply({
          content:
            `🟢 **AFFAIRE #${id} — ACQUITTÉE**\n\n` +
            `L'accusé <@${plainte.accuse}> est acquitté.\n\n` +
            `💰 **Récompenses :**\n` +
            (
              recompenses.length
                ? recompenses.join("\n")
                : "Aucune."
            )
        });
      }

      // ==================================================
      // /FERMER
      // ==================================================

      if (
        interaction.commandName ===
        "fermer"
      ) {

        if (
          !estJuge(
            interaction.member
          )
        ) {

          return interaction.reply({
            content:
              "❌ Seul un **Juge** peut fermer une affaire.",
            ephemeral: true
          });
        }

        const id =
          interaction.options.getInteger(
            "id"
          );

        const plainte =
          getPlainte(id);

        if (!plainte) {

          return interaction.reply({
            content:
              "❌ Affaire introuvable.",
            ephemeral: true
          });
        }

        plainte.statut =
          "Fermée";

        saveJSON(
          DATA_FILE,
          plaintes
        );

        const channel =
          getChannel(
            interaction.guild,
            plainte.channel_id
          );

        await interaction.reply({
          content:
            `🔒 Affaire **#${id}** fermée.`,
          ephemeral: true
        });

        if (channel) {

          setTimeout(
            async () => {

              try {
                await channel.delete();
              } catch (error) {
                console.error(
                  "❌ Erreur suppression salon :",
                  error
                );
              }

            },
            5000
          );
        }

        return;
      }

      // ==================================================
      // /PLAINTES
      // ==================================================

      if (
        interaction.commandName ===
        "plaintes"
      ) {

        if (
          !estJuge(
            interaction.member
          )
        ) {

          return interaction.reply({
            content:
              "❌ Seul un **Juge** peut voir les plaintes.",
            ephemeral: true
          });
        }

        const ouvertes =
          plaintes.filter(
            plainte =>
              plainte.statut !==
              "Fermée"
          );

        if (
          ouvertes.length === 0
        ) {

          return interaction.reply({
            content:
              "📂 Aucune affaire ouverte.",
            ephemeral: true
          });
        }

        const texte =
          ouvertes
            .map(
              plainte =>
                `⚖️ **#${plainte.id}** — ${plainte.statut}\n` +
                `👤 Plaignant : <@${plainte.plaignant}>\n` +
                `⚠️ Accusé : <@${plainte.accuse}>`
            )
            .join("\n\n");

        return interaction.reply({
          content:
            `📂 **AFFAIRES OUVERTES**\n\n${texte}`,
          ephemeral: true
        });
      }

      // ==================================================
      // /VERDICT
      // ==================================================

      if (
        interaction.commandName ===
        "verdict"
      ) {

        const id =
          interaction.options.getInteger(
            "id"
          );

        const plainte =
          getPlainte(id);

        if (!plainte) {

          return interaction.reply({
            content:
              "❌ Affaire introuvable.",
            ephemeral: true
          });
        }

        let texte =
          `⚖️ **VERDICT — AFFAIRE #${id}**\n\n`;

        texte +=
          `👤 Plaignant : <@${plainte.plaignant}>\n`;

        texte +=
          `⚠️ Accusé : <@${plainte.accuse}>\n`;

        texte +=
          `📌 Motif : ${plainte.motif}\n`;

        texte +=
          `📊 Statut : **${plainte.statut}**\n`;

        if (plainte.avocat) {
          texte +=
            `🧑‍💼 Avocat : <@${plainte.avocat}>\n`;
        }

        if (plainte.representant) {
          texte +=
            `🛡️ Représentant : <@${plainte.representant}>\n`;
        }

        if (plainte.verdict_par) {
          texte +=
            `⚖️ Juge : <@${plainte.verdict_par}>`;
        }

        return interaction.reply({
          content: texte,
          ephemeral: true
        });
      }

      // ==================================================
      // /ACHETER-ROLE
      // ==================================================

      if (
        interaction.commandName ===
        "acheter-role"
      ) {

        const roleName =
          interaction.options.getString(
            "role"
          );

        const prix =
          PRIX_ROLES[roleName];

        if (!prix) {

          return interaction.reply({
            content:
              "❌ Rôle invalide.",
            ephemeral: true
          });
        }

        if (
          hasPurchasedRole(
            interaction.user.id,
            roleName
          )
        ) {

          return interaction.reply({
            content:
              `❌ Tu possèdes déjà le rôle **${roleName}**.`,
            ephemeral: true
          });
        }

        const argent =
          await getCash(
            interaction.user.id
          );

        if (argent === null) {

          return interaction.reply({
            content:
              "❌ Impossible de récupérer ton argent auprès d'UnbelievaBoat.",
            ephemeral: true
          });
        }

        if (argent < prix) {

          return interaction.reply({
            content:
              `❌ Tu n'as pas assez d'argent.\n` +
              `💰 Solde : **${argent.toLocaleString("fr-FR")}**\n` +
              `💵 Prix : **${prix.toLocaleString("fr-FR")}**`,
            ephemeral: true
          });
        }

        const role =
          getRole(
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

        const paiement =
          await modifierArgent(
            interaction.user.id,
            -prix,
            `Achat du rôle ${roleName}`
          );

        if (!paiement) {

          return interaction.reply({
            content:
              "❌ Le paiement a échoué.",
            ephemeral: true
          });
        }

        try {

          await interaction.member.roles.add(
            role
          );

        } catch (error) {

          await modifierArgent(
            interaction.user.id,
            prix,
            `Remboursement - impossible d'attribuer ${roleName}`
          );

          console.error(
            "❌ Erreur attribution rôle :",
            error
          );

          return interaction.reply({
            content:
              "❌ Impossible de donner le rôle. L'achat a été remboursé.",
            ephemeral: true
          });
        }

        addPurchasedRole(
          interaction.user.id,
          roleName
        );

        return interaction.reply({
          content:
            `🎉 **Achat effectué !**\n\n` +
            `🎭 Rôle : **${roleName}**\n` +
            `💰 Prix : **${prix.toLocaleString("fr-FR")}**`,
          ephemeral: true
        });
      }

      // ==================================================
      // /MES-ROLES
      // ==================================================

      if (
        interaction.commandName ===
        "mes-roles"
      ) {

        const roles =
          getUserOwnedRoles(
            interaction.user.id
          );

        if (
          roles.length === 0
        ) {

          return interaction.reply({
            content:
              "🎭 Tu n'as encore acheté aucun rôle.",
            ephemeral: true
          });
        }

        return interaction.reply({
          content:
            `🎭 **TES RÔLES ACHETÉS**\n\n` +
            roles
              .map(
                role =>
                  `• **${role}**`
              )
              .join("\n"),
          ephemeral: true
        });
      }

    } catch (error) {

      console.error(
        "❌ Erreur InteractionCreate :",
        error
      );

      try {

        if (
          interaction.replied ||
          interaction.deferred
        ) {

          await interaction.followUp({
            content:
              "❌ Une erreur est survenue.",
            ephemeral: true
          });

        } else {

          await interaction.reply({
            content:
              "❌ Une erreur est survenue.",
            ephemeral: true
          });
        }

      } catch {}
    }
  }
);

// ======================================================
// CONNEXION
// ======================================================

client.once(
  Events.ClientReady,
  async readyClient => {

    console.log(
      `✅ Tribunal connecté : ${readyClient.user.tag}`
    );

    await enregistrerCommandes();

    console.log(
      "⚖️ Tribunal prêt !"
    );
  }
);

// ======================================================
// LOGIN
// ======================================================

client.login(TOKEN);
