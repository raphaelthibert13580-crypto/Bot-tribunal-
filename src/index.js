const {
  Client,
  GatewayIntentBits,
  Events,
  ChannelType
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  console.error("❌ DISCORD_TOKEN est manquant.");
  process.exit(1);
}

// ==========================
// BASE DE DONNÉES JSON
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
  if (plaintes.length === 0) {
    return 1;
  }

  return Math.max(...plaintes.map(p => p.id)) + 1;
}

function getPlainte(id) {
  return plaintes.find(p => p.id === id);
}

// ==========================
// CLIENT DISCORD
// ==========================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// ==========================
// PERMISSIONS
// ==========================

function estJuge(member) {
  return member.roles.cache.some(
    role => role.name === "Juge"
  );
}

// ==========================
// 🏛️ STRUCTURE DU TRIBUNAL
// ==========================

async function creerStructureTribunal(guild) {
  try {
    console.log("🏛️ Vérification de la structure du Tribunal...");

    const categories = [
      {
        nom: "📢 INFORMATIONS",
        salons: [
          {
            nom: "📜・règlement",
            type: ChannelType.GuildText
          },
          {
            nom: "📢・annonces",
            type: ChannelType.GuildText
          },
          {
            nom: "❓・aide",
            type: ChannelType.GuildText
          }
        ]
      },

      {
        nom: "⚖️ TRIBUNAL",
        salons: [
          {
            nom: "📝・déposer-une-plainte",
            type: ChannelType.GuildText
          },
          {
            nom: "📂・affaires",
            type: ChannelType.GuildText
          },
          {
            nom: "⚖️・audiences",
            type: ChannelType.GuildText
          },
          {
            nom: "📜・verdicts",
            type: ChannelType.GuildText
          }
        ]
      },

      {
        nom: "🔒 ESPACE JUDICIAIRE",
        salons: [
          {
            nom: "👨‍⚖️・juges",
            type: ChannelType.GuildText
          },
          {
            nom: "🧑‍💼・avocats",
            type: ChannelType.GuildText
          },
          {
            nom: "📁・dossiers",
            type: ChannelType.GuildText
          }
        ]
      },

      {
        nom: "💬 COMMUNAUTÉ",
        salons: [
          {
            nom: "💬・discussion",
            type: ChannelType.GuildText
          },
          {
            nom: "🔊・vocal",
            type: ChannelType.GuildVoice
          }
        ]
      }
    ];

    for (const categorie of categories) {

      let category = guild.channels.cache.find(
        channel =>
          channel.type === ChannelType.GuildCategory &&
          channel.name === categorie.nom
      );

      if (!category) {
        category = await guild.channels.create({
          name: categorie.nom,
          type: ChannelType.GuildCategory
        });

        console.log(
          `✅ Catégorie créée : ${categorie.nom}`
        );
      }

      for (const salon of categorie.salons) {

        const existe = guild.channels.cache.find(
          channel =>
            channel.name === salon.nom &&
            channel.parentId === category.id
        );

        if (!existe) {

          await guild.channels.create({
            name: salon.nom,
            type: salon.type,
            parent: category.id
          });

          console.log(
            `✅ Salon créé : ${salon.nom}`
          );
        }
      }
    }

    console.log("🏛️ Structure du Tribunal terminée.");

  } catch (error) {

    console.error(
      "❌ Impossible de créer la structure du Tribunal :",
      error
    );
  }
}

// ==========================
// BOT PRÊT
// ==========================

client.once(Events.ClientReady, async bot => {

  console.log(
    `⚖️ Tribunal en ligne : ${bot.user.tag}`
  );

  console.log(
    `📁 ${plaintes.length} plainte(s) chargée(s).`
  );

  const guild = bot.guilds.cache.get(
    process.env.GUILD_ID
  );

  if (!guild) {

    console.error(
      "❌ Serveur introuvable avec GUILD_ID."
    );

    return;
  }

  await creerStructureTribunal(guild);
});

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

          plaignant:
            interaction.user.id,

          accuse:
            accuse.id,

          motif,

          description,

          statut:
            "En attente",

          juge:
            null,

          peine:
            null,

          raison:
            null,

          created_at:
            new Date().toISOString(),

          verdict_at:
            null
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

        const liste = plaintes
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
        !interaction.deferred
      ) {

        await interaction.reply({

          content:
            "❌ Une erreur est survenue pendant l'exécution de la commande.",

          ephemeral: true
        });
      }
    }
  }
);

// ==========================
// GESTION DES ERREURS
// ==========================

process.on(
  "unhandledRejection",
  error => {
    console.error(
      "❌ Unhandled Rejection :",
      error
    );
  }
);

process.on(
  "uncaughtException",
  error => {
    console.error(
      "❌ Uncaught Exception :",
      error
    );
  }
);

// ==========================
// CONNEXION
// ==========================

client.login(TOKEN);
