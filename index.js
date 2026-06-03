const { 
    makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    delay,
    makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const ytSearch = require('yt-search');
const ytdl = require('ytdl-core-muxer');

const BOT_NAME = "ॐ𝐂𝐀𝐍𝐃𝐘°❤️𝆺꯭𝅥⎯‌꯭"; 
const OWNER_NAME = "P－Ｘᝰ..ᐟ.ᐟ";
const OWNER_NUMBER = "91XXXXXXXXXX@s.whatsapp.net"; 

const MENU_IMAGE_URL = "https://kommodo.ai/i/jk9yFOZNL7CrnoZYKVKr"; 
const CHANNEL_LINK = "https://whatsapp.com/channel/0029Vb7kF10HgZWjQhQape0M"; 

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('darko_session');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log(`🟢 ${BOT_NAME} Connected successfully!`);
        }
    });

    sock.ev.on('group-participants.update', async (anu) => {
        try {
            const metadata = await sock.groupMetadata(anu.id);
            const num = anu.participants[0]; 
            const userTag = `@${num.split('@')[0]}`;
            const author = anu.author; 

            if (anu.action === 'promote') {
                const isOwnerAction = author && author.includes(OWNER_NUMBER.split('@')[0]);
                if (!isOwnerAction && author) {
                    const authorTag = `@${author.split('@')[0]}`;
                    let warningText = `🚨 *SECURITY ALERT: ILLEGAL PROMOTION!* 🚨\n\n👤 Admin trying to promote: ${authorTag}\n👥 Targeted User: ${userTag}\n\n❌ *${BOT_NAME} Strict Mode:* Only Owner can promote users. Both are being demoted!`;
                    await sock.sendMessage(anu.id, { text: warningText, mentions: [author, num] });
                    await sock.groupParticipantsUpdate(anu.id, [num], "demote");
                    await delay(1000); 
                    await sock.groupParticipantsUpdate(anu.id, [author], "demote");
                    return;
                }
                if (isOwnerAction) {
                    await sock.sendMessage(anu.id, { text: `✨ *CONGRATULATIONS!* ✨\n\n👑 ${userTag} is now an Admin of this group.`, mentions: [num] });
                }
            }
            
            if (anu.action === 'add') {
                let welcomeText = `✨ *WELCOME TO OUR GROUP!* ✨\n\n📝 *Group:* ${metadata.subject}\n👤 *Member:* ${userTag}\n\nHope you have a great time here! Follow the rules.\n\n⚡ Powered by *${BOT_NAME}*`;
                await sock.sendMessage(anu.id, { image: { url: MENU_IMAGE_URL }, caption: welcomeText, mentions: [num] });
            }
            
            if (anu.action === 'remove') {
                let goodbyeText = `🍂 *GOODBYE!* 🍂\n\n👤 ${userTag} left the group or was removed.\n\nWe wish you a good future ahead!`;
                await sock.sendMessage(anu.id, { image: { url: MENU_IMAGE_URL }, caption: goodbyeText, mentions: [num] });
            }
        } catch (err) {
            console.log(err);
        }
    });

    sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message) return;
            
            const type = Object.keys(mek.message)[0];
            const from = mek.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            
            const pushName = mek.pushName || 'WhatsApp User';
            const sender = mek.key.participant || mek.key.remoteJid;
            const isOwner = sender.includes(OWNER_NUMBER.split('@')[0]);

            const body = (type === 'conversation') ? mek.message.conversation : 
                         (type === 'extendedTextMessage') ? mek.message.extendedTextMessage.text : '';
            
            if (isGroup && body.match(/(https:\/\/|http:\/\/|www\.|chat.whatsapp.com)/gi)) {
                const groupMetadata = await sock.groupMetadata(from);
                const participants = groupMetadata.participants;
                const isBotAdmin = participants.find(p => p.id === sock.user.id.split(':')[0] + '@s.whatsapp.net')?.admin;
                const isSenderAdmin = participants.find(p => p.id === sender)?.admin;

                if (!isSenderAdmin && !isOwner && isBotAdmin) {
                    await sock.sendMessage(from, { delete: mek.key });
                    await sock.sendMessage(from, { text: `⚠️ *@${sender.split('@')[0]}*, links are strictly prohibited in this group! Your message has been deleted.`, mentions: [sender] });
                }
            }

            if (!body.startsWith('!')) return; 
            const command = body.slice(1).trim().split(/ +/).shift().toLowerCase();
            const args = body.trim().split(/ +/).slice(1);

            if (command === 'join') {
                const targetNumber = args[0];
                if (!targetNumber || isNaN(targetNumber)) {
                    return sock.sendMessage(from, { text: `❌ *Invalid Format!* \n\nUse: !join 91XXXXXXXXXX` });
                }

                await sock.sendMessage(from, { text: `⏳ *${BOT_NAME} System:* Processing number (${targetNumber})... Please wait for your pairing code.` });

                try {
                    let tempSock = makeWASocket({
                        auth: (await useMultiFileAuthState('temp_session_' + targetNumber)).state,
                        logger: pino({ level: 'silent' }),
                        browser: ["Ubuntu", "Chrome", "20.0.04"]
                    });

                    await delay(3000);
                    const pairingCode = await tempSock.requestPairingCode(targetNumber.trim());
                    
                    let successText = `🎉 *${BOT_NAME} LINK CODE READY!* 🎉\n\n👤 *User:* @${targetNumber}\n🔑 *Code:* \`${pairingCode}\`\n\n👉 Copy this code. Go to WhatsApp -> Linked Devices -> Link with phone number and enter it!`;
                    await sock.sendMessage(from, { text: successText, mentions: [targetNumber + '@s.whatsapp.net'] });
                } catch (err) {
                    await sock.sendMessage(from, { text: `❌ Failed to generate pairing code.` });
                }
            }

            if (!isGroup) return; 

            if (command === 'menu' || command === 'help') {
                let menuText = `⚡ *🔥 ${BOT_NAME} MAIN MENU 🔥* ⚡\n\n👑 *Owner:* ${OWNER_NAME}\n👤 *User:* ${pushName}\n────────────────────\n\n🔑 *BOT LINK COMMAND:* \n» \`!join [number]\` - Link bot without QR code.\n\n🎵 *MUSIC COMMANDS:* \n» \`!play [song name]\` - Play audio from YouTube.\n\n🛡️ *GROUP MANAGEMENT:* \n» \`!tagall\` - Tag all group members.\n» \`!ping\` - Check bot response speed.\n────────────────────\n📢 *Official Channel:* ${CHANNEL_LINK}`;
                await sock.sendMessage(from, { image: { url: MENU_IMAGE_URL }, caption: menuText });
            }

            if (command === 'ping') {
                const start = new Date().getTime();
                const pmsg = await sock.sendMessage(from, { text: 'Testing speed...' });
                const end = new Date().getTime();
                await sock.sendMessage(from, { delete: pmsg.key }); 
                await sock.sendMessage(from, { text: `🚀 *${BOT_NAME} Speed:* ${end - start}ms\n🟢 Status: Online!` });
            }

            if (command === 'tagall') {
                const groupMetadata = await sock.groupMetadata(from);
                const participants = groupMetadata.participants;
                let mentions = [];
                let text = `📢 *${BOT_NAME} - TAG ALL* 📢\n💬 *Message:* ${args.join(' ') || 'No Message'}\n\n`;
                for (let participant of participants) {
                    text += `👥 @${participant.id.split('@')[0]}\n`;
                    mentions.push(participant.id);
                }
                await sock.sendMessage(from, { text: text, mentions: mentions });
            }

            if (command === 'play') {
                const songName = args.join(' ');
                if (!songName) return sock.sendMessage(from, { text: '❌ Please provide a song name.' });
                await sock.sendMessage(from, { text: `🎵 *${BOT_NAME}* is searching for your song...` });
                try {
                    const searchResult = await ytSearch(songName);
                    const video = searchResult.videos[0];
                    if (!video) return sock.sendMessage(from, { text: '❌ Song not found.' });
                    await sock.sendMessage(from, { text: `🎧 *Downloading:* "${video.title}"...` });
                    const stream = ytdl(video.url, { filter: 'audioonly', quality: 'highestaudio' });
                    await sock.sendMessage(from, { audio: { stream: stream }, mimetype: 'audio/mp4', fileName: `${video.title}.mp4` });
                } catch (e) {
                    await sock.sendMessage(from, { text: '❌ Download failed.' });
                }
            }

            if (command === 'makeadmin') {
                if (!isOwner) return sock.sendMessage(from, { text: `❌ Only Owner can use this command!` });
                let users = mek.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || mek.message.extendedTextMessage?.contextInfo?.participant;
                if (!users) return sock.sendMessage(from, { text: 'Please tag a user.' });
                await sock.groupParticipantsUpdate(from, [users], "promote");
            }

            if (command === 'removeadmin') {
                if (!isOwner) return sock.sendMessage(from, { text: `❌ Only Owner can use this command!` });
                let users = mek.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || mek.message.extendedTextMessage?.contextInfo?.participant;
                if (!users) return sock.sendMessage(from, { text: 'Please tag a user.' });
                await sock.groupParticipantsUpdate(from, [users], "demote");
            }

        } catch (err) {
            console.log(err);
        }
    });
}

startBot();
