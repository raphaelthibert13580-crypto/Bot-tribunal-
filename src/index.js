const {
  Client,
  GatewayIntentBits,
  Events,
  ChannelType,
  PermissionFlagsBits
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  console.error("❌ DISCORD_TOKEN est manquant.");
  process.exit(1);
}

// ==========================
// BASE DE DONNÉES
// ==========================

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
    console.error("❌ Impossible de charger les plaintes :", error);
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
    console.error("❌ Impossible de sauvegarder les plaintes :", error);
  }
}

let plaintes = loadData();

function nextId() {
  if (plaintes.length === 0) return 1;

  return Math.max(
    ...plaintes.map(p => p.id)
  ) + 1;
}

function getPlainte(id) {
  return plaintes.find(p => p.id === id);
}

// ==========================
// CLIENT
// ==========================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// ==========================
// RÔLES
// ==========================

function getRole(guild, name) {
  return guild.roles.cache.find(
    role => role.name === name
  );
}

function estJuge(member) {
  return member.roles.cache.some(
    role => role.name === "Juge"
  );
}

// ==========================
// STRUCTURE + PERMISSIONS
// ==========================

async function creerStructureTribunal(guild) {

  try {

    console.log("🏛️ Vérification du Tribunal...");

    const roles = {
      juge: getRole(guild, "Juge"),
      avocat: getRole(guild, "Avocat"),
      accuse: getRole(guild, "Accusé"),
      cour: getRole(guild, "Cour")
    };

    console.log("👨‍⚖️ Rôles détectés :");
    console.log(`Juge : ${roles.juge ? "✅" : "❌"}`);
    console.log(`Avocat : ${roles.avocat ? "✅" : "❌"}`);
    console.log(`Accusé : ${roles.accuse ? "✅" : "❌"}`);
    console.log(`Cour : ${roles.cour ? "✅" : "❌"}`);

    // ==========================
    // CATÉGORIES
    // ==========================

    const categories = [
      {
        name: "📢 INFORMATIONS",
        permissions: {
          everyone: true,
          juge: true,
          avocat: true,
          accuse: true,
          cour: true
        },
        channels: [
          "📜・règlement",
          "📢・annonces",
          "❓・aide"
        ]
      },

      {
        name: "⚖️ TRIBUNAL",
        permissions: {
          everyone: true,
          juge: true,
          avocat: true,
          accuse: true,
          cour: true
        },
        channels: [
          "📝・déposer-une-plainte",
          "📂・affaires",
          "⚖️・audiences",
          "📜・verdicts"
        ]
      },

      {
        name: "🔒 ESPACE JUDICIAIRE",
        permissions: {
          everyone: false,
          juge: true,
          avocat: true,
          accuse: false,
          cour: true
        },
        channels: [
          "👨‍⚖️・juges",
          "🧑‍💼・avocats",
          "📁・dossiers"
        ]
      },

      {
        name: "💬 COMMUNAUTÉ",
        permissions: {
          everyone: true,
          juge: true,
          avocat: true,
          accuse: true,
          cour: true
        },
        channels: [
          "💬・discussion"
        ]
      }
    ];

    // ==========================
    // CRÉATION DES CATÉGORIES
    // ==========================

    for (const categoryData of categories) {

      let category =
        guild.channels.cache.find(
          channel =>
            channel.type === ChannelType.GuildCategory &&
            channel.name === categoryData.name
        );

      if (!category) {

        const permissionOverwrites = [];

        permissionOverwrites.push({
          id: guild.roles.everyone.id,
          allow: categoryData.permissions.everyone
            ? [
                PermissionFlagsBits.ViewChannel
              ]
            : [
                PermissionFlagsBits.ViewChannel
              ],
          deny: categoryData.permissions.everyone
            ? []
            : [
                PermissionFlagsBits.ViewChannel
              ]
        });

        if (roles.juge) {
          permissionOverwrites.push({
            id: roles.juge.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory
            ]
          });
        }

        if (roles.avocat) {
          permissionOverwrites.push({
            id: roles.avocat.id,
            allow: categoryData.permissions.avocat
              ? [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory
                ]
              : [],
            deny: categoryData.permissions.avocat
              ? []
              : [
                  PermissionFlagsBits.ViewChannel
                ]
          });
        }

        if (roles.accuse) {
          permissionOverwrites.push({
            id: roles.accuse.id,
            allow: categoryData.permissions.accuse
              ? [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory
                ]
              : [],
            deny: categoryData.permissions.accuse
              ? []
              : [
                  PermissionFlagsBits.ViewChannel
                ]
          });
        }

        if (roles.cour) {
          permissionOverwrites.push({
            id: roles.cour.id,
            allow: categoryData.permissions.cour
              ? [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory
                ]
              : [],
            deny: categoryData.permissions.cour
              ? []
              : [
                  PermissionFlagsBits.ViewChannel
                ]
          });
        }

        category =
          await guild.channels.create({
            name: categoryData.name,
            type: ChannelType.GuildCategory,
            permissionOverwrites
          });

        console.log(
          `✅ Catégorie créée : ${categoryData.name}`
        );

      } else {

        console.log(
          `ℹ️ Catégorie déjà présente : ${categoryData.name}`
        );
      }

      // ==========================
      // CRÉATION DES SALONS
      // ==========================

      for (const channelName of categoryData.channels) {

        const existing =
          guild.channels.cache.find(
            channel =>
              channel.name === channelName &&
              channel.parentId === category.id
          );

        if (!existing) {

          await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: category.id
          });

          console.log(
            `✅ Salon créé : ${channelName}`
          );
        }
      }
    }

    // ==========================
    // VOCAL
    // ==========================

    let communityCategory =
      guild.channels.cache.find(
        channel =>
          channel.type === ChannelType.GuildCategory &&
          channel.name === "💬 COMMUNAUTÉ"
      );

    if (communityCategory) {

      const vocal =
        guild.channels.cache.find(
          channel =>
            channel.name === "🔊・vocal" &&
            channel.parentId === communityCategory.id
        );

      if (!vocal) {

        await guild.channels.create({
          name: "🔊・vocal",
          type: ChannelType.GuildVoice,
          parent: communityCategory.id
        });

        console.log("✅ Vocal créé.");
      }
    }

    console.log(
      "🏛️ Structure et permissions terminées."
    );

  } catch (error) {

    console.error(
      "❌ Erreur structure Tribunal :",
      error
    );
  }
}

