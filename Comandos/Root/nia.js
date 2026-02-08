const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { registerPrefixCommand } = require('../../bot/commands/prefix/prefix-registry');

registerPrefixCommand('nia', async (msg, args) => {
    // 1. Creamos el Embed con toda tu info de las capturas
    const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle('Nia (Naiara Zhiyao) — Developer Profile')
        .setURL('https://github.com/lz20r')
        .setAuthor({ 
            name: 'MoxiBot Lead Developer', 
            iconURL: 'https://github.com/lz20r.png',
            url: 'https://github.com/lz20r'
        })
        .setDescription('✨ **Full Stack Developer** de 23 años de China con base en España.\nApasionada por la creación de bots, el diseño y el aprendizaje continuo.')
        .setThumbnail('https://github.com/lz20r.png')
        .addFields(
            { name: '🛠️ Stack Principal', value: '`PHP`, `JS/TS`, `Python`, `Java`', inline: true },
            { name: '🚀 Frameworks', value: '`React`, `Vue.js`, `Laravel`, `Tailwind`', inline: true },
            { name: '📦 Herramientas', value: '`Docker`, `Linux`, `After Effects`, `Figma`', inline: true },
            { name: '📊 GitHub Stats', value: '🏆 **1.5k** Contribuciones\n📂 **18** Repositorios\n⭐ **7** Estrellas', inline: false }
        )
        .setImage('https://github-readme-stats.vercel.app/api?username=lz20r&show_icons=true&theme=dark&hide_border=true') // Esto genera un gráfico de tus stats en tiempo real
        .setFooter({ text: 'Connect with me • lz20r', iconURL: msg.client.user.displayAvatarURL() })
        .setTimestamp();

    // 2. Creamos los botones interactivos
    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel('GitHub')
            .setURL('https://github.com/lz20r')
            .setStyle(ButtonStyle.Link),
        new ButtonBuilder()
            .setLabel('Instagram')
            .setURL('https://www.instagram.com/zhiyaolezameta20') // Basado en tu captura
            .setStyle(ButtonStyle.Link),
        new ButtonBuilder()
            .setLabel('Twitter')
            .setURL('https://x.com/nazhiida')
            .setStyle(ButtonStyle.Link),
        new ButtonBuilder()
            .setLabel('Sponsor')
            .setURL('https://github.com/sponsors/lz20r')
            .setStyle(ButtonStyle.Link)
    );

    await msg.reply({ embeds: [embed], components: [buttons] });
});