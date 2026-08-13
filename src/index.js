const {
  Client,
  GatewayIntentBits,
  Collection,
  Events
} = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  console.error("❌ DISCORD_TOKEN est manquant.");
  process.exit(1);
}

const db = new Database(process.env.DB_PATH || "tribunal.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS plaintes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plaignant TEXT NOT NULL,
    accuse TEXT NOT NULL,
    motif TEXT NOT NULL,
    description TEXT NOT NULL,
    statut TEXT NOT NULL DEFAULT 'En attente',
    juge TEXT,
    peine TEXT,
    raison TEXT,
    created_at TEXT NOT NULL,
    verdict_at TEXT
  )
`);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

function estJuge(member) {
  return member.roles.cache.some(role => role.name === "Juge");
}

client.once(Events.ClientReady, (bot) => {
  console.log(`⚖️ Tribunal en ligne : ${bot.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === "plainte") {
      if (estJuge(interaction.member)) {
        return interaction.reply({
          content: "❌ Un Juge ne peut pas déposer de plainte.",
          ephemeral: true
        });
      }

      const accuse = interaction.options.getUser("accuse");
      const motif = interaction.options.getString("motif");
      const description = interaction.options.getString("description");

      const result = db.prepare(`
        INSERT INTO plaintes
        (plaignant, accuse, motif, description, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        interaction.user.id,
        accuse.id,
        motif,
        description,
        new Date().toISOString()
      );

      return interaction.reply({
        content:
          `⚖️ **Plainte enregistrée !**\n\n` +
          `📁 Affaire : **#${result.lastInsertRowid}**\n` +
          `👤 Plaignant : ${interaction.user}\n` +
          `👤 Accusé : ${accuse}\n` +
          `📌 Motif : **${motif}**\n` +
          `📄 Description : ${description}\n\n` +
          `⏳ Statut : **En attente**`
      });
    }

    if (interaction.commandName === "plaintes") {
      if (!estJuge(interaction.member)) {
        return interaction.reply({
          content: "❌ Cette commande est réservée au rôle **Juge**.",
          ephemeral: true
        });
      }

      const plaintes = db.prepare(`
        SELECT * FROM plaintes
        ORDER BY id DESC
      `).all();

      if (plaintes.length === 0) {
        return interaction.reply({
          content: "📁 Aucune plainte enregistrée.",
          ephemeral: true
        });
      }

      const texte = plaintes.map(p =>
        `**#${p.id}** — ${p.statut}\n` +
        `👤 Accusé : <@${p.accuse}>\n` +
        `📌 Motif : ${p.motif}`
      ).join("\n\n");

      return interaction.reply({
        content: `⚖️ **Plaintes du Tribunal**\n\n${texte}`,
        ephemeral: true
      });
    }

    if (interaction.commandName === "audience") {
      if (!estJuge(interaction.member)) {
        return interaction.reply({
          content: "❌ Cette commande est réservée au rôle **Juge**.",
          ephemeral: true
        });
      }

      const id = interaction.options.getInteger("id");

      const plainte = db.prepare(
        "SELECT * FROM plaintes WHERE id = ?"
      ).get(id);

      if (!plainte) {
        return interaction.reply({
          content: "❌ Cette affaire n'existe pas.",
          ephemeral: true
        });
      }

      if (plainte.statut === "Fermée") {
        return interaction.reply({
          content: "❌ Cette affaire est déjà fermée.",
          ephemeral: true
        });
      }

      db.prepare(`
        UPDATE plaintes
        SET statut = 'Audience ouverte', juge = ?
        WHERE id = ?
      `).run(interaction.user.id, id);

      return interaction.reply({
        content:
          `⚖️ **OUVERTURE DE L'AUDIENCE**\n\n` +
          `Le Tribunal est officiellement réuni.\n` +
          `L'accusé est appelé à comparaître.\n\n` +
          `📁 **Affaire #${id}**\n` +
          `👤 Accusé : <@${plainte.accuse}>\n` +
          `👤 Plaignant : <@${plainte.plaignant}>\n` +
          `📌 Motif : **${plainte.motif}**\n` +
          `📄 Description : ${plainte.description}\n` +
          `⚖️ Juge : ${interaction.user}\n\n` +
          `🔔 **L'audience commence maintenant.**`
      });
    }

    if (
      interaction.commandName === "condamner" ||
      interaction.commandName === "acquitter"
    ) {
      if (!estJuge(interaction.member)) {
        return interaction.reply({
          content: "❌ Cette commande est réservée au rôle **Juge**.",
          ephemeral: true
        });
      }

      const id = interaction.options.getInteger("id");

      const plainte = db.prepare(
        "SELECT * FROM plaintes WHERE id = ?"
      ).get(id);

      if (!plainte) {
        return interaction.reply({
          content: "❌ Cette affaire n'existe pas.",
          ephemeral: true
        });
      }

      if (plainte.statut === "Fermée") {
        return interaction.reply({
          content: "❌ Cette affaire est déjà fermée.",
          ephemeral: true
        });
      }

      if (interaction.commandName === "condamner") {
        const peine = interaction.options.getString("peine");

        db.prepare(`
          UPDATE plaintes
          SET statut = 'Coupable / Condamné',
              juge = ?,
              peine = ?,
              verdict_at = ?
          WHERE id = ?
        `).run(
          interaction.user.id,
          peine,
          new Date().toISOString(),
          id
        );

        return interaction.reply({
          content:
            `⚖️ **VERDICT DU TRIBUNAL**\n\n` +
            `📁 Affaire : **#${id}**\n` +
            `👤 Accusé : <@${plainte.accuse}>\n` +
            `👤 Plaignant : <@${plainte.plaignant}>\n\n` +
            `🔨 Verdict : **COUPABLE**\n\n` +
            `📜 Peine : ${peine}\n\n` +
            `⚖️ Jugement rendu par ${interaction.user}`
        });
      }

      const raison = interaction.options.getString("raison");

      db.prepare(`
        UPDATE plaintes
        SET statut = 'Acquitté',
            juge = ?,
            raison = ?,
            verdict_at = ?
        WHERE id = ?
      `).run(
        interaction.user.id,
        raison,
        new Date().toISOString(),
        id
      );

      return interaction.reply({
        content:
          `⚖️ **VERDICT DU TRIBUNAL**\n\n` +
          `📁 Affaire : **#${id}**\n` +
          `👤 Accusé : <@${plainte.accuse}>\n\n` +
          `✅ Verdict : **ACQUITTÉ**\n\n` +
          `📄 Raison : ${raison}\n\n` +
          `⚖️ Jugement rendu par ${interaction.user}`
      });
    }

    if (interaction.commandName === "verdict") {
      const id = interaction.options.getInteger("id");

      const plainte = db.prepare(
        "SELECT * FROM plaintes WHERE id = ?"
      ).get(id);

      if (!plainte) {
        return interaction.reply({
          content: "❌ Cette affaire n'existe pas.",
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
        texte += `\n🔨 Peine : ${plainte.peine}`;
      }

      if (plainte.raison) {
        texte += `\n📄 Raison : ${plainte.raison}`;
      }

      return interaction.reply({
        content: texte,
        ephemeral: true
      });
    }

    if (interaction.commandName === "fermer") {
      if (!estJuge(interaction.member)) {
        return interaction.reply({
          content: "❌ Cette commande est réservée au rôle **Juge**.",
          ephemeral: true
        });
      }

      const id = interaction.options.getInteger("id");

      const plainte = db.prepare(
        "SELECT * FROM plaintes WHERE id = ?"
      ).get(id);

      if (!plainte) {
        return interaction.reply({
          content: "❌ Cette affaire n'existe pas.",
          ephemeral: true
        });
      }

      db.prepare(`
        UPDATE plaintes
        SET statut = 'Fermée'
        WHERE id = ?
      `).run(id);

      return interaction.reply({
        content:
          `🔒 **AFFAIRE FERMÉE**\n\n` +
          `L'affaire **#${id}** est maintenant officiellement fermée.\n` +
          `⚖️ Fermée par ${interaction.user}`
      });
    }

    if (interaction.commandName === "aide") {
      return interaction.reply({
        content:
          `⚖️ **COMMANDES DU TRIBUNAL**\n\n` +
          `📋 \`/plainte\` — Déposer une plainte\n` +
          `📁 \`/plaintes\` — Voir les plaintes (Juge)\n` +
          `⚖️ \`/audience\` — Ouvrir une audience (Juge)\n` +
          `🔨 \`/condamner\` — Condamner un accusé (Juge)\n` +
          `✅ \`/acquitter\` — Acquitter un accusé (Juge)\n` +
          `📜 \`/verdict\` — Consulter un verdict\n` +
          `🔒 \`/fermer\` — Fermer une affaire (Juge)\n` +
          `❓ \`/aide\` — Afficher cette aide`,
        ephemeral: true
      });
    }

  } catch (error) {
    console.error(error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ Une erreur est survenue.",
        ephemeral: true
      });
    }
  }
});

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

client.login(TOKEN);