// ==========================
// BOT PRÊT
// ==========================

client.once(
  Events.ClientReady,
  async bot => {

    console.log(
      `⚖️ Tribunal en ligne : ${bot.user.tag}`
    );

    console.log(
      `📁 ${plaintes.length} plainte(s) chargée(s).`
    );

    const guild =
      bot.guilds.cache.get(
        process.env.GUILD_ID
      );

    if (!guild) {

      console.error(
        "❌ Serveur introuvable. Vérifie GUILD_ID."
      );

      return;
    }

    await creerStructureTribunal(guild);
  }
);

// ==========================
// COMMANDES
// ==========================

client.on(
  Events.InteractionCreate,
  async interaction => {

    if (!interaction.isChatInputCommand()) {
      return;
    }

    try {

      // ==========================
      // /plainte
      // ==========================

      if (interaction.commandName === "plainte") {

        if (estJuge(interaction.member)) {

          return interaction.reply({
            content:
              "❌ Un Juge ne peut pas déposer de plainte.",
            ephemeral: true
          });
        }

        const accuse =
          interaction.options.getUser("accuse");

        const motif =
          interaction.options.getString("motif");

        const description =
          interaction.options.getString("description");

        const plainte = {
          id: nextId(),
          plaignant: interaction.user.id,
          accuse: accuse.id,
          motif,
          description,
          statut: "En attente",
          juge: null,
          peine: null,
          raison: null,
          created_at:
            new Date().toISOString(),
          verdict_at: null
        };

        plaintes.push(plainte);

        saveData(plaintes);

        return interaction.reply({
          content:
            `⚖️ **PLAINTE ENREGISTRÉE**\n\n` +
            `📁 Affaire : **#${plainte.id}**\n` +
            `👤 Plaignant : ${interaction.user}\n` +
            `👤 Accusé : ${accuse}\n` +
            `📌 Motif : **${motif}**\n` +
            `📄 Description : ${description}\n\n` +
            `⏳ Statut : **En attente**`
        });
      }

      // ==========================
      // /plaintes
      // ==========================

      if (interaction.commandName === "plaintes") {

        if (!estJuge(interaction.member)) {

          return interaction.reply({
            content:
              "❌ Cette commande est réservée au rôle **Juge**.",
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
            .map(p =>
              `**#${p.id}** — ${p.statut}\n` +
              `👤 Accusé : <@${p.accuse}>\n` +
              `📌 Motif : ${p.motif}`
            )
            .join("\n\n");

        return interaction.reply({
          content:
            `⚖️ **PLAINTES DU TRIBUNAL**\n\n${liste}`,
          ephemeral: true
        });
      }

      // ==========================
      // /audience
      // ==========================

      if (interaction.commandName === "audience") {

        if (!estJuge(interaction.member)) {

          return interaction.reply({
            content:
              "❌ Cette commande est réservée au rôle **Juge**.",
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

        if (plainte.statut === "Fermée") {

          return interaction.reply({
            content:
              "❌ Cette affaire est déjà fermée.",
            ephemeral: true
          });
        }

        plainte.statut =
          "Audience ouverte";

        plainte.juge =
          interaction.user.id;

        saveData(plaintes);

        return interaction.reply({
          content:
            `⚖️ **OUVERTURE DE L'AUDIENCE**\n\n` +
            `Le Tribunal est officiellement réuni.\n` +
            `L'accusé est appelé à comparaître.\n\n` +
            `━━━━━━━━━━━━━━━━━━\n\n` +
            `📁 **Affaire #${id}**\n` +
            `👤 Accusé : <@${plainte.accuse}>\n` +
            `👤 Plaignant : <@${plainte.plaignant}>\n` +
            `📌 Motif : **${plainte.motif}**\n` +
            `📄 Description : ${plainte.description}\n` +
            `⚖️ Juge : ${interaction.user}\n\n` +
            `🔔 **L'audience commence maintenant.**`
        });
      }

      // ==========================
      // /condamner
      // ==========================

      if (interaction.commandName === "condamner") {

        if (!estJuge(interaction.member)) {

          return interaction.reply({
            content:
              "❌ Cette commande est réservée au rôle **Juge**.",
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

        if (plainte.statut === "Fermée") {

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

        saveData(plaintes);

        return interaction.reply({
          content:
            `⚖️ **VERDICT DU TRIBUNAL**\n\n` +
            `📁 Affaire : **#${id}**\n` +
            `👤 Accusé : <@${plainte.accuse}>\n` +
            `👤 Plaignant : <@${plainte.plaignant}>\n\n` +
            `🔨 Verdict : **COUPABLE**\n\n` +
            `📜 Peine : ${peine}\n\n` +
            `⚖️ Jugement rendu par ${interaction.user}\n\n` +
            `🔔 L'affaire peut maintenant être fermée avec \`/fermer\`.`
        });
      }

      // ==========================
      // /acquitter
      // ==========================

      if (interaction.commandName === "acquitter") {

        if (!estJuge(interaction.member)) {

          return interaction.reply({
            content:
              "❌ Cette commande est réservée au rôle **Juge**.",
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

        if (plainte.statut === "Fermée") {

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

        saveData(plaintes);

        return interaction.reply({
          content:
            `⚖️ **VERDICT DU TRIBUNAL**\n\n` +
            `📁 Affaire : **#${id}**\n` +
            `👤 Accusé : <@${plainte.accuse}>\n` +
            `👤 Plaignant : <@${plainte.plaignant}>\n\n` +
            `✅ Verdict : **ACQUITTÉ**\n\n` +
            `📄 Raison : ${raison}\n\n` +
            `⚖️ Jugement rendu par ${interaction.user}\n\n` +
            `🔔 L'affaire peut maintenant être fermée avec \`/fermer\`.`
        });
      }

      // ==========================
      // /verdict
      // ==========================

      if (interaction.commandName === "verdict") {

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

        return interaction.reply({
          content: texte,
          ephemeral: true
        });
      }

      // ==========================
      // /fermer
      // ==========================

      if (interaction.commandName === "fermer") {

        if (!estJuge(interaction.member)) {

          return interaction.reply({
            content:
              "❌ Cette commande est réservée au rôle **Juge**.",
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

        if (plainte.statut === "Fermée") {

          return interaction.reply({
            content:
              "❌ Cette affaire est déjà fermée.",
            ephemeral: true
          });
        }

        plainte.statut =
          "Fermée";

        saveData(plaintes);

        return interaction.reply({
          content:
            `🔒 **AFFAIRE FERMÉE**\n\n` +
            `L'affaire **#${id}** est maintenant officiellement fermée.\n\n` +
            `⚖️ Fermée par ${interaction.user}`
        });
      }

      // ==========================
      // /aide
      // ==========================

      if (interaction.commandName === "aide") {

        return interaction.reply({
          content:
            `⚖️ **TRIBUNAL — COMMANDES**\n\n` +
            `📋 \`/plainte\` — Déposer une plainte\n` +
            `📁 \`/plaintes\` — Voir les plaintes (Juge)\n` +
            `⚖️ \`/audience\` — Ouvrir une audience (Juge)\n` +
            `🔨 \`/condamner\` — Condamner (Juge)\n` +
            `✅ \`/acquitter\` — Acquitter (Juge)\n` +
            `📜 \`/verdict\` — Voir un verdict\n` +
            `🔒 \`/fermer\` — Fermer une affaire (Juge)\n` +
            `❓ \`/aide\` — Afficher cette aide`,
          ephemeral: true
        });
      }

    } catch (error) {

      console.error(
        "❌ Erreur pendant l'exécution d'une commande :",
        error
      );

      if (
        !interaction.replied &&
        
